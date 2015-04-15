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

var tld = require('tldjs');

// does the string start with an optional scheme/colon and two slashes?
// TODO better IP regex, check for IPv6
var IP_ADDRESS = /^\d+\.\d+\.\d+\.\d+(?::\d+)?$/,
	// TODO could be a chrome-extension protocol URL: chrome-extension://boadgeojelhgndaghljhdicfkmllpafd/cast_sender.js
	VALID_URL = /^(?:[a-z]+:)?\/\//;

// TODO see getBaseDomain in https://github.com/adblockplus/adblockpluschrome/blob/f9c5bd397bb8a9d7d2890aee89d45e25178c4b7a/lib/basedomain.js
// TODO punycode? https://publicsuffix.org/list/ and http://www.w3.org/International/articles/idn-and-iri/
module.exports.get_domain = function (url) {
	var domain,
		hostname,
		UNKNOWN_DOMAIN = '<unknown domain>';

	if (!url) {
		return UNKNOWN_DOMAIN;
	}

	if (!VALID_URL.test(url)) {
		return UNKNOWN_DOMAIN;
	}

	hostname = new URL(url).hostname;

	// TODO tld.js does not properly handle IP (v4 or v6) addresses
	if (!IP_ADDRESS.test(hostname)) {
		domain = tld.getDomain(url);
	}

	if (!domain) {
		domain = hostname;

		// strip the port
		var port_index = domain.lastIndexOf(':');
		if (port_index != -1) {
			domain = domain.slice(0, port_index);
		}
	}

	return domain;
};
