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

var _ = require('underscore'),
	sendMessage = require('../lib/utils').sendMessage,
	template = require('../templates/panel.jst'),
	data;

function addListeners() {
	document.getElementById('toggle').addEventListener('click', function (e) {
		e.preventDefault();
		sendMessage('panelToggle');
		data.enabled = !data.enabled;
		render(data);
		document.getElementById('status-text').className = 'animated flipInY';
	});
}

function render() {
	var body = document.getElementsByTagName('body')[0];
	body.innerHTML = template(data);
	addListeners();
}

sendMessage('panelLoaded', function (response) {
	var counts = _.countBy(response.accesses, function (data) {
		return data.obj + '.' + data.prop;
	});

	data = {
		counts: counts,
		enabled: response.enabled,
		fontEnumeration: response.fontEnumeration
	};

	render();
});

},{"../lib/utils":3,"../templates/panel.jst":4}],3:[function(require,module,exports){
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
 * This module needs to work both inside content scripts and the browser popup.
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

},{}],4:[function(require,module,exports){
var _ = require('underscore');
module.exports = function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<span class="sprites toplogo logo-';
 if (!enabled) print('in') 
__p+='active"></span>\n<div id="header">\n\tChameleon is <span id="status-text">';
 print(enabled ? 'enabled' : '<span class="warning">disabled</span>') 
__p+='</span>\n\t<br>\n\t<a href="#" id="toggle">';
 print(enabled ? 'Disable' : 'Enable') 
__p+='</a>\n</div>\n<hr>\n';
 if (fontEnumeration) { 
__p+='\n\t<p>\n\tFont enumeration detected.\n\t</p>\n';
 } 
__p+='\n';
 if (_.size(counts)) { 
__p+='\n\t<table>\n\t\t<caption><b>'+
((__t=( _.size(counts) ))==null?'':_.escape(__t))+
'</b> property accesses detected</caption>\n\t\t<tr>\n\t\t\t<th>property</th>\n\t\t\t<th>count</th>\n\t\t</tr>\n\t\t';
 _.each(Object.keys(counts).sort(), function (name) { 
__p+='\n\t\t<tr>\n\t\t\t<td>\n\t\t\t\t'+
((__t=( name ))==null?'':_.escape(__t))+
'\n\t\t\t</td>\n\t\t\t<td>\n\t\t\t\t'+
((__t=( counts[name] ))==null?'':_.escape(__t))+
'\n\t\t\t</td>\n\t\t</tr>\n\t\t';
 }) 
__p+='\n\t</table>\n';
 } else { 
__p+='\n\t<p>\n\tNo property accesses detected.\n\t</p>\n';
 } 
__p+='\n';
}
return __p;
};
},{}]},{},[2])