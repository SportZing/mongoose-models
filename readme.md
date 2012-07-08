# mongoose-models

An extension of Mongoose's models

## Install

```bash
$ npm install mongoose-models
```

## Init

```javascript
require('mongoose-models').init({
	url: 'mongodb://localhost/dbname',
	modelPath: '/path/to/models/dir'
});
```

## Usage

##### models/Person.js

```javascript
var models = require('mongoose-models');

var Person = models.create('Person', {
	
	// If this is given and truthy, the mongoose-types timestamps
	// plugin will be loaded for this model creating automatically
	// updating 'createdAt' and 'updatedAt' properties
	useTimestamps: true,
	
	// Define your mongoose schema here
	schema: {
		firstName: String,
		lastName: String,
		
		// Special types like Email, Url, and ObjectId can be accessed
		// through the models.types object
		email: models.types.Email,
		website: models.types.Url
	},
	
	// Instance methods can be defined here, eg.
	//  
	//  Person.findOne({ firstName: 'bob' }, function(err, bob) {
	//    bob.sendEmail(...);
	//  });
	//
	methods: {
		
		sendEmail: function(subject, msg) {
			someMailingLib.sendEmail(this.email, subject, msg);
		}
		
	},
	
	// Anything other than the above properties is considered a static
	// properties and stored directly on the model, eg.
	//
	//  Person.findByName('bob', function(err, bob) {
	//    ...
	//  });
	//
	findByName: function(name, callback) {
		name = name.split(' ');
		var lookup = { firstName: name[0] };
		if (name.length > 1) {
			lookup.lastName = name.pop();
		}
		Person.findOne(lookup, callback);
	}
	
});
```

##### some-other-file.js

```javascript
var models = require('mongoose-models');

var Person = models.require('Person');

Person.findByName('bob', function(err, bob) {
	
});
```
















