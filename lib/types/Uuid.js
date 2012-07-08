
var uuid = require('uuid-v4');

exports.load = function(mongoose) {
	
	function Uuid(path, options) {
		mongoose.SchemaTypes.String.call(this, path, options);
		this.validate(uuid.isUUID, 'UUID is invalid');
	}
	Uuid.prototype.__proto__ = mongoose.SchemaTypes.String.prototype;
	Uuid.prototype.cast = function(value) {
		return value.toLowerCase();
	};
	
	mongoose.SchemaTypes.Uuid = Uuid;
	mongoose.Types.Uuid = String;
	
};

