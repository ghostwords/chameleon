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
							reads: [
								<access_object>,
								...
							],
							writes: [
								<access_object>,
								...
							]
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
			injected: false,
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
					reads: [],
					writes: []
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
			} else if (extra.hasOwnProperty('canvas')) {
				var canvas_reads = scriptData.canvas.reads,
					canvas_writes = scriptData.canvas.writes;

				if (CANVAS_WRITE.hasOwnProperty(access.prop)) {
					canvas_writes.push(access);
				} else if (CANVAS_READ.hasOwnProperty(access.prop)) {
					canvas_reads.push(access);
				}

				if (!scriptData.canvas.fingerprinting) {
					if (canvas_writes.length && canvas_reads.length) {
						// if the last canvas read got enough data,
						// let's call it fingerprinting
						var canvas_extra = canvas_reads[canvas_reads.length-1].extra;
						if (canvas_extra.width > 16 && canvas_extra.height > 16) {
							scriptData.canvas.fingerprinting = true;
						}
					}
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
