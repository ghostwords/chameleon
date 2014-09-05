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
	getFingerprintingScore = require('../lib/score.js').getFingerprintingScore,
	sendMessage = require('../lib/content_script_utils').sendMessage,
	utils = require('../lib/utils');

var PanelApp = React.createClass({
	getInitialState: function () {
		return {
			// TODO do we need a "loading" prop?
			domains: {},
			enabled: false,
			fontEnumeration: false
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
					domainData={this.state.domains}
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
	render: function () {
		var domains = Object.keys(this.props.domainData),
			num_fingerprinters = utils.getFingerprinterCount(this.props.domainData),
			reports = [];

		domains.sort().forEach(function (domain) {
			reports.push(
				<DomainReport
					key={domain}
					domain={domain}
					scriptData={this.props.domainData[domain].scripts} />
			);
		}, this);

		var status = num_fingerprinters ?
			<p>
				<b>{num_fingerprinters}</b> suspected fingerprinting script
					{num_fingerprinters > 1 ? 's' : ''} detected.
			</p> :
			<p>No fingerprinting detected.</p>;

		return (
			<div>
				{status}
				{reports}
			</div>
		);
	}
});

var DomainReport = React.createClass({
	getInitialState: function () {
		return {
			expanded: true
		};
	},

	toggle: function () {
		this.setState({
			expanded: !this.state.expanded
		});
	},

	render: function () {
		var domain = this.props.domain,
			reports = [];

		if (this.state.expanded) {
			Object.keys(this.props.scriptData).sort().forEach(function (url) {
				var data = this.props.scriptData[url];

				if (getFingerprintingScore(data) > 50) {
					reports.push(
						<ScriptReport
							key={url}
							counts={data.counts}
							fontEnumeration={data.fontEnumeration}
							url={url} />
					);
				}
			}, this);

			if (!reports.length) {
				return null;
			}
		}

		return (
			<div>
				<p className="domain ellipsis" onClick={this.toggle} title={domain}>
					<span className="noselect triangle">
						{this.state.expanded ? '▾' : '▸'}
					</span>
					{domain}
				</p>
				{reports}
			</div>
		);
	}
});

var ScriptReport = React.createClass({
	render: function () {
		var font_enumeration,
			property_accesses_table,
			rows = [];

		if (this.props.fontEnumeration) {
			font_enumeration = (
				<div className="font-enumeration">
					Font enumeration detected.
				</div>
			);
		}

		Object.keys(this.props.counts).sort().forEach(function (name) {
			rows.push(
				<ReportRow key={name} name={name} count={this.props.counts[name]} />
			);
		}, this);

		if (rows.length) {
			property_accesses_table = (
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
			);
		}

		return (
			<div>
				<p className="script-url ellipsis" title={this.props.url}>
					{this.props.url}
				</p>

				{font_enumeration}

				{property_accesses_table}
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
