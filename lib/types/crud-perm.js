
exports.load = function(mongoose, models) {

	function CrudPermission(path, options) {
		mongoose.SchemaTypes.String.call(this, path, options);
		this.validate(isPermissionBits, 'Permission value is invalid');
	}

	CrudPermission.prototype.__proto__ = mongoose.SchemaTypes.String.prototype;
	CrudPermission.prototype.cast = function(value) {
		return value;
	}

	mongoose.SchemaTypes.CrudPermission = CrudPermission;
	mongoose.Types.CrudPermission = String;

	var isBits = /^[01]+$/;
	function isPermissionBits(str) {
		return (typeof str === 'string' && isBits.test(str) && str.length === 4);
	}

	CrudPermission._mmId = 'CrudPermission';
	models.installVirtuals(CrudPermission, function(path) {
		'.create': {
			get: function() {
				return (this[path][0] === '1');
			},
			set: function(value) {
				this[path][0] = value ? '1' : '0';
			}
		},
		'.read': {
			get: function() {
				return (this[path][1] === '1');
			},
			set: function(value) {
				this[path][1] = value ? '1' : '0';
			}
		},
		'.update': {
			get: function() {
				return (this[path][2] === '1');
			},
			set: function(value) {
				this[path][2] = value ? '1' : '0';
			}
		},
		'.destroy': {
			get: function() {
				return (this[path][3] === '1');
			},
			set: function(value) {
				this[path][3] = value ? '1' : '0';
			}
		}
	});

};
