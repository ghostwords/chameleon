require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({155:[function(require,module,exports){
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

var score = require('./score.js').scoreScriptActivity;

// used by the badge and the popup
module.exports.getFingerprinterCount = function (domains) {
	var count = 0;

	// no need for hasOwnProperty loop checks in this context
	for (var domain in domains) { // jshint ignore:line
		var scripts = domains[domain].scripts;

		for (var url in scripts) {
			if (score(scripts[url]).fingerprinter) {
				count++;
			}
		}
	}

	return count;
};

},{"./score.js":153}],153:[function(require,module,exports){
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

module.exports.scoreScriptActivity = function (scriptData) {
	var points = 0;

	// 95 points for font enumeration
	if (scriptData.fontEnumeration) {
		points += 95;
	}

	// 15 points for each property access
	// TODO language/userAgent/common properties should count less, others should count more?
	// TODO use non-linear scale?
	// TODO third-party scripts should count more?
	// TODO count across domains instead of individual scripts?
	for (var i = 0, ln = Object.keys(scriptData.counts).length; i < ln; i++) {
		points += 15;
	}

	return {
		fingerprinter: (points > 50),
		points: points
	};
};

},{}],152:[function(require,module,exports){
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
 * This module needs to work both inside content scripts and the rest of the
 * extension, like the browser popup.
 *
 * Content scripts have certain limitations in Chrome:
 * https://developer.chrome.com/extensions/content_scripts
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

},{}]},{},[]);
