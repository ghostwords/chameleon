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
				scripts: {}
			};
		}

		var datum = data[tab_id],
			font_enumeration_prop = (access.prop == 'style.fontFamily');

		// initialize script-level data (indexed by script URL)
		if (!datum.scripts.hasOwnProperty(script_url)) {
			datum.scripts[script_url] = {
				counts: {},
				fontEnumeration: false
			};
		}

		// JavaScript property access counts.
		// Do not store style.fontFamily since it is already represented
		// as fontEnumeration, plus its count is meaningless.
		if (!font_enumeration_prop) {
			var counts = datum.scripts[script_url].counts;
			if (!counts.hasOwnProperty(key)) {
				counts[key] = 0;
			}
			counts[key]++;
		}

		// font enumeration (script-level)
		if (font_enumeration_prop) {
			datum.scripts[script_url].fontEnumeration = true;
		}
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
