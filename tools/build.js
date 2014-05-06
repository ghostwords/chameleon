#!/usr/bin/env node

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
glob.sync('./src/js/*.js').forEach(function (inpath) {
	var infile = path.basename(inpath),
		outpath = './chrome/js/builds/' + infile,
		b = browserify(inpath)
			// precompile Underscore templates
			// TODO add error handling to https://github.com/zertosh/jstify
			.transform('jstify');

	// don't bundle vendor libs; they get bundled separately
	// and included manually via own script tags
	vendor_modules.forEach(function (module) {
		b = b.external(module);
	});

	// minify some files
	if (['./src/js/injected.js'].indexOf(inpath) != -1) {
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
