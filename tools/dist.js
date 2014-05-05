#!/usr/bin/env node

var moment = require('moment'),
	shell = require('shelljs');

var package_name = [
	'chameleon',
	require('../src/manifest.json').version,
	moment().format('YYYY-MM-DD')
].join('_');

// copy src/** to dist/
shell.cp('-R', 'src/**', 'dist/' + package_name);

// create the package
shell.exit(shell.exec(
	'cd dist && ../tools/crxmake.sh ' + package_name + ' ~/.ssh/chameleon.pem'
).code);
