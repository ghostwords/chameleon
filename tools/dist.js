#!/usr/bin/env node

var moment = require('moment'),
	shell = require('shelljs');

var package_name = [
	'chameleon',
	require('../chrome/manifest.json').version,
	moment().format('YYYY-MM-DD')
].join('_');

// copy chrome/** to dist/
shell.cp('-R', 'chrome/**', 'dist/' + package_name);

// create the package
shell.exit(shell.exec(
	'cd dist && ../tools/crxmake.sh ' + package_name + ' ~/.ssh/chameleon.pem'
).code);
