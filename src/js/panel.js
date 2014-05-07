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
	sendMessage = require('../lib/utils').sendMessage;

sendMessage('panelLoaded', function (response) {
	var counts = _.countBy(response.accesses, function (access) {
		return access.obj + '.' + access.prop;
	});
	var body = document.getElementsByTagName('body')[0];
	body.innerHTML += require('../templates/panel.jst')({
		counts: counts
	});
});
