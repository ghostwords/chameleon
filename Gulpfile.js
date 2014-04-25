#!/usr/bin/env node

var gulp = require('gulp'),
	clean = require('gulp-clean'),
	shell = require('gulp-shell'),
	moment = require('moment');

var package_name = [
	'chameleon',
	require('./src/manifest.json').version,
	moment().format('YYYY-MM-DD')
].join('_');

gulp.task('clean', function () {
	return gulp.src(['dist/*'], { read: false }).pipe(clean());
});

gulp.task('copy-to-dist', ['clean'], function () {
	return gulp.src(['src/**']).pipe(gulp.dest('dist/' + package_name));
});

gulp.task('dist', ['copy-to-dist'], shell.task(
	'cd dist && ../tools/crxmake.sh ' + package_name + ' ~/.ssh/chameleon.pem'
));
