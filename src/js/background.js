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
	CSP_REPORT_URL = 'http://localhost/report', // TODO better URL?
	ENABLED = true;

var tabData = require('../lib/tabdata');

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

function addCSPHeader(details) {
	var headers = details.responseHeaders;

	headers.push({
		name: 'Content-Security-Policy-Report-Only',
		value: 'default-src "none"; report-uri ' + CSP_REPORT_URL
	});

	return {
		responseHeaders: headers
	};
}

// http://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers
// TODO review
function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function getCSPReports(details) {
	var report_str = ab2str(details.requestBody.raw[0].bytes),
		report = JSON.parse(report_str)['csp-report'];

	console.log(report);

	return {
		cancel: true
	};
}

function updateBadge(tab_id) {
	var data = tabData.get(tab_id),
		text = '';

	if (data) {
		text = _.size(_.countBy(data.accesses, function (access) {
			return access.obj + '.' + access.prop;
		}));

		if (data.fontEnumeration) {
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

function onMessage(request, sender, sendResponse) {
	var response = {};

	if (request.name == 'injected') {
		response.insertScript = ENABLED;

	} else if (request.name == 'trapped') {
		//if (sender.tab && sender.tab.id) {
		if (_.isArray(request.message)) {
			request.message.forEach(function (msg) {
				tabData.record(sender.tab.id, msg);
			});
		} else {
			tabData.record(sender.tab.id, request.message);
		}
		updateBadge(sender.tab.id);
		//}

	} else if (request.name == 'panelLoaded') {
		// TODO fails when inspecting popup: we send inspector tab instead
		getCurrentTab(function (tab) {
			var data = tabData.get(tab.id);

			response.accesses = data.accesses;
			response.enabled = ENABLED;
			response.fontEnumeration = !!data.fontEnumeration;

			sendResponse(response);
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
//	[ "blocking" ]
//);

chrome.webRequest.onBeforeSendHeaders.addListener(
	normalizeHeaders,
	ALL_URLS,
	['blocking', 'requestHeaders']
);

// produce Content Security Policy (CSP) reports
chrome.webRequest.onHeadersReceived.addListener(
	addCSPHeader,
	// filter to top-level documents and frames only
	_.extend(ALL_URLS, {
		types: ['main_frame', 'sub_frame']
	}),
	['blocking', 'responseHeaders']
);

// listen to CSP reports
chrome.webRequest.onBeforeRequest.addListener(
	getCSPReports,
	{ urls: [CSP_REPORT_URL] },
	['blocking', 'requestBody']
);

// TODO set plugins to "ask by default"

chrome.runtime.onMessage.addListener(onMessage);

chrome.tabs.onRemoved.addListener(tabData.clear);

chrome.webNavigation.onCommitted.addListener(onNavigation);

// see if we have any orphan data every five minutes
// TODO switch to chrome.alarms?
setInterval(tabData.clean, 300000);
