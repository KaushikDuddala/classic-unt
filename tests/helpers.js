/* Shared helpers: repo paths, assertions and DOM setup. No test framework, these just run under node. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'src');
const SHOTS = path.join(__dirname, 'screenshots');

/* ------------------------------------------------------------------ *
 * Minimal assertion helpers
 * ------------------------------------------------------------------ */

function createReporter(title) {
  const state = { failures: 0, checks: 0 };

  state.check = function check(label, actual, expected) {
    state.checks++;
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) state.failures++;
    const line = ok
      ? `PASS  ${label}`
      : `FAIL  ${label}\n        expected ${JSON.stringify(expected)}` +
        `\n        actual   ${JSON.stringify(actual)}`;
    console.log(line);
  };

  state.section = function section(name) {
    console.log(`\n=== ${name} ===`);
  };

  state.finish = function finish() {
    console.log(`\n${state.checks - state.failures}/${state.checks} checks passed`);
    return state.failures === 0;
  };

  console.log(title);
  return state;
}

/* ------------------------------------------------------------------ *
 * Extension sources under test
 * ------------------------------------------------------------------ */

const contentJs = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
const contentCss = fs.readFileSync(path.join(EXT, 'content.css'), 'utf8');

/* A scrubbed copy of the real homepage markup. Null when it is absent, so a
   contributor can run the other suites without it. */
const FIXTURE = path.join(__dirname, 'fixtures', 'homepage.html');
const pageHtml = fs.existsSync(FIXTURE) ? fs.readFileSync(FIXTURE, 'utf8') : null;

/* ------------------------------------------------------------------ *
 * DOM bootstrapping
 * ------------------------------------------------------------------ */

/* jsdom has no layout engine. Without this the content script sees every
   element as invisible and declines to mask it. */
function stubLayout(window) {
  window.Element.prototype.getClientRects = function () {
    return [{ width: 100, height: 20, top: 0, left: 0 }];
  };
}

/* In-memory chrome.storage.sync. `store` is mutated in place so tests can
   seed it and read back what the code under test wrote. */
function stubChrome(window, store, { withOnChanged = true } = {}) {
  const listeners = [];
  window.chrome = {
    storage: {
      sync: {
        get(keys, cb) {
          const out = {};
          const list = keys === null || keys === undefined
            ? Object.keys(store)
            : (Array.isArray(keys) ? keys : Object.keys(keys || {}));
          for (const k of list) out[k] = k in store ? store[k] : (keys || {})[k];
          cb(out);
        },
        set(patch, cb) {
          Object.assign(store, patch);
          if (cb) cb();
        }
      },
      onChanged: {
        addListener: withOnChanged ? (fn) => listeners.push(fn) : () => {}
      }
    },
    runtime: { onMessage: { addListener() {} } }
  };
  window.__storageListeners = listeners;
  window.__touchStorage = () => listeners.forEach((fn) => fn({}, 'sync'));
  return window;
}

/* Run the real content.js over the page fixture. */
function loadPage(store, source = pageHtml) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(source, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  stubLayout(window);
  stubChrome(window, store);
  return new Promise((resolve) => {
    window.addEventListener('load', () => {
      window.eval(contentJs);
      setTimeout(() => resolve({ window, d: window.document, store }), 40);
    });
  });
}

/* Load one of the extension's own pages with its real inline scripts. */
function loadExtensionPage(file, store) {
  const { JSDOM } = require('jsdom');
  return JSDOM.fromFile(path.join(EXT, file), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  }).then((dom) => {
    const { window } = dom;
    stubChrome(window, store, { withOnChanged: false });
    window.chrome.runtime.openOptionsPage = () => {};
    return new Promise((resolve) => {
      window.addEventListener('load', () => setTimeout(() => resolve({ window, d: window.document }), 60));
    });
  });
}

module.exports = {
  ROOT, EXT, FIXTURE, SHOTS,
  contentJs, contentCss, pageHtml,
  createReporter, stubLayout, stubChrome, loadPage, loadExtensionPage
};
