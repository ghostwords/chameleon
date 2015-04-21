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
 * Injects injected.js into the page frame's execution environment
 * to work around Chrome's content script security sandbox/"isolated world".
 */

(function () {

	function insertScript(text, data) {
		var parent = document.documentElement,
			script = document.createElement('script');

		script.text = text;
		script.async = false;

		for (var key in data) { // jshint ignore:line
			//if (data.hasOwnProperty(key)) { // unnecessary
			script.setAttribute('data-' + key.replace('_', '-'), data[key]);
			//}
		}

		parent.insertBefore(script, parent.firstChild);
		parent.removeChild(script);
	}

	var event_id = Math.random(),
		script = require('raw!../../chrome/js/builds/injected.min.js'),
		sendMessage = require('../lib/content_script_utils').sendMessage;

	// listen for messages from the script we are about to insert
	document.addEventListener(event_id, function (e) {
		// pass these on to the background page
		sendMessage('trapped', e.detail);
	});

	insertScript(script, { event_id: event_id });
}());
