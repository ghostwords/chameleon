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
	score = require('../lib/score').scoreScriptActivity,
	sendMessage = require('../lib/content_script_utils').sendMessage,
	utils = require('../lib/utils');

var PanelApp = React.createClass({
	getInitialState: function () {
		// TODO do we need a "loading" prop?
		return {
			domains: {},
			hostname: '',
			injected: false,
			invalid_page: false,
			whitelisted: false,
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
		sendMessage('panelToggle', {
			hostname: this.state.hostname
		}, function () {
			this.setState({
				whitelisted: !this.state.whitelisted,
			}, function () {
				this.refs.header.animate();
			});
		}.bind(this));
	},

	render: function () {
		var report;

		if (this.state.invalid_page) {
			report = <p style={{
				marginLeft:'40px',
				marginRight:'40px'
			}}>Chameleon does not work on special browser pages.</p>;
		} else if (this.state.whitelisted) {
			report = <p>Chameleon is disabled on this page.</p>;
		} else {
			if (this.state.injected) {
				report = <Report domainData={this.state.domains} />;
			} else {
				// TODO add link
				report = <p>Please reload the page.</p>;
			}
		}

		return (
			<div>
				<Header
					hostname={this.state.hostname}
					invalid_page={this.state.invalid_page}
					ref="header"
					toggle={this.toggle}
					whitelisted={this.state.whitelisted} />
				<hr />
				{report}
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
		var enabled = !this.props.invalid_page && !this.props.whitelisted;

		var logoClasses = [
			'sprites',
			'toplogo',
			'logo-' + (enabled ? '' : 'in') + 'active'
		];

		var text = (enabled ? 'enabled' : <span className="warning">disabled</span>);

		var header_contents_style,
			toggle_link;

		if (!this.props.invalid_page && this.props.hostname) {
			toggle_link = (
				<div className="ellipsis">
					<a href="#" id="toggle" onClick={this.toggle}>
						{this.props.whitelisted ? 'Enable' : 'Disable'} on <span title={this.props.hostname}>
							{this.props.hostname}
						</span>
					</a>
				</div>
			);
		} else {
			header_contents_style = {
				lineHeight: '2.4em'
			};
		}

		return (
			<div>
				<span className={logoClasses.join(' ')}></span>
				<div id="header-contents" style={header_contents_style}>
					Chameleon is <span id="status-text" ref="statusText">
						{text}
					</span>
					{toggle_link}
				</div>
			</div>
		);
	}
});

var Report = React.createClass({
	getInitialState: function () {
		var filtered = utils.storage('filterReports');

		if (filtered === null) {
			filtered = true;
		}

		return {
			filtered: filtered
		};
	},

	filter: function () {
		var filtered = !this.state.filtered;

		utils.storage('filterReports', filtered);

		this.setState({
			filtered: filtered
		});
	},

	render: function () {
		var display_filter,
			domains = Object.keys(this.props.domainData),
			num_fingerprinter_domains = 0,
			num_fingerprinter_scripts = 0,
			num_scripts = 0,
			reports = [];

		domains.sort().forEach(function (domain) {
			var has_fingerprinters = false,
				scripts = this.props.domainData[domain].scripts;

			// no need for hasOwnProperty loop checks in this context
			for (var url in scripts) { // jshint ignore:line
				var data = scripts[url];

				data.fingerprinter = score(data).fingerprinter;

				if (data.fingerprinter) {
					num_fingerprinter_scripts++;
					has_fingerprinters = true;
				}

				num_scripts++;
			}

			if (has_fingerprinters) {
				num_fingerprinter_domains++;
			}

			reports.push(
				<DomainReport
					key={domain}
					domain={domain}
					filtered={this.state.filtered}
					hasFingerprinters={has_fingerprinters}
					scriptData={scripts} />
			);
		}, this);

		var status = num_fingerprinter_domains ?
			<p>
				<b>{num_fingerprinter_domains}</b> suspected fingerprinter
					{num_fingerprinter_domains > 1 ? 's' : ''} detected.
			</p> :
			<p>No fingerprinting detected.</p>;

		if (num_fingerprinter_scripts != num_scripts) {
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
			reports = [];

		Object.keys(this.props.scriptData).sort().forEach(function (url) {
			var data = this.props.scriptData[url];

			if (this.state.expanded && (!this.props.filtered || data.fingerprinter)) {
				reports.push(
					<ScriptReport
						key={url}
						canvasFingerprinting={data.canvas.fingerprinting}
						counts={data.counts}
						filtered={this.props.filtered}
						fingerprinter={data.fingerprinter}
						fontEnumeration={data.fontEnumeration}
						url={url} />
				);
			}
		}, this);

		// hide the domain completely when all of its scripts got filtered out
		if (!reports.length && this.props.filtered && !this.props.hasFingerprinters) {
			return null;
		}

		var classes = ['domain', 'ellipsis'];
		if (this.props.hasFingerprinters) {
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
		var canvas_fingerprinting,
			fingerprinter = '',
			font_enumeration,
			property_accesses_table,
			rows = [];

		if (this.props.canvasFingerprinting) {
			canvas_fingerprinting = (
				<div className="fp-technique">
					<b>Canvas fingerprinting</b> detected.
				</div>
			);
		}

		if (this.props.fontEnumeration) {
			font_enumeration = (
				<div className="fp-technique">
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

				{canvas_fingerprinting}

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
