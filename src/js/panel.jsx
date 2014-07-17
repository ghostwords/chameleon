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
	sendMessage = require('../lib/utils').sendMessage;

var PanelApp = React.createClass({
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
			<div>
				<Header
					enabled={this.state.enabled}
					ref="header"
					toggle={this.toggle} />
				<hr />
				<Report
					counts={this.state.counts}
					fontEnumeration={this.state.fontEnumeration} />
			</div>
		);
	}
});

var Header = React.createClass({
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
			<span className="warning">disabled</span>;

		return (
			<div>
				<span className={logoClasses.join(' ')}></span>
				<div id="header-contents">
					Chameleon is <span id="status-text" ref="statusText">
						{text}
					</span>
					<br />
					<a href="#" id="toggle" onClick={this.toggle}>
						{this.props.enabled ? 'Disable' : 'Enable'}
					</a>
				</div>
			</div>
		);
	}
});

var Report = React.createClass({
	getAccessCount: function () {
		var counts = this.props.counts;

		// TODO refactor together with sister code in background.js

		var props = {};

		// no need for hasOwnProperty loop checks in this context
		for (var url in counts) { // jshint ignore:line
			for (var prop in counts[url]) { // jshint ignore:line
				props[prop] = true;
			}
		}

		return Object.keys(props).length;
	},

	render: function () {
		var fontEnumeration,
			reports = [];

		if (this.props.fontEnumeration) {
			fontEnumeration = (
				<p>Font enumeration detected.</p>
			);
		}

		Object.keys(this.props.counts).sort().forEach(function (url) {
			reports.push(
				<ScriptReport
					key={url}
					url={url}
					counts={this.props.counts[url]} />
			);
		}, this);

		var status = reports.length ?
			<p>
				<b>{this.getAccessCount()}</b> property accesses detected
				across <b>{reports.length}</b> scripts.
			</p> :
			<p>No property accesses detected.</p>;

		return (
			<div>
				{fontEnumeration}
				{status}
				{reports}
			</div>
		);
	}
});

var ScriptReport = React.createClass({
	render: function () {
		var rows = [];

		Object.keys(this.props.counts).sort().forEach(function (name) {
			rows.push(
				<ReportRow key={name} name={name} count={this.props.counts[name]} />
			);
		}, this);

		return (
			<div>
				<p title={this.props.url} style={{
					margin: '20px 0 5px',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap'
				}}>
					{this.props.url}
				</p>
				<table>
					<thead>
						<tr>
							<th>property</th>
							<th>count</th>
						</tr>
					</thead>
					<tbody>
						{rows}
					</tbody>
				</table>
			</div>
		);
	}
});

var ReportRow = React.createClass({
	render: function () {
		return (
			<tr>
				<td>
					<div title={this.props.name}>{this.props.name}</div>
				</td>
				<td>
					{this.props.count}
				</td>
			</tr>
		);
	}
});

React.renderComponent(<PanelApp />, document.body);
