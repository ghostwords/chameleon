/*!
 * Chameleon
 *
 * Copyright 2014 ghostwords. All rights reserved.
 */

var ALL_URLS = { urls: ['http://*/*', 'https://*/*'] },
	ENABLED = false;

var HEADER_OVERRIDES = {
	'User-Agent': "Mozilla/5.0 (Windows NT 6.1; rv:24.0) Gecko/20100101 Firefox/24.0",
	'Accept': "text/html, */*",
	'Accept-Language': "en-us,en;q=0.5",
	'Accept-Encoding': "gzip, deflate"
};

// TODO handlerBehaviorChanged, etc.: https://developer.chrome.com/extensions/webRequest#implementation
function filterRequests(details) {
	var cancel = false;

	if (!ENABLED) {
		return;
	}

	console.log("onBeforeRequest: %o", details);

	return {
		cancel: cancel
	};
}

function normalizeHeaders(details) {
	var headers = details.requestHeaders;

	if (!ENABLED) {
		return;
	}

	console.log("onBeforeSendHeaders: %o", details);

	for (var i = 0; i < headers.length; ++i) {
		if (HEADER_OVERRIDES.hasOwnProperty(headers[i].name)) {
			headers[i].value = HEADER_OVERRIDES[headers[i].name];
		}
	}

	return {
		requestHeaders: details.requestHeaders
	};
}

function updateButton() {
	chrome.browserAction.setIcon({
		path: {
			19: 'icons/19' + (ENABLED ? '' : '_off') + '.png',
			38: 'icons/38' + (ENABLED ? '' : '_off') + '.png'
		}
	});
}

chrome.webRequest.onBeforeRequest.addListener(
	filterRequests,
	ALL_URLS,
	[ "blocking" ]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
	normalizeHeaders,
	ALL_URLS,
	[ "blocking", "requestHeaders" ]
);

// TODO set plugins to "ask by default"

//chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
//	console.log(request);
//	console.log(sender);
//	sendResponse({});
//});

chrome.browserAction.onClicked.addListener(function (/*tab*/) {
	ENABLED = !ENABLED;
	updateButton();
});
