#!/usr/bin/env node

/*
  
  This is a debugging REPL with access to the mongoose models (but not much else)
  
  Usage:
    $ ./_models.js
    Loading REPL...
    > models.require('Foo');
    undefined
    > Foo.find({ }, store('foos'));
    { ... }
    > 
    Stored 2 arguments in "foos"
    > print(foos);
    { ... }
  
*/

var path    = require('path');
var util    = require('util');
var colors  = require('colors');

// CONFIG
var conf = {
	url: '',
	types: [ 'email', 'url', 'uuid' ],
	modelPath: path.join(__dirname, 'models')
};

// Check for a color disable flag
if (process.env.DISABLE_COLORS) {
	colors.mode = 'none';
}

// Welcome message
console.log('Loading REPL...'.grey);

// Determine some config global
global.REPL_PROMPT = process.env.REPL_PROMPT || '> ';
global.INSPECT_DEPTH = Number(process.env.INSPECT_DEPTH);
if (isNaN(global.INSPECT_DEPTH)) {
	global.INSPECT_DEPTH = 2;
}

// Load mongoose models
var models = global.models = require('mongoose-models');
models.init(conf);

// Patch models.require to store in global automatically
models._require = models.require;
models.require = function(model) {
	global[model] = models._require(model);
};

// Define the print function
var print = global.print = function() {
	console.log.apply(console, arguments);
	process.stdout.write(global.REPL_PROMPT);
};

// Define the store function
var store = global.store = function(name) {
	return function() {
		var args = arguments;
		process.nextTick(function() {
			global[name] = args;
			print(('\nStored ' + args.length + ' arguments to "' + name + '"').green.italic);
			process.stdout.write(buffer);
		});
	};
};

// Enable stdin
process.stdin.resume();
process.stdin.setEncoding('utf8');

// Build a buffer so we can reprint any given input when we
// have to interupt the user
var buffer = '';
process.stdin.on('keypress', function(ch) {
	buffer += ch;
});

// Eval stage
process.stdin.on('data', function (data) {
	buffer = '';
	print(util.inspect(eval(data), true, global.INSPECT_DEPTH, ! process.env.DISABLE_COLORS));
});

// Allow exiting on ctrl+c
process.on('SIGINT', function() {
	console.log('\nGood Bye.'.grey)
	process.exit();
});

// Print errors in red
process.on('uncaughtException', function(err) {
	if (typeof err === 'object' && err && err.stack) {
		err = err.stack;
	}
	print(err.red);
});

// Start...
process.stdout.write(global.REPL_PROMPT);

/* End of file _models.js */
