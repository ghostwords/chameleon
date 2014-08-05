(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
/** @jsx React.DOM */

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

/*jshint newcap:false */

var React = require('react'),
	sendMessage = require('../lib/content_script_utils').sendMessage,
	utils = require('../lib/utils');

var PanelApp = React.createClass({displayName: 'PanelApp',
	getInitialState: function () {
		return {
			// TODO do we need a "loading" prop?
			enabled: false,
			fontEnumeration: false,
			counts: {}
		};
	},

	componentDidMount: function () {
		// get panel data on load
		sendMessage('panelLoaded', this.setState.bind(this));

		// get live updates to panel data
		chrome.runtime.onMessage.addListener(this.onMessage);
	},

	// TODO unnecessary?
	componentWillUnmount: function () {
		chrome.runtime.onMessage.removeListener(this.onMessage);
	},

	onMessage: function (request, sender) {
		if (sender.id != chrome.runtime.id) {
			return;
		}

		if (request.name == 'panelData') {
			this.setState(request.message);
		}
	},

	toggle: function () {
		sendMessage('panelToggle', function () {
			this.setState({
				enabled: !this.state.enabled
			}, function () {
				this.refs.header.animate();
			});
		}.bind(this));
	},

	render: function () {
		return (
			React.DOM.div(null, 
				Header({
					enabled: this.state.enabled, 
					ref: "header", 
					toggle: this.toggle}), 
				React.DOM.hr(null), 
				Report({
					counts: this.state.counts, 
					fontEnumeration: this.state.fontEnumeration})
			)
		);
	}
});

var Header = React.createClass({displayName: 'Header',
	toggle: function () {
		this.props.toggle();
	},

	animate: function () {
		var el = this.refs.statusText.getDOMNode();

		el.className = '';

		// hack to force repaint
		var redraw = el.offsetHeight; // jshint ignore:line

		el.className = 'animated flipInY';
	},

	render: function () {
		var logoClasses = [
			'sprites',
			'toplogo',
			'logo-' + (this.props.enabled ? '' : 'in') + 'active'
		];

		var text = this.props.enabled ?
			'enabled' :
			React.DOM.span({className: "warning"}, "disabled");

		return (
			React.DOM.div(null, 
				React.DOM.span({className: logoClasses.join(' ')}), 
				React.DOM.div({id: "header-contents"}, 
					"Chameleon is ", React.DOM.span({id: "status-text", ref: "statusText"}, 
						text
					), 
					React.DOM.br(null), 
					React.DOM.a({href: "#", id: "toggle", onClick: this.toggle}, 
						this.props.enabled ? 'Disable' : 'Enable'
					)
				)
			)
		);
	}
});

var Report = React.createClass({displayName: 'Report',
	render: function () {
		var fontEnumeration,
			reports = [];

		if (this.props.fontEnumeration) {
			fontEnumeration = (
				React.DOM.p(null, "Font enumeration detected.")
			);
		}

		Object.keys(this.props.counts).sort().forEach(function (url) {
			reports.push(
				ScriptReport({
					key: url, 
					url: url, 
					counts: this.props.counts[url]})
			);
		}, this);

		var status = reports.length ?
			React.DOM.p(null, 
				React.DOM.b(null, utils.getAccessCount(this.props.counts)), " property" + ' ' +
				"accesses detected across ", React.DOM.b(null, reports.length), " scripts."
			) :
			React.DOM.p(null, "No property accesses detected.");

		return (
			React.DOM.div(null, 
				fontEnumeration, 
				status, 
				reports
			)
		);
	}
});

var ScriptReport = React.createClass({displayName: 'ScriptReport',
	render: function () {
		var rows = [];

		Object.keys(this.props.counts).sort().forEach(function (name) {
			rows.push(
				ReportRow({key: name, name: name, count: this.props.counts[name]})
			);
		}, this);

		return (
			React.DOM.div(null, 
				React.DOM.p({title: this.props.url, style: {
					margin: '20px 0 5px',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap'
				}}, 
					this.props.url
				), 
				React.DOM.table(null, 
					React.DOM.thead(null, 
						React.DOM.tr(null, 
							React.DOM.th(null, "property"), 
							React.DOM.th(null, "count")
						)
					), 
					React.DOM.tbody(null, 
						rows
					)
				)
			)
		);
	}
});

var ReportRow = React.createClass({displayName: 'ReportRow',
	render: function () {
		return (
			React.DOM.tr(null, 
				React.DOM.td(null, 
					React.DOM.div({title: this.props.name}, this.props.name)
				), 
				React.DOM.td(null, 
					this.props.count
				)
			)
		);
	}
});

React.renderComponent(PanelApp(null), document.body);

},{"../lib/content_script_utils":3,"../lib/utils":4}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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

// used by the badge and the popup
module.exports.getAccessCount = function (counts) {
	// count unique keys across all counts objects
	var props = {};

	// no need for hasOwnProperty loop checks in this context
	for (var url in counts) { // jshint ignore:line
		for (var prop in counts[url]) { // jshint ignore:line
			props[prop] = true;
		}
	}

	return Object.keys(props).length;
};

},{}]},{},[2])