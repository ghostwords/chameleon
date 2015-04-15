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

/*
 * Injects injected.js from a chrome-extension:// URL. This way injected.js
 * goes through the webRequest API. This is a hack to support programmatic
 * injection of a before-anything-else-on-the-page content script.
 */

(function () {

	var sendMessage = require('../lib/content_script_utils').sendMessage;

	function insertScript(url, data) {
		var head = document.getElementsByTagName('head')[0] || document.documentElement,
			script = document.createElement('script');

		script.src = url;
		script.async = false;

		// TODO onload?
		script.onload = function () {
			head.removeChild(script);
		};

		for (var key in data) { // jshint ignore:line
			//if (data.hasOwnProperty(key)) { // unnecessary
			script.setAttribute('data-' + key.replace('_', '-'), data[key]);
			//}
		}

		head.insertBefore(script, head.firstChild);
	}

	var event_id = Math.random();

	// listen for messages from the script we are about to insert
	document.addEventListener(event_id, function (e) {
		// pass these on to the background page
		sendMessage('trapped', e.detail);
	});

	insertScript(
		'chrome-extension://' + chrome.runtime.id + '/js/builds/injected.min.js',
		{ event_id: event_id }
	);
}());
