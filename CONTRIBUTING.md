# Contributing

Thanks for looking at this. It is a small, self-contained browser extension, so the workflow is short.

## Getting set up

```sh
git clone <your fork>
cd classic-unt
npm install          # jsdom and js-yaml, only needed for the tests
```

Then load it: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick the **`src/`** folder. reloading the extension in Chrome picks up changes.

## Before you open a pull request

```sh
npm run check
```

`npm test` runs four suites:

| Suite | What it protects |
| --- | --- |
| `tests/manifests.test.js` | all three manifests resolve, agree where they must, and contain no `:has()` or unquoted `$` selector |
| `tests/forms.test.js` | the issue forms, repo metadata and community files |
| `tests/content.test.js` | the content script against the real saved page markup |
| `tests/ui.test.js` | the options and popup pages |

`npm run measure` renders the classic layout at six widths and fails if a box would be clipped. It needs Chrome or Chromium; without one it skips cleanly.

Please include test output in your PR. A change that fixes a visual bug should come with either a screenshot or a measurement showing it.

## House rules

These exist because breaking them fails quietly rather than loudly.

- **No `:has()` in any stylesheet.** An engine that cannot parse one selector discards *every* selector in that rule, so the bug shows up as unrelated missing styling. `tests/manifests.test.js` enforces this.
- **Never put a `$` in an unquoted id selector.** PeopleSoft's ids contain `$`, which is not valid there, and one bad selector voids the whole rule. Use a class, or a quoted attribute selector like `[id^="foo$46$"]`.
- **Do not use `:has()` in `options.css` either**, same reason. Toggle a class from JS instead. See `.opt.on` in `src/options.js`.
- **The extension has no runtime dependencies and no build step.** `src/` is loaded by Chrome exactly as committed. Please keep it that way; adding a bundler would mean the "load unpacked" workflow and the CI build diverge.

## Changing the tiles

- **Old tile names** live in `CLASSIC_LABELS` in `src/content.js`. Edit that map rather than the markup.
- **What gets redacted** is the `SENSITIVE` map next to it. Prefer adding a CSS class that already exists in the page's markup over inventing a selector.
- **Adding an icon**: put an entry in `ICONS` (a 48×48 `viewBox` of flat SVG paths) and match it in `CLASSIC_ICONS`.

## Releasing

Version numbers live in four places and `tests/manifests.test.js` checks the manifests agree:

- `src/manifest.json`
- `manifests/firefox.json`
- `manifests/safari.json`
- `package.json`

Publish a `v1.2.3` release and the release workflow builds the packages and attaches them to a GitHub release. See the README for what each artifact is for.

**The signing key in `keys/` is gitignored on purpose.** Never commit it. CI builds the Chrome Web Store zip unsigned; if you want a signed `.crx` in releases, add a `CRX_PRIVATE_KEY` repository secret and the workflow will use it. Losing the key means a new extension id for anything already distributed.

## Reporting bugs

Include your browser and version, which mode you were in, and a screenshot. For anything unstyled, check the page console first; `Content script could not be loaded` explains most of them.

By contributing you agree that your work is licensed under the MIT licence.
