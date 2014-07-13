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

var fs = require('fs'),
	glob = require('glob'),
	path = require('path');

var args = require('yargs').default({
	watch: false
}).argv;

var browserify = require(args.watch ? 'watchify' : 'browserify');

function bundle(b, outpath) {
	console.log("Writing out %s ...", outpath);

	// TODO check out source maps with bundle({ debug: true })
	var outStream = b.bundle();

	outStream.on('error', function (e) {
		console.error(String(e));
	});

	outStream.pipe(fs.createWriteStream(outpath));
}

var vendor_modules = [];

// vendor JS bundles
glob.sync('./src/lib/vendor/*.js').forEach(function (inpath) {
	var infile = path.basename(inpath),
		outpath = './chrome/js/builds/vendor/' + infile,
		// strip filename version info from module name
		module_name = infile.replace(/-[\d\.]+\.js$/, '');

	vendor_modules.push(module_name);

	// need to use b.require when bundling vendor libs to make these libs
	// available via require calls in other bundles
	bundle(browserify().require(inpath, {
		expose: module_name
	}), outpath);
});

// extension JS bundles
// TODO allow requiring all modules used by background/panel pages in browser
// TODO dev tools: https://github.com/substack/node-browserify/issues/533
glob.sync('./src/js/*.+(js|jsx)').forEach(function (inpath) {
	var infile = path.basename(inpath),
		outpath = './chrome/js/builds/' + infile.replace(/\.jsx$/, '.js'),
		b = browserify(inpath)
			// compile JSX
			.transform('reactify');

	// don't bundle vendor libs; they get bundled separately
	// and included manually via own script tags
	vendor_modules.forEach(function (module) {
		b = b.external(module);
	});

	// minify some files
	var minify = [
		'./src/js/inject.js',
		'./src/js/injected.js'
	];
	if (minify.indexOf(inpath) != -1) {
		b = b.transform('uglifyify');
		outpath = outpath.replace(/\.js$/, '.min.js');
	}

	bundle(b, outpath);

	if (args.watch) {
		b.on('update', function (/*ids*/) {
			bundle(b, outpath);
		});
	}
});
