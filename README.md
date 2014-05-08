# Chameleon

[Browser fingerprinting](http://akademie.dw.de/digitalsafety/your-browsers-fingerprints-and-how-to-reduce-them/) protection for everybody.

Chameleon is a Chrome privacy extension that makes Chrome look like Tor Browser to [Panopticlick](https://panopticlick.eff.org/). This initial, proof-of-concept profile was chosen since [Tor users are supposed to all look alike](https://www.torproject.org/projects/torbrowser/design/#fingerprinting-linkability).

The number over Chameleon's button counts the number of distinct attempts to collect information about your browser on the current page. Higher numbers suggest fingerprinting is taking place. Chameleon will soon support submitting fingerprinting attempts, to better understand fingerprinting and subsequently improve Chameleon's functionality.

Chameleon for Firefox is in the works.

### Before:

!["before" screenshot](images/before.png)

### After:

!["after" screenshot](images/after.png)

### Tor Browser:

![Tor Browser screenshot](images/tor.png)


## Dev setup

1. `npm install` to install dev dependencies.
2. `npm run lint` to check JS code for common errors/formatting issues.
3. `npm test` to run unit tests (coming soon).
4. `npm run watch` to monitor extension sources for changes and regenerate extension JS bundles as needed.
5. Load the unpacked extension in Chrome from the [chrome](chrome/) folder.
6. `npm run dist` to generate an installable CRX package. This requires having the signing key in `~/.ssh/chameleon.pem`. To get a key, visit `chrome://extensions/` in Chrome and click on the "Pack extension..." button to generate a CRX manually.


## Roadmap

- Add roadmap to GitHub Wiki pages.


## Code license

Mozilla Public License Version 2.0
