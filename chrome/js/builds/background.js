webpackJsonp([4],{

/***/ 0:
/***/ function(module, exports, __webpack_require__) {

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
	
	var _ = __webpack_require__(77);
	
	var ALL_URLS = { urls: ['http://*/*', 'https://*/*'] },
		ENABLED = true;
	
	var tabData = __webpack_require__(81),
		sendMessage = __webpack_require__(32).sendMessage,
		utils = __webpack_require__(79);
	
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
	
	function updateBadge(tab_id) {
		var data = tabData.get(tab_id),
			count = 0;
	
		if (data) {
			count = utils.getFingerprinterCount(data.domains);
		}
	
		if (count) {
			chrome.browserAction.setBadgeText({
				tabId: tab_id,
				text: count.toString()
			});
		}
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
		return _.extend({ enabled: ENABLED }, tabData.get(tab_id));
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
	
	updateButton();
	
	// see if we have any orphan data every five minutes
	// TODO switch to chrome.alarms?
	setInterval(tabData.clean, 300000);


/***/ },

/***/ 77:
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;//     Underscore.js 1.6.0
	//     http://underscorejs.org
	//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	//     Underscore may be freely distributed under the MIT license.
	
	(function() {
	
	  // Baseline setup
	  // --------------
	
	  // Establish the root object, `window` in the browser, or `exports` on the server.
	  var root = this;
	
	  // Save the previous value of the `_` variable.
	  var previousUnderscore = root._;
	
	  // Establish the object that gets returned to break out of a loop iteration.
	  var breaker = {};
	
	  // Save bytes in the minified (but not gzipped) version:
	  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;
	
	  // Create quick reference variables for speed access to core prototypes.
	  var
	    push             = ArrayProto.push,
	    slice            = ArrayProto.slice,
	    concat           = ArrayProto.concat,
	    toString         = ObjProto.toString,
	    hasOwnProperty   = ObjProto.hasOwnProperty;
	
	  // All **ECMAScript 5** native function implementations that we hope to use
	  // are declared here.
	  var
	    nativeForEach      = ArrayProto.forEach,
	    nativeMap          = ArrayProto.map,
	    nativeReduce       = ArrayProto.reduce,
	    nativeReduceRight  = ArrayProto.reduceRight,
	    nativeFilter       = ArrayProto.filter,
	    nativeEvery        = ArrayProto.every,
	    nativeSome         = ArrayProto.some,
	    nativeIndexOf      = ArrayProto.indexOf,
	    nativeLastIndexOf  = ArrayProto.lastIndexOf,
	    nativeIsArray      = Array.isArray,
	    nativeKeys         = Object.keys,
	    nativeBind         = FuncProto.bind;
	
	  // Create a safe reference to the Underscore object for use below.
	  var _ = function(obj) {
	    if (obj instanceof _) return obj;
	    if (!(this instanceof _)) return new _(obj);
	    this._wrapped = obj;
	  };
	
	  // Export the Underscore object for **Node.js**, with
	  // backwards-compatibility for the old `require()` API. If we're in
	  // the browser, add `_` as a global object via a string identifier,
	  // for Closure Compiler "advanced" mode.
	  if (true) {
	    if (typeof module !== 'undefined' && module.exports) {
	      exports = module.exports = _;
	    }
	    exports._ = _;
	  } else {
	    root._ = _;
	  }
	
	  // Current version.
	  _.VERSION = '1.6.0';
	
	  // Collection Functions
	  // --------------------
	
	  // The cornerstone, an `each` implementation, aka `forEach`.
	  // Handles objects with the built-in `forEach`, arrays, and raw objects.
	  // Delegates to **ECMAScript 5**'s native `forEach` if available.
	  var each = _.each = _.forEach = function(obj, iterator, context) {
	    if (obj == null) return obj;
	    if (nativeForEach && obj.forEach === nativeForEach) {
	      obj.forEach(iterator, context);
	    } else if (obj.length === +obj.length) {
	      for (var i = 0, length = obj.length; i < length; i++) {
	        if (iterator.call(context, obj[i], i, obj) === breaker) return;
	      }
	    } else {
	      var keys = _.keys(obj);
	      for (var i = 0, length = keys.length; i < length; i++) {
	        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
	      }
	    }
	    return obj;
	  };
	
	  // Return the results of applying the iterator to each element.
	  // Delegates to **ECMAScript 5**'s native `map` if available.
	  _.map = _.collect = function(obj, iterator, context) {
	    var results = [];
	    if (obj == null) return results;
	    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
	    each(obj, function(value, index, list) {
	      results.push(iterator.call(context, value, index, list));
	    });
	    return results;
	  };
	
	  var reduceError = 'Reduce of empty array with no initial value';
	
	  // **Reduce** builds up a single result from a list of values, aka `inject`,
	  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
	  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
	    var initial = arguments.length > 2;
	    if (obj == null) obj = [];
	    if (nativeReduce && obj.reduce === nativeReduce) {
	      if (context) iterator = _.bind(iterator, context);
	      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
	    }
	    each(obj, function(value, index, list) {
	      if (!initial) {
	        memo = value;
	        initial = true;
	      } else {
	        memo = iterator.call(context, memo, value, index, list);
	      }
	    });
	    if (!initial) throw new TypeError(reduceError);
	    return memo;
	  };
	
	  // The right-associative version of reduce, also known as `foldr`.
	  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
	  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
	    var initial = arguments.length > 2;
	    if (obj == null) obj = [];
	    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
	      if (context) iterator = _.bind(iterator, context);
	      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
	    }
	    var length = obj.length;
	    if (length !== +length) {
	      var keys = _.keys(obj);
	      length = keys.length;
	    }
	    each(obj, function(value, index, list) {
	      index = keys ? keys[--length] : --length;
	      if (!initial) {
	        memo = obj[index];
	        initial = true;
	      } else {
	        memo = iterator.call(context, memo, obj[index], index, list);
	      }
	    });
	    if (!initial) throw new TypeError(reduceError);
	    return memo;
	  };
	
	  // Return the first value which passes a truth test. Aliased as `detect`.
	  _.find = _.detect = function(obj, predicate, context) {
	    var result;
	    any(obj, function(value, index, list) {
	      if (predicate.call(context, value, index, list)) {
	        result = value;
	        return true;
	      }
	    });
	    return result;
	  };
	
	  // Return all the elements that pass a truth test.
	  // Delegates to **ECMAScript 5**'s native `filter` if available.
	  // Aliased as `select`.
	  _.filter = _.select = function(obj, predicate, context) {
	    var results = [];
	    if (obj == null) return results;
	    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
	    each(obj, function(value, index, list) {
	      if (predicate.call(context, value, index, list)) results.push(value);
	    });
	    return results;
	  };
	
	  // Return all the elements for which a truth test fails.
	  _.reject = function(obj, predicate, context) {
	    return _.filter(obj, function(value, index, list) {
	      return !predicate.call(context, value, index, list);
	    }, context);
	  };
	
	  // Determine whether all of the elements match a truth test.
	  // Delegates to **ECMAScript 5**'s native `every` if available.
	  // Aliased as `all`.
	  _.every = _.all = function(obj, predicate, context) {
	    predicate || (predicate = _.identity);
	    var result = true;
	    if (obj == null) return result;
	    if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
	    each(obj, function(value, index, list) {
	      if (!(result = result && predicate.call(context, value, index, list))) return breaker;
	    });
	    return !!result;
	  };
	
	  // Determine if at least one element in the object matches a truth test.
	  // Delegates to **ECMAScript 5**'s native `some` if available.
	  // Aliased as `any`.
	  var any = _.some = _.any = function(obj, predicate, context) {
	    predicate || (predicate = _.identity);
	    var result = false;
	    if (obj == null) return result;
	    if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
	    each(obj, function(value, index, list) {
	      if (result || (result = predicate.call(context, value, index, list))) return breaker;
	    });
	    return !!result;
	  };
	
	  // Determine if the array or object contains a given value (using `===`).
	  // Aliased as `include`.
	  _.contains = _.include = function(obj, target) {
	    if (obj == null) return false;
	    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
	    return any(obj, function(value) {
	      return value === target;
	    });
	  };
	
	  // Invoke a method (with arguments) on every item in a collection.
	  _.invoke = function(obj, method) {
	    var args = slice.call(arguments, 2);
	    var isFunc = _.isFunction(method);
	    return _.map(obj, function(value) {
	      return (isFunc ? method : value[method]).apply(value, args);
	    });
	  };
	
	  // Convenience version of a common use case of `map`: fetching a property.
	  _.pluck = function(obj, key) {
	    return _.map(obj, _.property(key));
	  };
	
	  // Convenience version of a common use case of `filter`: selecting only objects
	  // containing specific `key:value` pairs.
	  _.where = function(obj, attrs) {
	    return _.filter(obj, _.matches(attrs));
	  };
	
	  // Convenience version of a common use case of `find`: getting the first object
	  // containing specific `key:value` pairs.
	  _.findWhere = function(obj, attrs) {
	    return _.find(obj, _.matches(attrs));
	  };
	
	  // Return the maximum element or (element-based computation).
	  // Can't optimize arrays of integers longer than 65,535 elements.
	  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
	  _.max = function(obj, iterator, context) {
	    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
	      return Math.max.apply(Math, obj);
	    }
	    var result = -Infinity, lastComputed = -Infinity;
	    each(obj, function(value, index, list) {
	      var computed = iterator ? iterator.call(context, value, index, list) : value;
	      if (computed > lastComputed) {
	        result = value;
	        lastComputed = computed;
	      }
	    });
	    return result;
	  };
	
	  // Return the minimum element (or element-based computation).
	  _.min = function(obj, iterator, context) {
	    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
	      return Math.min.apply(Math, obj);
	    }
	    var result = Infinity, lastComputed = Infinity;
	    each(obj, function(value, index, list) {
	      var computed = iterator ? iterator.call(context, value, index, list) : value;
	      if (computed < lastComputed) {
	        result = value;
	        lastComputed = computed;
	      }
	    });
	    return result;
	  };
	
	  // Shuffle an array, using the modern version of the
	  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
	  _.shuffle = function(obj) {
	    var rand;
	    var index = 0;
	    var shuffled = [];
	    each(obj, function(value) {
	      rand = _.random(index++);
	      shuffled[index - 1] = shuffled[rand];
	      shuffled[rand] = value;
	    });
	    return shuffled;
	  };
	
	  // Sample **n** random values from a collection.
	  // If **n** is not specified, returns a single random element.
	  // The internal `guard` argument allows it to work with `map`.
	  _.sample = function(obj, n, guard) {
	    if (n == null || guard) {
	      if (obj.length !== +obj.length) obj = _.values(obj);
	      return obj[_.random(obj.length - 1)];
	    }
	    return _.shuffle(obj).slice(0, Math.max(0, n));
	  };
	
	  // An internal function to generate lookup iterators.
	  var lookupIterator = function(value) {
	    if (value == null) return _.identity;
	    if (_.isFunction(value)) return value;
	    return _.property(value);
	  };
	
	  // Sort the object's values by a criterion produced by an iterator.
	  _.sortBy = function(obj, iterator, context) {
	    iterator = lookupIterator(iterator);
	    return _.pluck(_.map(obj, function(value, index, list) {
	      return {
	        value: value,
	        index: index,
	        criteria: iterator.call(context, value, index, list)
	      };
	    }).sort(function(left, right) {
	      var a = left.criteria;
	      var b = right.criteria;
	      if (a !== b) {
	        if (a > b || a === void 0) return 1;
	        if (a < b || b === void 0) return -1;
	      }
	      return left.index - right.index;
	    }), 'value');
	  };
	
	  // An internal function used for aggregate "group by" operations.
	  var group = function(behavior) {
	    return function(obj, iterator, context) {
	      var result = {};
	      iterator = lookupIterator(iterator);
	      each(obj, function(value, index) {
	        var key = iterator.call(context, value, index, obj);
	        behavior(result, key, value);
	      });
	      return result;
	    };
	  };
	
	  // Groups the object's values by a criterion. Pass either a string attribute
	  // to group by, or a function that returns the criterion.
	  _.groupBy = group(function(result, key, value) {
	    _.has(result, key) ? result[key].push(value) : result[key] = [value];
	  });
	
	  // Indexes the object's values by a criterion, similar to `groupBy`, but for
	  // when you know that your index values will be unique.
	  _.indexBy = group(function(result, key, value) {
	    result[key] = value;
	  });
	
	  // Counts instances of an object that group by a certain criterion. Pass
	  // either a string attribute to count by, or a function that returns the
	  // criterion.
	  _.countBy = group(function(result, key) {
	    _.has(result, key) ? result[key]++ : result[key] = 1;
	  });
	
	  // Use a comparator function to figure out the smallest index at which
	  // an object should be inserted so as to maintain order. Uses binary search.
	  _.sortedIndex = function(array, obj, iterator, context) {
	    iterator = lookupIterator(iterator);
	    var value = iterator.call(context, obj);
	    var low = 0, high = array.length;
	    while (low < high) {
	      var mid = (low + high) >>> 1;
	      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
	    }
	    return low;
	  };
	
	  // Safely create a real, live array from anything iterable.
	  _.toArray = function(obj) {
	    if (!obj) return [];
	    if (_.isArray(obj)) return slice.call(obj);
	    if (obj.length === +obj.length) return _.map(obj, _.identity);
	    return _.values(obj);
	  };
	
	  // Return the number of elements in an object.
	  _.size = function(obj) {
	    if (obj == null) return 0;
	    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
	  };
	
	  // Array Functions
	  // ---------------
	
	  // Get the first element of an array. Passing **n** will return the first N
	  // values in the array. Aliased as `head` and `take`. The **guard** check
	  // allows it to work with `_.map`.
	  _.first = _.head = _.take = function(array, n, guard) {
	    if (array == null) return void 0;
	    if ((n == null) || guard) return array[0];
	    if (n < 0) return [];
	    return slice.call(array, 0, n);
	  };
	
	  // Returns everything but the last entry of the array. Especially useful on
	  // the arguments object. Passing **n** will return all the values in
	  // the array, excluding the last N. The **guard** check allows it to work with
	  // `_.map`.
	  _.initial = function(array, n, guard) {
	    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
	  };
	
	  // Get the last element of an array. Passing **n** will return the last N
	  // values in the array. The **guard** check allows it to work with `_.map`.
	  _.last = function(array, n, guard) {
	    if (array == null) return void 0;
	    if ((n == null) || guard) return array[array.length - 1];
	    return slice.call(array, Math.max(array.length - n, 0));
	  };
	
	  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
	  // Especially useful on the arguments object. Passing an **n** will return
	  // the rest N values in the array. The **guard**
	  // check allows it to work with `_.map`.
	  _.rest = _.tail = _.drop = function(array, n, guard) {
	    return slice.call(array, (n == null) || guard ? 1 : n);
	  };
	
	  // Trim out all falsy values from an array.
	  _.compact = function(array) {
	    return _.filter(array, _.identity);
	  };
	
	  // Internal implementation of a recursive `flatten` function.
	  var flatten = function(input, shallow, output) {
	    if (shallow && _.every(input, _.isArray)) {
	      return concat.apply(output, input);
	    }
	    each(input, function(value) {
	      if (_.isArray(value) || _.isArguments(value)) {
	        shallow ? push.apply(output, value) : flatten(value, shallow, output);
	      } else {
	        output.push(value);
	      }
	    });
	    return output;
	  };
	
	  // Flatten out an array, either recursively (by default), or just one level.
	  _.flatten = function(array, shallow) {
	    return flatten(array, shallow, []);
	  };
	
	  // Return a version of the array that does not contain the specified value(s).
	  _.without = function(array) {
	    return _.difference(array, slice.call(arguments, 1));
	  };
	
	  // Split an array into two arrays: one whose elements all satisfy the given
	  // predicate, and one whose elements all do not satisfy the predicate.
	  _.partition = function(array, predicate) {
	    var pass = [], fail = [];
	    each(array, function(elem) {
	      (predicate(elem) ? pass : fail).push(elem);
	    });
	    return [pass, fail];
	  };
	
	  // Produce a duplicate-free version of the array. If the array has already
	  // been sorted, you have the option of using a faster algorithm.
	  // Aliased as `unique`.
	  _.uniq = _.unique = function(array, isSorted, iterator, context) {
	    if (_.isFunction(isSorted)) {
	      context = iterator;
	      iterator = isSorted;
	      isSorted = false;
	    }
	    var initial = iterator ? _.map(array, iterator, context) : array;
	    var results = [];
	    var seen = [];
	    each(initial, function(value, index) {
	      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
	        seen.push(value);
	        results.push(array[index]);
	      }
	    });
	    return results;
	  };
	
	  // Produce an array that contains the union: each distinct element from all of
	  // the passed-in arrays.
	  _.union = function() {
	    return _.uniq(_.flatten(arguments, true));
	  };
	
	  // Produce an array that contains every item shared between all the
	  // passed-in arrays.
	  _.intersection = function(array) {
	    var rest = slice.call(arguments, 1);
	    return _.filter(_.uniq(array), function(item) {
	      return _.every(rest, function(other) {
	        return _.contains(other, item);
	      });
	    });
	  };
	
	  // Take the difference between one array and a number of other arrays.
	  // Only the elements present in just the first array will remain.
	  _.difference = function(array) {
	    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
	    return _.filter(array, function(value){ return !_.contains(rest, value); });
	  };
	
	  // Zip together multiple lists into a single array -- elements that share
	  // an index go together.
	  _.zip = function() {
	    var length = _.max(_.pluck(arguments, 'length').concat(0));
	    var results = new Array(length);
	    for (var i = 0; i < length; i++) {
	      results[i] = _.pluck(arguments, '' + i);
	    }
	    return results;
	  };
	
	  // Converts lists into objects. Pass either a single array of `[key, value]`
	  // pairs, or two parallel arrays of the same length -- one of keys, and one of
	  // the corresponding values.
	  _.object = function(list, values) {
	    if (list == null) return {};
	    var result = {};
	    for (var i = 0, length = list.length; i < length; i++) {
	      if (values) {
	        result[list[i]] = values[i];
	      } else {
	        result[list[i][0]] = list[i][1];
	      }
	    }
	    return result;
	  };
	
	  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
	  // we need this function. Return the position of the first occurrence of an
	  // item in an array, or -1 if the item is not included in the array.
	  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
	  // If the array is large and already in sort order, pass `true`
	  // for **isSorted** to use binary search.
	  _.indexOf = function(array, item, isSorted) {
	    if (array == null) return -1;
	    var i = 0, length = array.length;
	    if (isSorted) {
	      if (typeof isSorted == 'number') {
	        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
	      } else {
	        i = _.sortedIndex(array, item);
	        return array[i] === item ? i : -1;
	      }
	    }
	    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
	    for (; i < length; i++) if (array[i] === item) return i;
	    return -1;
	  };
	
	  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
	  _.lastIndexOf = function(array, item, from) {
	    if (array == null) return -1;
	    var hasIndex = from != null;
	    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
	      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
	    }
	    var i = (hasIndex ? from : array.length);
	    while (i--) if (array[i] === item) return i;
	    return -1;
	  };
	
	  // Generate an integer Array containing an arithmetic progression. A port of
	  // the native Python `range()` function. See
	  // [the Python documentation](http://docs.python.org/library/functions.html#range).
	  _.range = function(start, stop, step) {
	    if (arguments.length <= 1) {
	      stop = start || 0;
	      start = 0;
	    }
	    step = arguments[2] || 1;
	
	    var length = Math.max(Math.ceil((stop - start) / step), 0);
	    var idx = 0;
	    var range = new Array(length);
	
	    while(idx < length) {
	      range[idx++] = start;
	      start += step;
	    }
	
	    return range;
	  };
	
	  // Function (ahem) Functions
	  // ------------------
	
	  // Reusable constructor function for prototype setting.
	  var ctor = function(){};
	
	  // Create a function bound to a given object (assigning `this`, and arguments,
	  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
	  // available.
	  _.bind = function(func, context) {
	    var args, bound;
	    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
	    if (!_.isFunction(func)) throw new TypeError;
	    args = slice.call(arguments, 2);
	    return bound = function() {
	      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
	      ctor.prototype = func.prototype;
	      var self = new ctor;
	      ctor.prototype = null;
	      var result = func.apply(self, args.concat(slice.call(arguments)));
	      if (Object(result) === result) return result;
	      return self;
	    };
	  };
	
	  // Partially apply a function by creating a version that has had some of its
	  // arguments pre-filled, without changing its dynamic `this` context. _ acts
	  // as a placeholder, allowing any combination of arguments to be pre-filled.
	  _.partial = function(func) {
	    var boundArgs = slice.call(arguments, 1);
	    return function() {
	      var position = 0;
	      var args = boundArgs.slice();
	      for (var i = 0, length = args.length; i < length; i++) {
	        if (args[i] === _) args[i] = arguments[position++];
	      }
	      while (position < arguments.length) args.push(arguments[position++]);
	      return func.apply(this, args);
	    };
	  };
	
	  // Bind a number of an object's methods to that object. Remaining arguments
	  // are the method names to be bound. Useful for ensuring that all callbacks
	  // defined on an object belong to it.
	  _.bindAll = function(obj) {
	    var funcs = slice.call(arguments, 1);
	    if (funcs.length === 0) throw new Error('bindAll must be passed function names');
	    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
	    return obj;
	  };
	
	  // Memoize an expensive function by storing its results.
	  _.memoize = function(func, hasher) {
	    var memo = {};
	    hasher || (hasher = _.identity);
	    return function() {
	      var key = hasher.apply(this, arguments);
	      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
	    };
	  };
	
	  // Delays a function for the given number of milliseconds, and then calls
	  // it with the arguments supplied.
	  _.delay = function(func, wait) {
	    var args = slice.call(arguments, 2);
	    return setTimeout(function(){ return func.apply(null, args); }, wait);
	  };
	
	  // Defers a function, scheduling it to run after the current call stack has
	  // cleared.
	  _.defer = function(func) {
	    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
	  };
	
	  // Returns a function, that, when invoked, will only be triggered at most once
	  // during a given window of time. Normally, the throttled function will run
	  // as much as it can, without ever going more than once per `wait` duration;
	  // but if you'd like to disable the execution on the leading edge, pass
	  // `{leading: false}`. To disable execution on the trailing edge, ditto.
	  _.throttle = function(func, wait, options) {
	    var context, args, result;
	    var timeout = null;
	    var previous = 0;
	    options || (options = {});
	    var later = function() {
	      previous = options.leading === false ? 0 : _.now();
	      timeout = null;
	      result = func.apply(context, args);
	      context = args = null;
	    };
	    return function() {
	      var now = _.now();
	      if (!previous && options.leading === false) previous = now;
	      var remaining = wait - (now - previous);
	      context = this;
	      args = arguments;
	      if (remaining <= 0) {
	        clearTimeout(timeout);
	        timeout = null;
	        previous = now;
	        result = func.apply(context, args);
	        context = args = null;
	      } else if (!timeout && options.trailing !== false) {
	        timeout = setTimeout(later, remaining);
	      }
	      return result;
	    };
	  };
	
	  // Returns a function, that, as long as it continues to be invoked, will not
	  // be triggered. The function will be called after it stops being called for
	  // N milliseconds. If `immediate` is passed, trigger the function on the
	  // leading edge, instead of the trailing.
	  _.debounce = function(func, wait, immediate) {
	    var timeout, args, context, timestamp, result;
	
	    var later = function() {
	      var last = _.now() - timestamp;
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
	
	    return function() {
	      context = this;
	      args = arguments;
	      timestamp = _.now();
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
	  };
	
	  // Returns a function that will be executed at most one time, no matter how
	  // often you call it. Useful for lazy initialization.
	  _.once = function(func) {
	    var ran = false, memo;
	    return function() {
	      if (ran) return memo;
	      ran = true;
	      memo = func.apply(this, arguments);
	      func = null;
	      return memo;
	    };
	  };
	
	  // Returns the first function passed as an argument to the second,
	  // allowing you to adjust arguments, run code before and after, and
	  // conditionally execute the original function.
	  _.wrap = function(func, wrapper) {
	    return _.partial(wrapper, func);
	  };
	
	  // Returns a function that is the composition of a list of functions, each
	  // consuming the return value of the function that follows.
	  _.compose = function() {
	    var funcs = arguments;
	    return function() {
	      var args = arguments;
	      for (var i = funcs.length - 1; i >= 0; i--) {
	        args = [funcs[i].apply(this, args)];
	      }
	      return args[0];
	    };
	  };
	
	  // Returns a function that will only be executed after being called N times.
	  _.after = function(times, func) {
	    return function() {
	      if (--times < 1) {
	        return func.apply(this, arguments);
	      }
	    };
	  };
	
	  // Object Functions
	  // ----------------
	
	  // Retrieve the names of an object's properties.
	  // Delegates to **ECMAScript 5**'s native `Object.keys`
	  _.keys = function(obj) {
	    if (!_.isObject(obj)) return [];
	    if (nativeKeys) return nativeKeys(obj);
	    var keys = [];
	    for (var key in obj) if (_.has(obj, key)) keys.push(key);
	    return keys;
	  };
	
	  // Retrieve the values of an object's properties.
	  _.values = function(obj) {
	    var keys = _.keys(obj);
	    var length = keys.length;
	    var values = new Array(length);
	    for (var i = 0; i < length; i++) {
	      values[i] = obj[keys[i]];
	    }
	    return values;
	  };
	
	  // Convert an object into a list of `[key, value]` pairs.
	  _.pairs = function(obj) {
	    var keys = _.keys(obj);
	    var length = keys.length;
	    var pairs = new Array(length);
	    for (var i = 0; i < length; i++) {
	      pairs[i] = [keys[i], obj[keys[i]]];
	    }
	    return pairs;
	  };
	
	  // Invert the keys and values of an object. The values must be serializable.
	  _.invert = function(obj) {
	    var result = {};
	    var keys = _.keys(obj);
	    for (var i = 0, length = keys.length; i < length; i++) {
	      result[obj[keys[i]]] = keys[i];
	    }
	    return result;
	  };
	
	  // Return a sorted list of the function names available on the object.
	  // Aliased as `methods`
	  _.functions = _.methods = function(obj) {
	    var names = [];
	    for (var key in obj) {
	      if (_.isFunction(obj[key])) names.push(key);
	    }
	    return names.sort();
	  };
	
	  // Extend a given object with all the properties in passed-in object(s).
	  _.extend = function(obj) {
	    each(slice.call(arguments, 1), function(source) {
	      if (source) {
	        for (var prop in source) {
	          obj[prop] = source[prop];
	        }
	      }
	    });
	    return obj;
	  };
	
	  // Return a copy of the object only containing the whitelisted properties.
	  _.pick = function(obj) {
	    var copy = {};
	    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
	    each(keys, function(key) {
	      if (key in obj) copy[key] = obj[key];
	    });
	    return copy;
	  };
	
	   // Return a copy of the object without the blacklisted properties.
	  _.omit = function(obj) {
	    var copy = {};
	    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
	    for (var key in obj) {
	      if (!_.contains(keys, key)) copy[key] = obj[key];
	    }
	    return copy;
	  };
	
	  // Fill in a given object with default properties.
	  _.defaults = function(obj) {
	    each(slice.call(arguments, 1), function(source) {
	      if (source) {
	        for (var prop in source) {
	          if (obj[prop] === void 0) obj[prop] = source[prop];
	        }
	      }
	    });
	    return obj;
	  };
	
	  // Create a (shallow-cloned) duplicate of an object.
	  _.clone = function(obj) {
	    if (!_.isObject(obj)) return obj;
	    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
	  };
	
	  // Invokes interceptor with the obj, and then returns obj.
	  // The primary purpose of this method is to "tap into" a method chain, in
	  // order to perform operations on intermediate results within the chain.
	  _.tap = function(obj, interceptor) {
	    interceptor(obj);
	    return obj;
	  };
	
	  // Internal recursive comparison function for `isEqual`.
	  var eq = function(a, b, aStack, bStack) {
	    // Identical objects are equal. `0 === -0`, but they aren't identical.
	    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
	    if (a === b) return a !== 0 || 1 / a == 1 / b;
	    // A strict comparison is necessary because `null == undefined`.
	    if (a == null || b == null) return a === b;
	    // Unwrap any wrapped objects.
	    if (a instanceof _) a = a._wrapped;
	    if (b instanceof _) b = b._wrapped;
	    // Compare `[[Class]]` names.
	    var className = toString.call(a);
	    if (className != toString.call(b)) return false;
	    switch (className) {
	      // Strings, numbers, dates, and booleans are compared by value.
	      case '[object String]':
	        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
	        // equivalent to `new String("5")`.
	        return a == String(b);
	      case '[object Number]':
	        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
	        // other numeric values.
	        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
	      case '[object Date]':
	      case '[object Boolean]':
	        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
	        // millisecond representations. Note that invalid dates with millisecond representations
	        // of `NaN` are not equivalent.
	        return +a == +b;
	      // RegExps are compared by their source patterns and flags.
	      case '[object RegExp]':
	        return a.source == b.source &&
	               a.global == b.global &&
	               a.multiline == b.multiline &&
	               a.ignoreCase == b.ignoreCase;
	    }
	    if (typeof a != 'object' || typeof b != 'object') return false;
	    // Assume equality for cyclic structures. The algorithm for detecting cyclic
	    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
	    var length = aStack.length;
	    while (length--) {
	      // Linear search. Performance is inversely proportional to the number of
	      // unique nested structures.
	      if (aStack[length] == a) return bStack[length] == b;
	    }
	    // Objects with different constructors are not equivalent, but `Object`s
	    // from different frames are.
	    var aCtor = a.constructor, bCtor = b.constructor;
	    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
	                             _.isFunction(bCtor) && (bCtor instanceof bCtor))
	                        && ('constructor' in a && 'constructor' in b)) {
	      return false;
	    }
	    // Add the first object to the stack of traversed objects.
	    aStack.push(a);
	    bStack.push(b);
	    var size = 0, result = true;
	    // Recursively compare objects and arrays.
	    if (className == '[object Array]') {
	      // Compare array lengths to determine if a deep comparison is necessary.
	      size = a.length;
	      result = size == b.length;
	      if (result) {
	        // Deep compare the contents, ignoring non-numeric properties.
	        while (size--) {
	          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
	        }
	      }
	    } else {
	      // Deep compare objects.
	      for (var key in a) {
	        if (_.has(a, key)) {
	          // Count the expected number of properties.
	          size++;
	          // Deep compare each member.
	          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
	        }
	      }
	      // Ensure that both objects contain the same number of properties.
	      if (result) {
	        for (key in b) {
	          if (_.has(b, key) && !(size--)) break;
	        }
	        result = !size;
	      }
	    }
	    // Remove the first object from the stack of traversed objects.
	    aStack.pop();
	    bStack.pop();
	    return result;
	  };
	
	  // Perform a deep comparison to check if two objects are equal.
	  _.isEqual = function(a, b) {
	    return eq(a, b, [], []);
	  };
	
	  // Is a given array, string, or object empty?
	  // An "empty" object has no enumerable own-properties.
	  _.isEmpty = function(obj) {
	    if (obj == null) return true;
	    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
	    for (var key in obj) if (_.has(obj, key)) return false;
	    return true;
	  };
	
	  // Is a given value a DOM element?
	  _.isElement = function(obj) {
	    return !!(obj && obj.nodeType === 1);
	  };
	
	  // Is a given value an array?
	  // Delegates to ECMA5's native Array.isArray
	  _.isArray = nativeIsArray || function(obj) {
	    return toString.call(obj) == '[object Array]';
	  };
	
	  // Is a given variable an object?
	  _.isObject = function(obj) {
	    return obj === Object(obj);
	  };
	
	  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
	  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
	    _['is' + name] = function(obj) {
	      return toString.call(obj) == '[object ' + name + ']';
	    };
	  });
	
	  // Define a fallback version of the method in browsers (ahem, IE), where
	  // there isn't any inspectable "Arguments" type.
	  if (!_.isArguments(arguments)) {
	    _.isArguments = function(obj) {
	      return !!(obj && _.has(obj, 'callee'));
	    };
	  }
	
	  // Optimize `isFunction` if appropriate.
	  if (true) {
	    _.isFunction = function(obj) {
	      return typeof obj === 'function';
	    };
	  }
	
	  // Is a given object a finite number?
	  _.isFinite = function(obj) {
	    return isFinite(obj) && !isNaN(parseFloat(obj));
	  };
	
	  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
	  _.isNaN = function(obj) {
	    return _.isNumber(obj) && obj != +obj;
	  };
	
	  // Is a given value a boolean?
	  _.isBoolean = function(obj) {
	    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
	  };
	
	  // Is a given value equal to null?
	  _.isNull = function(obj) {
	    return obj === null;
	  };
	
	  // Is a given variable undefined?
	  _.isUndefined = function(obj) {
	    return obj === void 0;
	  };
	
	  // Shortcut function for checking if an object has a given property directly
	  // on itself (in other words, not on a prototype).
	  _.has = function(obj, key) {
	    return hasOwnProperty.call(obj, key);
	  };
	
	  // Utility Functions
	  // -----------------
	
	  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
	  // previous owner. Returns a reference to the Underscore object.
	  _.noConflict = function() {
	    root._ = previousUnderscore;
	    return this;
	  };
	
	  // Keep the identity function around for default iterators.
	  _.identity = function(value) {
	    return value;
	  };
	
	  _.constant = function(value) {
	    return function () {
	      return value;
	    };
	  };
	
	  _.property = function(key) {
	    return function(obj) {
	      return obj[key];
	    };
	  };
	
	  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
	  _.matches = function(attrs) {
	    return function(obj) {
	      if (obj === attrs) return true; //avoid comparing an object to itself.
	      for (var key in attrs) {
	        if (attrs[key] !== obj[key])
	          return false;
	      }
	      return true;
	    }
	  };
	
	  // Run a function **n** times.
	  _.times = function(n, iterator, context) {
	    var accum = Array(Math.max(0, n));
	    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
	    return accum;
	  };
	
	  // Return a random integer between min and max (inclusive).
	  _.random = function(min, max) {
	    if (max == null) {
	      max = min;
	      min = 0;
	    }
	    return min + Math.floor(Math.random() * (max - min + 1));
	  };
	
	  // A (possibly faster) way to get the current timestamp as an integer.
	  _.now = Date.now || function() { return new Date().getTime(); };
	
	  // List of HTML entities for escaping.
	  var entityMap = {
	    escape: {
	      '&': '&amp;',
	      '<': '&lt;',
	      '>': '&gt;',
	      '"': '&quot;',
	      "'": '&#x27;'
	    }
	  };
	  entityMap.unescape = _.invert(entityMap.escape);
	
	  // Regexes containing the keys and values listed immediately above.
	  var entityRegexes = {
	    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
	    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
	  };
	
	  // Functions for escaping and unescaping strings to/from HTML interpolation.
	  _.each(['escape', 'unescape'], function(method) {
	    _[method] = function(string) {
	      if (string == null) return '';
	      return ('' + string).replace(entityRegexes[method], function(match) {
	        return entityMap[method][match];
	      });
	    };
	  });
	
	  // If the value of the named `property` is a function then invoke it with the
	  // `object` as context; otherwise, return it.
	  _.result = function(object, property) {
	    if (object == null) return void 0;
	    var value = object[property];
	    return _.isFunction(value) ? value.call(object) : value;
	  };
	
	  // Add your own custom functions to the Underscore object.
	  _.mixin = function(obj) {
	    each(_.functions(obj), function(name) {
	      var func = _[name] = obj[name];
	      _.prototype[name] = function() {
	        var args = [this._wrapped];
	        push.apply(args, arguments);
	        return result.call(this, func.apply(_, args));
	      };
	    });
	  };
	
	  // Generate a unique integer id (unique within the entire client session).
	  // Useful for temporary DOM ids.
	  var idCounter = 0;
	  _.uniqueId = function(prefix) {
	    var id = ++idCounter + '';
	    return prefix ? prefix + id : id;
	  };
	
	  // By default, Underscore uses ERB-style template delimiters, change the
	  // following template settings to use alternative delimiters.
	  _.templateSettings = {
	    evaluate    : /<%([\s\S]+?)%>/g,
	    interpolate : /<%=([\s\S]+?)%>/g,
	    escape      : /<%-([\s\S]+?)%>/g
	  };
	
	  // When customizing `templateSettings`, if you don't want to define an
	  // interpolation, evaluation or escaping regex, we need one that is
	  // guaranteed not to match.
	  var noMatch = /(.)^/;
	
	  // Certain characters need to be escaped so that they can be put into a
	  // string literal.
	  var escapes = {
	    "'":      "'",
	    '\\':     '\\',
	    '\r':     'r',
	    '\n':     'n',
	    '\t':     't',
	    '\u2028': 'u2028',
	    '\u2029': 'u2029'
	  };
	
	  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;
	
	  // JavaScript micro-templating, similar to John Resig's implementation.
	  // Underscore templating handles arbitrary delimiters, preserves whitespace,
	  // and correctly escapes quotes within interpolated code.
	  _.template = function(text, data, settings) {
	    var render;
	    settings = _.defaults({}, settings, _.templateSettings);
	
	    // Combine delimiters into one regular expression via alternation.
	    var matcher = new RegExp([
	      (settings.escape || noMatch).source,
	      (settings.interpolate || noMatch).source,
	      (settings.evaluate || noMatch).source
	    ].join('|') + '|$', 'g');
	
	    // Compile the template source, escaping string literals appropriately.
	    var index = 0;
	    var source = "__p+='";
	    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
	      source += text.slice(index, offset)
	        .replace(escaper, function(match) { return '\\' + escapes[match]; });
	
	      if (escape) {
	        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
	      }
	      if (interpolate) {
	        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
	      }
	      if (evaluate) {
	        source += "';\n" + evaluate + "\n__p+='";
	      }
	      index = offset + match.length;
	      return match;
	    });
	    source += "';\n";
	
	    // If a variable is not specified, place data values in local scope.
	    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';
	
	    source = "var __t,__p='',__j=Array.prototype.join," +
	      "print=function(){__p+=__j.call(arguments,'');};\n" +
	      source + "return __p;\n";
	
	    try {
	      render = new Function(settings.variable || 'obj', '_', source);
	    } catch (e) {
	      e.source = source;
	      throw e;
	    }
	
	    if (data) return render(data, _);
	    var template = function(data) {
	      return render.call(this, data, _);
	    };
	
	    // Provide the compiled function source as a convenience for precompilation.
	    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';
	
	    return template;
	  };
	
	  // Add a "chain" function, which will delegate to the wrapper.
	  _.chain = function(obj) {
	    return _(obj).chain();
	  };
	
	  // OOP
	  // ---------------
	  // If Underscore is called as a function, it returns a wrapped object that
	  // can be used OO-style. This wrapper holds altered versions of all the
	  // underscore functions. Wrapped objects may be chained.
	
	  // Helper function to continue chaining intermediate results.
	  var result = function(obj) {
	    return this._chain ? _(obj).chain() : obj;
	  };
	
	  // Add all of the Underscore functions to the wrapper object.
	  _.mixin(_);
	
	  // Add all mutator Array functions to the wrapper.
	  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
	    var method = ArrayProto[name];
	    _.prototype[name] = function() {
	      var obj = this._wrapped;
	      method.apply(obj, arguments);
	      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
	      return result.call(this, obj);
	    };
	  });
	
	  // Add all accessor Array functions to the wrapper.
	  each(['concat', 'join', 'slice'], function(name) {
	    var method = ArrayProto[name];
	    _.prototype[name] = function() {
	      return result.call(this, method.apply(this._wrapped, arguments));
	    };
	  });
	
	  _.extend(_.prototype, {
	
	    // Start chaining a wrapped Underscore object.
	    chain: function() {
	      this._chain = true;
	      return this;
	    },
	
	    // Extracts the result from a wrapped and chained object.
	    value: function() {
	      return this._wrapped;
	    }
	
	  });
	
	  // AMD registration happens at the end for compatibility with AMD loaders
	  // that may not enforce next-turn semantics on modules. Even though general
	  // practice for AMD registration is to be anonymous, underscore registers
	  // as a named module because, like jQuery, it is a base library that is
	  // popular enough to be bundled in a third party lib, but not be part of
	  // an AMD load request. Those cases could generate an error when an
	  // anonymous define() is called outside of a loader request.
	  if (true) {
	    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function() {
	      return _;
	    }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	  }
	}).call(this);


/***/ },

/***/ 80:
/***/ function(module, exports, __webpack_require__) {

	module.exports = {
		"ac": "com|edu|gov|net|mil|org",
		"ad": "nom",
		"ae": "co|net|org|sch|ac|gov|mil",
		"aero": "accident-investigation|accident-prevention|aerobatic|aeroclub|aerodrome|agents|aircraft|airline|airport|air-surveillance|airtraffic|air-traffic-control|ambulance|amusement|association|author|ballooning|broker|caa|cargo|catering|certification|championship|charter|civilaviation|club|conference|consultant|consulting|control|council|crew|design|dgca|educator|emergency|engine|engineer|entertainment|equipment|exchange|express|federation|flight|freight|fuel|gliding|government|groundhandling|group|hanggliding|homebuilt|insurance|journal|journalist|leasing|logistics|magazine|maintenance|marketplace|media|microlight|modelling|navigation|parachuting|paragliding|passenger-association|pilot|press|production|recreation|repbody|res|research|rotorcraft|safety|scientist|services|show|skydiving|software|student|taxi|trader|trading|trainer|union|workinggroup|works",
		"af": "gov|com|org|net|edu",
		"ag": "com|org|net|co|nom",
		"ai": "off|com|net|org",
		"al": "com|edu|gov|mil|net|org",
		"am": "",
		"an": "com|net|org|edu",
		"ao": "ed|gv|og|co|pb|it",
		"aq": "",
		"ar": "com|edu|gob|gov|int|mil|net|org|tur|blogspot.com",
		"arpa": "e164|in-addr|ip6|iris|uri|urn",
		"as": "gov",
		"asia": "",
		"at": "ac|co|gv|or|blogspot.co|biz|info|priv",
		"au": "com|net|org|edu|gov|asn|id|info|conf|oz|act|nsw|nt|qld|sa|tas|vic|wa|act.edu|nsw.edu|nt.edu|qld.edu|sa.edu|tas.edu|vic.edu|wa.edu|qld.gov|sa.gov|tas.gov|vic.gov|wa.gov|blogspot.com",
		"aw": "com",
		"ax": "",
		"az": "com|net|int|gov|org|edu|info|pp|mil|name|pro|biz",
		"ba": "org|net|edu|gov|mil|unsa|unbi|co|com|rs",
		"bb": "biz|co|com|edu|gov|info|net|org|store|tv",
		"bd": "*",
		"be": "ac|blogspot",
		"bf": "gov",
		"bg": "a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z|0|1|2|3|4|5|6|7|8|9",
		"bh": "com|edu|net|org|gov",
		"bi": "co|com|edu|or|org",
		"biz": "dyndns|for-better|for-more|for-some|for-the|selfip|webhop",
		"bj": "asso|barreau|gouv|blogspot",
		"bm": "com|edu|gov|net|org",
		"bn": "*",
		"bo": "com|edu|gov|gob|int|org|net|mil|tv",
		"br": "adm|adv|agr|am|arq|art|ato|b|bio|blog|bmd|cim|cng|cnt|com|coop|ecn|eco|edu|emp|eng|esp|etc|eti|far|flog|fm|fnd|fot|fst|g12|ggf|gov|imb|ind|inf|jor|jus|leg|lel|mat|med|mil|mp|mus|net|*nom|not|ntr|odo|org|ppg|pro|psc|psi|qsl|radio|rec|slg|srv|taxi|teo|tmp|trd|tur|tv|vet|vlog|wiki|zlg|blogspot.com",
		"bs": "com|net|org|edu|gov",
		"bt": "com|edu|gov|net|org",
		"bv": "",
		"bw": "co|org",
		"by": "gov|mil|com|of",
		"bz": "com|net|org|edu|gov|za",
		"ca": "ab|bc|mb|nb|nf|nl|ns|nt|nu|on|pe|qc|sk|yk|gc|co|blogspot",
		"cat": "",
		"cc": "ftpaccess|game-server|myphotos|scrapping",
		"cd": "gov",
		"cf": "blogspot",
		"cg": "",
		"ch": "blogspot",
		"ci": "org|or|com|co|edu|ed|ac|net|go|asso|aéroport|int|presse|md|gouv",
		"ck": "*|!www",
		"cl": "gov|gob|co|mil",
		"cm": "co|com|gov|net",
		"cn": "ac|com|edu|gov|net|org|mil|公司|网络|網絡|ah|bj|cq|fj|gd|gs|gz|gx|ha|hb|he|hi|hl|hn|jl|js|jx|ln|nm|nx|qh|sc|sd|sh|sn|sx|tj|xj|xz|yn|zj|hk|mo|tw|cn-north-1.compute.amazonaws|compute.amazonaws",
		"co": "arts|com|edu|firm|gov|info|int|mil|net|nom|org|rec|web",
		"com": "ap-northeast-1.compute.amazonaws|ap-southeast-1.compute.amazonaws|ap-southeast-2.compute.amazonaws|compute.amazonaws|compute-1.amazonaws|eu-west-1.compute.amazonaws|sa-east-1.compute.amazonaws|us-east-1.amazonaws|us-gov-west-1.compute.amazonaws|us-west-1.compute.amazonaws|us-west-2.compute.amazonaws|z-1.compute-1.amazonaws|z-2.compute-1.amazonaws|elasticbeanstalk|elb.amazonaws|s3.amazonaws|s3-us-west-2.amazonaws|s3-us-west-1.amazonaws|s3-eu-west-1.amazonaws|s3-ap-southeast-1.amazonaws|s3-ap-southeast-2.amazonaws|s3-ap-northeast-1.amazonaws|s3-sa-east-1.amazonaws|s3-us-gov-west-1.amazonaws|s3-fips-us-gov-west-1.amazonaws|s3-website-us-east-1.amazonaws|s3-website-us-west-2.amazonaws|s3-website-us-west-1.amazonaws|s3-website-eu-west-1.amazonaws|s3-website-ap-southeast-1.amazonaws|s3-website-ap-southeast-2.amazonaws|s3-website-ap-northeast-1.amazonaws|s3-website-sa-east-1.amazonaws|s3-website-us-gov-west-1.amazonaws|betainabox|ar|br|cn|de|eu|gb|hu|jpn|kr|mex|no|qc|ru|sa|se|uk|us|uy|za|africa|gr|co|cloudcontrolled|cloudcontrolapp|dreamhosters|dyndns-at-home|dyndns-at-work|dyndns-blog|dyndns-free|dyndns-home|dyndns-ip|dyndns-mail|dyndns-office|dyndns-pics|dyndns-remote|dyndns-server|dyndns-web|dyndns-wiki|dyndns-work|blogdns|cechire|dnsalias|dnsdojo|doesntexist|dontexist|doomdns|dyn-o-saur|dynalias|est-a-la-maison|est-a-la-masion|est-le-patron|est-mon-blogueur|from-ak|from-al|from-ar|from-ca|from-ct|from-dc|from-de|from-fl|from-ga|from-hi|from-ia|from-id|from-il|from-in|from-ks|from-ky|from-ma|from-md|from-mi|from-mn|from-mo|from-ms|from-mt|from-nc|from-nd|from-ne|from-nh|from-nj|from-nm|from-nv|from-oh|from-ok|from-or|from-pa|from-pr|from-ri|from-sc|from-sd|from-tn|from-tx|from-ut|from-va|from-vt|from-wa|from-wi|from-wv|from-wy|getmyip|gotdns|hobby-site|homelinux|homeunix|iamallama|is-a-anarchist|is-a-blogger|is-a-bookkeeper|is-a-bulls-fan|is-a-caterer|is-a-chef|is-a-conservative|is-a-cpa|is-a-cubicle-slave|is-a-democrat|is-a-designer|is-a-doctor|is-a-financialadvisor|is-a-geek|is-a-green|is-a-guru|is-a-hard-worker|is-a-hunter|is-a-landscaper|is-a-lawyer|is-a-liberal|is-a-libertarian|is-a-llama|is-a-musician|is-a-nascarfan|is-a-nurse|is-a-painter|is-a-personaltrainer|is-a-photographer|is-a-player|is-a-republican|is-a-rockstar|is-a-socialist|is-a-student|is-a-teacher|is-a-techie|is-a-therapist|is-an-accountant|is-an-actor|is-an-actress|is-an-anarchist|is-an-artist|is-an-engineer|is-an-entertainer|is-certified|is-gone|is-into-anime|is-into-cars|is-into-cartoons|is-into-games|is-leet|is-not-certified|is-slick|is-uberleet|is-with-theband|isa-geek|isa-hockeynut|issmarterthanyou|likes-pie|likescandy|neat-url|saves-the-whales|selfip|sells-for-less|sells-for-u|servebbs|simple-url|space-to-rent|teaches-yoga|writesthisblog|firebaseapp|flynnhub|githubusercontent|ro|appspot|blogspot|codespot|googleapis|googlecode|withgoogle|herokuapp|herokussl|nfshost|operaunite|outsystemscloud|rhcloud|yolasite",
		"coop": "",
		"cr": "ac|co|ed|fi|go|or|sa",
		"cu": "com|edu|org|net|gov|inf",
		"cv": "blogspot",
		"cw": "com|edu|net|org",
		"cx": "gov|ath",
		"cy": "*",
		"cz": "blogspot",
		"de": "com|fuettertdasnetz|isteingeek|istmein|lebtimnetz|leitungsen|traeumtgerade|blogspot",
		"dj": "",
		"dk": "blogspot",
		"dm": "com|net|org|edu|gov",
		"do": "art|com|edu|gob|gov|mil|net|org|sld|web",
		"dz": "com|org|net|gov|edu|asso|pol|art",
		"ec": "com|info|net|fin|k12|med|pro|org|edu|gov|gob|mil",
		"edu": "",
		"ee": "edu|gov|riik|lib|med|com|pri|aip|org|fie",
		"eg": "com|edu|eun|gov|mil|name|net|org|sci",
		"er": "*",
		"es": "com|nom|org|gob|edu|blogspot.com",
		"et": "com|gov|org|edu|biz|name|info",
		"eu": "",
		"fi": "aland|blogspot|iki",
		"fj": "*",
		"fk": "*",
		"fm": "",
		"fo": "",
		"fr": "com|asso|nom|prd|presse|tm|aeroport|assedic|avocat|avoues|cci|chambagri|chirurgiens-dentistes|experts-comptables|geometre-expert|gouv|greta|huissier-justice|medecin|notaires|pharmacien|port|veterinaire|blogspot",
		"ga": "",
		"gb": "",
		"gd": "",
		"ge": "com|edu|gov|org|mil|net|pvt",
		"gf": "",
		"gg": "co|net|org",
		"gh": "com|edu|gov|org|mil",
		"gi": "com|ltd|gov|mod|edu|org",
		"gl": "",
		"gm": "",
		"gn": "ac|com|edu|gov|org|net",
		"gov": "",
		"gp": "com|net|mobi|edu|org|asso",
		"gq": "",
		"gr": "com|edu|net|org|gov|blogspot",
		"gs": "",
		"gt": "com|edu|gob|ind|mil|net|org",
		"gu": "*",
		"gw": "",
		"gy": "co|com|net",
		"hk": "com|edu|gov|idv|net|org|公司|教育|敎育|政府|個人|个人|箇人|網络|网络|组織|網絡|网絡|组织|組織|組织|blogspot",
		"hm": "",
		"hn": "com|edu|org|net|mil|gob",
		"hr": "iz|from|name|com",
		"ht": "com|shop|firm|info|adult|net|pro|org|med|art|coop|pol|asso|edu|rel|gouv|perso",
		"hu": "co|info|org|priv|sport|tm|2000|agrar|bolt|casino|city|erotica|erotika|film|forum|games|hotel|ingatlan|jogasz|konyvelo|lakas|media|news|reklam|sex|shop|suli|szex|tozsde|utazas|video|blogspot",
		"id": "ac|biz|co|desa|go|mil|my|net|or|sch|web",
		"ie": "gov|blogspot",
		"il": "*|blogspot.co",
		"im": "ac|co|com|ltd.co|net|org|plc.co|tt|tv",
		"in": "co|firm|net|org|gen|ind|nic|ac|edu|res|gov|mil|blogspot",
		"info": "dyndns|barrel-of-knowledge|barrell-of-knowledge|for-our|groks-the|groks-this|here-for-more|knowsitall|selfip|webhop",
		"int": "eu",
		"io": "com|github|nid",
		"iq": "gov|edu|mil|com|org|net",
		"ir": "ac|co|gov|id|net|org|sch|ایران|ايران",
		"is": "net|com|edu|gov|org|int|cupcake",
		"it": "gov|edu|abr|abruzzo|aosta-valley|aostavalley|bas|basilicata|cal|calabria|cam|campania|emilia-romagna|emiliaromagna|emr|friuli-v-giulia|friuli-ve-giulia|friuli-vegiulia|friuli-venezia-giulia|friuli-veneziagiulia|friuli-vgiulia|friuliv-giulia|friulive-giulia|friulivegiulia|friulivenezia-giulia|friuliveneziagiulia|friulivgiulia|fvg|laz|lazio|lig|liguria|lom|lombardia|lombardy|lucania|mar|marche|mol|molise|piedmont|piemonte|pmn|pug|puglia|sar|sardegna|sardinia|sic|sicilia|sicily|taa|tos|toscana|trentino-a-adige|trentino-aadige|trentino-alto-adige|trentino-altoadige|trentino-s-tirol|trentino-stirol|trentino-sud-tirol|trentino-sudtirol|trentino-sued-tirol|trentino-suedtirol|trentinoa-adige|trentinoaadige|trentinoalto-adige|trentinoaltoadige|trentinos-tirol|trentinostirol|trentinosud-tirol|trentinosudtirol|trentinosued-tirol|trentinosuedtirol|tuscany|umb|umbria|val-d-aosta|val-daosta|vald-aosta|valdaosta|valle-aosta|valle-d-aosta|valle-daosta|valleaosta|valled-aosta|valledaosta|vallee-aoste|valleeaoste|vao|vda|ven|veneto|ag|agrigento|al|alessandria|alto-adige|altoadige|an|ancona|andria-barletta-trani|andria-trani-barletta|andriabarlettatrani|andriatranibarletta|ao|aosta|aoste|ap|aq|aquila|ar|arezzo|ascoli-piceno|ascolipiceno|asti|at|av|avellino|ba|balsan|bari|barletta-trani-andria|barlettatraniandria|belluno|benevento|bergamo|bg|bi|biella|bl|bn|bo|bologna|bolzano|bozen|br|brescia|brindisi|bs|bt|bz|ca|cagliari|caltanissetta|campidano-medio|campidanomedio|campobasso|carbonia-iglesias|carboniaiglesias|carrara-massa|carraramassa|caserta|catania|catanzaro|cb|ce|cesena-forli|cesenaforli|ch|chieti|ci|cl|cn|co|como|cosenza|cr|cremona|crotone|cs|ct|cuneo|cz|dell-ogliastra|dellogliastra|en|enna|fc|fe|fermo|ferrara|fg|fi|firenze|florence|fm|foggia|forli-cesena|forlicesena|fr|frosinone|ge|genoa|genova|go|gorizia|gr|grosseto|iglesias-carbonia|iglesiascarbonia|im|imperia|is|isernia|kr|la-spezia|laquila|laspezia|latina|lc|le|lecce|lecco|li|livorno|lo|lodi|lt|lu|lucca|macerata|mantova|massa-carrara|massacarrara|matera|mb|mc|me|medio-campidano|mediocampidano|messina|mi|milan|milano|mn|mo|modena|monza-brianza|monza-e-della-brianza|monza|monzabrianza|monzaebrianza|monzaedellabrianza|ms|mt|na|naples|napoli|no|novara|nu|nuoro|og|ogliastra|olbia-tempio|olbiatempio|or|oristano|ot|pa|padova|padua|palermo|parma|pavia|pc|pd|pe|perugia|pesaro-urbino|pesarourbino|pescara|pg|pi|piacenza|pisa|pistoia|pn|po|pordenone|potenza|pr|prato|pt|pu|pv|pz|ra|ragusa|ravenna|rc|re|reggio-calabria|reggio-emilia|reggiocalabria|reggioemilia|rg|ri|rieti|rimini|rm|rn|ro|roma|rome|rovigo|sa|salerno|sassari|savona|si|siena|siracusa|so|sondrio|sp|sr|ss|suedtirol|sv|ta|taranto|te|tempio-olbia|tempioolbia|teramo|terni|tn|to|torino|tp|tr|trani-andria-barletta|trani-barletta-andria|traniandriabarletta|tranibarlettaandria|trapani|trentino|trento|treviso|trieste|ts|turin|tv|ud|udine|urbino-pesaro|urbinopesaro|va|varese|vb|vc|ve|venezia|venice|verbania|vercelli|verona|vi|vibo-valentia|vibovalentia|vicenza|viterbo|vr|vs|vt|vv|blogspot",
		"je": "co|net|org",
		"jm": "*",
		"jo": "com|org|net|edu|sch|gov|mil|name",
		"jobs": "",
		"jp": "ac|ad|co|ed|go|gr|lg|ne|or|aichi|akita|aomori|chiba|ehime|fukui|fukuoka|fukushima|gifu|gunma|hiroshima|hokkaido|hyogo|ibaraki|ishikawa|iwate|kagawa|kagoshima|kanagawa|kochi|kumamoto|kyoto|mie|miyagi|miyazaki|nagano|nagasaki|nara|niigata|oita|okayama|okinawa|osaka|saga|saitama|shiga|shimane|shizuoka|tochigi|tokushima|tokyo|tottori|toyama|wakayama|yamagata|yamaguchi|yamanashi|*kawasaki|*kitakyushu|*kobe|*nagoya|*sapporo|*sendai|*yokohama|!city.kawasaki|!city.kitakyushu|!city.kobe|!city.nagoya|!city.sapporo|!city.sendai|!city.yokohama|aisai.aichi|ama.aichi|anjo.aichi|asuke.aichi|chiryu.aichi|chita.aichi|fuso.aichi|gamagori.aichi|handa.aichi|hazu.aichi|hekinan.aichi|higashiura.aichi|ichinomiya.aichi|inazawa.aichi|inuyama.aichi|isshiki.aichi|iwakura.aichi|kanie.aichi|kariya.aichi|kasugai.aichi|kira.aichi|kiyosu.aichi|komaki.aichi|konan.aichi|kota.aichi|mihama.aichi|miyoshi.aichi|nishio.aichi|nisshin.aichi|obu.aichi|oguchi.aichi|oharu.aichi|okazaki.aichi|owariasahi.aichi|seto.aichi|shikatsu.aichi|shinshiro.aichi|shitara.aichi|tahara.aichi|takahama.aichi|tobishima.aichi|toei.aichi|togo.aichi|tokai.aichi|tokoname.aichi|toyoake.aichi|toyohashi.aichi|toyokawa.aichi|toyone.aichi|toyota.aichi|tsushima.aichi|yatomi.aichi|akita.akita|daisen.akita|fujisato.akita|gojome.akita|hachirogata.akita|happou.akita|higashinaruse.akita|honjo.akita|honjyo.akita|ikawa.akita|kamikoani.akita|kamioka.akita|katagami.akita|kazuno.akita|kitaakita.akita|kosaka.akita|kyowa.akita|misato.akita|mitane.akita|moriyoshi.akita|nikaho.akita|noshiro.akita|odate.akita|oga.akita|ogata.akita|semboku.akita|yokote.akita|yurihonjo.akita|aomori.aomori|gonohe.aomori|hachinohe.aomori|hashikami.aomori|hiranai.aomori|hirosaki.aomori|itayanagi.aomori|kuroishi.aomori|misawa.aomori|mutsu.aomori|nakadomari.aomori|noheji.aomori|oirase.aomori|owani.aomori|rokunohe.aomori|sannohe.aomori|shichinohe.aomori|shingo.aomori|takko.aomori|towada.aomori|tsugaru.aomori|tsuruta.aomori|abiko.chiba|asahi.chiba|chonan.chiba|chosei.chiba|choshi.chiba|chuo.chiba|funabashi.chiba|futtsu.chiba|hanamigawa.chiba|ichihara.chiba|ichikawa.chiba|ichinomiya.chiba|inzai.chiba|isumi.chiba|kamagaya.chiba|kamogawa.chiba|kashiwa.chiba|katori.chiba|katsuura.chiba|kimitsu.chiba|kisarazu.chiba|kozaki.chiba|kujukuri.chiba|kyonan.chiba|matsudo.chiba|midori.chiba|mihama.chiba|minamiboso.chiba|mobara.chiba|mutsuzawa.chiba|nagara.chiba|nagareyama.chiba|narashino.chiba|narita.chiba|noda.chiba|oamishirasato.chiba|omigawa.chiba|onjuku.chiba|otaki.chiba|sakae.chiba|sakura.chiba|shimofusa.chiba|shirako.chiba|shiroi.chiba|shisui.chiba|sodegaura.chiba|sosa.chiba|tako.chiba|tateyama.chiba|togane.chiba|tohnosho.chiba|tomisato.chiba|urayasu.chiba|yachimata.chiba|yachiyo.chiba|yokaichiba.chiba|yokoshibahikari.chiba|yotsukaido.chiba|ainan.ehime|honai.ehime|ikata.ehime|imabari.ehime|iyo.ehime|kamijima.ehime|kihoku.ehime|kumakogen.ehime|masaki.ehime|matsuno.ehime|matsuyama.ehime|namikata.ehime|niihama.ehime|ozu.ehime|saijo.ehime|seiyo.ehime|shikokuchuo.ehime|tobe.ehime|toon.ehime|uchiko.ehime|uwajima.ehime|yawatahama.ehime|echizen.fukui|eiheiji.fukui|fukui.fukui|ikeda.fukui|katsuyama.fukui|mihama.fukui|minamiechizen.fukui|obama.fukui|ohi.fukui|ono.fukui|sabae.fukui|sakai.fukui|takahama.fukui|tsuruga.fukui|wakasa.fukui|ashiya.fukuoka|buzen.fukuoka|chikugo.fukuoka|chikuho.fukuoka|chikujo.fukuoka|chikushino.fukuoka|chikuzen.fukuoka|chuo.fukuoka|dazaifu.fukuoka|fukuchi.fukuoka|hakata.fukuoka|higashi.fukuoka|hirokawa.fukuoka|hisayama.fukuoka|iizuka.fukuoka|inatsuki.fukuoka|kaho.fukuoka|kasuga.fukuoka|kasuya.fukuoka|kawara.fukuoka|keisen.fukuoka|koga.fukuoka|kurate.fukuoka|kurogi.fukuoka|kurume.fukuoka|minami.fukuoka|miyako.fukuoka|miyama.fukuoka|miyawaka.fukuoka|mizumaki.fukuoka|munakata.fukuoka|nakagawa.fukuoka|nakama.fukuoka|nishi.fukuoka|nogata.fukuoka|ogori.fukuoka|okagaki.fukuoka|okawa.fukuoka|oki.fukuoka|omuta.fukuoka|onga.fukuoka|onojo.fukuoka|oto.fukuoka|saigawa.fukuoka|sasaguri.fukuoka|shingu.fukuoka|shinyoshitomi.fukuoka|shonai.fukuoka|soeda.fukuoka|sue.fukuoka|tachiarai.fukuoka|tagawa.fukuoka|takata.fukuoka|toho.fukuoka|toyotsu.fukuoka|tsuiki.fukuoka|ukiha.fukuoka|umi.fukuoka|usui.fukuoka|yamada.fukuoka|yame.fukuoka|yanagawa.fukuoka|yukuhashi.fukuoka|aizubange.fukushima|aizumisato.fukushima|aizuwakamatsu.fukushima|asakawa.fukushima|bandai.fukushima|date.fukushima|fukushima.fukushima|furudono.fukushima|futaba.fukushima|hanawa.fukushima|higashi.fukushima|hirata.fukushima|hirono.fukushima|iitate.fukushima|inawashiro.fukushima|ishikawa.fukushima|iwaki.fukushima|izumizaki.fukushima|kagamiishi.fukushima|kaneyama.fukushima|kawamata.fukushima|kitakata.fukushima|kitashiobara.fukushima|koori.fukushima|koriyama.fukushima|kunimi.fukushima|miharu.fukushima|mishima.fukushima|namie.fukushima|nango.fukushima|nishiaizu.fukushima|nishigo.fukushima|okuma.fukushima|omotego.fukushima|ono.fukushima|otama.fukushima|samegawa.fukushima|shimogo.fukushima|shirakawa.fukushima|showa.fukushima|soma.fukushima|sukagawa.fukushima|taishin.fukushima|tamakawa.fukushima|tanagura.fukushima|tenei.fukushima|yabuki.fukushima|yamato.fukushima|yamatsuri.fukushima|yanaizu.fukushima|yugawa.fukushima|anpachi.gifu|ena.gifu|gifu.gifu|ginan.gifu|godo.gifu|gujo.gifu|hashima.gifu|hichiso.gifu|hida.gifu|higashishirakawa.gifu|ibigawa.gifu|ikeda.gifu|kakamigahara.gifu|kani.gifu|kasahara.gifu|kasamatsu.gifu|kawaue.gifu|kitagata.gifu|mino.gifu|minokamo.gifu|mitake.gifu|mizunami.gifu|motosu.gifu|nakatsugawa.gifu|ogaki.gifu|sakahogi.gifu|seki.gifu|sekigahara.gifu|shirakawa.gifu|tajimi.gifu|takayama.gifu|tarui.gifu|toki.gifu|tomika.gifu|wanouchi.gifu|yamagata.gifu|yaotsu.gifu|yoro.gifu|annaka.gunma|chiyoda.gunma|fujioka.gunma|higashiagatsuma.gunma|isesaki.gunma|itakura.gunma|kanna.gunma|kanra.gunma|katashina.gunma|kawaba.gunma|kiryu.gunma|kusatsu.gunma|maebashi.gunma|meiwa.gunma|midori.gunma|minakami.gunma|naganohara.gunma|nakanojo.gunma|nanmoku.gunma|numata.gunma|oizumi.gunma|ora.gunma|ota.gunma|shibukawa.gunma|shimonita.gunma|shinto.gunma|showa.gunma|takasaki.gunma|takayama.gunma|tamamura.gunma|tatebayashi.gunma|tomioka.gunma|tsukiyono.gunma|tsumagoi.gunma|ueno.gunma|yoshioka.gunma|asaminami.hiroshima|daiwa.hiroshima|etajima.hiroshima|fuchu.hiroshima|fukuyama.hiroshima|hatsukaichi.hiroshima|higashihiroshima.hiroshima|hongo.hiroshima|jinsekikogen.hiroshima|kaita.hiroshima|kui.hiroshima|kumano.hiroshima|kure.hiroshima|mihara.hiroshima|miyoshi.hiroshima|naka.hiroshima|onomichi.hiroshima|osakikamijima.hiroshima|otake.hiroshima|saka.hiroshima|sera.hiroshima|seranishi.hiroshima|shinichi.hiroshima|shobara.hiroshima|takehara.hiroshima|abashiri.hokkaido|abira.hokkaido|aibetsu.hokkaido|akabira.hokkaido|akkeshi.hokkaido|asahikawa.hokkaido|ashibetsu.hokkaido|ashoro.hokkaido|assabu.hokkaido|atsuma.hokkaido|bibai.hokkaido|biei.hokkaido|bifuka.hokkaido|bihoro.hokkaido|biratori.hokkaido|chippubetsu.hokkaido|chitose.hokkaido|date.hokkaido|ebetsu.hokkaido|embetsu.hokkaido|eniwa.hokkaido|erimo.hokkaido|esan.hokkaido|esashi.hokkaido|fukagawa.hokkaido|fukushima.hokkaido|furano.hokkaido|furubira.hokkaido|haboro.hokkaido|hakodate.hokkaido|hamatonbetsu.hokkaido|hidaka.hokkaido|higashikagura.hokkaido|higashikawa.hokkaido|hiroo.hokkaido|hokuryu.hokkaido|hokuto.hokkaido|honbetsu.hokkaido|horokanai.hokkaido|horonobe.hokkaido|ikeda.hokkaido|imakane.hokkaido|ishikari.hokkaido|iwamizawa.hokkaido|iwanai.hokkaido|kamifurano.hokkaido|kamikawa.hokkaido|kamishihoro.hokkaido|kamisunagawa.hokkaido|kamoenai.hokkaido|kayabe.hokkaido|kembuchi.hokkaido|kikonai.hokkaido|kimobetsu.hokkaido|kitahiroshima.hokkaido|kitami.hokkaido|kiyosato.hokkaido|koshimizu.hokkaido|kunneppu.hokkaido|kuriyama.hokkaido|kuromatsunai.hokkaido|kushiro.hokkaido|kutchan.hokkaido|kyowa.hokkaido|mashike.hokkaido|matsumae.hokkaido|mikasa.hokkaido|minamifurano.hokkaido|mombetsu.hokkaido|moseushi.hokkaido|mukawa.hokkaido|muroran.hokkaido|naie.hokkaido|nakagawa.hokkaido|nakasatsunai.hokkaido|nakatombetsu.hokkaido|nanae.hokkaido|nanporo.hokkaido|nayoro.hokkaido|nemuro.hokkaido|niikappu.hokkaido|niki.hokkaido|nishiokoppe.hokkaido|noboribetsu.hokkaido|numata.hokkaido|obihiro.hokkaido|obira.hokkaido|oketo.hokkaido|okoppe.hokkaido|otaru.hokkaido|otobe.hokkaido|otofuke.hokkaido|otoineppu.hokkaido|oumu.hokkaido|ozora.hokkaido|pippu.hokkaido|rankoshi.hokkaido|rebun.hokkaido|rikubetsu.hokkaido|rishiri.hokkaido|rishirifuji.hokkaido|saroma.hokkaido|sarufutsu.hokkaido|shakotan.hokkaido|shari.hokkaido|shibecha.hokkaido|shibetsu.hokkaido|shikabe.hokkaido|shikaoi.hokkaido|shimamaki.hokkaido|shimizu.hokkaido|shimokawa.hokkaido|shinshinotsu.hokkaido|shintoku.hokkaido|shiranuka.hokkaido|shiraoi.hokkaido|shiriuchi.hokkaido|sobetsu.hokkaido|sunagawa.hokkaido|taiki.hokkaido|takasu.hokkaido|takikawa.hokkaido|takinoue.hokkaido|teshikaga.hokkaido|tobetsu.hokkaido|tohma.hokkaido|tomakomai.hokkaido|tomari.hokkaido|toya.hokkaido|toyako.hokkaido|toyotomi.hokkaido|toyoura.hokkaido|tsubetsu.hokkaido|tsukigata.hokkaido|urakawa.hokkaido|urausu.hokkaido|uryu.hokkaido|utashinai.hokkaido|wakkanai.hokkaido|wassamu.hokkaido|yakumo.hokkaido|yoichi.hokkaido|aioi.hyogo|akashi.hyogo|ako.hyogo|amagasaki.hyogo|aogaki.hyogo|asago.hyogo|ashiya.hyogo|awaji.hyogo|fukusaki.hyogo|goshiki.hyogo|harima.hyogo|himeji.hyogo|ichikawa.hyogo|inagawa.hyogo|itami.hyogo|kakogawa.hyogo|kamigori.hyogo|kamikawa.hyogo|kasai.hyogo|kasuga.hyogo|kawanishi.hyogo|miki.hyogo|minamiawaji.hyogo|nishinomiya.hyogo|nishiwaki.hyogo|ono.hyogo|sanda.hyogo|sannan.hyogo|sasayama.hyogo|sayo.hyogo|shingu.hyogo|shinonsen.hyogo|shiso.hyogo|sumoto.hyogo|taishi.hyogo|taka.hyogo|takarazuka.hyogo|takasago.hyogo|takino.hyogo|tamba.hyogo|tatsuno.hyogo|toyooka.hyogo|yabu.hyogo|yashiro.hyogo|yoka.hyogo|yokawa.hyogo|ami.ibaraki|asahi.ibaraki|bando.ibaraki|chikusei.ibaraki|daigo.ibaraki|fujishiro.ibaraki|hitachi.ibaraki|hitachinaka.ibaraki|hitachiomiya.ibaraki|hitachiota.ibaraki|ibaraki.ibaraki|ina.ibaraki|inashiki.ibaraki|itako.ibaraki|iwama.ibaraki|joso.ibaraki|kamisu.ibaraki|kasama.ibaraki|kashima.ibaraki|kasumigaura.ibaraki|koga.ibaraki|miho.ibaraki|mito.ibaraki|moriya.ibaraki|naka.ibaraki|namegata.ibaraki|oarai.ibaraki|ogawa.ibaraki|omitama.ibaraki|ryugasaki.ibaraki|sakai.ibaraki|sakuragawa.ibaraki|shimodate.ibaraki|shimotsuma.ibaraki|shirosato.ibaraki|sowa.ibaraki|suifu.ibaraki|takahagi.ibaraki|tamatsukuri.ibaraki|tokai.ibaraki|tomobe.ibaraki|tone.ibaraki|toride.ibaraki|tsuchiura.ibaraki|tsukuba.ibaraki|uchihara.ibaraki|ushiku.ibaraki|yachiyo.ibaraki|yamagata.ibaraki|yawara.ibaraki|yuki.ibaraki|anamizu.ishikawa|hakui.ishikawa|hakusan.ishikawa|kaga.ishikawa|kahoku.ishikawa|kanazawa.ishikawa|kawakita.ishikawa|komatsu.ishikawa|nakanoto.ishikawa|nanao.ishikawa|nomi.ishikawa|nonoichi.ishikawa|noto.ishikawa|shika.ishikawa|suzu.ishikawa|tsubata.ishikawa|tsurugi.ishikawa|uchinada.ishikawa|wajima.ishikawa|fudai.iwate|fujisawa.iwate|hanamaki.iwate|hiraizumi.iwate|hirono.iwate|ichinohe.iwate|ichinoseki.iwate|iwaizumi.iwate|iwate.iwate|joboji.iwate|kamaishi.iwate|kanegasaki.iwate|karumai.iwate|kawai.iwate|kitakami.iwate|kuji.iwate|kunohe.iwate|kuzumaki.iwate|miyako.iwate|mizusawa.iwate|morioka.iwate|ninohe.iwate|noda.iwate|ofunato.iwate|oshu.iwate|otsuchi.iwate|rikuzentakata.iwate|shiwa.iwate|shizukuishi.iwate|sumita.iwate|tanohata.iwate|tono.iwate|yahaba.iwate|yamada.iwate|ayagawa.kagawa|higashikagawa.kagawa|kanonji.kagawa|kotohira.kagawa|manno.kagawa|marugame.kagawa|mitoyo.kagawa|naoshima.kagawa|sanuki.kagawa|tadotsu.kagawa|takamatsu.kagawa|tonosho.kagawa|uchinomi.kagawa|utazu.kagawa|zentsuji.kagawa|akune.kagoshima|amami.kagoshima|hioki.kagoshima|isa.kagoshima|isen.kagoshima|izumi.kagoshima|kagoshima.kagoshima|kanoya.kagoshima|kawanabe.kagoshima|kinko.kagoshima|kouyama.kagoshima|makurazaki.kagoshima|matsumoto.kagoshima|minamitane.kagoshima|nakatane.kagoshima|nishinoomote.kagoshima|satsumasendai.kagoshima|soo.kagoshima|tarumizu.kagoshima|yusui.kagoshima|aikawa.kanagawa|atsugi.kanagawa|ayase.kanagawa|chigasaki.kanagawa|ebina.kanagawa|fujisawa.kanagawa|hadano.kanagawa|hakone.kanagawa|hiratsuka.kanagawa|isehara.kanagawa|kaisei.kanagawa|kamakura.kanagawa|kiyokawa.kanagawa|matsuda.kanagawa|minamiashigara.kanagawa|miura.kanagawa|nakai.kanagawa|ninomiya.kanagawa|odawara.kanagawa|oi.kanagawa|oiso.kanagawa|sagamihara.kanagawa|samukawa.kanagawa|tsukui.kanagawa|yamakita.kanagawa|yamato.kanagawa|yokosuka.kanagawa|yugawara.kanagawa|zama.kanagawa|zushi.kanagawa|aki.kochi|geisei.kochi|hidaka.kochi|higashitsuno.kochi|ino.kochi|kagami.kochi|kami.kochi|kitagawa.kochi|kochi.kochi|mihara.kochi|motoyama.kochi|muroto.kochi|nahari.kochi|nakamura.kochi|nankoku.kochi|nishitosa.kochi|niyodogawa.kochi|ochi.kochi|okawa.kochi|otoyo.kochi|otsuki.kochi|sakawa.kochi|sukumo.kochi|susaki.kochi|tosa.kochi|tosashimizu.kochi|toyo.kochi|tsuno.kochi|umaji.kochi|yasuda.kochi|yusuhara.kochi|amakusa.kumamoto|arao.kumamoto|aso.kumamoto|choyo.kumamoto|gyokuto.kumamoto|hitoyoshi.kumamoto|kamiamakusa.kumamoto|kashima.kumamoto|kikuchi.kumamoto|kosa.kumamoto|kumamoto.kumamoto|mashiki.kumamoto|mifune.kumamoto|minamata.kumamoto|minamioguni.kumamoto|nagasu.kumamoto|nishihara.kumamoto|oguni.kumamoto|ozu.kumamoto|sumoto.kumamoto|takamori.kumamoto|uki.kumamoto|uto.kumamoto|yamaga.kumamoto|yamato.kumamoto|yatsushiro.kumamoto|ayabe.kyoto|fukuchiyama.kyoto|higashiyama.kyoto|ide.kyoto|ine.kyoto|joyo.kyoto|kameoka.kyoto|kamo.kyoto|kita.kyoto|kizu.kyoto|kumiyama.kyoto|kyotamba.kyoto|kyotanabe.kyoto|kyotango.kyoto|maizuru.kyoto|minami.kyoto|minamiyamashiro.kyoto|miyazu.kyoto|muko.kyoto|nagaokakyo.kyoto|nakagyo.kyoto|nantan.kyoto|oyamazaki.kyoto|sakyo.kyoto|seika.kyoto|tanabe.kyoto|uji.kyoto|ujitawara.kyoto|wazuka.kyoto|yamashina.kyoto|yawata.kyoto|asahi.mie|inabe.mie|ise.mie|kameyama.mie|kawagoe.mie|kiho.mie|kisosaki.mie|kiwa.mie|komono.mie|kumano.mie|kuwana.mie|matsusaka.mie|meiwa.mie|mihama.mie|minamiise.mie|misugi.mie|miyama.mie|nabari.mie|shima.mie|suzuka.mie|tado.mie|taiki.mie|taki.mie|tamaki.mie|toba.mie|tsu.mie|udono.mie|ureshino.mie|watarai.mie|yokkaichi.mie|furukawa.miyagi|higashimatsushima.miyagi|ishinomaki.miyagi|iwanuma.miyagi|kakuda.miyagi|kami.miyagi|kawasaki.miyagi|kesennuma.miyagi|marumori.miyagi|matsushima.miyagi|minamisanriku.miyagi|misato.miyagi|murata.miyagi|natori.miyagi|ogawara.miyagi|ohira.miyagi|onagawa.miyagi|osaki.miyagi|rifu.miyagi|semine.miyagi|shibata.miyagi|shichikashuku.miyagi|shikama.miyagi|shiogama.miyagi|shiroishi.miyagi|tagajo.miyagi|taiwa.miyagi|tome.miyagi|tomiya.miyagi|wakuya.miyagi|watari.miyagi|yamamoto.miyagi|zao.miyagi|aya.miyazaki|ebino.miyazaki|gokase.miyazaki|hyuga.miyazaki|kadogawa.miyazaki|kawaminami.miyazaki|kijo.miyazaki|kitagawa.miyazaki|kitakata.miyazaki|kitaura.miyazaki|kobayashi.miyazaki|kunitomi.miyazaki|kushima.miyazaki|mimata.miyazaki|miyakonojo.miyazaki|miyazaki.miyazaki|morotsuka.miyazaki|nichinan.miyazaki|nishimera.miyazaki|nobeoka.miyazaki|saito.miyazaki|shiiba.miyazaki|shintomi.miyazaki|takaharu.miyazaki|takanabe.miyazaki|takazaki.miyazaki|tsuno.miyazaki|achi.nagano|agematsu.nagano|anan.nagano|aoki.nagano|asahi.nagano|azumino.nagano|chikuhoku.nagano|chikuma.nagano|chino.nagano|fujimi.nagano|hakuba.nagano|hara.nagano|hiraya.nagano|iida.nagano|iijima.nagano|iiyama.nagano|iizuna.nagano|ikeda.nagano|ikusaka.nagano|ina.nagano|karuizawa.nagano|kawakami.nagano|kiso.nagano|kisofukushima.nagano|kitaaiki.nagano|komagane.nagano|komoro.nagano|matsukawa.nagano|matsumoto.nagano|miasa.nagano|minamiaiki.nagano|minamimaki.nagano|minamiminowa.nagano|minowa.nagano|miyada.nagano|miyota.nagano|mochizuki.nagano|nagano.nagano|nagawa.nagano|nagiso.nagano|nakagawa.nagano|nakano.nagano|nozawaonsen.nagano|obuse.nagano|ogawa.nagano|okaya.nagano|omachi.nagano|omi.nagano|ookuwa.nagano|ooshika.nagano|otaki.nagano|otari.nagano|sakae.nagano|sakaki.nagano|saku.nagano|sakuho.nagano|shimosuwa.nagano|shinanomachi.nagano|shiojiri.nagano|suwa.nagano|suzaka.nagano|takagi.nagano|takamori.nagano|takayama.nagano|tateshina.nagano|tatsuno.nagano|togakushi.nagano|togura.nagano|tomi.nagano|ueda.nagano|wada.nagano|yamagata.nagano|yamanouchi.nagano|yasaka.nagano|yasuoka.nagano|chijiwa.nagasaki|futsu.nagasaki|goto.nagasaki|hasami.nagasaki|hirado.nagasaki|iki.nagasaki|isahaya.nagasaki|kawatana.nagasaki|kuchinotsu.nagasaki|matsuura.nagasaki|nagasaki.nagasaki|obama.nagasaki|omura.nagasaki|oseto.nagasaki|saikai.nagasaki|sasebo.nagasaki|seihi.nagasaki|shimabara.nagasaki|shinkamigoto.nagasaki|togitsu.nagasaki|tsushima.nagasaki|unzen.nagasaki|ando.nara|gose.nara|heguri.nara|higashiyoshino.nara|ikaruga.nara|ikoma.nara|kamikitayama.nara|kanmaki.nara|kashiba.nara|kashihara.nara|katsuragi.nara|kawai.nara|kawakami.nara|kawanishi.nara|koryo.nara|kurotaki.nara|mitsue.nara|miyake.nara|nara.nara|nosegawa.nara|oji.nara|ouda.nara|oyodo.nara|sakurai.nara|sango.nara|shimoichi.nara|shimokitayama.nara|shinjo.nara|soni.nara|takatori.nara|tawaramoto.nara|tenkawa.nara|tenri.nara|uda.nara|yamatokoriyama.nara|yamatotakada.nara|yamazoe.nara|yoshino.nara|aga.niigata|agano.niigata|gosen.niigata|itoigawa.niigata|izumozaki.niigata|joetsu.niigata|kamo.niigata|kariwa.niigata|kashiwazaki.niigata|minamiuonuma.niigata|mitsuke.niigata|muika.niigata|murakami.niigata|myoko.niigata|nagaoka.niigata|niigata.niigata|ojiya.niigata|omi.niigata|sado.niigata|sanjo.niigata|seiro.niigata|seirou.niigata|sekikawa.niigata|shibata.niigata|tagami.niigata|tainai.niigata|tochio.niigata|tokamachi.niigata|tsubame.niigata|tsunan.niigata|uonuma.niigata|yahiko.niigata|yoita.niigata|yuzawa.niigata|beppu.oita|bungoono.oita|bungotakada.oita|hasama.oita|hiji.oita|himeshima.oita|hita.oita|kamitsue.oita|kokonoe.oita|kuju.oita|kunisaki.oita|kusu.oita|oita.oita|saiki.oita|taketa.oita|tsukumi.oita|usa.oita|usuki.oita|yufu.oita|akaiwa.okayama|asakuchi.okayama|bizen.okayama|hayashima.okayama|ibara.okayama|kagamino.okayama|kasaoka.okayama|kibichuo.okayama|kumenan.okayama|kurashiki.okayama|maniwa.okayama|misaki.okayama|nagi.okayama|niimi.okayama|nishiawakura.okayama|okayama.okayama|satosho.okayama|setouchi.okayama|shinjo.okayama|shoo.okayama|soja.okayama|takahashi.okayama|tamano.okayama|tsuyama.okayama|wake.okayama|yakage.okayama|aguni.okinawa|ginowan.okinawa|ginoza.okinawa|gushikami.okinawa|haebaru.okinawa|higashi.okinawa|hirara.okinawa|iheya.okinawa|ishigaki.okinawa|ishikawa.okinawa|itoman.okinawa|izena.okinawa|kadena.okinawa|kin.okinawa|kitadaito.okinawa|kitanakagusuku.okinawa|kumejima.okinawa|kunigami.okinawa|minamidaito.okinawa|motobu.okinawa|nago.okinawa|naha.okinawa|nakagusuku.okinawa|nakijin.okinawa|nanjo.okinawa|nishihara.okinawa|ogimi.okinawa|okinawa.okinawa|onna.okinawa|shimoji.okinawa|taketomi.okinawa|tarama.okinawa|tokashiki.okinawa|tomigusuku.okinawa|tonaki.okinawa|urasoe.okinawa|uruma.okinawa|yaese.okinawa|yomitan.okinawa|yonabaru.okinawa|yonaguni.okinawa|zamami.okinawa|abeno.osaka|chihayaakasaka.osaka|chuo.osaka|daito.osaka|fujiidera.osaka|habikino.osaka|hannan.osaka|higashiosaka.osaka|higashisumiyoshi.osaka|higashiyodogawa.osaka|hirakata.osaka|ibaraki.osaka|ikeda.osaka|izumi.osaka|izumiotsu.osaka|izumisano.osaka|kadoma.osaka|kaizuka.osaka|kanan.osaka|kashiwara.osaka|katano.osaka|kawachinagano.osaka|kishiwada.osaka|kita.osaka|kumatori.osaka|matsubara.osaka|minato.osaka|minoh.osaka|misaki.osaka|moriguchi.osaka|neyagawa.osaka|nishi.osaka|nose.osaka|osakasayama.osaka|sakai.osaka|sayama.osaka|sennan.osaka|settsu.osaka|shijonawate.osaka|shimamoto.osaka|suita.osaka|tadaoka.osaka|taishi.osaka|tajiri.osaka|takaishi.osaka|takatsuki.osaka|tondabayashi.osaka|toyonaka.osaka|toyono.osaka|yao.osaka|ariake.saga|arita.saga|fukudomi.saga|genkai.saga|hamatama.saga|hizen.saga|imari.saga|kamimine.saga|kanzaki.saga|karatsu.saga|kashima.saga|kitagata.saga|kitahata.saga|kiyama.saga|kouhoku.saga|kyuragi.saga|nishiarita.saga|ogi.saga|omachi.saga|ouchi.saga|saga.saga|shiroishi.saga|taku.saga|tara.saga|tosu.saga|yoshinogari.saga|arakawa.saitama|asaka.saitama|chichibu.saitama|fujimi.saitama|fujimino.saitama|fukaya.saitama|hanno.saitama|hanyu.saitama|hasuda.saitama|hatogaya.saitama|hatoyama.saitama|hidaka.saitama|higashichichibu.saitama|higashimatsuyama.saitama|honjo.saitama|ina.saitama|iruma.saitama|iwatsuki.saitama|kamiizumi.saitama|kamikawa.saitama|kamisato.saitama|kasukabe.saitama|kawagoe.saitama|kawaguchi.saitama|kawajima.saitama|kazo.saitama|kitamoto.saitama|koshigaya.saitama|kounosu.saitama|kuki.saitama|kumagaya.saitama|matsubushi.saitama|minano.saitama|misato.saitama|miyashiro.saitama|miyoshi.saitama|moroyama.saitama|nagatoro.saitama|namegawa.saitama|niiza.saitama|ogano.saitama|ogawa.saitama|ogose.saitama|okegawa.saitama|omiya.saitama|otaki.saitama|ranzan.saitama|ryokami.saitama|saitama.saitama|sakado.saitama|satte.saitama|sayama.saitama|shiki.saitama|shiraoka.saitama|soka.saitama|sugito.saitama|toda.saitama|tokigawa.saitama|tokorozawa.saitama|tsurugashima.saitama|urawa.saitama|warabi.saitama|yashio.saitama|yokoze.saitama|yono.saitama|yorii.saitama|yoshida.saitama|yoshikawa.saitama|yoshimi.saitama|aisho.shiga|gamo.shiga|higashiomi.shiga|hikone.shiga|koka.shiga|konan.shiga|kosei.shiga|koto.shiga|kusatsu.shiga|maibara.shiga|moriyama.shiga|nagahama.shiga|nishiazai.shiga|notogawa.shiga|omihachiman.shiga|otsu.shiga|ritto.shiga|ryuoh.shiga|takashima.shiga|takatsuki.shiga|torahime.shiga|toyosato.shiga|yasu.shiga|akagi.shimane|ama.shimane|gotsu.shimane|hamada.shimane|higashiizumo.shimane|hikawa.shimane|hikimi.shimane|izumo.shimane|kakinoki.shimane|masuda.shimane|matsue.shimane|misato.shimane|nishinoshima.shimane|ohda.shimane|okinoshima.shimane|okuizumo.shimane|shimane.shimane|tamayu.shimane|tsuwano.shimane|unnan.shimane|yakumo.shimane|yasugi.shimane|yatsuka.shimane|arai.shizuoka|atami.shizuoka|fuji.shizuoka|fujieda.shizuoka|fujikawa.shizuoka|fujinomiya.shizuoka|fukuroi.shizuoka|gotemba.shizuoka|haibara.shizuoka|hamamatsu.shizuoka|higashiizu.shizuoka|ito.shizuoka|iwata.shizuoka|izu.shizuoka|izunokuni.shizuoka|kakegawa.shizuoka|kannami.shizuoka|kawanehon.shizuoka|kawazu.shizuoka|kikugawa.shizuoka|kosai.shizuoka|makinohara.shizuoka|matsuzaki.shizuoka|minamiizu.shizuoka|mishima.shizuoka|morimachi.shizuoka|nishiizu.shizuoka|numazu.shizuoka|omaezaki.shizuoka|shimada.shizuoka|shimizu.shizuoka|shimoda.shizuoka|shizuoka.shizuoka|susono.shizuoka|yaizu.shizuoka|yoshida.shizuoka|ashikaga.tochigi|bato.tochigi|haga.tochigi|ichikai.tochigi|iwafune.tochigi|kaminokawa.tochigi|kanuma.tochigi|karasuyama.tochigi|kuroiso.tochigi|mashiko.tochigi|mibu.tochigi|moka.tochigi|motegi.tochigi|nasu.tochigi|nasushiobara.tochigi|nikko.tochigi|nishikata.tochigi|nogi.tochigi|ohira.tochigi|ohtawara.tochigi|oyama.tochigi|sakura.tochigi|sano.tochigi|shimotsuke.tochigi|shioya.tochigi|takanezawa.tochigi|tochigi.tochigi|tsuga.tochigi|ujiie.tochigi|utsunomiya.tochigi|yaita.tochigi|aizumi.tokushima|anan.tokushima|ichiba.tokushima|itano.tokushima|kainan.tokushima|komatsushima.tokushima|matsushige.tokushima|mima.tokushima|minami.tokushima|miyoshi.tokushima|mugi.tokushima|nakagawa.tokushima|naruto.tokushima|sanagochi.tokushima|shishikui.tokushima|tokushima.tokushima|wajiki.tokushima|adachi.tokyo|akiruno.tokyo|akishima.tokyo|aogashima.tokyo|arakawa.tokyo|bunkyo.tokyo|chiyoda.tokyo|chofu.tokyo|chuo.tokyo|edogawa.tokyo|fuchu.tokyo|fussa.tokyo|hachijo.tokyo|hachioji.tokyo|hamura.tokyo|higashikurume.tokyo|higashimurayama.tokyo|higashiyamato.tokyo|hino.tokyo|hinode.tokyo|hinohara.tokyo|inagi.tokyo|itabashi.tokyo|katsushika.tokyo|kita.tokyo|kiyose.tokyo|kodaira.tokyo|koganei.tokyo|kokubunji.tokyo|komae.tokyo|koto.tokyo|kouzushima.tokyo|kunitachi.tokyo|machida.tokyo|meguro.tokyo|minato.tokyo|mitaka.tokyo|mizuho.tokyo|musashimurayama.tokyo|musashino.tokyo|nakano.tokyo|nerima.tokyo|ogasawara.tokyo|okutama.tokyo|ome.tokyo|oshima.tokyo|ota.tokyo|setagaya.tokyo|shibuya.tokyo|shinagawa.tokyo|shinjuku.tokyo|suginami.tokyo|sumida.tokyo|tachikawa.tokyo|taito.tokyo|tama.tokyo|toshima.tokyo|chizu.tottori|hino.tottori|kawahara.tottori|koge.tottori|kotoura.tottori|misasa.tottori|nanbu.tottori|nichinan.tottori|sakaiminato.tottori|tottori.tottori|wakasa.tottori|yazu.tottori|yonago.tottori|asahi.toyama|fuchu.toyama|fukumitsu.toyama|funahashi.toyama|himi.toyama|imizu.toyama|inami.toyama|johana.toyama|kamiichi.toyama|kurobe.toyama|nakaniikawa.toyama|namerikawa.toyama|nanto.toyama|nyuzen.toyama|oyabe.toyama|taira.toyama|takaoka.toyama|tateyama.toyama|toga.toyama|tonami.toyama|toyama.toyama|unazuki.toyama|uozu.toyama|yamada.toyama|arida.wakayama|aridagawa.wakayama|gobo.wakayama|hashimoto.wakayama|hidaka.wakayama|hirogawa.wakayama|inami.wakayama|iwade.wakayama|kainan.wakayama|kamitonda.wakayama|katsuragi.wakayama|kimino.wakayama|kinokawa.wakayama|kitayama.wakayama|koya.wakayama|koza.wakayama|kozagawa.wakayama|kudoyama.wakayama|kushimoto.wakayama|mihama.wakayama|misato.wakayama|nachikatsuura.wakayama|shingu.wakayama|shirahama.wakayama|taiji.wakayama|tanabe.wakayama|wakayama.wakayama|yuasa.wakayama|yura.wakayama|asahi.yamagata|funagata.yamagata|higashine.yamagata|iide.yamagata|kahoku.yamagata|kaminoyama.yamagata|kaneyama.yamagata|kawanishi.yamagata|mamurogawa.yamagata|mikawa.yamagata|murayama.yamagata|nagai.yamagata|nakayama.yamagata|nanyo.yamagata|nishikawa.yamagata|obanazawa.yamagata|oe.yamagata|oguni.yamagata|ohkura.yamagata|oishida.yamagata|sagae.yamagata|sakata.yamagata|sakegawa.yamagata|shinjo.yamagata|shirataka.yamagata|shonai.yamagata|takahata.yamagata|tendo.yamagata|tozawa.yamagata|tsuruoka.yamagata|yamagata.yamagata|yamanobe.yamagata|yonezawa.yamagata|yuza.yamagata|abu.yamaguchi|hagi.yamaguchi|hikari.yamaguchi|hofu.yamaguchi|iwakuni.yamaguchi|kudamatsu.yamaguchi|mitou.yamaguchi|nagato.yamaguchi|oshima.yamaguchi|shimonoseki.yamaguchi|shunan.yamaguchi|tabuse.yamaguchi|tokuyama.yamaguchi|toyota.yamaguchi|ube.yamaguchi|yuu.yamaguchi|chuo.yamanashi|doshi.yamanashi|fuefuki.yamanashi|fujikawa.yamanashi|fujikawaguchiko.yamanashi|fujiyoshida.yamanashi|hayakawa.yamanashi|hokuto.yamanashi|ichikawamisato.yamanashi|kai.yamanashi|kofu.yamanashi|koshu.yamanashi|kosuge.yamanashi|minami-alps.yamanashi|minobu.yamanashi|nakamichi.yamanashi|nanbu.yamanashi|narusawa.yamanashi|nirasaki.yamanashi|nishikatsura.yamanashi|oshino.yamanashi|otsuki.yamanashi|showa.yamanashi|tabayama.yamanashi|tsuru.yamanashi|uenohara.yamanashi|yamanakako.yamanashi|yamanashi.yamanashi|blogspot",
		"ke": "*",
		"kg": "org|net|com|edu|gov|mil",
		"kh": "*",
		"ki": "edu|biz|net|org|gov|info|com",
		"km": "org|nom|gov|prd|tm|edu|mil|ass|com|coop|asso|presse|medecin|notaires|pharmaciens|veterinaire|gouv",
		"kn": "net|org|edu|gov",
		"kp": "com|edu|gov|org|rep|tra",
		"kr": "ac|co|es|go|hs|kg|mil|ms|ne|or|pe|re|sc|busan|chungbuk|chungnam|daegu|daejeon|gangwon|gwangju|gyeongbuk|gyeonggi|gyeongnam|incheon|jeju|jeonbuk|jeonnam|seoul|ulsan|blogspot",
		"kw": "*",
		"ky": "edu|gov|com|org|net",
		"kz": "org|edu|net|gov|mil|com",
		"la": "int|net|info|edu|gov|per|com|org|c",
		"lb": "com|edu|gov|net|org",
		"lc": "com|net|co|org|edu|gov",
		"li": "",
		"lk": "gov|sch|net|int|com|org|edu|ngo|soc|web|ltd|assn|grp|hotel",
		"lr": "com|edu|gov|org|net",
		"ls": "co|org",
		"lt": "gov",
		"lu": "",
		"lv": "com|edu|gov|org|mil|id|net|asn|conf",
		"ly": "com|net|gov|plc|edu|sch|med|org|id",
		"ma": "co|net|gov|org|ac|press",
		"mc": "tm|asso",
		"md": "",
		"me": "co|net|org|edu|ac|gov|its|priv",
		"mg": "org|nom|gov|prd|tm|edu|mil|com",
		"mh": "",
		"mil": "",
		"mk": "com|org|net|edu|gov|inf|name",
		"ml": "com|edu|gouv|gov|net|org|presse",
		"mm": "*",
		"mn": "gov|edu|org|nyc",
		"mo": "com|net|org|edu|gov",
		"mobi": "",
		"mp": "",
		"mq": "",
		"mr": "gov|blogspot",
		"ms": "com|edu|gov|net|org",
		"mt": "com|edu|net|org",
		"mu": "com|net|org|gov|ac|co|or",
		"museum": "academy|agriculture|air|airguard|alabama|alaska|amber|ambulance|american|americana|americanantiques|americanart|amsterdam|and|annefrank|anthro|anthropology|antiques|aquarium|arboretum|archaeological|archaeology|architecture|art|artanddesign|artcenter|artdeco|arteducation|artgallery|arts|artsandcrafts|asmatart|assassination|assisi|association|astronomy|atlanta|austin|australia|automotive|aviation|axis|badajoz|baghdad|bahn|bale|baltimore|barcelona|baseball|basel|baths|bauern|beauxarts|beeldengeluid|bellevue|bergbau|berkeley|berlin|bern|bible|bilbao|bill|birdart|birthplace|bonn|boston|botanical|botanicalgarden|botanicgarden|botany|brandywinevalley|brasil|bristol|british|britishcolumbia|broadcast|brunel|brussel|brussels|bruxelles|building|burghof|bus|bushey|cadaques|california|cambridge|can|canada|capebreton|carrier|cartoonart|casadelamoneda|castle|castres|celtic|center|chattanooga|cheltenham|chesapeakebay|chicago|children|childrens|childrensgarden|chiropractic|chocolate|christiansburg|cincinnati|cinema|circus|civilisation|civilization|civilwar|clinton|clock|coal|coastaldefence|cody|coldwar|collection|colonialwilliamsburg|coloradoplateau|columbia|columbus|communication|communications|community|computer|computerhistory|comunicações|contemporary|contemporaryart|convent|copenhagen|corporation|correios-e-telecomunicações|corvette|costume|countryestate|county|crafts|cranbrook|creation|cultural|culturalcenter|culture|cyber|cymru|dali|dallas|database|ddr|decorativearts|delaware|delmenhorst|denmark|depot|design|detroit|dinosaur|discovery|dolls|donostia|durham|eastafrica|eastcoast|education|educational|egyptian|eisenbahn|elburg|elvendrell|embroidery|encyclopedic|england|entomology|environment|environmentalconservation|epilepsy|essex|estate|ethnology|exeter|exhibition|family|farm|farmequipment|farmers|farmstead|field|figueres|filatelia|film|fineart|finearts|finland|flanders|florida|force|fortmissoula|fortworth|foundation|francaise|frankfurt|franziskaner|freemasonry|freiburg|fribourg|frog|fundacio|furniture|gallery|garden|gateway|geelvinck|gemological|geology|georgia|giessen|glas|glass|gorge|grandrapids|graz|guernsey|halloffame|hamburg|handson|harvestcelebration|hawaii|health|heimatunduhren|hellas|helsinki|hembygdsforbund|heritage|histoire|historical|historicalsociety|historichouses|historisch|historisches|history|historyofscience|horology|house|humanities|illustration|imageandsound|indian|indiana|indianapolis|indianmarket|intelligence|interactive|iraq|iron|isleofman|jamison|jefferson|jerusalem|jewelry|jewish|jewishart|jfk|journalism|judaica|judygarland|juedisches|juif|karate|karikatur|kids|koebenhavn|koeln|kunst|kunstsammlung|kunstunddesign|labor|labour|lajolla|lancashire|landes|lans|läns|larsson|lewismiller|lincoln|linz|living|livinghistory|localhistory|london|losangeles|louvre|loyalist|lucerne|luxembourg|luzern|mad|madrid|mallorca|manchester|mansion|mansions|manx|marburg|maritime|maritimo|maryland|marylhurst|media|medical|medizinhistorisches|meeres|memorial|mesaverde|michigan|midatlantic|military|mill|miners|mining|minnesota|missile|missoula|modern|moma|money|monmouth|monticello|montreal|moscow|motorcycle|muenchen|muenster|mulhouse|muncie|museet|museumcenter|museumvereniging|music|national|nationalfirearms|nationalheritage|nativeamerican|naturalhistory|naturalhistorymuseum|naturalsciences|nature|naturhistorisches|natuurwetenschappen|naumburg|naval|nebraska|neues|newhampshire|newjersey|newmexico|newport|newspaper|newyork|niepce|norfolk|north|nrw|nuernberg|nuremberg|nyc|nyny|oceanographic|oceanographique|omaha|online|ontario|openair|oregon|oregontrail|otago|oxford|pacific|paderborn|palace|paleo|palmsprings|panama|paris|pasadena|pharmacy|philadelphia|philadelphiaarea|philately|phoenix|photography|pilots|pittsburgh|planetarium|plantation|plants|plaza|portal|portland|portlligat|posts-and-telecommunications|preservation|presidio|press|project|public|pubol|quebec|railroad|railway|research|resistance|riodejaneiro|rochester|rockart|roma|russia|saintlouis|salem|salvadordali|salzburg|sandiego|sanfrancisco|santabarbara|santacruz|santafe|saskatchewan|satx|savannahga|schlesisches|schoenbrunn|schokoladen|school|schweiz|science|scienceandhistory|scienceandindustry|sciencecenter|sciencecenters|science-fiction|sciencehistory|sciences|sciencesnaturelles|scotland|seaport|settlement|settlers|shell|sherbrooke|sibenik|silk|ski|skole|society|sologne|soundandvision|southcarolina|southwest|space|spy|square|stadt|stalbans|starnberg|state|stateofdelaware|station|steam|steiermark|stjohn|stockholm|stpetersburg|stuttgart|suisse|surgeonshall|surrey|svizzera|sweden|sydney|tank|tcm|technology|telekommunikation|television|texas|textile|theater|time|timekeeping|topology|torino|touch|town|transport|tree|trolley|trust|trustee|uhren|ulm|undersea|university|usa|usantiques|usarts|uscountryestate|usculture|usdecorativearts|usgarden|ushistory|ushuaia|uslivinghistory|utah|uvic|valley|vantaa|versailles|viking|village|virginia|virtual|virtuel|vlaanderen|volkenkunde|wales|wallonie|war|washingtondc|watchandclock|watch-and-clock|western|westfalen|whaling|wildlife|williamsburg|windmill|workshop|york|yorkshire|yosemite|youth|zoological|zoology|ירושלים|иком",
		"mv": "aero|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro",
		"mw": "ac|biz|co|com|coop|edu|gov|int|museum|net|org",
		"mx": "com|org|gob|edu|net|blogspot",
		"my": "com|net|org|gov|edu|mil|name",
		"mz": "*|!teledata",
		"na": "info|pro|name|school|or|dr|us|mx|ca|in|cc|tv|ws|mobi|co|com|org",
		"name": "forgot.her|forgot.his",
		"nc": "asso",
		"ne": "",
		"net": "cloudfront|gb|hu|jp|se|uk|in|at-band-camp|blogdns|broke-it|buyshouses|dnsalias|dnsdojo|does-it|dontexist|dynalias|dynathome|endofinternet|from-az|from-co|from-la|from-ny|gets-it|ham-radio-op|homeftp|homeip|homelinux|homeunix|in-the-band|is-a-chef|is-a-geek|isa-geek|kicks-ass|office-on-the|podzone|scrapper-site|selfip|sells-it|servebbs|serveftp|thruhere|webhop|a.ssl.fastly|b.ssl.fastly|global.ssl.fastly|a.prod.fastly|global.prod.fastly|azurewebsites|azure-mobile|cloudapp|za",
		"nf": "com|net|per|rec|web|arts|firm|info|other|store",
		"ng": "com|edu|name|net|org|sch|gov|mil|mobi",
		"ni": "*",
		"nl": "bv|co|blogspot",
		"no": "fhs|vgs|fylkesbibl|folkebibl|museum|idrett|priv|mil|stat|dep|kommune|herad|aa|ah|bu|fm|hl|hm|jan-mayen|mr|nl|nt|of|ol|oslo|rl|sf|st|svalbard|tm|tr|va|vf|gs.aa|gs.ah|gs.bu|gs.fm|gs.hl|gs.hm|gs.jan-mayen|gs.mr|gs.nl|gs.nt|gs.of|gs.ol|gs.oslo|gs.rl|gs.sf|gs.st|gs.svalbard|gs.tm|gs.tr|gs.va|gs.vf|akrehamn|åkrehamn|algard|ålgård|arna|brumunddal|bryne|bronnoysund|brønnøysund|drobak|drøbak|egersund|fetsund|floro|florø|fredrikstad|hokksund|honefoss|hønefoss|jessheim|jorpeland|jørpeland|kirkenes|kopervik|krokstadelva|langevag|langevåg|leirvik|mjondalen|mjøndalen|mo-i-rana|mosjoen|mosjøen|nesoddtangen|orkanger|osoyro|osøyro|raholt|råholt|sandnessjoen|sandnessjøen|skedsmokorset|slattum|spjelkavik|stathelle|stavern|stjordalshalsen|stjørdalshalsen|tananger|tranby|vossevangen|afjord|åfjord|agdenes|al|ål|alesund|ålesund|alstahaug|alta|áltá|alaheadju|álaheadju|alvdal|amli|åmli|amot|åmot|andebu|andoy|andøy|andasuolo|ardal|årdal|aremark|arendal|ås|aseral|åseral|asker|askim|askvoll|askoy|askøy|asnes|åsnes|audnedaln|aukra|aure|aurland|aurskog-holand|aurskog-høland|austevoll|austrheim|averoy|averøy|balestrand|ballangen|balat|bálát|balsfjord|bahccavuotna|báhccavuotna|bamble|bardu|beardu|beiarn|bajddar|bájddar|baidar|báidár|berg|bergen|berlevag|berlevåg|bearalvahki|bearalváhki|bindal|birkenes|bjarkoy|bjarkøy|bjerkreim|bjugn|bodo|bodø|badaddja|bådåddjå|budejju|bokn|bremanger|bronnoy|brønnøy|bygland|bykle|barum|bærum|bo.telemark|bø.telemark|bo.nordland|bø.nordland|bievat|bievát|bomlo|bømlo|batsfjord|båtsfjord|bahcavuotna|báhcavuotna|dovre|drammen|drangedal|dyroy|dyrøy|donna|dønna|eid|eidfjord|eidsberg|eidskog|eidsvoll|eigersund|elverum|enebakk|engerdal|etne|etnedal|evenes|evenassi|evenášši|evje-og-hornnes|farsund|fauske|fuossko|fuoisku|fedje|fet|finnoy|finnøy|fitjar|fjaler|fjell|flakstad|flatanger|flekkefjord|flesberg|flora|fla|flå|folldal|forsand|fosnes|frei|frogn|froland|frosta|frana|fræna|froya|frøya|fusa|fyresdal|forde|førde|gamvik|gangaviika|gáŋgaviika|gaular|gausdal|gildeskal|gildeskål|giske|gjemnes|gjerdrum|gjerstad|gjesdal|gjovik|gjøvik|gloppen|gol|gran|grane|granvin|gratangen|grimstad|grong|kraanghke|kråanghke|grue|gulen|hadsel|halden|halsa|hamar|hamaroy|habmer|hábmer|hapmir|hápmir|hammerfest|hammarfeasta|hámmárfeasta|haram|hareid|harstad|hasvik|aknoluokta|ákŋoluokta|hattfjelldal|aarborte|haugesund|hemne|hemnes|hemsedal|heroy.more-og-romsdal|herøy.møre-og-romsdal|heroy.nordland|herøy.nordland|hitra|hjartdal|hjelmeland|hobol|hobøl|hof|hol|hole|holmestrand|holtalen|holtålen|hornindal|horten|hurdal|hurum|hvaler|hyllestad|hagebostad|hægebostad|hoyanger|høyanger|hoylandet|høylandet|ha|hå|ibestad|inderoy|inderøy|iveland|jevnaker|jondal|jolster|jølster|karasjok|karasjohka|kárášjohka|karlsoy|galsa|gálsá|karmoy|karmøy|kautokeino|guovdageaidnu|klepp|klabu|klæbu|kongsberg|kongsvinger|kragero|kragerø|kristiansand|kristiansund|krodsherad|krødsherad|kvalsund|rahkkeravju|ráhkkerávju|kvam|kvinesdal|kvinnherad|kviteseid|kvitsoy|kvitsøy|kvafjord|kvæfjord|giehtavuoatna|kvanangen|kvænangen|navuotna|návuotna|kafjord|kåfjord|gaivuotna|gáivuotna|larvik|lavangen|lavagis|loabat|loabát|lebesby|davvesiida|leikanger|leirfjord|leka|leksvik|lenvik|leangaviika|leaŋgaviika|lesja|levanger|lier|lierne|lillehammer|lillesand|lindesnes|lindas|lindås|lom|loppa|lahppi|láhppi|lund|lunner|luroy|lurøy|luster|lyngdal|lyngen|ivgu|lardal|lerdal|lærdal|lodingen|lødingen|lorenskog|lørenskog|loten|løten|malvik|masoy|måsøy|muosat|muosát|mandal|marker|marnardal|masfjorden|meland|meldal|melhus|meloy|meløy|meraker|meråker|moareke|moåreke|midsund|midtre-gauldal|modalen|modum|molde|moskenes|moss|mosvik|malselv|målselv|malatvuopmi|málatvuopmi|namdalseid|aejrie|namsos|namsskogan|naamesjevuemie|nååmesjevuemie|laakesvuemie|nannestad|narvik|narviika|naustdal|nedre-eiker|nes.akershus|nes.buskerud|nesna|nesodden|nesseby|unjarga|unjárga|nesset|nissedal|nittedal|nord-aurdal|nord-fron|nord-odal|norddal|nordkapp|davvenjarga|davvenjárga|nordre-land|nordreisa|raisa|ráisa|nore-og-uvdal|notodden|naroy|nærøy|notteroy|nøtterøy|odda|oksnes|øksnes|oppdal|oppegard|oppegård|orkdal|orland|ørland|orskog|ørskog|orsta|ørsta|os.hedmark|os.hordaland|osen|osteroy|osterøy|ostre-toten|østre-toten|overhalla|ovre-eiker|øvre-eiker|oyer|øyer|oygarden|øygarden|oystre-slidre|øystre-slidre|porsanger|porsangu|porsáŋgu|porsgrunn|radoy|radøy|rakkestad|rana|ruovat|randaberg|rauma|rendalen|rennebu|rennesoy|rennesøy|rindal|ringebu|ringerike|ringsaker|rissa|risor|risør|roan|rollag|rygge|ralingen|rælingen|rodoy|rødøy|romskog|rømskog|roros|røros|rost|røst|royken|røyken|royrvik|røyrvik|rade|råde|salangen|siellak|saltdal|salat|sálát|sálat|samnanger|sande.more-og-romsdal|sande.møre-og-romsdal|sande.vestfold|sandefjord|sandnes|sandoy|sandøy|sarpsborg|sauda|sauherad|sel|selbu|selje|seljord|sigdal|siljan|sirdal|skaun|skedsmo|ski|skien|skiptvet|skjervoy|skjervøy|skierva|skiervá|skjak|skjåk|skodje|skanland|skånland|skanit|skánit|smola|smøla|snillfjord|snasa|snåsa|snoasa|snaase|snåase|sogndal|sokndal|sola|solund|songdalen|sortland|spydeberg|stange|stavanger|steigen|steinkjer|stjordal|stjørdal|stokke|stor-elvdal|stord|stordal|storfjord|omasvuotna|strand|stranda|stryn|sula|suldal|sund|sunndal|surnadal|sveio|svelvik|sykkylven|sogne|søgne|somna|sømna|sondre-land|søndre-land|sor-aurdal|sør-aurdal|sor-fron|sør-fron|sor-odal|sør-odal|sor-varanger|sør-varanger|matta-varjjat|mátta-várjjat|sorfold|sørfold|sorreisa|sørreisa|sorum|sørum|tana|deatnu|time|tingvoll|tinn|tjeldsund|dielddanuorri|tjome|tjøme|tokke|tolga|torsken|tranoy|tranøy|tromso|tromsø|tromsa|romsa|trondheim|troandin|trysil|trana|træna|trogstad|trøgstad|tvedestrand|tydal|tynset|tysfjord|divtasvuodna|divttasvuotna|tysnes|tysvar|tysvær|tonsberg|tønsberg|ullensaker|ullensvang|ulvik|utsira|vadso|vadsø|cahcesuolo|čáhcesuolo|vaksdal|valle|vang|vanylven|vardo|vardø|varggat|várggát|vefsn|vaapste|vega|vegarshei|vegårshei|vennesla|verdal|verran|vestby|vestnes|vestre-slidre|vestre-toten|vestvagoy|vestvågøy|vevelstad|vik|vikna|vindafjord|volda|voss|varoy|værøy|vagan|vågan|voagat|vagsoy|vågsøy|vaga|vågå|valer.ostfold|våler.østfold|valer.hedmark|våler.hedmark|co|blogspot",
		"np": "*",
		"nr": "biz|info|gov|edu|org|net|com",
		"nu": "merseine|mine|shacknet",
		"nz": "ac|co|cri|geek|gen|govt|health|iwi|kiwi|maori|mil|māori|net|org|parliament|school|blogspot.co",
		"om": "co|com|edu|gov|med|museum|net|org|pro",
		"org": "ae|us|dyndns|blogdns|blogsite|boldlygoingnowhere|dnsalias|dnsdojo|doesntexist|dontexist|doomdns|dvrdns|dynalias|endofinternet|endoftheinternet|from-me|game-host|go.dyndns|gotdns|hobby-site|home.dyndns|homedns|homeftp|homelinux|homeunix|is-a-bruinsfan|is-a-candidate|is-a-celticsfan|is-a-chef|is-a-geek|is-a-knight|is-a-linux-user|is-a-patsfan|is-a-soxfan|is-found|is-lost|is-saved|is-very-bad|is-very-evil|is-very-good|is-very-nice|is-very-sweet|isa-geek|kicks-ass|misconfused|podzone|readmyblog|selfip|sellsyourhome|servebbs|serveftp|servegame|stuff-4-sale|webhop|za",
		"pa": "ac|gob|com|org|sld|edu|net|ing|abo|med|nom",
		"pe": "edu|gob|nom|mil|org|com|net",
		"pf": "com|org|edu",
		"pg": "*",
		"ph": "com|net|org|gov|edu|ngo|mil|i",
		"pk": "com|net|edu|org|fam|biz|web|gov|gob|gok|gon|gop|gos|info",
		"pl": "aid|agro|atm|auto|biz|com|edu|gmina|gsm|info|mail|miasta|media|mil|net|nieruchomosci|nom|org|pc|powiat|priv|realestate|rel|sex|shop|sklep|sos|szkola|targi|tm|tourism|travel|turystyka|6bone|art|mbone|gov|uw.gov|um.gov|ug.gov|upow.gov|starostwo.gov|so.gov|sr.gov|po.gov|pa.gov|ngo|irc|usenet|augustow|babia-gora|bedzin|beskidy|bialowieza|bialystok|bielawa|bieszczady|boleslawiec|bydgoszcz|bytom|cieszyn|czeladz|czest|dlugoleka|elblag|elk|glogow|gniezno|gorlice|grajewo|ilawa|jaworzno|jelenia-gora|jgora|kalisz|kazimierz-dolny|karpacz|kartuzy|kaszuby|katowice|kepno|ketrzyn|klodzko|kobierzyce|kolobrzeg|konin|konskowola|kutno|lapy|lebork|legnica|lezajsk|limanowa|lomza|lowicz|lubin|lukow|malbork|malopolska|mazowsze|mazury|mielec|mielno|mragowo|naklo|nowaruda|nysa|olawa|olecko|olkusz|olsztyn|opoczno|opole|ostroda|ostroleka|ostrowiec|ostrowwlkp|pila|pisz|podhale|podlasie|polkowice|pomorze|pomorskie|prochowice|pruszkow|przeworsk|pulawy|radom|rawa-maz|rybnik|rzeszow|sanok|sejny|siedlce|slask|slupsk|sosnowiec|stalowa-wola|skoczow|starachowice|stargard|suwalki|swidnica|swiebodzin|swinoujscie|szczecin|szczytno|tarnobrzeg|tgory|turek|tychy|ustka|walbrzych|warmia|warszawa|waw|wegrow|wielun|wlocl|wloclawek|wodzislaw|wolomin|wroclaw|zachpomor|zagan|zarow|zgora|zgorzelec|gda|gdansk|gdynia|med|sopot|gliwice|krakow|poznan|wroc|zakopane|co",
		"pm": "",
		"pn": "gov|co|org|edu|net",
		"post": "",
		"pr": "com|net|org|gov|edu|isla|pro|biz|info|name|est|prof|ac",
		"pro": "aca|bar|cpa|jur|law|med|eng",
		"ps": "edu|gov|sec|plo|com|org|net",
		"pt": "net|gov|org|edu|int|publ|com|nome|blogspot",
		"pw": "co|ne|or|ed|go|belau",
		"py": "com|coop|edu|gov|mil|net|org",
		"qa": "com|edu|gov|mil|name|net|org|sch",
		"re": "com|asso|nom|blogspot",
		"ro": "com|org|tm|nt|nom|info|rec|arts|firm|store|www|blogspot",
		"rs": "co|org|edu|ac|gov|in",
		"ru": "ac|com|edu|int|net|org|pp|adygeya|altai|amur|arkhangelsk|astrakhan|bashkiria|belgorod|bir|bryansk|buryatia|cbg|chel|chelyabinsk|chita|chukotka|chuvashia|dagestan|dudinka|e-burg|grozny|irkutsk|ivanovo|izhevsk|jar|joshkar-ola|kalmykia|kaluga|kamchatka|karelia|kazan|kchr|kemerovo|khabarovsk|khakassia|khv|kirov|koenig|komi|kostroma|krasnoyarsk|kuban|kurgan|kursk|lipetsk|magadan|mari|mari-el|marine|mordovia|mosreg|msk|murmansk|nalchik|nnov|nov|novosibirsk|nsk|omsk|orenburg|oryol|palana|penza|perm|ptz|rnd|ryazan|sakhalin|samara|saratov|simbirsk|smolensk|spb|stavropol|stv|surgut|tambov|tatarstan|tom|tomsk|tsaritsyn|tsk|tula|tuva|tver|tyumen|udm|udmurtia|ulan-ude|vladikavkaz|vladimir|vladivostok|volgograd|vologda|voronezh|vrn|vyatka|yakutia|yamal|yaroslavl|yekaterinburg|yuzhno-sakhalinsk|amursk|baikal|cmw|fareast|jamal|kms|k-uralsk|kustanai|kuzbass|magnitka|mytis|nakhodka|nkz|norilsk|oskol|pyatigorsk|rubtsovsk|snz|syzran|vdonsk|zgrad|gov|mil|test",
		"rw": "gov|net|edu|ac|com|co|int|mil|gouv",
		"sa": "com|net|org|gov|med|pub|edu|sch",
		"sb": "com|edu|gov|net|org",
		"sc": "com|gov|net|org|edu",
		"sd": "com|net|org|edu|med|tv|gov|info",
		"se": "a|ac|b|bd|brand|c|d|e|f|fh|fhsk|fhv|g|h|i|k|komforb|kommunalforbund|komvux|l|lanbib|m|n|naturbruksgymn|o|org|p|parti|pp|press|r|s|t|tm|u|w|x|y|z|com|blogspot",
		"sg": "com|net|org|gov|edu|per|blogspot",
		"sh": "com|net|gov|org|mil",
		"si": "",
		"sj": "",
		"sk": "blogspot",
		"sl": "com|net|edu|gov|org",
		"sm": "",
		"sn": "art|com|edu|gouv|org|perso|univ",
		"so": "com|net|org",
		"sr": "",
		"st": "co|com|consulado|edu|embaixada|gov|mil|net|org|principe|saotome|store",
		"su": "",
		"sv": "com|edu|gob|org|red",
		"sx": "gov",
		"sy": "edu|gov|net|mil|com|org",
		"sz": "co|ac|org",
		"tc": "",
		"td": "blogspot",
		"tel": "",
		"tf": "",
		"tg": "",
		"th": "ac|co|go|in|mi|net|or",
		"tj": "ac|biz|co|com|edu|go|gov|int|mil|name|net|nic|org|test|web",
		"tk": "",
		"tl": "gov",
		"tm": "com|co|org|net|nom|gov|mil|edu",
		"tn": "com|ens|fin|gov|ind|intl|nat|net|org|info|perso|tourism|edunet|rnrt|rns|rnu|mincom|agrinet|defense|turen",
		"to": "com|gov|net|org|edu|mil",
		"tp": "",
		"tr": "com|info|biz|net|org|web|gen|tv|av|dr|bbs|name|tel|gov|bel|pol|mil|k12|edu|kep|nc|gov.nc",
		"travel": "",
		"tt": "co|com|org|net|biz|info|pro|int|coop|jobs|mobi|travel|museum|aero|name|gov|edu",
		"tv": "dyndns|better-than|on-the-web|worse-than",
		"tw": "edu|gov|mil|com|net|org|idv|game|ebiz|club|網路|組織|商業|blogspot",
		"tz": "ac|co|go|hotel|info|me|mil|mobi|ne|or|sc|tv",
		"ua": "com|edu|gov|in|net|org|cherkassy|cherkasy|chernigov|chernihiv|chernivtsi|chernovtsy|ck|cn|cr|crimea|cv|dn|dnepropetrovsk|dnipropetrovsk|dominic|donetsk|dp|if|ivano-frankivsk|kh|kharkiv|kharkov|kherson|khmelnitskiy|khmelnytskyi|kiev|kirovograd|km|kr|krym|ks|kv|kyiv|lg|lt|lugansk|lutsk|lv|lviv|mk|mykolaiv|nikolaev|od|odesa|odessa|pl|poltava|rivne|rovno|rv|sb|sebastopol|sevastopol|sm|sumy|te|ternopil|uz|uzhgorod|vinnica|vinnytsia|vn|volyn|yalta|zaporizhzhe|zaporizhzhia|zhitomir|zhytomyr|zp|zt|co|pp",
		"ug": "co|or|ac|sc|go|ne|com|org",
		"uk": "ac|co|gov|ltd|me|net|nhs|org|plc|police|*sch|blogspot.co|service.gov",
		"us": "dni|fed|isa|kids|nsn|ak|al|ar|as|az|ca|co|ct|dc|de|fl|ga|gu|hi|ia|id|il|in|ks|ky|la|ma|md|me|mi|mn|mo|ms|mt|nc|nd|ne|nh|nj|nm|nv|ny|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vi|vt|va|wa|wi|wv|wy|k12.ak|k12.al|k12.ar|k12.as|k12.az|k12.ca|k12.co|k12.ct|k12.dc|k12.de|k12.fl|k12.ga|k12.gu|k12.ia|k12.id|k12.il|k12.in|k12.ks|k12.ky|k12.la|k12.ma|k12.md|k12.me|k12.mi|k12.mn|k12.mo|k12.ms|k12.mt|k12.nc|k12.ne|k12.nh|k12.nj|k12.nm|k12.nv|k12.ny|k12.oh|k12.ok|k12.or|k12.pa|k12.pr|k12.ri|k12.sc|k12.tn|k12.tx|k12.ut|k12.vi|k12.vt|k12.va|k12.wa|k12.wi|k12.wy|cc.ak|cc.al|cc.ar|cc.as|cc.az|cc.ca|cc.co|cc.ct|cc.dc|cc.de|cc.fl|cc.ga|cc.gu|cc.hi|cc.ia|cc.id|cc.il|cc.in|cc.ks|cc.ky|cc.la|cc.ma|cc.md|cc.me|cc.mi|cc.mn|cc.mo|cc.ms|cc.mt|cc.nc|cc.nd|cc.ne|cc.nh|cc.nj|cc.nm|cc.nv|cc.ny|cc.oh|cc.ok|cc.or|cc.pa|cc.pr|cc.ri|cc.sc|cc.sd|cc.tn|cc.tx|cc.ut|cc.vi|cc.vt|cc.va|cc.wa|cc.wi|cc.wv|cc.wy|lib.ak|lib.al|lib.ar|lib.as|lib.az|lib.ca|lib.co|lib.ct|lib.dc|lib.de|lib.fl|lib.ga|lib.gu|lib.hi|lib.ia|lib.id|lib.il|lib.in|lib.ks|lib.ky|lib.la|lib.ma|lib.md|lib.me|lib.mi|lib.mn|lib.mo|lib.ms|lib.mt|lib.nc|lib.nd|lib.ne|lib.nh|lib.nj|lib.nm|lib.nv|lib.ny|lib.oh|lib.ok|lib.or|lib.pa|lib.pr|lib.ri|lib.sc|lib.sd|lib.tn|lib.tx|lib.ut|lib.vi|lib.vt|lib.va|lib.wa|lib.wi|lib.wy|pvt.k12.ma|chtr.k12.ma|paroch.k12.ma|is-by|land-4-sale|stuff-4-sale",
		"uy": "com|edu|gub|mil|net|org",
		"uz": "co|com|net|org",
		"va": "",
		"vc": "com|net|org|gov|mil|edu",
		"ve": "arts|co|com|e12|edu|firm|gob|gov|info|int|mil|net|org|rec|store|tec|web",
		"vg": "",
		"vi": "co|com|k12|net|org",
		"vn": "com|net|org|edu|gov|int|ac|biz|info|name|pro|health",
		"vu": "com|edu|net|org",
		"wf": "",
		"ws": "com|net|org|gov|edu|dyndns|mypets",
		"yt": "",
		"امارات": "",
		"বাংলা": "",
		"中国": "",
		"中國": "",
		"الجزائر": "",
		"مصر": "",
		"გე": "",
		"香港": "",
		"भारत": "",
		"بھارت": "",
		"భారత్": "",
		"ભારત": "",
		"ਭਾਰਤ": "",
		"ভারত": "",
		"இந்தியா": "",
		"ایران": "",
		"ايران": "",
		"الاردن": "",
		"한국": "",
		"қаз": "",
		"ලංකා": "",
		"இலங்கை": "",
		"المغرب": "",
		"мон": "",
		"مليسيا": "",
		"عمان": "",
		"فلسطين": "",
		"срб": "пр|орг|обр|од|упр|ак",
		"рф": "",
		"قطر": "",
		"السعودية": "",
		"السعودیة": "",
		"السعودیۃ": "",
		"السعوديه": "",
		"سورية": "",
		"سوريا": "",
		"新加坡": "",
		"சிங்கப்பூர்": "",
		"ไทย": "",
		"تونس": "",
		"台灣": "",
		"台湾": "",
		"臺灣": "",
		"укр": "",
		"اليمن": "",
		"xxx": "",
		"ye": "*",
		"za": "*",
		"zm": "*",
		"zw": "*",
		"abbott": "",
		"abogado": "",
		"academy": "",
		"accenture": "",
		"accountants": "",
		"active": "",
		"actor": "",
		"africa": "",
		"agency": "",
		"airforce": "",
		"allfinanz": "",
		"alsace": "",
		"amsterdam": "",
		"android": "",
		"aquarelle": "",
		"archi": "",
		"army": "",
		"associates": "",
		"attorney": "",
		"auction": "",
		"audio": "",
		"autos": "",
		"axa": "",
		"band": "",
		"bar": "",
		"barcelona": "",
		"bargains": "",
		"bauhaus": "",
		"bayern": "",
		"bcn": "",
		"beer": "",
		"berlin": "",
		"best": "",
		"bharti": "",
		"bible": "",
		"bid": "",
		"bike": "",
		"bio": "",
		"black": "",
		"blackfriday": "",
		"bloomberg": "",
		"blue": "",
		"bmw": "",
		"bnl": "",
		"bnpparibas": "",
		"bond": "",
		"boo": "",
		"boutique": "",
		"brussels": "",
		"budapest": "",
		"build": "",
		"builders": "",
		"business": "",
		"buzz": "",
		"bzh": "",
		"cab": "",
		"cal": "",
		"camera": "",
		"camp": "",
		"cancerresearch": "",
		"capetown": "",
		"capital": "",
		"caravan": "",
		"cards": "",
		"care": "",
		"career": "",
		"careers": "",
		"cartier": "",
		"casa": "",
		"cash": "",
		"catering": "",
		"cba": "",
		"cbn": "",
		"center": "",
		"ceo": "",
		"cern": "",
		"cfa": "",
		"channel": "",
		"cheap": "",
		"christmas": "",
		"chrome": "",
		"church": "",
		"citic": "",
		"city": "",
		"claims": "",
		"cleaning": "",
		"click": "",
		"clinic": "",
		"clothing": "",
		"club": "",
		"codes": "",
		"coffee": "",
		"college": "",
		"cologne": "",
		"commbank": "",
		"community": "",
		"company": "",
		"computer": "",
		"condos": "",
		"construction": "",
		"consulting": "",
		"contractors": "",
		"cooking": "",
		"cool": "",
		"country": "",
		"credit": "",
		"creditcard": "",
		"crs": "",
		"cruises": "",
		"cuisinella": "",
		"cymru": "",
		"dabur": "",
		"dad": "",
		"dance": "",
		"dating": "",
		"datsun": "",
		"day": "",
		"deals": "",
		"degree": "",
		"democrat": "",
		"dental": "",
		"dentist": "",
		"desi": "",
		"diamonds": "",
		"diet": "",
		"digital": "",
		"direct": "",
		"directory": "",
		"discount": "",
		"dnp": "",
		"domains": "",
		"doosan": "",
		"durban": "",
		"dvag": "",
		"eat": "",
		"education": "",
		"email": "",
		"emerck": "",
		"engineer": "",
		"engineering": "",
		"enterprises": "",
		"equipment": "",
		"erni": "",
		"esq": "",
		"estate": "",
		"eurovision": "",
		"eus": "",
		"events": "",
		"everbank": "",
		"exchange": "",
		"expert": "",
		"exposed": "",
		"fail": "",
		"fan": "",
		"farm": "",
		"fashion": "",
		"feedback": "",
		"finance": "",
		"financial": "",
		"firmdale": "",
		"fish": "",
		"fishing": "",
		"fitness": "",
		"flights": "",
		"florist": "",
		"flsmidth": "",
		"fly": "",
		"foo": "",
		"forsale": "",
		"foundation": "",
		"frl": "",
		"frogans": "",
		"fund": "",
		"furniture": "",
		"futbol": "",
		"gal": "",
		"gallery": "",
		"garden": "",
		"gbiz": "",
		"gdn": "",
		"gent": "",
		"ggee": "",
		"gift": "",
		"gifts": "",
		"gives": "",
		"glass": "",
		"gle": "",
		"global": "",
		"globo": "",
		"gmail": "",
		"gmo": "",
		"gmx": "",
		"google": "",
		"gop": "",
		"graphics": "",
		"gratis": "",
		"green": "",
		"gripe": "",
		"group": "",
		"guge": "",
		"guide": "",
		"guitars": "",
		"guru": "",
		"hamburg": "",
		"haus": "",
		"healthcare": "",
		"help": "",
		"here": "",
		"hermes": "",
		"hiphop": "",
		"hiv": "",
		"holdings": "",
		"holiday": "",
		"homes": "",
		"horse": "",
		"host": "",
		"hosting": "",
		"house": "",
		"how": "",
		"ibm": "",
		"ifm": "",
		"iinet": "",
		"immo": "",
		"immobilien": "",
		"industries": "",
		"infiniti": "",
		"ing": "",
		"ink": "",
		"institute": "",
		"insure": "",
		"international": "",
		"investments": "",
		"ipiranga": "",
		"irish": "",
		"ist": "",
		"istanbul": "",
		"iwc": "",
		"java": "",
		"jetzt": "",
		"joburg": "",
		"juegos": "",
		"kaufen": "",
		"kim": "",
		"kitchen": "",
		"kiwi": "",
		"koeln": "",
		"krd": "",
		"kred": "",
		"lacaixa": "",
		"land": "",
		"latrobe": "",
		"lawyer": "",
		"lds": "",
		"lease": "",
		"leclerc": "",
		"lgbt": "",
		"life": "",
		"lighting": "",
		"limited": "",
		"limo": "",
		"link": "",
		"loans": "",
		"london": "",
		"lotto": "",
		"ltda": "",
		"luxe": "",
		"luxury": "",
		"madrid": "",
		"maison": "",
		"management": "",
		"mango": "",
		"market": "",
		"marketing": "",
		"media": "",
		"meet": "",
		"melbourne": "",
		"meme": "",
		"menu": "",
		"miami": "",
		"mini": "",
		"moda": "",
		"moe": "",
		"monash": "",
		"montblanc": "",
		"mormon": "",
		"mortgage": "",
		"moscow": "",
		"motorcycles": "",
		"mov": "",
		"nagoya": "",
		"navy": "",
		"netbank": "",
		"network": "",
		"neustar": "",
		"new": "",
		"nexus": "",
		"ngo": "",
		"nhk": "",
		"ninja": "",
		"nissan": "",
		"nra": "",
		"nrw": "",
		"nyc": "",
		"okinawa": "",
		"ong": "",
		"onl": "",
		"ooo": "",
		"oracle": "",
		"organic": "",
		"otsuka": "",
		"ovh": "",
		"paris": "",
		"partners": "",
		"parts": "",
		"pharmacy": "",
		"photo": "",
		"photography": "",
		"photos": "",
		"physio": "",
		"pics": "",
		"pictet": "",
		"pictures": "",
		"pink": "",
		"pizza": "",
		"place": "",
		"plumbing": "",
		"pohl": "",
		"poker": "",
		"praxi": "",
		"press": "",
		"prod": "",
		"productions": "",
		"prof": "",
		"properties": "",
		"property": "",
		"pub": "",
		"qpon": "",
		"quebec": "",
		"realtor": "",
		"recipes": "",
		"red": "",
		"rehab": "",
		"reise": "",
		"reisen": "",
		"ren": "",
		"rentals": "",
		"repair": "",
		"report": "",
		"republican": "",
		"rest": "",
		"restaurant": "",
		"reviews": "",
		"rich": "",
		"rio": "",
		"rip": "",
		"rocks": "",
		"rodeo": "",
		"rsvp": "",
		"ruhr": "",
		"ryukyu": "",
		"saarland": "",
		"samsung": "",
		"sap": "",
		"sarl": "",
		"sca": "",
		"scb": "",
		"schmidt": "",
		"scholarships": "",
		"schule": "",
		"scot": "",
		"seat": "",
		"services": "",
		"sew": "",
		"sexy": "",
		"sharp": "",
		"shiksha": "",
		"shoes": "",
		"shriram": "",
		"singles": "",
		"sky": "",
		"social": "",
		"software": "",
		"sohu": "",
		"solar": "",
		"solutions": "",
		"soy": "",
		"space": "",
		"spiegel": "",
		"supplies": "",
		"supply": "",
		"support": "",
		"surf": "",
		"surgery": "",
		"suzuki": "",
		"systems": "",
		"taipei": "",
		"tatar": "",
		"tattoo": "",
		"tax": "",
		"technology": "",
		"temasek": "",
		"tienda": "",
		"tips": "",
		"tirol": "",
		"today": "",
		"tokyo": "",
		"tools": "",
		"top": "",
		"toshiba": "",
		"town": "",
		"toys": "",
		"trade": "",
		"training": "",
		"tui": "",
		"university": "",
		"uno": "",
		"uol": "",
		"vacations": "",
		"vegas": "",
		"ventures": "",
		"versicherung": "",
		"vet": "",
		"viajes": "",
		"villas": "",
		"vision": "",
		"vlaanderen": "",
		"vodka": "",
		"vote": "",
		"voting": "",
		"voto": "",
		"voyage": "",
		"wales": "",
		"wang": "",
		"watch": "",
		"webcam": "",
		"website": "",
		"wed": "",
		"wedding": "",
		"whoswho": "",
		"wien": "",
		"wiki": "",
		"williamhill": "",
		"wme": "",
		"work": "",
		"works": "",
		"world": "",
		"wtc": "",
		"wtf": "",
		"佛山": "",
		"慈善": "",
		"集团": "",
		"在线": "",
		"八卦": "",
		"موقع": "",
		"公益": "",
		"公司": "",
		"移动": "",
		"我爱你": "",
		"москва": "",
		"онлайн": "",
		"сайт": "",
		"时尚": "",
		"淡马锡": "",
		"орг": "",
		"삼성": "",
		"商标": "",
		"商店": "",
		"商城": "",
		"дети": "",
		"新闻": "",
		"中文网": "",
		"中信": "",
		"娱乐": "",
		"谷歌": "",
		"网店": "",
		"संगठन": "",
		"网络": "",
		"手机": "",
		"بازار": "",
		"政府": "",
		"شبكة": "",
		"机构": "",
		"组织机构": "",
		"рус": "",
		"みんな": "",
		"グーグル": "",
		"世界": "",
		"网址": "",
		"游戏": "",
		"vermögensberater": "",
		"vermögensberatung": "",
		"企业": "",
		"广东": "",
		"政务": "",
		"xyz": "",
		"yachts": "",
		"yandex": "",
		"yoga": "",
		"yokohama": "",
		"youtube": "",
		"zip": "",
		"zone": ""
	}

/***/ },

/***/ 81:
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {module.exports = global["tabData"] = __webpack_require__(155);
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },

/***/ 151:
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var tld = __webpack_require__(153).init();
	tld.rules = __webpack_require__(80);
	
	module.exports = tld;


/***/ },

/***/ 152:
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	function Rule (data){
	  data = data || {};
	
	  this.exception = data.exception || false;
	  this.firstLevel = data.firstLevel || '';
	  this.secondLevel = data.secondLevel || null;
	  this.source = data.source || '';
	  this.wildcard = data.wildcard || false;
	}
	
	/**
	 * Returns the TLD or SLD (Second Level Domain) pattern for a rule
	 *
	 * @return {String}
	 */
	Rule.prototype.getNormalXld = function getNormalXld(){
	  return (this.secondLevel ? '.' + this.secondLevel : '') + '.' + this.firstLevel;
	};
	
	/**
	 * Returns a pattern suitable for normal rule
	 * Mostly for internal use
	 *
	 * @return {String}
	 */
	Rule.prototype.getNormalPattern = function getNormalPattern(){
	  return (this.secondLevel ? '\\.' + this.secondLevel : '') + '\\.' + this.firstLevel;
	};
	
	/**
	 * Returns a pattern suitable for wildcard rule
	 * Mostly for internal use
	 *
	 * @return {String}
	 */
	Rule.prototype.getWildcardPattern = function getWildcardPattern(){
	  return '\\.[^\\.]+' + this.getNormalXld().replace(/\./g, '\\.');
	};
	
	/**
	 * Returns a pattern suitable for exception rule
	 * Mostly for internal use
	 *
	 * @return {String}
	 */
	Rule.prototype.getExceptionPattern = function getExceptionPattern(){
	  return (this.secondLevel || '') + '\\.' + this.firstLevel;
	};
	
	/**
	 * Returns the best pattern possible for a rule
	 * You just have to test a value against it to check or extract a hostname
	 *
	 * @api
	 * @param {string|undefined} before
	 * @param {string|undefined} after
	 * @return {String} A pattern to challenge some string against
	 */
	Rule.prototype.getPattern = function getPattern(before, after){
	  var pattern = '';
	
	  before = (before === undefined) ? '(': before+'';
	  after = (after === undefined) ? ')$': before+'';
	
	  if (this.exception === true){
	    pattern = this.getExceptionPattern();
	  }
	  else{
	    pattern = '[^\\.]+' + (this.wildcard ? this.getWildcardPattern() : this.getNormalPattern());
	  }
	
	  return before + pattern + after;
	};
	
	module.exports = Rule;

/***/ },

/***/ 153:
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Rule = __webpack_require__(152);
	var urlParts = /(^https?:?\/\/|^\/\/)?([^:]+(:[^@]+)?@)?([^:@\/]+)(:|\/|$)/; // 1 = protocol, 2/3 = auth, 4 = domain
	
	/**
	 * tld library
	 *
	 * Useable methods are those documented with an @api in JSDoc
	 * See README.md for more explanations on how to use this stuff.
	 */
	function tld () {
	  /* jshint validthis: true */
	  this.rules = [];
	}
	
	tld.init = function init () {
	  return new tld();
	};
	
	function trim(value) {
	  return String(value).replace(/(^\s+|\s+$)/g, '');
	}
	
	// Array.some() polyfill for IE8
	function _someFunction(value, fun /*, thisArg */) {
	    'use strict';
	
	    if (value === void 0 || value === null)
	      throw new TypeError();
	
	    var t = Object(value);
	    var len = t.length >>> 0;
	    if (typeof fun !== 'function') {
	      throw new TypeError();
	    }
	
	    var thisArg = arguments.length >= 3 ? arguments[2] : void 0;
	    for (var i = 0; i < len; i++)
	    {
	      if (i in t && fun.call(thisArg, t[i], i, t))
	        return true;
	    }
	
	    return false;
	}
	
	// Array.map polyfill for IE8
	function _mapFunction(thisVal, fun /*, thisArg */) {
	  "use strict";
	
	  if (thisVal === void 0 || thisVal === null)
	    throw new TypeError();
	
	  var t = Object(thisVal);
	  var len = t.length >>> 0;
	  if (typeof fun !== "function") {
	    throw new TypeError();
	  }
	
	  var res = new Array(len);
	  var thisArg = arguments.length >= 3 ? arguments[2] : void 0;
	
	  for (var i = 0; i < len; i++)
	  {
	    // NOTE: Absolute correctness would demand Object.defineProperty
	    //       be used.  But this method is fairly new, and failure is
	    //       possible only if Object.prototype or Array.prototype
	    //       has a property |i| (very unlikely), so use a lesscorrect
	    //       but more portable alternative.
	    if (i in t)
	      res[i] = fun.call(thisArg, t[i], i, t);
	  }
	
	  return res;
	};
	
	/**
	 * Returns the best rule for a given host based on candidates
	 *
	 * @static
	 * @param host {String} Hostname to check rules against
	 * @param rules {Array} List of rules used to work on
	 * @return {Object} Candidate object, with a normal and exception state
	 */
	tld.getCandidateRule = function getCandidateRule (host, rules, options) {
	  var rule = {'normal': null, 'exception': null};
	
	  options = options || { lazy: false };
	
	  _someFunction(rules, function (r) {
	    var pattern;
	
	    // sld matching? escape the loop immediately (except if it's an exception)
	    if ('.' + host === r.getNormalXld()) {
	      if (options.lazy || r.exception === true) {
	        rule.normal = r;
	      }
	
	      return true;
	    }
	
	    // otherwise check as a complete host
	    // if it's an exception, we want to loop a bit more to a normal rule
	    pattern = '.+' + r.getNormalPattern() + '$';
	
	    if ((new RegExp(pattern)).test(host)) {
	      rule[r.exception ? 'exception' : 'normal'] = r;
	      return !r.exception;
	    }
	
	    return false;
	  });
	
	  // favouring the exception if encountered
	  // previously we were copy-altering a rule, creating inconsistent results based on rule order order
	  // @see https://github.com/oncletom/tld.js/pull/35
	  if (rule.normal && rule.exception) {
	    return rule.exception;
	  }
	
	  return rule.normal;
	};
	
	/**
	 * Retrieve a subset of rules for a Top-Level-Domain string
	 *
	 * @param tld {String} Top-Level-Domain string
	 * @return {Array} Rules subset
	 */
	tld.prototype.getRulesForTld = function getRulesForTld (tld, default_rule) {
	  var exception = '!';
	  var wildcard = '*';
	  var append_tld_rule = true;
	  var rules = this.rules[tld];
	
	  // Already parsed
	  // Array.isArray polyfill for IE8
	  if (Object.prototype.toString.call(rules)  === '[object Array]') {
	    return rules;
	  }
	
	  // Nothing found, apply some default value
	  if (!rules) {
	    return default_rule ? [ default_rule ] : [];
	  }
	
	  // Parsing needed
	  rules = _mapFunction(rules.split('|'), function transformAsRule (sld) {
	    var first_bit = sld[0];
	
	    if (first_bit === exception || first_bit === wildcard) {
	      sld = sld.slice(1);
	
	      if (!sld) {
	        append_tld_rule = false;
	      }
	    }
	
	    return new Rule({
	      "firstLevel":  tld,
	      "secondLevel": sld,
	      "exception":   first_bit === exception,
	      "wildcard":    first_bit === wildcard
	    });
	  });
	
	  // Always prepend to make it the latest rule to be applied
	  if (append_tld_rule) {
	    rules.unshift(new Rule({
	      "firstLevel": tld
	    }));
	  }
	
	  this.rules[tld] = rules.reverse();
	
	  return rules;
	};
	
	/**
	 * Checks if the TLD exists for a given host
	 *
	 * @api
	 * @param {string} host
	 * @return {boolean}
	 */
	tld.prototype.tldExists = function tldExists(host){
	  var hostTld;
	
	  host = tld.cleanHostValue(host);
	
	  // Easy case, it's a TLD
	  if (this.rules[host]){
	    return true;
	  }
	
	  // Popping only the TLD of the hostname
	  hostTld = tld.extractTldFromHost(host);
	
	  return this.rules[hostTld] !== undefined;
	};
	
	/**
	 * Returns the public suffix (including exact matches)
	 *
	 * @api
	 * @since 1.5
	 * @param {string} host
	 * @return {String}
	 */
	tld.prototype.getPublicSuffix = function getPublicSuffix(host) {
	  var hostTld, rules, rule;
	
	  if (host in this.rules){
		  return host;
	  }
	
	  host = tld.cleanHostValue(host);
	  hostTld = tld.extractTldFromHost(host);
	  rules = this.getRulesForTld(hostTld);
	  rule = tld.getCandidateRule(host, rules, { lazy: true });
	
	  if (rule === null) {
	    return null;
	  }
	
	  return rule.getNormalXld().slice(1);
	};
	
	/**
	 * Detects the domain based on rules and upon and a host string
	 *
	 * @api
	 * @param {string} host
	 * @return {String}
	 */
	tld.prototype.getDomain = function getDomain (host) {
	  var domain = null, hostTld, rules, rule;
	
	  if (this.isValid(host) === false) {
	    return null;
	  }
	
	  host = tld.cleanHostValue(host);
	  hostTld = tld.extractTldFromHost(host);
	  rules = this.getRulesForTld(hostTld, new Rule({"firstLevel": hostTld}));
	  rule = tld.getCandidateRule(host, rules);
	
	  if (rule === null) {
	    return null;
	  }
	
	  host.replace(new RegExp(rule.getPattern()), function (m, d) {
	    domain = d;
	  });
	
	  return domain;
	};
	
	/**
	 * Returns the subdomain of a host string
	 *
	 * @api
	 * @param {string} host
	 * @return {string|null} a subdomain string if any, blank string if subdomain is empty, otherwise null
	 */
	tld.prototype.getSubdomain = function getSubdomain(host){
	  var domain, r, subdomain;
	
	  host = tld.cleanHostValue(host);
	  domain = this.getDomain(host);
	
	  // No domain found? Just abort, abort!
	  if (domain === null){
	    return null;
	  }
	
	  r = '\\.?'+ tld.escapeRegExp(domain)+'$';
	  subdomain = host.replace(new RegExp(r, 'i'), '');
	
	  return subdomain;
	};
	
	/**
	 * Checking if a host string is valid
	 * It's usually a preliminary check before trying to use getDomain or anything else
	 *
	 * Beware: it does not check if the TLD exists.
	 *
	 * @api
	 * @todo handle localhost, local etc.
	 * @param host {String}
	 * @return {Boolean}
	 */
	tld.prototype.isValid = function isValid (host) {
	  return !(typeof host !== 'string' || host.indexOf('.') === -1 || host[0] === '.');
	};
	
	/**
	 * Utility to cleanup the base host value. Also removes url fragments.
	 *
	 * Works for:
	 * - hostname
	 * - //hostname
	 * - scheme://hostname
	 * - scheme+scheme://hostname
	 *
	 * @param {string} value
	 * @return {String}
	 */
	tld.cleanHostValue = function cleanHostValue(value){
	  value = trim(value).toLowerCase();
	
	  var parts = urlParts.exec(value);
	
	  if (parts[3] && typeof console !== 'undefined' && console.log) {
	    var userPasswordSeparatorPosition = parts[3].lastIndexOf(':');
	
	    if (parts[3][userPasswordSeparatorPosition + 1] !== '/') {
	      console.error('user:password syntax is deprecated in RFC3986. You should consider an alternate way of doing it.');
	    }
	  }
	
	  return parts[4] || value || '';
	};
	
	/**
	 * Utility to extract the TLD from a host string
	 *
	 * @param {string} host
	 * @return {String}
	 */
	tld.extractTldFromHost = function extractTldFromHost(host){
	  return host.split('.').pop();
	};
	
	/**
	 * Escapes RegExp specific chars.
	 *
	 * @since 1.3.1
	 * @see https://github.com/oncletom/tld.js/pull/33
	 * @param {String|Mixed} s
	 * @returns {string} Escaped string for a safe use in a `new RegExp` expression
	 */
	tld.escapeRegExp = function escapeRegExp(s) {
	  return String(s).replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
	};
	
	module.exports = tld;


/***/ },

/***/ 154:
/***/ function(module, exports, __webpack_require__) {

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
	
	var tld = __webpack_require__(151);
	
	// does the string start with an optional scheme/colon and two slashes?
	// TODO better IP regex, check for IPv6
	var IP_ADDRESS = /^\d+\.\d+\.\d+\.\d+(?::\d+)?$/,
		// TODO could be a chrome-extension protocol URL: chrome-extension://boadgeojelhgndaghljhdicfkmllpafd/cast_sender.js
		VALID_URL = /^(?:[a-z]+:)?\/\//;
	
	// TODO see getBaseDomain in https://github.com/adblockplus/adblockpluschrome/blob/f9c5bd397bb8a9d7d2890aee89d45e25178c4b7a/lib/basedomain.js
	// TODO punycode? https://publicsuffix.org/list/ and http://www.w3.org/International/articles/idn-and-iri/
	module.exports.get_domain = function (url) {
		var domain,
			hostname,
			UNKNOWN_DOMAIN = '<unknown domain>';
	
		if (!url) {
			return UNKNOWN_DOMAIN;
		}
	
		if (!VALID_URL.test(url)) {
			return UNKNOWN_DOMAIN;
		}
	
		hostname = url.split('/')[2];
	
		// TODO tld.js does not properly handle IP (v4 or v6) addresses
		if (!IP_ADDRESS.test(hostname)) {
			domain = tld.getDomain(url);
		}
	
		if (!domain) {
			domain = hostname;
	
			// strip the port
			var port_index = domain.lastIndexOf(':');
			if (port_index != -1) {
				domain = domain.slice(0, port_index);
			}
		}
	
		return domain;
	};


/***/ },

/***/ 155:
/***/ function(module, exports, __webpack_require__) {

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
	
	var _ = __webpack_require__(77),
		uri = __webpack_require__(154);
	
	/* data = {
		<tab_id>: {
			domains: {
				<domain>: {
					scripts: {
						<script_url>: {
							counts: {
								<accessed_object_property>: number count,
								...
							},
							fontEnumeration: boolean
						},
						...
					}
				},
				...
			}
		},
		...
	} */
	var data = {};
	
	var tabData = {
		// TODO review performance impact
		record: function (tab_id, access) {
			var domain = uri.get_domain(access.scriptUrl),
				font_enumeration_prop = (access.prop == 'style.fontFamily'),
				key = access.obj + '.' + access.prop,
				script_url = access.scriptUrl || '<unknown script>';
	
			// initialize tab-level data
			if (!data.hasOwnProperty(tab_id)) {
				data[tab_id] = {
					domains: {}
				};
			}
			var datum = data[tab_id];
	
			// initialize domain-level data
			if (!datum.domains.hasOwnProperty(domain)) {
				datum.domains[domain] = {
					scripts: {}
				};
			}
			var domainData = datum.domains[domain];
	
			// initialize script-level data
			if (!domainData.scripts.hasOwnProperty(script_url)) {
				domainData.scripts[script_url] = {
					counts: {},
					fontEnumeration: false
				};
			}
			var scriptData = domainData.scripts[script_url];
	
			// JavaScript property access counts.
			// Do not store style.fontFamily since it is already represented
			// as fontEnumeration, plus its count is meaningless.
			if (!font_enumeration_prop) {
				var counts = scriptData.counts;
				if (!counts.hasOwnProperty(key)) {
					counts[key] = 0;
				}
				counts[key]++;
			}
	
			// font enumeration (script-level)
			if (font_enumeration_prop) {
				scriptData.fontEnumeration = true;
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


/***/ }

});