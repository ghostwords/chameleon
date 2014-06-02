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

	function getName(o) {
		return o.toString().replace(/^\[object ([^\]]+)\]/, '$1');
	}

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
						obj: getName(obj),
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

	// protect against font enumeration
	// TODO https://gitweb.torproject.org/torbrowser.git/blob_plain/HEAD:/src/current-patches/firefox/0010-Limit-the-number-of-fonts-per-document.patch
	//
	// TODO current implementation doesn't cover all the ways elements can get
	// TODO created like innerHTML
	// TODO http://www.lalit.org/lab/javascript-css-font-detect/ -- uses createElement directly
	// TODO http://flippingtypical.com/ -- uses jQuery, which doesn't use createElement ...
	//
	// TODO the proper way (overriding fontFamily getters/setters on the
	// TODO CSSStyleDeclaration prototype) doesn't work, at least in Chrome
	//
	// TODO http://stackoverflow.com/questions/19775573/override-element-stylesheet-csstext
	// TODO https://code.google.com/p/chromium/issues/detail?id=90335
	// TODO https://www.google.com/search?q=cssstyledeclaration+prototype+defineProperty
	//
	// TODO ??? breaks icons above submit form on stackoverflow pages, makes google search visually funky, ...
	/*
	document.createElement = (function (orig) {
		return function () {
			var el = orig.apply(document, arguments),
				origStyle = el.style,
				style = Object.create(window.CSSStyleDeclaration.prototype);

			// wrap CSSStyleDeclaration
			['cssText', 'fontFamily'].forEach(function (prop) {
				Object.defineProperty(style, prop, {
					set: function (val) {
						console.log("setting %s to %s", prop, val);
						origStyle[prop] = val;
					},
					get: function () {
						return origStyle[prop];
					}
				});
			});

			// replace native style prop with our wrapped CSSStyleDeclaration
			Object.defineProperty(el, 'style', {
				get: function () {
					return style;
				}
			});

			return el;
		};
	}(document.createElement));
	*/
	/*
	window.HTMLElement.prototype.setAttribute = (function (orig) {
		return function () {
			console.log("setAttribute called: %o", arguments);
			return orig.apply(this, arguments);
		};
	}(window.HTMLElement.prototype.setAttribute));
	*/
	/*
	window.CSSStyleDeclaration.prototype.setProperty = (function (orig) {
		//return function (name, value, priority) {
		return function (name) {
			if (name == 'font-family') {
				send({
					obj: 'CSSStyleDeclaration.prototype',
					prop: 'setProperty(\'fontFamily\', ...)'
				});
			}

			console.log("CSSStyleDeclaration.prototype.setProperty called: %o", arguments);

			return orig.apply(this, arguments);
		};
	}(window.CSSStyleDeclaration.prototype.setProperty));
	*/

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

	// detect font enumeration
	var observer = new MutationObserver(function (mutations) {
		for (var i = 0; i < mutations.length; i++) {
			var mutation = mutations[i];

			if (!mutation.oldValue || mutation.oldValue.indexOf('font-family: ') == -1) {
				continue;
			}

			var target = mutation.target,
				old_font = mutation.oldValue.match(/font-family: ([^;]+);/)[1],
				fonts = [];

			// TODO switch to WeakMaps
			// TODO https://github.com/Benvie/WeakMap
			// TODO https://gist.github.com/Gozala/1269991
			if (!(event_id in target.dataset)) {
				target.dataset[event_id] = '';
			} else {
				fonts = target.dataset[event_id].split(';');
			}

			if (fonts.indexOf(old_font) == -1) {
				fonts.push(old_font);
			}

			console.log(fonts); // TODO

			if (fonts.length > 2) {
				console.log(mutation); // TODO

				send({
					obj: getName(target),
					prop: 'style.fontFamily',
				});

				// no need to keep listening
				observer.disconnect();

				break;
			}

			target.dataset[event_id] = fonts.join(';');
		}
	});
	observer.observe(document, {
		attribute: true,
		// TODO more precise filtering?
		attributeFilter: ['style'],
		attributeOldValue: true,
		childList: false,
		subtree: true
	});

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
