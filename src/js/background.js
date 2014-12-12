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

var ALL_URLS = { urls: ['http://*/*', 'https://*/*'] };

var score = require('../lib/score').scoreScriptActivity,
	sendMessage = require('../lib/content_script_utils').sendMessage,
	tabData = require('../lib/tabdata'),
	whitelist = require('../lib/whitelist');

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

// need to match Firefox/Tor Browser's Accept header across all content types
// TODO video, audio, ...
// TODO https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation
// TODO note that webRequest reports "main_frame", "sub_frame", "stylesheet", "script", "image", "object", "xmlhttprequest", or "other" in details.type
var HEADER_OVERRIDES = {
	'*': {
		'User-Agent': "Mozilla/5.0 (Windows NT 6.1; rv:31.0) Gecko/20100101 Firefox/31.0",
		'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		'Accept-Language': "en-us,en;q=0.5",
		'Accept-Encoding': "gzip, deflate",
		'DNT': null // remove to match Tor Browser
	},
	'image': {
		'Accept': "image/png,image/*;q=0.8,*/*;q=0.5"
	},
	'other': {
		'Accept': "*/*"
	},
	'script': {
		'Accept': "*/*"
	},
	'stylesheet': {
		'Accept': "text/css,*/*;q=0.1"
	},
	'xmlhttprequest': {
		'Accept': "text/html, */*"
	}
};

// functions ///////////////////////////////////////////////////////////////////

// TODO handlerBehaviorChanged, etc.: https://developer.chrome.com/extensions/webRequest#implementation
//function filterRequests(details) {
//	var cancel = false;
//
//	if (!isEnabled(details.tabId) {
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
	if (!isEnabled(details.tabId)) {
		return;
	}

	var typeOverrides = HEADER_OVERRIDES.hasOwnProperty(details.type) && HEADER_OVERRIDES[details.type] || {},
		globalOverrides = HEADER_OVERRIDES['*'],
		origHeaders = details.requestHeaders,
		newHeaders = [];

	origHeaders.forEach(function (header) {
		var name = header.name,
			value = header.value,
			new_value,
			newHeader = {
				name: name,
				value: value
			};

		// modify or remove?
		if (typeOverrides.hasOwnProperty(name) || globalOverrides.hasOwnProperty(name)) {
			if (typeOverrides.hasOwnProperty(name)) {
				new_value = typeOverrides[name];
			} else if (globalOverrides.hasOwnProperty(name)) {
				new_value = globalOverrides[name];
			}

			// modify
			if (new_value) {
				newHeader.value = new_value;
				newHeaders.push(newHeader);
			}

		// just copy
		} else {
			newHeaders.push(newHeader);
		}
	});

	return {
		requestHeaders: newHeaders
	};
}

function isEnabled(tab_id) {
	var data = tabData.get(tab_id);
	return data.injected && !whitelist.whitelisted(data.hostname);
}

function updateBadge(tab_id) {
	var data = tabData.get(tab_id),
		count = 0;

	if (data) {
		// no need for hasOwnProperty loop checks in this context
		for (var domain in data.domains) { // jshint ignore:line
			var scripts = data.domains[domain].scripts;

			for (var url in scripts) {
				if (score(scripts[url]).fingerprinter) {
					count++;
					break;
				}
			}
		}
	}

	if (count) {
		// TODO Unchecked runtime.lastError while running browserAction.setBadgeText: No tab with id: XXX.
		chrome.browserAction.setBadgeText({
			tabId: tab_id,
			text: count.toString()
		});
	}
}

function updateButton(tab_id) {
	function _updateButton(tab_id) {
		var enabled = isEnabled(tab_id);

		// TODO Unchecked runtime.lastError while running browserAction.setIcon: No tab with id: XXX.
		chrome.browserAction.setIcon({
			path: {
				19: 'icons/19' + (enabled ? '' : '_off') + '.png',
				38: 'icons/38' + (enabled ? '' : '_off') + '.png'
			},
			tabId: tab_id
		});
	}

	if (tab_id) {
		_.defer(_updateButton, tab_id);
	} else {
		getCurrentTab(function (tab) {
			_updateButton(tab.id);
		});
	}
}

function getCurrentTab(callback) {
	chrome.tabs.query({
		active: true,
		lastFocusedWindow: true
	}, function (tabs) {
		callback(tabs[0]);
	});
}

function getPanelData(tab) {
	return _.extend(tabData.get(tab.id) || {}, {
		invalid_page: (
			tab.url.indexOf('http') !== 0 ||
			tab.url.indexOf('https://chrome.google.com/webstore/') === 0
		),
		whitelisted: whitelist.whitelisted(tab.id)
	});
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
				sendMessage('panelData', getPanelData(tab));
			}
		});

	} else if (request.name == 'panelLoaded') {
		getCurrentTab(function (tab) {
			sendResponse(getPanelData(tab));
		});

		// we will send the response asynchronously
		return true;

	} else if (request.name == 'panelToggle') {
		whitelist.toggle(request.message.hostname);
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

	tabData.init(tab_id, details.url);
	updateButton(tab_id);
	updateBadge(tab_id);
}

// initialization //////////////////////////////////////////////////////////////

// TODO track all scripts (including ones loaded via XHR)
//chrome.webRequest.onResponseStarted.addListener(
//	function (details) { console.log(details); },
//	_.extend(ALL_URLS, { types: ['script', 'xmlhttprequest'] }),
//	['responseHeaders']
//);

// TODO filter out known fingerprinters
//chrome.webRequest.onBeforeRequest.addListener(
//	filterRequests,
//	ALL_URLS,
//	["blocking"]
//);

// TODO Tor Browser rejects web fonts? "downloadable font: download not allowed (font-family: "Open Sans" style:normal weight:normal stretch:normal src index:1): status=2147500037"

// abort injecting the content script when Chameleon is disabled
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		var tab_id = details.tabId;

		if (whitelist.whitelisted(tab_id)) {
			// we redirect to a blank script instead of simply cancelling the request
			// because cancelling makes pages spin forever for some reason
			// TODO Gmail: Refused to load the script 'data:text/javascript,' because it violates the following Content Security Policy directive: "script-src 'unsafe-inline' 'unsafe-eval' 'self'
			return {
				redirectUrl: 'data:text/javascript,'
			};

		} else {
			tabData.get(tab_id).injected = true;
			updateButton(tab_id);
		}
	},
	{
		urls: [
			'chrome-extension://' + chrome.runtime.id + '/js/builds/injected.min.js'
		]
	},
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
