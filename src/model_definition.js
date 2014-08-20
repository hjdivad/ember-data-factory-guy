/**
 A ModelDefinition encapsulates a model's definition

 @param model
 @param config
 @constructor
 */
ModelDefinition = function (model, config) {
  var sequences = {};
  var traits = {};
  var eventsByTrait = {};
  var defaultAttributes = {};
  var namedModels = {};
  var modelId = 1;
  this.model = model;

  /**
   @param {String} name model name like 'user' or named type like 'admin'
   @returns {Boolean} true if name is this definitions model or this definition
   contains a named model with that name
   */
  this.matchesName = function (name) {
    return model == name || namedModels[name];
  }

  // TODO
  this.merge = function (config) {
  }

  /**
   Call the next method on the named sequence function. If the name
   is a function, create the sequence with that function

   @param   {String} name previously declared sequence name or
            an the random name generate for inline functions
   @param   {Function} sequenceFn optional function to use as sequence
   @returns {String} output of sequence function
   */
  this.generate = function (name, sequenceFn) {
    if (sequenceFn) {
      if (!sequences[name]) {
        // create and add that sequence function on the fly
        sequences[name] = new Sequence(sequenceFn);
      }
    }
    var sequence = sequences[name];
    if (!sequence) {
      throw new MissingSequenceError("Can not find that sequence named [" + sequenceName + "] in '" + model + "' definition")
    }
    return sequence.next();
  }

  var runEvent = function(eventName, fixture, traitArgs) {
    ['default'].concat(traitArgs).forEach(function (trait) {
      var traitEvents = eventsByTrait[trait] || {}
      var handler = traitEvents[eventName]

      if (handler) {
        handler.call(null, fixture)
      }
    })
  }

  /**
   Build a fixture by name

   @param {String} name fixture name
   @param {Object} opts attributes to override
   @param {String} traitArgs array of traits
   @returns {Object} json
   */
  this.build = function (name, opts, traitArgs) {
    var traitsObj = {}
    traitArgs.forEach(function(trait) {
      $.extend(traitsObj, traits[trait]);
    })
    var modelAttributes = namedModels[name] || {};
    // merge default, modelAttributes, traits and opts to get the rough fixture
    var fixture = $.extend({}, defaultAttributes, modelAttributes, traitsObj, opts);
    // deal with attributes that are functions or objects
    for (attribute in fixture) {
      if (Ember.typeOf(fixture[attribute]) == 'function') {
        // function might be a sequence of a named association
        fixture[attribute] = fixture[attribute].call(this, fixture);
      } else if (Ember.typeOf(fixture[attribute]) == 'object') {
        // if it's an object it's for a model association, so build the json
        // for the association and replace the attribute with that json
        fixture[attribute] = FactoryGuy.build(attribute, fixture[attribute])
      }
    }
    // set the id, unless it was already set in opts
    if (!fixture.id) {
      fixture.id = modelId++;
    }
    runEvent('after-build', fixture, [name].concat(traitArgs))
    return fixture;
  }

  /**
   Build a list of fixtures

   @param {String} name model name or named model type
   @param {Integer} number of fixtures to build
   @param {Array} array of traits to build with
   @param {Object} opts attribute options
   @returns array of fixtures
   */
  this.buildList = function (name, number, traits, opts) {
    var arr = [];
    for (var i = 0; i < number; i++) {
      arr.push(this.build(name, opts, traits));
    }
    return arr;
  }

  // Set the modelId back to 1, and reset the sequences
  this.reset = function () {
    modelId = 1;
    for (name in sequences) {
      sequences[name].reset();
    }
  }

  var parseDefault = function (object) {
    if (!object) {
      return
    }
    defaultAttributes = object;
  }

  var parseTraits = function (object) {
    if (!object) {
      return
    }
    traits = object;
  }

  var parseSequences = function (object) {
    if (!object) {
      return
    }
    for (sequenceName in object) {
      var sequenceFn = object[sequenceName];
      if (Ember.typeOf(sequenceFn) != 'function') {
        throw new Error('Problem with [' + sequenceName + '] sequence definition. Sequences must be functions')
      }
      object[sequenceName] = new Sequence(sequenceFn);
    }
    sequences = object;
  }

  var parseEventHandlers = function (object) {
    if (!object) {
      return
    }

    for (var trait in object) {
      if (!object.hasOwnProperty(trait)) { continue; }

      eventsByTrait[trait] = parseTraitEventHandlers(object[trait])
    }
  }

  var parseTraitEventHandlers = function (object) {
    for (var eventName in object) {
      if (!object.hasOwnProperty(eventName)) { continue; }

      var eventHandler = object[eventName]

      if (Ember.typeOf(eventHandler) != 'function') {
        throw new Error('Problem with [' + eventName + '] event handler. Handlers must be functions')
      }
    }

    return object
  }

  var parseConfig = function (config) {
    parseSequences(config.sequences);
    delete config.sequences;

    parseTraits(config.traits);
    delete config.traits;

    parseEventHandlers(config.events);
    delete config.events;

    parseDefault(config.default);
    delete config.default;

    namedModels = config;
  }

  // initialize
  parseConfig(config);
}
