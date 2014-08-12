(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
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

// globals /////////////////////////////////////////////////////////////////////

var _ = require('underscore');

var ALL_URLS = { urls: ['http://*/*', 'https://*/*'] },
	ENABLED = true;

var tabData = require('../lib/tabdata'),
	sendMessage = require('../lib/content_script_utils').sendMessage,
	utils = require('../lib/utils');

// TODO https://developer.chrome.com/extensions/webRequest#life_cycle_footnote
// The following headers are currently not provided to the onBeforeSendHeaders event.
// This list is not guaranteed to be complete nor stable.
// Authorization
// Cache-Control
// Connection
// Content-Length
// Host
// If-Modified-Since
// If-None-Match
// If-Range
// Partial-Data
// Pragma
// Proxy-Authorization
// Proxy-Connection
// Transfer-Encoding
var HEADER_OVERRIDES = {
	'User-Agent': "Mozilla/5.0 (Windows NT 6.1; rv:24.0) Gecko/20100101 Firefox/24.0",
	// TODO this matches Tor Browser on http://fingerprint.pet-portal.eu/?lang=en but not on Panopticlick ...
	//'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	'Accept': "text/html, */*",
	'Accept-Language': "en-us,en;q=0.5",
	'Accept-Encoding': "gzip, deflate",
	'DNT': null // remove to match Tor Browser
};

// functions ///////////////////////////////////////////////////////////////////

// TODO handlerBehaviorChanged, etc.: https://developer.chrome.com/extensions/webRequest#implementation
//function filterRequests(details) {
//	var cancel = false;
//
//	if (!ENABLED) {
//		return;
//	}
//
//	console.log("onBeforeRequest: %o", details);
//
//	return {
//		cancel: cancel
//	};
//}

function normalizeHeaders(details) {
	if (!ENABLED) {
		return;
	}

	var origHeaders = details.requestHeaders,
		newHeaders = [];

	origHeaders.forEach(function (header) {
		var name = header.name,
			value = header.value,
			newHeader = {
				name: name,
				value: value
			};

		if (HEADER_OVERRIDES.hasOwnProperty(name)) {
			// modify or remove?
			if (HEADER_OVERRIDES[name]) {
				newHeader.value = HEADER_OVERRIDES[name];
				newHeaders.push(newHeader);
			}
		} else {
			// just copy
			newHeaders.push(newHeader);
		}
	});

	return {
		requestHeaders: newHeaders
	};
}

function updateBadge(tab_id) {
	var data = tabData.get(tab_id),
		text = '';

	if (data) {
		text = utils.getAccessCount(data.scripts);

		// count font enumeration once
		if (_.some(data.scripts, function (s) { return s.fontEnumeration; })) {
			text++;
		}

		text = text.toString();
	}

	chrome.browserAction.setBadgeText({
		tabId: tab_id,
		text: text
	});
}

function updateButton() {
	chrome.browserAction.setIcon({
		path: {
			19: 'icons/19' + (ENABLED ? '' : '_off') + '.png',
			38: 'icons/38' + (ENABLED ? '' : '_off') + '.png'
		}
	});
}

function getCurrentTab(callback) {
	chrome.tabs.query({
		active: true,
		lastFocusedWindow: true
	}, function (tabs) {
		callback(tabs[0]);
	});
}

function getPanelData(tab_id) {
	return _.extend(
		{
			scripts: {},
			enabled: ENABLED
		},
		tabData.get(tab_id)
	);
}

function onMessage(request, sender, sendResponse) {
	var response = {};

	if (request.name == 'trapped') {
		if (_.isArray(request.message)) {
			request.message.forEach(function (msg) {
				tabData.record(sender.tab.id, msg);
			});
		} else {
			tabData.record(sender.tab.id, request.message);
		}

		updateBadge(sender.tab.id);

		// message the popup to rerender with latest data
		getCurrentTab(function (tab) {
			// but only if this message is for the current tab
			if (tab.id == sender.tab.id) {
				sendMessage('panelData', getPanelData(tab.id));
			}
		});

	} else if (request.name == 'panelLoaded') {
		// TODO fails when inspecting popup: we send inspector tab instead
		getCurrentTab(function (tab) {
			sendResponse(getPanelData(tab.id));
		});

		// we will send the response asynchronously
		return true;

	} else if (request.name == 'panelToggle') {
		ENABLED = !ENABLED;
		updateButton();
	}

	sendResponse(response);
}

function onNavigation(details) {
	var tab_id = details.tabId;

	// top-level page navigation only
	if (details.frameId !== 0 || tab_id < 1) {
		return;
	}

	tabData.clear(tab_id);
	updateBadge(tab_id);
}

// initialization //////////////////////////////////////////////////////////////

// TODO filter out known fingerprinters
//chrome.webRequest.onBeforeRequest.addListener(
//	filterRequests,
//	ALL_URLS,
//	["blocking"]
//);

// abort injecting the content script when Chameleon is disabled
chrome.webRequest.onBeforeRequest.addListener(
	// we redirect to a blank script instead of simply cancelling the request
	// because cancelling makes pages spin forever for some reason
	function () { if (!ENABLED) { return { redirectUrl: 'data:text/javascript,' }; } },
	{ urls: ['chrome-extension://' + chrome.runtime.id + '/js/builds/injected.min.js'] },
	["blocking"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
	normalizeHeaders,
	ALL_URLS,
	["blocking", "requestHeaders"]
);

// TODO set plugins to "ask by default"

chrome.runtime.onMessage.addListener(onMessage);

chrome.tabs.onRemoved.addListener(tabData.clear);

chrome.webNavigation.onCommitted.addListener(onNavigation);

// see if we have any orphan data every five minutes
// TODO switch to chrome.alarms?
setInterval(tabData.clean, 300000);

},{"../lib/content_script_utils":3,"../lib/tabdata":4,"../lib/utils":5}],3:[function(require,module,exports){
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

/*
 * This module needs to work both inside content scripts and the rest of the
 * extension, like the browser popup.
 *
 * Content scripts have certain limitations in Chrome:
 * https://developer.chrome.com/extensions/content_scripts
 */

// acceptable signatures:
// name
// name, message
// name, callback
// name, message, callback
module.exports.sendMessage = function (name, message, callback) {
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
};

},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
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

// used by the badge and the popup
module.exports.getAccessCount = function (scripts) {
	// count unique keys across all counts objects
	var props = {};

	// no need for hasOwnProperty loop checks in this context
	for (var url in scripts) { // jshint ignore:line
		for (var prop in scripts[url].counts) { // jshint ignore:line
			props[prop] = true;
		}
	}

	return Object.keys(props).length;
};

},{}]},{},[2])