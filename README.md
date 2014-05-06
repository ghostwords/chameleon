# Chameleon

Browser fingerprinting protection for everybody.

Currently makes Chrome look like Tor Browser to [Panopticlick](https://panopticlick.eff.org/).

The number over the toolbar button counts the number of distinct attempts to collect information about your browser on the current page.


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
5. `npm run dist` to generate an installable CRX package. This requires having the signing key in `~/.ssh/chameleon.pem`. To get a key, visit `chrome://extensions/` in Chrome and click on the "Pack extension..." button to generate a CRX manually.


## Roadmap

- Add roadmap to GitHub Wiki pages.
