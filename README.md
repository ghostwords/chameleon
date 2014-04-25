# Chameleon

## Dev setup

1. `npm install` to install dev dependencies.
2. `npm run lint` to check JS code for common errors/formatting. Ideally, you'd have linting integrated into your editor. [Syntastic](https://github.com/scrooloose/syntastic) does this for Vim, for example.
3. `npm test` to run unit tests (coming soon).
4. `npm run dist` to generate an installable CRX package. This requires having the signing key in `~/.ssh/chameleon.pem`. To get a key, visit `chrome://extensions/` in Chrome and click on the "Pack extension..." button to generate a CRX manually.
