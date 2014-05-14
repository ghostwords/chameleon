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

var sendMessage = require('../lib/utils').sendMessage;

function insertScript(src) {
	var head = document.getElementsByTagName('head')[0] || document.documentElement,
		script = document.createElement('script');

	script.textContent = src;

	// TODO onload?
	script.onload = function () {
		head.removeChild(script);
	};

	head.insertBefore(script, head.firstChild);
}

var event_id = Math.random();
// http://stackoverflow.com/questions/9515704/building-a-chrome-extension-inject-code-in-a-page-using-a-content-script
var script = '(' + function (event_id) {

// start of page JS ////////////////////////////////////////////////////////////

	// from underscore-1.6.0.js
	function debounce(func, wait, immediate) {
		var timeout, args, context, timestamp, result;

		var later = function () {
			var last = Date.now() - timestamp;
			if (last < wait) {
				timeout = setTimeout(later, wait - last);
			} else {
				timeout = null;
				if (!immediate) {
					result = func.apply(context, args);
					context = args = null;
				}
			}
		};

		return function () {
			context = this;
			args = arguments;
			timestamp = Date.now();
			var callNow = immediate && !timeout;
			if (!timeout) {
				timeout = setTimeout(later, wait);
			}
			if (callNow) {
				result = func.apply(context, args);
				context = args = null;
			}

			return result;
		};
	}

	// messages the injected script
	var send = (function () {
		var messages = [];

		// debounce sending queued messages
		var _send = debounce(function () {
			document.dispatchEvent(new CustomEvent(event_id, {
				detail: messages
			}));

			// clear the queue
			messages = [];
		}, 100);

		return function (msg) {
			// queue the message
			messages.push(msg);

			_send();
		};
	}());

	function trap(obj, overrides) {
		overrides = overrides || {};

		Object.keys(obj).forEach(function (prop) {
			var desc = Object.getOwnPropertyDescriptor(window, prop);

			if (desc && !desc.configurable) {
				console.log("%s.%s is not configurable", obj, prop);
				return;
			}

			var orig_val = obj[prop];

			//if (orig_val == console || orig_val == console.log) {
			//	return;
			//}

			//console.log("trapping %s.%s ...", obj, prop);

			Object.defineProperty(obj, prop, {
				get: function () {
					console.log("%s.%s prop access", obj, prop);

					send({
						obj: obj.toString().replace(/^\[object ([^\]]+)\]/, '$1'),
						prop: prop.toString()
					});

					if (overrides.hasOwnProperty(prop)) {
						return overrides[prop];
					}

					return orig_val;
				}
			});
		});
	}

	// define nonexistent-in-Chrome properties (to match Tor Browser)
	window.navigator.buildID = "20000101000000";

	// JS objects to trap along with properties to override
	[
		{
			obj: window.navigator,
			overrides: {
				appVersion: "5.0 (Windows)",
				doNotTrack: "unspecified",
				language: "en-US",
				mimeTypes: {
					length: 0
				},
				plugins: {
					length: 0,
					refresh: function () {}
				},
				userAgent: "Mozilla/5.0 (Windows NT 6.1; rv:24.0) Gecko/20100101 Firefox/24.0"
			}
		},
		{
			obj: window.screen,
			overrides: {
				availWidth: 1000,
				availHeight: 700,
				width: 1000,
				height: 700,
				colorDepth: 24
			}
		}
	].forEach(function (item) {
		trap(item.obj, item.overrides);
	});

	// override Date
	window.Date = (function (OrigDate) {
		function NewDate() {
			// convert arguments to array
			var args = [].slice.call(arguments, 0);

			// Date was called as a constructor
			if (this instanceof NewDate) {
				// TODO explain
				var DateFactory = OrigDate.bind.apply(OrigDate, [ OrigDate ].concat(args)),
					date = new DateFactory();

				// TODO make trap work with (standard class) instance function
				date.getTimezoneOffset = function () {
					console.log("date.getTimezoneOffset prop access");

					send({
						obj: 'new Date()',
						prop: 'getTimezoneOffset'
					});

					return 0;
				};
				// TODO take care of toString, etc.

				return date;

			// Date was called as a function
			} else {
				return OrigDate.apply(args);
			}
		}

		// provide class/static methods
		// TODO overriding length doesn't work ... (not writable/configurable?)
		['length', 'now', 'parse', 'UTC'].forEach(function (prop) {
			NewDate[prop] = OrigDate[prop];
		});

		return NewDate;

	}(window.Date));

// end of page JS //////////////////////////////////////////////////////////////

} + '(' + event_id + '));';

// TODO async messaging introduces race condition (page JS could execute before our script)
sendMessage('injected', function (response) {
	if (response.insertScript) {
		// listen for messages from the script we are about to insert
		document.addEventListener(event_id, function (e) {
			// pass these on to the background page
			sendMessage('trapped', e.detail);
		});

		insertScript(script);
	}
});
