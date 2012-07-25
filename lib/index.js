
var path           = require('path');
var wrench         = require('wrench');
var events         = require('events');
var mongoose       = require('mongoose');

// Patch mongoose-types bug (#17 and #21)
// @link {https://github.com/bnoguchi/mongoose-types/}
var bson = require(__dirname + '/../node_modules/mongoose/node_modules/mongodb/node_modules/bson');
mongoose.mongo.BinaryParser = bson.BinaryParser;
	
var mongooseTypes  = require('mongoose-types');

exports.init = function(conf) {
	var connection = mongoose.createConnection(conf.url);
	
	// Load extra types
	if (conf.types) {
		conf.types.forEach(function(type) {
			switch (type) {
				// These comes with mongoose-types
				case 'url':
				case 'email':
					mongooseTypes.loadTypes(mongoose, type);
				break;
				// Anything else is assumed to be from us
				default:
					require('./types/' + type).load(mongoose);
				break;
			}
		});
	}


	// Find all of the models (This does not load models,
	// simply creates a registry with all of the file paths)
	var models = { };
	wrench.readdirSyncRecursive(conf.modelPath).forEach(function(file) {
		if (file[0] === '.') {return;}
		file = file.split('.');
		if (file.length > 1 && file.pop() === 'js') {
			file = file.join('.');
			file = path.join(conf.modelPath, file);
			models[path.basename(file)] = file;
		}
	});
	
	// Load a model
	exports.require = function(model) {
		if (typeof models[model] === 'string') {
			require(models[model]);
		}
		return models[model];
	};
	
	var oid = mongoose.SchemaTypes.ObjectId;
	
	// Handles circular references
	var circles = new events.EventEmitter();
	
	// Creates a new model
	exports.create = function(name, props) {
		props = props || { };
		
		// Check for a scheme definition
		if (props.schema) {
			// Look for circular references
			Object.keys(props.schema).forEach(function(key) {
				var def = props.schema[key];
				if (typeof def === 'object' && def.type === oid) {
					// Shortcut simple circular reference to self
					if (def.ref === '$circular') {
						def.ref = { $circular: model };
					}
					// Handle circular references
					if (typeof def.ref === 'object' && def.ref && def.ref.$circular) {
						var model = def.ref.$circular;
						// First, check if the model is already loaded
						if (models[model]) {
							props.schema[key].ref = models[model];
						}
						// Otherwise, wait and resolve it later
						else {
							circles.once(model, function(model) {
								props.schema.add({
									key: { type: oid, ref: model.schema }
								});
							});
							delete props.schema[key];
						}
					}
				}
			});
			// Create the schema
			props.schema = new mongoose.Schema(props.schema);
		}
		
		// Check if we are loading the timestamps plugin
		if (props.useTimestamps) {
			props.schema.plugin(mongooseTypes.useTimestamps);
		}
		
		// Bind any instance methods to the schema.methods object
		if (props.methods) {
			Object.keys(props.methods).forEach(function(i) {
				props.schema.methods[i] = props.methods[i];
			});
		}
		
		// Create the mongoose model
		var model = connection.model(name, props.schema);
		
		// Copy over all other properties as static model properties
		Object.keys(props).forEach(function(i) {
			if (i !== 'schema' && i !== 'useTimestamps' && i !== 'methods') {
				model[i] = props[i];
			}
		});
		
		// Store the model
		models[name] = model;
		
		// The model is done being built, allow circular reference to resolve
		circles.emit(name, model);
	
		return model;
	};
	
	// Expose mongoose and mongoose's types
	exports.mongoose  = mongoose;
	exports.types     = mongoose.SchemaTypes;
	
	// Don't allow re-init
	exports.init = undefined;
};

