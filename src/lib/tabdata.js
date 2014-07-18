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
		var key = access.obj + '.' + access.prop,
			script_url = access.scriptUrl || '<unknown>';

		if (!data.hasOwnProperty(tab_id)) {
			data[tab_id] = {
				counts: {},
				fontEnumeration: false
			};
		}

		var datum = data[tab_id];

		// font enumeration
		if (access.prop == 'style.fontFamily') {
			datum.fontEnumeration = true;
		}

		// javascript property access counts indexed by script URL
		if (!datum.counts.hasOwnProperty(script_url)) {
			datum.counts[script_url] = {};
		}
		var counts = datum.counts[script_url];
		if (!counts.hasOwnProperty(key)) {
			counts[key] = 0;
		}
		counts[key]++;
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
