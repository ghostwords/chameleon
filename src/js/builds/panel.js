(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
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

var _ = require('underscore');

// TODO move into own lib module (this also lives in js/injected.js)
function sendMessage(name, message, callback) {
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
}

sendMessage('panelLoaded', function (response) {
	var counts = _.countBy(response.accesses, function (access) {
		return access.obj + '.' + access.prop;
	});
	var body = document.getElementsByTagName('body')[0];
	body.innerHTML += require('../lib/templates/panel.jst')({
		counts: counts
	});
});

},{"../lib/templates/panel.jst":3}],3:[function(require,module,exports){
var _ = require('underscore');
module.exports = function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<pre>'+
((__t=( JSON.stringify(counts, null, "\t") ))==null?'':_.escape(__t))+
'</pre>';
}
return __p;
};
},{}]},{},[2])