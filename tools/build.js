#!/usr/bin/env node

/*!
 * Chameleon
 *
 * Copyright 2014 ghostwords.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

var _ = require('underscore'),
	browserify = require('browserify'),
	fs = require('fs'),
	glob = require('glob'),
	path = require('path'),
	watchify = require('watchify');

var args = require('yargs').default({
	watch: false
}).argv;

// default to development
if (!process.env.hasOwnProperty('NODE_ENV')) {
	process.env.NODE_ENV = 'development';
}

function bundle(b, outpath) {
	console.log("Writing out %s ...", outpath);

	var outStream = b.bundle();

	outStream.on('error', function (e) {
		console.error(String(e));
	});

	outStream.pipe(fs.createWriteStream(outpath));
}

// extension JS bundles
//
// TODO look into https://github.com/substack/factor-bundle
//
// TODO allow requiring all modules used by background/panel pages in browser
// TODO dev tools: https://github.com/substack/node-browserify/issues/533
glob.sync('./src/js/*.+(js|jsx)').forEach(function (inpath) {
	var infile = path.basename(inpath),
		outpath = './chrome/js/builds/' + infile.replace(/\.jsx$/, '.js'),
		// TODO check out source maps with browserify({ debug: true })
		// TODO speed up bundling with noparse
		opts = {};

	if (args.watch) {
		opts = _.extend(opts, watchify.args);
		// TODO https://github.com/substack/watchify/issues/78
		opts.fullPaths = false;
	}

	var b = browserify(inpath, opts);

	if (args.watch) {
		b = watchify(b);
	}

	// compile JSX
	b = b.transform('reactify');

	// minify some files
	var minify = [
		'./src/js/inject.js',
		'./src/js/injected.js'
	];
	if (minify.indexOf(inpath) != -1) {
		b = b.transform('envify').transform('uglifyify');
		outpath = outpath.replace(/\.js$/, '.min.js');
	}

	bundle(b, outpath);

	if (args.watch) {
		b.on('update', function (/*ids*/) {
			bundle(b, outpath);
		});
	}
});
