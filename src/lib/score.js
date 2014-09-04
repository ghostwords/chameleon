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

module.exports.getFingerprintingScore = function (scriptData) {
	// a likelihood percentage
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
};
