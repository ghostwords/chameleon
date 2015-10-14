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

/*
 * Injected via inject.js. Not a content script, no chrome.* API access.
 */

(function (undef, ERROR, navigator) {

	// TODO defend all overridden methods against toString inspection
	// for example:
	//navigator.taintEnabled.toString = function () {
	//	return "function taintEnabled() {\n    [native code]\n}";
	//};

	// TODO unnecessary?
	ERROR.stackTraceLimit = Infinity; // collect all frames

	var event_id = document.currentScript.getAttribute('data-event-id');

	var NAVIGATOR_ENUMERATION = {};

	function log() {
		if (process.env.NODE_ENV == 'development') {
			console.log.apply(console, arguments);
		}
	}

	// from Underscore v1.6.0
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

	var detectNavigatorEnumeration = (function () {
		var accesses = {},
			checkers = {};

		var make_checker = function (script_url) {
			return function () {
				var enumeration = true;

				for (var key in NAVIGATOR_ENUMERATION) {
					if (NAVIGATOR_ENUMERATION.hasOwnProperty(key)) {
						if (!accesses[script_url].hasOwnProperty(key)) {
							enumeration = false;
							break;
						}
					}
				}

				if (enumeration) {
					log("Navigator enumeration detected from", script_url);
					send({
						extra: {
							navigatorEnumeration: true
						},
						scriptUrl: script_url
					});
				}

				// clean up
				delete accesses[script_url];
				delete checkers[script_url];
			};
		};

		return function (prop, script_url) {
			// store the access
			if (!accesses.hasOwnProperty(script_url)) {
				accesses[script_url] = {};
			}
			accesses[script_url][prop] = true;

			// check if enumeration has happened in a bit
			if (!checkers.hasOwnProperty(script_url)) {
				checkers[script_url] = debounce(make_checker(script_url), 90);
			}
			checkers[script_url]();
		};
	}());

	// http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
	function getStackTrace(structured) {
		var err = {}, // TODO should this be new Error() instead?
			origFormatter,
			stack;

		if (structured) {
			origFormatter = ERROR.prepareStackTrace;
			ERROR.prepareStackTrace = function (err, structuredStackTrace) {
				return structuredStackTrace;
			};
		}

		ERROR.captureStackTrace(err, getStackTrace);
		stack = err.stack;

		if (structured) {
			ERROR.prepareStackTrace = origFormatter;
		}

		return stack;
	}

	/*
	TODO Doesn't work when the stack trace contains <anonymous> fileNames.
	For example: http://blogs.wsj.com/digits/2014/07/16/newest-hit-game-maker-machine-zone-nears-3-billion-valuation/
		at Navigator.Object.defineProperty.get [as userAgent] (chrome-extension://.../js/builds/injected.min.js:2:1027)
		at Object.self.doTag (<anonymous>:33:1230)
		at bk_doSendData (<anonymous>:33:2259)
		at Object.blueKai.blueKai.sendBlueKai (<anonymous>:55:3)
		at Object.blueKai.blueKai.getAdsData (<anonymous>:147:8)
		at <anonymous>:1:17
	Seems related to setTimeout use.

	TODO Doesn't work when the script gets loaded via eval.
	For example, see globalEval in http://code.jquery.com/jquery-1.6.4.js,
	used on http://fingerprint.pet-portal.eu/, apparently here:
		$.get("?controller=fingerprint&t="+(new Date().getTime()), function(data) {
			$('body').append(data);
		});
	The stack trace:
		at Navigator.Object.defineProperty.get [as language] (chrome-extension://.../js/builds/injected.min.js:2:1020)
		at start_test (eval at <anonymous> (eval at <anonymous> (http://fingerprint.pet-portal.eu/javascript/jquery.min.js:2:12388)), <anonymous>:1:1079)
	Appears to be double eval'd: once by jQuery and again by Dean Edwards' Packer.
	Another eval'd script example here: http://lomavistarecordings.com/
	*/
	function getOriginatingScriptUrl() {
		var trace = getStackTrace(true);

		// TODO investigate
		if (trace.length < 2) {
			return '';
		}

		// this script is at 0 and 1
		var callSite = trace[2];

		if (callSite.isEval()) {
			// TODO
			/*
			 * CAUTION hangs http://blogs.wsj.com/digits/2014/07/16/newest-hit-game-maker-machine-zone-nears-3-billion-valuation/
			var f = arguments.callee.caller.caller; // jshint ignore:line
			while (f) {
				log('XXX', f);
				f = f.caller;
			}
			*/

			// argh, getEvalOrigin returns a string ...
			var eval_origin = callSite.getEvalOrigin(),
				script_url_matches = eval_origin.match(/\((http.*:\d+:\d+)/);

			return script_url_matches && script_url_matches[1] || eval_origin;
		} else {
			return callSite.getFileName() + ':' + callSite.getLineNumber() + ':' + callSite.getColumnNumber();
		}
	}

	function stripLineAndColumnNumbers(script_url) {
		return script_url.replace(/:\d+:\d+$/, '');
	}

	function getObjectName(o) {
		return o.toString().replace(/^\[object ([^\]]+)\]/, '$1');
	}

	function trap(obj, prop) {
		var desc = Object.getOwnPropertyDescriptor(obj, prop);

		if (desc && !desc.configurable) {
			log("%s.%s is not configurable", obj, prop);
			return;
		}

		var is_navigator = (obj === navigator),
			orig_val = obj[prop];

		//if (orig_val == console || orig_val == console.log) {
		//	return;
		//}

		//log("trapping %s.%s ...", obj, prop);

		Object.defineProperty(obj, prop, {
			get: function () {
				var script_url = getOriginatingScriptUrl();

				log("%s.%s prop access: %s", getObjectName(obj), prop, script_url);
				if (process.env.NODE_ENV == 'development') {
					log(getStackTrace());
				}

				script_url = stripLineAndColumnNumbers(script_url);

				if (is_navigator) {
					detectNavigatorEnumeration(prop, script_url);
				}

				send({
					obj: getObjectName(obj),
					prop: prop.toString(),
					scriptUrl: script_url
				});

				return orig_val;
			}
		});
	}

	function trapInstanceMethod(item) {
		var is_canvas_write = (
			item.propName == 'fillText' || item.propName == 'strokeText'
		);

		item.obj[item.propName] = (function (orig) {

			return function () {
				var args = arguments;

				if (is_canvas_write) {
					// to avoid false positives,
					// bail if the text being written is too short
					if (!args[0] || args[0].length < 5) {
						return orig.apply(this, args);
					}
				}

				var script_url = getOriginatingScriptUrl(),
					msg = {
						obj: item.objName,
						prop: item.propName,
						scriptUrl: stripLineAndColumnNumbers(script_url)
					};

				if (item.hasOwnProperty('extra')) {
					msg.extra = item.extra.apply(this, args);
				}

				log("%s.%s prop access: %s", item.objName, item.propName, script_url);

				send(msg);

				if (is_canvas_write) {
					// optimization: one canvas write is enough,
					// restore original write method
					// to this CanvasRenderingContext2D object instance
					this[item.propName] = orig;
				}

				return orig.apply(this, args);
			};

		}(item.obj[item.propName]));
	}

	// JS objects to trap //////////////////////////////////////////////////////////

	[
		navigator,
		window.screen
	].forEach(function (obj) {
		// trap all enumerable keys on the object and its prototype chain
		for (var prop in obj) { // jshint ignore:line
			if (obj === navigator) {
				NAVIGATOR_ENUMERATION[prop] = true;
			}
			trap(obj, prop);
		}
	});

	trap(window, 'devicePixelRatio');
	trap(window, 'innerWidth');
	trap(window, 'innerHeight');

	// TODO breaks setting document.cookie since there is a getter but no setter
	//trap(document, 'cookie');

	// TODO document.body might not yet be available at this point
	//trap(document.body, 'clientWidth');
	//trap(document.body, 'clientHeight');

	trap(document.documentElement, 'clientWidth');
	trap(document.documentElement, 'clientHeight');

	// trap instance methods ///////////////////////////////////////////////////////

	var methods = [
		// Date
		{
			objName: 'Date.prototype',
			propName: 'getTimezoneOffset',
			obj: Date.prototype
		},

		// WebGL
		{
			objName: 'WebGLRenderingContext.prototype',
			propName: 'getParameter',
			obj: window.WebGLRenderingContext.prototype
		},
		{
			objName: 'WebGLRenderingContext.prototype',
			propName: 'getSupportedExtensions',
			obj: window.WebGLRenderingContext.prototype
		}
	];

	// canvas fingerprinting
	['getImageData', 'fillText', 'strokeText'].forEach(function (method) {
		var item = {
			objName: 'CanvasRenderingContext2D.prototype',
			propName: method,
			obj: CanvasRenderingContext2D.prototype,
			extra: function () {
				return {
					canvas: true
				};
			}
		};

		if (method == 'getImageData') {
			item.extra = (function (getImageDataOrig, toDataURLOrig) {
				return function () {
					var args = arguments,
						width = args[2],
						height = args[3];

					// "this" is a CanvasRenderingContext2D object
					if (width === undef) {
						width = this.canvas.width;
					}
					if (height === undef) {
						height = this.canvas.height;
					}

					return {
						canvas: true,
						dataURL: (function () {
							var el = document.createElement('canvas');
							el.width = width;
							el.height = height;
							el.getContext('2d').putImageData(
								getImageDataOrig.call(
									this, 0, 0, width, height
								), 0, 0
							);
							return toDataURLOrig.call(el);
						}.call(this)),
						width: width,
						height: height
					};
				};
			}(CanvasRenderingContext2D.prototype.getImageData, HTMLCanvasElement.prototype.toDataURL));
		}

		methods.push(item);
	});
	methods.push({
		objName: 'HTMLCanvasElement.prototype',
		propName: 'toDataURL',
		obj: HTMLCanvasElement.prototype,
		extra: (function (toDataURLOrig) {
			return function () {
				// "this" is a canvas element
				return {
					canvas: true,
					dataURL: toDataURLOrig.call(this),
					width: this.width,
					height: this.height
				};
			};
		}(HTMLCanvasElement.prototype.toDataURL))
	});

	methods.forEach(trapInstanceMethod);

	// trap constructors ///////////////////////////////////////////////////////////

	// from http://nullprogram.com/blog/2013/03/24/
	function create(constructor) {
		var Factory = constructor.bind.apply(constructor, arguments);
		return new Factory();
	}
	[
		// WebRTC
		{
			obj: window,
			prop: 'RTCPeerConnection'
		},
		{
			obj: window,
			prop: 'webkitRTCPeerConnection'
		}
	].forEach(function (item) {
		if (item.obj.hasOwnProperty(item.prop)) {
			item.obj[item.prop] = (function (Orig) {
				return function () {
					var script_url = getOriginatingScriptUrl();

					log("%s constructor call: %s", item.prop, script_url);
					send({
						obj: item.prop,
						scriptUrl: stripLineAndColumnNumbers(script_url)
					});

					var args = [Orig].concat(Array.prototype.slice.call(arguments));
					return create.apply(this, args);
				};
			}(item.obj[item.prop]));
		}
	});

	// font enumeration detection workaround ///////////////////////////////////////

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

			log(fonts); // TODO

			if (fonts.length > 2) {
				log(mutation); // TODO

				// TODO since MutationObserver is async, a stack trace now
				// TODO won't get us the script that originated the scanning
				send({
					extra: {
						fontEnumeration: true
					}
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

// save locally to keep from getting overwritten by site code
}(undefined, Error, window.navigator));
