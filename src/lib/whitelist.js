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

//var tabData = require('./tabdata'),
var utils = require('./utils'),
	_ = require('underscore');

var list = utils.storage('whitelist') || {};

function whitelisted(/*tab_id_or_hostname*/) {
	// TODO whitelisting is disabled pending https://crbug.com/377978
	return false;
/*
	var hostname = tab_id_or_hostname;

	if (_.isNumber(tab_id_or_hostname)) {
		hostname = tabData.get(tab_id_or_hostname).hostname;

		if (!hostname) {
			// don't have a cached hostname for this tab ID,
			// Chameleon must have been loaded after the tab ...
			return false;
		}
	}

	return list.hasOwnProperty(hostname);
*/
}

function toggle(hostname) {
	if (whitelisted(hostname)) {
		delete list[hostname];
	} else {
		list[hostname] = true;
	}
	save();
}

var save = _.debounce(function () {
	utils.storage('whitelist', list);
}, 250);

module.exports = {
	toggle: toggle,
	whitelisted: whitelisted,
};
