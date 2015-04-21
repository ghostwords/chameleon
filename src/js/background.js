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


// globals /////////////////////////////////////////////////////////////////////


var _ = require('underscore');

//var ALL_URLS = { urls: ['http://*/*', 'https://*/*'] };

var score = require('../lib/score').scoreScriptActivity,
	sendMessage = require('../lib/content_script_utils').sendMessage,
	tabData = require('../lib/tabdata'),
	whitelist = require('../lib/whitelist');


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

function isInvalidPage(url) {
	return (url.indexOf('http') !== 0 ||
		url.indexOf('https://chrome.google.com/webstore/') === 0);
}

function isEnabled(tab_id) {
	var data = tabData.get(tab_id);
	return data.injected && !isInvalidPage(data.url) && !whitelist.whitelisted(data.hostname);
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
		invalid_page: isInvalidPage(tab.url),
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

// TODO set plugins to "ask by default"

chrome.runtime.onMessage.addListener(onMessage);

chrome.tabs.onRemoved.addListener(tabData.clear);

chrome.webNavigation.onCommitted.addListener(onNavigation);

// see if we have any orphan data every five minutes
// TODO switch to chrome.alarms?
setInterval(tabData.clean, 300000);
