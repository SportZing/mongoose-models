
var path           = require('path');
var wrench         = require('wrench');
var mongoose       = require('mongoose');
var mongooseTypes  = require('mongoose-types');

exports.init = function(conf) {
	var connection = mongoose.createConnection(conf.url);

	// Patch mongoose-types bug (#17 and #21)
	// @link {https://github.com/bnoguchi/mongoose-types/}
	var bson = require(__dirname + '/../node_modules/mongoose/node_modules/mongodb/node_modules/bson');
	mongoose.mongo.BinaryParser = bson.BinaryParser;
	
	// Load extra types
	if (conf.types) {
		conf.types.forEach(function(type) {
			switch (type) {
				// These comes with mongoose-types
				case 'Url':
				case 'Email':
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
			file = path.join(modelPath, file);
			models[path.basename(file)] = file;
		}
	});
	
	// Load a model
	exports.require = function(model) {
		if (typeof models[model] === 'string') {
			models[model] = require(models[model]);
		}
		return models[model];
	};
	
	// Creates a new model
	exports.create = function(model, props) {
		props = props || { };
		
		// Check for a scheme definition
		if (props.schema) {
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
		var model = connection.model(model, props.schema);
		
		// Copy over all other properties as static model properties
		Object.keys(props).forEach(function(i) {
			if (i !== 'schema' && i !== 'useTimestamps' && i !== 'methods') {
				model[i] = props[i];
			}
		});
	
		return model;
	};
	
	// Expose mongoose and mongoose's types
	exports.mongoose  = mongoose;
	exports.types     = mongoose.SchemaTypes;
	
	// Don't allow re-init
	exports.init = undefined;
};

