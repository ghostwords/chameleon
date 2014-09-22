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
	mkdirp = require('mkdirp'),
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

// TODO move elsewhere
var conf = {
	// js/jsx source (entry) files location
	indir: 'src/js',
	// minify all / some ((array of) directory name(s)) / no bundles
	minify: ['injected'],
	// output bundles go here
	outdir: 'chrome/js/builds'
};

var subdirs = ['.'].concat(fs.readdirSync(conf.indir).filter(function (file) {
	return fs.statSync(path.resolve(conf.indir, file)).isDirectory();
}));

subdirs.forEach(function (subdir) {

	var minify = false;
	if (conf.minify === true ||
		conf.minify === subdir ||
		(_.isArray(conf.minify) && conf.minify.indexOf(subdir) != -1)
	) {
		minify = true;
	}

	var inpaths = glob.sync(
		path.resolve(conf.indir, subdir) + '/*.+(js|jsx)'
	).map(function (inpath) {
		return path.resolve(inpath);
	});

	var outdir = path.resolve(conf.outdir, subdir);
	if (!fs.existsSync(outdir)) {
		mkdirp.sync(outdir);
	}

	var outpaths = inpaths.map(function (inpath) {
		var outpath = path.resolve(
			outdir,
			path.basename(inpath.replace(/\.jsx$/, '.js'))
		);

		if (minify) {
			outpath = outpath.replace(/\.js$/, '.min.js');
		}

		return outpath;
	});

	var common_bundle_outpath = path.resolve(outdir, 'common.js');

	// TODO check out source maps with browserify({ debug: true })
	// TODO speed up bundling with noparse
	var browserify_opts = {
		entries: inpaths
	};

	if (args.watch) {
		browserify_opts = _.extend(browserify_opts, watchify.args);
		// TODO https://github.com/substack/watchify/issues/78
		browserify_opts.fullPaths = false;
	}

	// TODO allow requiring all modules used by background/panel pages in browser
	// TODO dev tools: https://github.com/substack/node-browserify/issues/533
	var b = browserify(browserify_opts);

	if (args.watch) {
		b = watchify(b);
	}

	// compile JSX
	b = b.transform('reactify');

	// factor out common modules
	b = b.plugin('factor-bundle', {
		// TODO https://github.com/substack/factor-bundle/issues/29#issuecomment-56258515
		entries: inpaths,
		o: outpaths
	});

	if (minify) {
		b = b.transform('envify').transform('uglifyify');
	}

	bundle(b, common_bundle_outpath);

	if (args.watch) {
		b.on('update', function (/*ids*/) {
			bundle(b, common_bundle_outpath);
		});
	}

});
