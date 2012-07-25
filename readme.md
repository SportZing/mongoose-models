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
	types: [ 'email', 'url', 'uuid' ],
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

### Circular References

Circular references are rather messy in Mongoose. To make this much easier there is built-in support for circular references in mongoose-models. For example, say you have two models:

##### Foo.js

```javascript
var models = require('mongoose-models');

var Bar = models.require('Bar');

models.create('Foo', {
	schema: {
		bar: { type: models.types.ObjectId, ref: Bar }
	}
});
```

##### Bar.js

```javascript
var models = require('mongoose-models');

var Foo = models.require('Foo');

models.create('Bar', {
	schema: {
		foo: { type: models.types.ObjectId, ref: Foo }
	}
});
```

This doesn't work because the models are trying to reference each other before they have been created. To make this work, we change the `ref` value like so in both files:

```javascript
{
	bar: { type: models.types.ObjectId, ref: {$circular: 'Bar'} }
}
```

```javascript
{
	foo: { type: models.types.ObjectId, ref: {$circular: 'Foo'} }
}
```

Now everything works as expected. There is also a shorter version of this if a model needs to reference itself recursively.

```javascript
var models = require('mongoose-models');

models.create('Baz', {
	schema: {
		child: { type: models.types.ObjectId, ref: '$circular' }
	}
});
```

### Debugging REPL

The REPL is a simple JavaScript interpreter with access to your mongoose-models. Before using the REPL, it will need to be loaded and configured.

```bash
$ cp ./node_modules/mongoose-models/bin/repl.js ./repl.js
```

Now, open up `repl.js` and change the values in `conf` to match your configuration settings. You can start the REPL by running:

```bash
$ node repl.js
```

The REPL comes with some helpful features on top of the standard node REPL. First, mongoose-models is already loaded for you and is available as `models`. Second, `models.require` has been patched to automatically store loaded models in `global`. There are also some useful functions defined.

```javascript
Loading REPL...
> models.require('Foo');
undefined
> Foo.find({ }, store('foos'));
{ ... }
> 
Stored 2 arguments in "foos"
> print(foos);
{
  '1': ...
  '2': ...
  ...
}
```

