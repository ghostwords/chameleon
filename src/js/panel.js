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
