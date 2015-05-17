#!/usr/bin/env node

/*!
 * Chameleon
 *
 * Copyright 2015 ghostwords.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

var fs = require('fs'),
	glob = require('glob'),
	path = require('path'),
	webpack = require('webpack');

var args = require('yargs').default({
	watch: false
}).argv;

// default to development
if (!process.env.hasOwnProperty('NODE_ENV')) {
	process.env.NODE_ENV = 'development';
}

var OUT_DIR = path.join('chrome', 'js', 'builds');

var FILES_TO_MINIFY = [
	'inject.js',
	'injected.js'
];

// TODO check out debugging with source maps (and minifying everything)

// TODO allow requiring all modules used by background/panel pages in browser dev tools:
// https://github.com/substack/node-browserify/issues/533
// https://github.com/webpack/docs/wiki/webpack-for-browserify-users#external-requires
// https://github.com/webpack/expose-loader

var config = {
	entry: glob.sync('./src/js/*').reduce(function (memo, inpath) {
		var infile = path.basename(inpath);
		memo[infile.slice(0, -path.extname(infile).length)] = inpath;
		return memo;
	}, {}),
	output: {
		path: OUT_DIR,
		filename: "[name].js"
	},
	module: {
		loaders: [
			{
				test: /\.json$/,
				loader: "json"
			},
			{
				test: /\.jsx$/,
				loader: "jsx"
			}
		],
		postLoaders: [
			{
				test: /\.js$/,
				// TODO cacheable? https://github.com/webpack/transform-loader#typical-brfs-example
				loader: "transform?envify"
			}
		]
	},
	plugins: [
		new webpack.optimize.CommonsChunkPlugin('common', 'common.js', ['background', 'panel']),
		new webpack.optimize.OccurrenceOrderPlugin(),
		new webpack.optimize.UglifyJsPlugin({
			compress: {
				warnings: false
			},
			include: FILES_TO_MINIFY
		})
	]
};

if (process.env.NODE_ENV == 'development') {
	config.module.postLoaders.push(
		{
			test: require.resolve("../src/lib/tabdata.js"),
			loader: "expose?tabData"
		}
	);
}

var compiler = webpack(config);

if (args.watch) {
	compiler.watch(200, handle_build_results);
} else {
	compiler.run(handle_build_results);
}

function handle_build_results(err, stats) {
	if (err) {
		return fatal_error(err);
	}

	var jsonStats = stats.toJson();

	if (jsonStats.errors.length > 0) {
		jsonStats.errors.forEach(function (err) {
			console.error(err);
		});
		return;
	}

	if (jsonStats.warnings.length > 0) {
		jsonStats.warnings.forEach(function (warn) {
			console.warn(warn);
		});
	}

	FILES_TO_MINIFY.forEach(function (infile) {
		var old_name = path.join(OUT_DIR, infile),
			new_name = old_name.replace(/\.js$/, '.min.js');

		if (fs.existsSync(old_name)) {
			fs.renameSync(old_name, new_name);
		}
	});

	var summary = stats.toString({
		cached: false,
		cachedAssets: false,
		chunks: false,
		colors: true,
		exclude: ['node_modules'],
		hash: false,
		timings: false,
		version: false
	});

	if (summary) {
		console.log(summary);
	}
}

function fatal_error(err) {
	console.error(err.stack || err);
	if (err.details) {
		console.error(err.details);
	}
	if (!args.watch) {
		process.on("exit", function () {
			process.exit(1);
		});
	}
}
