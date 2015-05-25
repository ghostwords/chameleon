/*!
 * Chameleon
 *
 * Copyright 2015 ghostwords.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

module.exports.scoreScriptActivity = function (scriptData) {
	var points = 0;

	if (scriptData.canvas.fingerprinting) {
		points += 95;
	}

	if (scriptData.fontEnumeration) {
		points += 95;
	}

	if (scriptData.navigatorEnumeration) {
		points += 95;
	}

	// 15 points for each property access
	// TODO language/userAgent/common properties should count less, others should count more?
	// TODO use non-linear scale?
	// TODO third-party scripts should count more?
	// TODO count across domains instead of individual scripts?
	//for (var i = 0, ln = Object.keys(scriptData.counts).length; i < ln; i++) {
	//	points += 15;
	//}

	return {
		fingerprinter: (points > 50),
		points: points
	};
};
