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

var score = require('./score').scoreScriptActivity;

// used by the badge and the popup
module.exports.getFingerprinterCount = function (domains) {
	var count = 0;

	// no need for hasOwnProperty loop checks in this context
	for (var domain in domains) { // jshint ignore:line
		var scripts = domains[domain].scripts;

		for (var url in scripts) {
			if (score(scripts[url]).fingerprinter) {
				count++;
				break;
			}
		}
	}

	return count;
};

module.exports.storage = function (key, value) {
	if (typeof value != 'undefined') {
		localStorage.setItem(key, JSON.stringify(value));
	} else {
		value = localStorage.getItem(key);
		return value && JSON.parse(value);
	}
};
