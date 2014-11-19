/******/ (function(modules) { // webpackBootstrap
/******/ 	// install a JSONP callback for chunk loading
/******/ 	var parentJsonpFunction = window["webpackJsonp"];
/******/ 	window["webpackJsonp"] = function webpackJsonpCallback(chunkIds, moreModules) {
/******/ 		// add "moreModules" to the modules object,
/******/ 		// then flag all "chunkIds" as loaded and fire callback
/******/ 		var moduleId, chunkId, i = 0, callbacks = [];
/******/ 		for(;i < chunkIds.length; i++) {
/******/ 			chunkId = chunkIds[i];
/******/ 			if(installedChunks[chunkId])
/******/ 				callbacks.push.apply(callbacks, installedChunks[chunkId]);
/******/ 			installedChunks[chunkId] = 0;
/******/ 		}
/******/ 		for(moduleId in moreModules) {
/******/ 			modules[moduleId] = moreModules[moduleId];
/******/ 		}
/******/ 		if(parentJsonpFunction) parentJsonpFunction(chunkIds, moreModules);
/******/ 		while(callbacks.length)
/******/ 			callbacks.shift().call(null, __webpack_require__);
/******/ 		if(moreModules[0]) {
/******/ 			installedModules[0] = 0;
/******/ 			__webpack_require__(0);
/******/ 		}
/******/ 	};
/******/
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// object to store loaded and loading chunks
/******/ 	// "0" means "already loaded"
/******/ 	// Array means "loading", array contains callbacks
/******/ 	var installedChunks = {
/******/ 		0:0
/******/ 	};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/ 	// This file contains only the entry chunk.
/******/ 	// The chunk loading function for additional chunks
/******/ 	__webpack_require__.e = function requireEnsure(chunkId, callback) {
/******/ 		// "0" is the signal for "already loaded"
/******/ 		if(installedChunks[chunkId] === 0)
/******/ 			return callback.call(null, __webpack_require__);
/******/
/******/ 		// an array means "currently loading".
/******/ 		if(installedChunks[chunkId] !== undefined) {
/******/ 			installedChunks[chunkId].push(callback);
/******/ 		} else {
/******/ 			// start chunk loading
/******/ 			installedChunks[chunkId] = [callback];
/******/ 			var head = document.getElementsByTagName('head')[0];
/******/ 			var script = document.createElement('script');
/******/ 			script.type = 'text/javascript';
/******/ 			script.charset = 'utf-8';
/******/ 			script.async = true;
/******/ 			script.src = __webpack_require__.p + "" + chunkId + "." + ({"3":"panel","4":"background"}[chunkId]||chunkId) + ".js";
/******/ 			head.appendChild(script);
/******/ 		}
/******/ 	};
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/ })
/************************************************************************/
/******/ ({

/***/ 32:
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


/***/ },

/***/ 78:
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
	
	module.exports.scoreScriptActivity = function (scriptData) {
		var points = 0;
	
		// 95 points for font enumeration
		if (scriptData.fontEnumeration) {
			points += 95;
		}
	
		// 15 points for each property access
		// TODO language/userAgent/common properties should count less, others should count more?
		// TODO use non-linear scale?
		// TODO third-party scripts should count more?
		// TODO count across domains instead of individual scripts?
		for (var i = 0, ln = Object.keys(scriptData.counts).length; i < ln; i++) {
			points += 15;
		}
	
		return {
			fingerprinter: (points > 50),
			points: points
		};
	};


/***/ },

/***/ 79:
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
	
	var score = __webpack_require__(78).scoreScriptActivity;
	
	// used by the badge and the popup
	module.exports.getFingerprinterCount = function (domains) {
		var count = 0;
	
		// no need for hasOwnProperty loop checks in this context
		for (var domain in domains) { // jshint ignore:line
			var scripts = domains[domain].scripts;
	
			for (var url in scripts) {
				if (score(scripts[url]).fingerprinter) {
					count++;
					break;
				}
			}
		}
	
		return count;
	};


/***/ }

/******/ })