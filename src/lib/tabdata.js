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

var _ = require('underscore'),
	uri = require('./uri');

var CANVAS_WRITE = {
	fillText: true,
	strokeText: true
};
var CANVAS_READ = {
	getImageData: true,
	toDataURL: true
};

/* data = {
	<tab_id>: {
		domains: {
			<domain>: {
				scripts: {
					<script_url>: {
						canvas: {
							fingerprinting: boolean,
							write: boolean
						},
						counts: {
							<accessed_object_property>: number count,
							...
						},
						fontEnumeration: boolean,
						navigatorEnumeration: boolean
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
			injected: true,
			url: tab_url
		};
	},

	// TODO review performance impact
	record: function (tab_id, access) {
		var domain = uri.get_domain(access.scriptUrl),
			script_url = access.scriptUrl || '<unknown script>',
			extra = access.hasOwnProperty('extra') && access.extra;

		var datum = data[tab_id];

		// initialize domain-level data
		// TODO Error in event handler for runtime.onMessage: TypeError: Cannot read property 'domains' of undefined
		if (!datum.domains.hasOwnProperty(domain)) {
			datum.domains[domain] = {
				scripts: {}
			};
		}
		var domainData = datum.domains[domain];

		// initialize script-level data
		if (!domainData.scripts.hasOwnProperty(script_url)) {
			domainData.scripts[script_url] = {
				canvas: {
					fingerprinting: false,
					write: false
				},
				counts: {},
				fontEnumeration: false,
				navigatorEnumeration: false
			};
		}
		var scriptData = domainData.scripts[script_url],
			counts = scriptData.counts;

		// count JavaScript property accesses
		if (!extra) {
			var key = access.obj + (access.hasOwnProperty('prop') ? '.' + access.prop : '');

			if (!counts.hasOwnProperty(key)) {
				counts[key] = 0;
			}

			counts[key]++;

		// don't count records with an "extra" property
		} else {
			if (extra.hasOwnProperty('fontEnumeration')) {
				scriptData.fontEnumeration = extra.fontEnumeration;

			} else if (extra.hasOwnProperty('navigatorEnumeration')) {
				scriptData.navigatorEnumeration = extra.navigatorEnumeration;

				// decrement Navigator counts
				if (scriptData.navigatorEnumeration) {
					_.each(counts, function (count, key) {
						if (key.indexOf('Navigator') === 0) {
							count--;
							if (count === 0) {
								delete counts[key];
							} else {
								counts[key] = count;
							}
						}
					});
				}

			// canvas fingerprinting
			// TODO check that the write and the read happened to the same canvas element
			} else if (extra.hasOwnProperty('canvas')) {
				if (scriptData.canvas.fingerprinting) {
					return;
				}

				// if this script already had a canvas write
				if (scriptData.canvas.write) {
					// and if this is a canvas read
					if (CANVAS_READ.hasOwnProperty(access.prop)) {
						// and it got enough data
						if (access.extra.width > 16 && access.extra.height > 16) {
							// let's call it fingerprinting
							scriptData.canvas.fingerprinting = true;
						}
					}
				// this is a canvas write
				} else if (CANVAS_WRITE.hasOwnProperty(access.prop)) {
					scriptData.canvas.write = true;
				}
			}
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
