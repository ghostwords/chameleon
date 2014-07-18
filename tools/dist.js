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

// create the drag-and-drop installable CRX package
shell.exit(shell.exec(
	'cd dist && ../tools/crxmake.sh ' + package_name + ' ~/.ssh/chameleon.pem'
).code);

// TODO create the zip for uploading to Chrome Web Store
// TODO make this is the "release" task (also tags, ...)
// https://developer.chrome.com/extensions/packaging
// 1. Rename the private key that was generated when you created the .crx file to key.pem.
// 2. Put key.pem in the top directory of your extension.
// 3. Compress that directory into a ZIP file.
// 4. Upload the ZIP file using the Chrome Developer Dashboard.
// TODO No need to do the key.pem thing for updates, right?
