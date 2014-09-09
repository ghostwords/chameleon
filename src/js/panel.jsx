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
	score = require('../lib/score.js').scoreScriptActivity,
	sendMessage = require('../lib/content_script_utils').sendMessage,
	utils = require('../lib/utils');

var PanelApp = React.createClass({
	getInitialState: function () {
		return {
			// TODO do we need a "loading" prop?
			domains: {},
			enabled: false
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
				<Report domainData={this.state.domains} />
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
	getInitialState: function () {
		var filtered = localStorage.getItem('filterReports');

		if (filtered === null) {
			filtered = true;
		} else {
			filtered = JSON.parse(filtered);
		}

		return {
			filtered: filtered
		};
	},

	filter: function () {
		var filtered = !this.state.filtered;

		localStorage.setItem('filterReports', JSON.stringify(filtered));

		this.setState({
			filtered: filtered
		});
	},

	render: function () {
		var display_filter,
			domains = Object.keys(this.props.domainData),
			// TODO we get scores here and then again down at each script level
			num_fingerprinters = utils.getFingerprinterCount(this.props.domainData),
			num_scripts = 0,
			reports = [];

		domains.sort().forEach(function (domain) {
			var scripts = this.props.domainData[domain].scripts;

			num_scripts += Object.keys(scripts).length;

			reports.push(
				<DomainReport
					key={domain}
					domain={domain}
					filtered={this.state.filtered}
					scriptData={scripts} />
			);
		}, this);

		var status = num_fingerprinters ?
			<p>
				<b>{num_fingerprinters}</b> suspected fingerprinter
					{num_fingerprinters > 1 ? 's' : ''} detected.
			</p> :
			<p>No fingerprinting detected.</p>;

		if (num_fingerprinters != num_scripts) {
			display_filter = (
				<p style={{ fontSize: 'small' }}>
					<label>
						<input type="checkbox"
							checked={this.state.filtered}
							onChange={this.filter} />
						Show fingerprinters only
					</label>
				</p>
			);
		}

		return (
			<div>
				{status}
				{display_filter}
				{!!reports.length && <hr />}
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
			has_fingerprinters = false,
			reports = [];

		Object.keys(this.props.scriptData).sort().forEach(function (url) {
			var data = this.props.scriptData[url],
				fingerprinter = score(data).fingerprinter;

			if (fingerprinter) {
				has_fingerprinters = true;
			}

			if (this.state.expanded && (!this.props.filtered || fingerprinter)) {
				reports.push(
					<ScriptReport
						key={url}
						counts={data.counts}
						filtered={this.props.filtered}
						fingerprinter={fingerprinter}
						fontEnumeration={data.fontEnumeration}
						url={url} />
				);
			}
		}, this);

		// hide the domain completely when all of its scripts got filtered out
		if (!reports.length && this.props.filtered && !has_fingerprinters) {
			return null;
		}

		var classes = ['domain', 'ellipsis'];
		if (has_fingerprinters) {
			classes.push('domain-fingerprinter');
		}

		return (
			<div>
				<p className={classes.join(' ')} onClick={this.toggle} title={domain}>
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
		var fingerprinter = '',
			font_enumeration,
			property_accesses_table,
			rows = [];

		if (this.props.fontEnumeration) {
			font_enumeration = (
				<div className="font-enumeration">
					<b>Font enumeration</b> detected.
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

		if (this.props.fingerprinter && !this.props.filtered) {
			fingerprinter = ' fingerprinter';
		}

		return (
			<div>
				<p className={'script-url ellipsis' + fingerprinter} title={this.props.url}>
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
