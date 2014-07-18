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

/*
 * This module needs to work both inside content scripts and the browser popup.
 */

// acceptable signatures:
// name
// name, message
// name, callback
// name, message, callback
module.exports.sendMessage = function (name, message, callback) {
	var args = [{ name: name }];

	if (Object.prototype.toString.call(message) == '[object Function]') {
		// name, callback
		args.push(message);
	} else {
		if (message) {
			// name, message, [callback]
			args[0].message = message;
		}
		if (callback) {
			// name, [message], callback
			args.push(callback);
		}
	}

	chrome.runtime.sendMessage.apply(chrome.runtime, args);
};

// used by the badge and the popup
module.exports.getAccessCount = function (counts) {
	// count unique keys across all counts objects
	var props = {};

	for (var url in counts) {
		if (counts.hasOwnProperty(url)) {
			for (var prop in counts[url]) {
				if (counts[url].hasOwnProperty(prop)) {
					props[prop] = true;
				}
			}
		}
	}

	return Object.keys(props).length;
};
