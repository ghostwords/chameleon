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

// TODO move scoring to lib/tabdata?
function get_fingerprinting_score(scriptData) {
	// 1 to 100
	var score = 0;

	// 95 points for font enumeration
	if (scriptData.fontEnumeration) {
		score += 95;
	}

	// 15 points for each property access
	// TODO language/userAgent/common properties should count less, others should count more?
	// TODO use non-linear scale?
	// TODO third-party scripts should count more?
	// TODO count across domains instead of individual scripts?
	for (var i = 0, ln = Object.keys(scriptData.counts).length; i < ln; i++) {
		score += 15;
		if (score > 100) {
			score = 100;
			break;
		}
	}

	return score;
}

function scale_int(num, old_min, old_max, new_min, new_max) {
	return Math.round((num - old_min) * (new_max - new_min) / (old_max - old_min) + new_min);
}

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
			font_enumeration = '',
			reports = [];

		if (this.props.fontEnumeration) {
			font_enumeration = <span><b>Font enumeration </b>and </span>;
		}

		domains.sort().forEach(function (domain) {
			reports.push(
				<DomainReport
					key={domain}
					domain={domain}
					scriptData={this.props.domainData[domain].scripts} />
			);
		}, this);

		var status = reports.length ?
			<p>
				{font_enumeration}
				<b>{utils.getAccessCount(this.props.domainData)}</b> property
				accesses detected across <b>{domains.length}</b> domains.
			</p> :
			<p>No property accesses detected.</p>;

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

				reports.push(
					<ScriptReport
						key={url}
						counts={data.counts}
						fontEnumeration={data.fontEnumeration}
						url={url} />
				);
			}, this);
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
			rows = [],
			score = get_fingerprinting_score(this.props),
			score_style = {};

		if (score > 50) {
			score_style.border =
				// 1 or 2
				scale_int(score, 51, 100, 1, 2) +
					'px solid hsl(360, ' +
					// 30 to 100
					scale_int(score, 51, 100, 30, 100) + '%, 50%)';
		}

		if (this.props.fontEnumeration) {
			font_enumeration = (
				<div className="font-enumeration" style={score_style}>
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
				<table style={score_style}>
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
