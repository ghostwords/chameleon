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

module.exports.storage = function (key, value) {
	if (typeof value != 'undefined') {
		localStorage.setItem(key, JSON.stringify(value));
	} else {
		value = localStorage.getItem(key);
		return value && JSON.parse(value);
	}
};
