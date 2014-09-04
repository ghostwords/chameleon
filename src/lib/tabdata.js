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
	tld = require('tldjs');

// does the string start with an optional scheme/colon and two slashes?
// TODO better IP regex, check for IPv6
var IP_ADDRESS = /^\d+\.\d+\.\d+\.\d+(?::\d+)?$/,
	// TODO could be a chrome-extension protocol URL: chrome-extension://boadgeojelhgndaghljhdicfkmllpafd/cast_sender.js
	VALID_URL = /^(?:[a-z]+:)?\/\//;

// TODO see getBaseDomain in https://github.com/adblockplus/adblockpluschrome/blob/f9c5bd397bb8a9d7d2890aee89d45e25178c4b7a/lib/basedomain.js
// TODO punycode? https://publicsuffix.org/list/ and http://www.w3.org/International/articles/idn-and-iri/
function get_domain(url) {
	var domain,
		hostname,
		UNKNOWN_DOMAIN = '<unknown domain>';

	if (!url) {
		return UNKNOWN_DOMAIN;
	}

	if (!VALID_URL.test(url)) {
		return UNKNOWN_DOMAIN;
	}

	hostname = url.split('/')[2];

	// TODO tld.js does not properly handle IP (v4 or v6) addresses
	if (!IP_ADDRESS.test(hostname)) {
		domain = tld.getDomain(url);
	}

	if (!domain) {
		domain = hostname;

		// strip the port
		var port_index = domain.lastIndexOf(':');
		if (port_index != -1) {
			domain = domain.slice(0, port_index);
		}
	}

	return domain;
}

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
		fontEnumeration: boolean true if any scripts for this tab have a true fontEnumeration property
	},
	...
} */
var data = {};

var tabData = {
	// TODO review performance impact
	record: function (tab_id, access) {
		var domain = get_domain(access.scriptUrl),
			font_enumeration_prop = (access.prop == 'style.fontFamily'),
			key = access.obj + '.' + access.prop,
			script_url = access.scriptUrl || '<unknown script>';

		// initialize tab-level data
		if (!data.hasOwnProperty(tab_id)) {
			data[tab_id] = {
				domains: {},
				fontEnumeration: false
			};
		}
		var datum = data[tab_id];

		// font enumeration (tab-level)
		if (font_enumeration_prop) {
			datum.fontEnumeration = true;
		}

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
