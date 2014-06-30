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

var data = {};

var tabData = {
	record: function (tab_id, access) {
		var key = access.obj + '.' + access.prop;

		if (!data.hasOwnProperty(tab_id)) {
			data[tab_id] = {
				counts: {},
				fontEnumeration: false
			};
		}

		if (access.prop == 'style.fontFamily') {
			data[tab_id].fontEnumeration = true;
		}

		if (!data[tab_id].counts.hasOwnProperty(key)) {
			data[tab_id].counts[key] = 0;
		}

		data[tab_id].counts[key]++;
	},

	get: function (tab_id) {
		return data.hasOwnProperty(tab_id) && data[tab_id];
	},

	clear: function (tab_id) {
		delete data[tab_id];
	},

	clean: function () {
		chrome.tabs.query({}, function (tabs) {
			// get tab IDs that are in "data" but no longer a known tab
			// and clean up orphan data
			_.difference(
				Object.keys(data).map(Number),
				_.pluck(tabs, 'id')
			).forEach(tabData.clear);
		});
	}
};

module.exports = tabData;
