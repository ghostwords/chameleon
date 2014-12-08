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

var _ = require('underscore'),
	uri = require('./uri');

/* data = {
	<tab_id>: {
		domains: {
			<domain>: {
				scripts: {
					<script_url>: {
						counts: {
							<accessed_object_property>: number count,
							...
						},
						fontEnumeration: boolean
					},
					...
				}
			},
			...
		},
		injected: boolean,
		url: string,
		hostname: string
	},
	...
} */
var data = {};

var tabData = {
	// initialize tab-level data
	init: function (tab_id, tab_url) {
		data[tab_id] = {
			domains: {},
			hostname: new URL(tab_url).hostname,
			injected: false,
			url: tab_url
		};
	},

	// TODO review performance impact
	record: function (tab_id, access) {
		var domain = uri.get_domain(access.scriptUrl),
			font_enumeration_prop = (access.prop == 'style.fontFamily'),
			key = access.obj + '.' + access.prop,
			script_url = access.scriptUrl || '<unknown script>';

		var datum = data[tab_id];

		// initialize domain-level data
		if (!datum.domains.hasOwnProperty(domain)) {
			datum.domains[domain] = {
				scripts: {}
			};
		}
		var domainData = datum.domains[domain];

		// initialize script-level data
		if (!domainData.scripts.hasOwnProperty(script_url)) {
			domainData.scripts[script_url] = {
				counts: {},
				fontEnumeration: false
			};
		}
		var scriptData = domainData.scripts[script_url];

		// JavaScript property access counts.
		// Do not store style.fontFamily since it is already represented
		// as fontEnumeration, plus its count is meaningless.
		if (!font_enumeration_prop) {
			var counts = scriptData.counts;
			if (!counts.hasOwnProperty(key)) {
				counts[key] = 0;
			}
			counts[key]++;
		}

		// font enumeration (script-level)
		if (font_enumeration_prop) {
			scriptData.fontEnumeration = true;
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
