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

var _ = require('underscore');

// TODO move into own lib module (this also lives in js/injected.js)
function sendMessage(name, message, callback) {
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
}

sendMessage('panelLoaded', function (response) {
	var counts = _.countBy(response.accesses, function (access) {
		return access.obj + '.' + access.prop;
	});
	var body = document.getElementsByTagName('body')[0];
	body.innerHTML += require('../lib/templates/panel.jst')({
		counts: counts
	});
});
