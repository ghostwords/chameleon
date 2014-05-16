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
