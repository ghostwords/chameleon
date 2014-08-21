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

// used by the badge and the popup
module.exports.getAccessCount = function (domains) {
	// count unique keys across all counts objects
	var props = {};

	// no need for hasOwnProperty loop checks in this context
	for (var domain in domains) { // jshint ignore:line
		var scripts = domains[domain].scripts; // jshint ignore:line

		for (var url in scripts) { // jshint ignore:line
			for (var prop in scripts[url].counts) { // jshint ignore:line
				props[prop] = true;
			}
		}
	}

	return Object.keys(props).length;
};
