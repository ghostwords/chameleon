/*!
 * Chameleon
 *
 * Copyright 2014 ghostwords. All rights reserved.
 */

// globals /////////////////////////////////////////////////////////////////////

/*global _ */

var ALL_URLS = { urls: ['http://*/*', 'https://*/*'] },
	ENABLED = true;

var tabData = (function () {
	var data = {};

	return {
		record: function (tab_id, access) {
			if (!data.hasOwnProperty(tab_id)) {
				data[tab_id] = {
					accesses: []
				};
			}
			data[tab_id].accesses.push(access);
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
}());

var HEADER_OVERRIDES = {
	'User-Agent': "Mozilla/5.0 (Windows NT 6.1; rv:24.0) Gecko/20100101 Firefox/24.0",
	'Accept': "text/html, */*",
	'Accept-Language': "en-us,en;q=0.5",
	'Accept-Encoding': "gzip, deflate"
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

	var headers = details.requestHeaders;

	for (var i = 0; i < headers.length; ++i) {
		if (HEADER_OVERRIDES.hasOwnProperty(headers[i].name)) {
			headers[i].value = HEADER_OVERRIDES[headers[i].name];
		}
	}

	return {
		requestHeaders: details.requestHeaders
	};
}

function updateBadge(tab_id) {
	var data = tabData.get(tab_id),
		text = '';

	if (data) {
		text = _.size(_.countBy(data.accesses, function (access) {
			return access.obj + '.' + access.prop;
		})).toString();
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

function onMessage(request, sender, sendResponse) {
	var response = {};

	if (request.name == 'injected') {
		response.insertScript = ENABLED;
	} else if (request.name == 'trapped') {
		//if (sender.tab && sender.tab.id) {
		tabData.record(sender.tab.id, request.message);
		updateBadge(sender.tab.id);
		//}
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
	[ "blocking", "requestHeaders" ]
);

// TODO set plugins to "ask by default"

chrome.runtime.onMessage.addListener(onMessage);

chrome.tabs.onRemoved.addListener(tabData.clear);

chrome.webNavigation.onCommitted.addListener(onNavigation);

chrome.browserAction.onClicked.addListener(function (/*tab*/) {
	ENABLED = !ENABLED;
	updateButton();
});

// see if we have any orphan data every five minutes
// TODO switch to chrome.alarms?
setInterval(tabData.clean, 300000);
