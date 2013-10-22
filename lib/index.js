
var path      = require('path');
var wrench    = require('wrench');
var events    = require('events');
var mongoose  = require('mongoose');

// Patch mongoose-types bug (#17 and #21)
// @link {https://github.com/bnoguchi/mongoose-types/}
var bson = require(__dirname + '/../node_modules/mongoose/node_modules/mongodb/node_modules/bson');
mongoose.mongo.BinaryParser = bson.BinaryParser;
	
var mongooseTypes= require('mongoose-types'),
	keywordize= require('mongoose-keywordize');
	
exports.init = function(conf) {

console.log('mongoose version: %s', mongoose.version);

	mongoose.set('debug', conf.debug || false);

	var connection = mongoose.createConnection(conf.url);

	// Add AMQP stuff to enable models messaging if provided else defaults to console...
	var amqpClient= conf.clients.amqp;
	if (!amqpClient){
		amqpClient= {
			sendMessage: function(routing_key, payload){
				var encoded_payload = JSON.stringify(payload);
				console.log('__NO_AMQP_TRANSPORT_DEFINED__%s!%s', routing_key, payload);
			}
		};
	}
	
	// Add MAIL stuff to enable email notifications...
	var mailClient= conf.clients.mail;
	if (!mailClient){
		mailClient= {
			sendMailMessage: function(emailFrom, emailTo, subject, tplName, tplVars, cb){				
				console.log('__NO_MAIL_TRANSPORT_DEFINED__%s!%s', emailFrom, emailTo);
				cb(null,'__NO_MAIL_TRANSPORT_DEFINED__');
			}
		};
	}
	
	// Add mongoose transport to the logging system if needed...
	var auditLog= conf.logger;
	if (auditLog){
		auditLog.addTransport("mongoose", {connectionString: conf.url, collectionName: 'audit.logs'});
	}

	var virtuals = { };
	exports.installVirtuals = function(type, builder) {
		virtuals[type._mmId] = builder;
	};
	
	// Load extra types
	if (conf.types) {
		conf.types.forEach(function(type) {
			// These comes with mongoose-types
			if (type === 'url' || type === 'email') {
				mongooseTypes.loadTypes(mongoose, type);
			}
			// If it starts with a dot or slash, assume its a file path
			else if (type[0] === '.' || type[1] === '/') {
				require('type').load(mongoose, exports);
			}
			// Anything else is assumed to be from us
			else {
				require('./types/' + type).load(mongoose, exports);
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
			var model = path.basename(file);
			models[model] = function() {
				return models[model].model;
			};
			models[model].path = file;
			models[model].model = null;
			models[model].schema = new mongoose.Schema();
			models[model].resolve = function(func) {
				circles.once(model, func);
				return models[model].getter;
			};
		}
	});
	
	// Load a model
	exports.require = function(model) {
		if (! models[model].model) {
			require(models[model].path);
		}
		return models[model];
	};
	
	var oid = mongoose.SchemaTypes.ObjectId;
	
	// Handles circular references
	var circles = new events.EventEmitter();
	
	// Creates a new model
	exports.create = function(name, props) {
		props = props || { };
		
		var _virtuals = { };

		// Check for a scheme definition
		if (props.schema) {
			// Look for circular references
			Object.keys(props.schema).forEach(function(key) {
				var def = props.schema[key];
				if (typeof def === 'object' && def.type === oid) {
					// Shortcut simple circular reference to self
					if (def.ref === '$circular') {
						def.ref = { $circular: name };
					}
					// Handle circular references
					if (typeof def.ref === 'object' && def.ref && def.ref.$circular) {
						var model = def.ref.$circular;
						// First, check if the model is already loaded
						if (models[model] && typeof models[model] === 'object') {												
							props.schema[key].ref = models[model].schema;
						}
						// Otherwise, wait and resolve it later
						else {						
							circles.once(model, function(model) {
								def.ref = model.schema;
								var update = { };
								update[key] = def;
								props.schema.add(update);
							});
							delete props.schema[key];
						}
					}
				}
				// Handle automatic virtuals for custom types
				var type = def;
				if (typeof def === 'object') {
					type = def.type;
				}
				if (typeof type === 'function' && type._mmId) {
					var funcs = virtuals[type._mmId](key);
					Object.keys(funcs).forEach(function(virtual) {
						if (virtual[0] === '.') {
							virtual = key + virtual;
						}
						_virtuals[virtual] = funcs[virtual];
					});
				}
			});
			// Create the schema
			props.schema = new mongoose.Schema(props.schema);
			// Bind automatic virtuals
			Object.keys(_virtuals).forEach(function(virtual) {
				var funcs = _virtuals[virtual];
				props.schema.virtual(virtual)
					.get(funcs.get || function() { })
					.set(funcs.set || function() { });
			})
		}
		
		// Check if we are loading the timestamps plugin
		if (props.useTimestamps) {
			props.schema.plugin(mongooseTypes.useTimestamps);
		}
		
		// Check if we are loading the keywordiez plugin
		if (props.useKeyword && typeof props.useKeyword === 'object') {
			props.schema.plugin(keywordize, props.useKeyword);
		}

		// Check if we are loading the audit-log plugin
		if (auditLog && props.useAudit && typeof props.useAudit === 'object') {

			var pluginFn = auditLog.getPlugin('mongoose', props.useAudit); // setup occurs here
			props.schema.plugin(pluginFn.handler); // .handler is the pluggable function for mongoose in this case
		}
		
		// Bind any instance methods to the schema.methods object
		if (props.methods) {
			Object.keys(props.methods).forEach(function(i) {
				props.schema.methods[i] = props.methods[i];
			});
		}
		
		mongoose.Model.paginate = function(q, skipFrom, resultsPerPage, sortCols, selCols, callback){
			var MyModel = this, 
			query, 
			pageCount= 0,
			callback = callback || function(){};
			
			if (skipFrom>0) {
				query = MyModel.find(q).skip(skipFrom).limit(resultsPerPage).sort(sortCols).select(selCols);
			}
			else {
				query = MyModel.find(q).limit(resultsPerPage).sort(sortCols).select(selCols);
			}
			
		  query.exec(function(error, results) {
			if (error) {
			  callback(error, null, null);
			} else {
			  MyModel.count(q, function(error, count) {
				if (error) {
				  callback(error, null, null);
				} else {
				  pageCount = Math.floor(count / resultsPerPage);
				  callback(null, count, results);
				}
			  });
			}
		  });
		}
		
		// Create the mongoose model
		var model = connection.model(name, props.schema, props.collection);
				
		// Copy over all other properties as static model properties
		Object.keys(props).forEach(function(i) {
			if (i !== 'schema' && i !== 'collection' && i !== 'useTimestamps' && i !== 'useKeyword' && i !== 'useAudit' && i !== 'methods') {
				model[i] = props[i];
			}
		});
				
		// Store the model
		models[name].model = model;
		
		// The model is done being built, allow circular reference to resolve
		circles.emit(name, model);
	
		return model;
	};
	
	// Expose mongoose and mongoose's types
	exports.mongoose 	= mongoose;	
	exports.types 		= mongoose.SchemaTypes;

	//Expose specific clients in models world...
	exports.amqpClient= amqpClient;
	exports.mailClient= mailClient;
	
	// Don't allow re-init
	exports.init = undefined;
};