/* Guards what differs between browsers. A break here is silent: Firefox drops
   any rule whose selector list it cannot parse, so the symptom is an unstyled
   page rather than an error.

   node tests/manifests.test.js
*/

const fs = require('fs');
const path = require('path');
const { createReporter, EXT, ROOT } = require('./helpers');

const t = createReporter('classic-unt cross-browser manifests and CSS');

const base = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const firefox = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/firefox.json'), 'utf8'));
const safari = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/safari.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const css = fs.readFileSync(path.join(EXT, 'content.css'), 'utf8');
const optionsCss = fs.readFileSync(path.join(EXT, 'options.css'), 'utf8');
const backgroundJs = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');

const VARIANTS = { base, firefox, safari };

/* Everything a manifest points at has to exist in src/. */
function referencedFiles(manifest) {
  const refs = [];
  const ui = manifest.options_ui || (manifest.options_page ? { page: manifest.options_page } : null);
  if (ui) refs.push(ui.page);
  if (manifest.action && manifest.action.default_popup) refs.push(manifest.action.default_popup);
  if (manifest.background) {
    if (manifest.background.service_worker) refs.push(manifest.background.service_worker);
    if (manifest.background.scripts) refs.push(...manifest.background.scripts);
  }
  for (const script of manifest.content_scripts || []) {
    refs.push(...(script.js || []), ...(script.css || []));
  }
  refs.push(...Object.values(manifest.icons || {}));
  if (manifest.action && manifest.action.default_icon) {
    refs.push(...Object.values(manifest.action.default_icon));
  }
  return refs;
}

t.section('every referenced file exists');
for (const [name, manifest] of Object.entries(VARIANTS)) {
  const refs = referencedFiles(manifest);
  const missing = refs.filter((r) => !fs.existsSync(path.join(EXT, r)));
  t.check(`${name}: ${refs.length} references resolve`, missing, []);
}

/* The manifest is not the only place a path can go stale: options.html and
   popup.html reference css, js and images by relative path too. */
t.section('assets referenced by the extension pages');
for (const page of ['options.html', 'popup.html']) {
  const html = fs.readFileSync(path.join(EXT, page), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((ref) => !/^(?:https?:|data:|#|javascript:)/.test(ref));
  t.check(`${page} references ${refs.length} local files`, refs.length > 0, true);
  t.check(`${page}: all resolve`,
    refs.filter((r) => !fs.existsSync(path.join(EXT, r))), []);
}

/* The mark is the real icon, not a letter someone typed. */
t.section('branding uses the generated icon');
for (const page of ['options.html', 'popup.html']) {
  const html = fs.readFileSync(path.join(EXT, page), 'utf8');
  const mark = (html.match(/<img[^>]*class="mark"[^>]*>/) || [])[0] || '';
  t.check(`${page} mark is an <img>`, /^<img/.test(mark), true);
  const src = (mark.match(/src="([^"]+)"/) || [])[1] || '';
  t.check(`${page} mark uses the shipped icon`,
    /^icons\/icon\d+\.png$/.test(src), true);
  t.check(`${page} has no typed-in letter`,
    />\s*U\s*</.test(html), false);
}

t.section('shared shape');
for (const [name, manifest] of Object.entries(VARIANTS)) {
  t.check(`${name}: manifest v3`, manifest.manifest_version, 3);
  t.check(`${name}: same version as base`, manifest.version, base.version);
  t.check(`${name}: same permissions`, manifest.permissions, base.permissions);
  t.check(`${name}: same host permissions`, manifest.host_permissions, base.host_permissions);
  t.check(`${name}: same content script matches`,
    manifest.content_scripts[0].matches, base.content_scripts[0].matches);
  t.check(`${name}: same content script js`, manifest.content_scripts[0].js,
    base.content_scripts[0].js);
  t.check(`${name}: all_frames preserved`, manifest.content_scripts[0].all_frames, true);
  t.check(`${name}: document_start preserved`, manifest.content_scripts[0].run_at, 'document_start');
}

/* The release workflow reads these and refuses to publish on a mismatch. */
t.section('versions agree everywhere');
t.check('package.json matches the manifests', pkg.version, base.version);
t.check('version looks like semver', /^\d+\.\d+\.\d+$/.test(base.version), true);

t.section('per-browser background');
t.check('chromium uses a service worker', base.background.service_worker, 'background.js');
t.check('chromium has no scripts list', base.background.scripts, undefined);
t.check('firefox uses background scripts', firefox.background.scripts, ['defaults.js', 'background.js']);
t.check('firefox has no service worker', firefox.background.service_worker, undefined);
t.check('safari uses background scripts', safari.background.scripts, ['defaults.js', 'background.js']);
t.check('safari has no service worker', safari.background.service_worker, undefined);

t.section('per-browser extras');
t.check('firefox has an add-on id', !!firefox.browser_specific_settings.gecko.id, true);
t.check('firefox id looks like an id',
  /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(firefox.browser_specific_settings.gecko.id), true);
t.check('firefox declares a minimum version',
  !!firefox.browser_specific_settings.gecko.strict_min_version, true);
t.check('safari carries no gecko block', safari.browser_specific_settings, undefined);
t.check('chromium carries no gecko block', base.browser_specific_settings, undefined);

t.section('stylesheet is portable');
/* Comments mention :has() while explaining why it is avoided, so strip them before inspecting. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const cssBody = stripComments(css);
const optionsBody = stripComments(optionsCss);

/* Each selector list, i.e. the text in front of a { */
function selectorLists(text) {
  const out = [];
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1].trim());
  return out;
}

const cssSelectors = selectorLists(cssBody);
const optionSelectors = selectorLists(optionsBody);
const allSelectors = [...cssSelectors, ...optionSelectors]
  .flatMap((list) => list.split(',').map((s) => s.trim()))
  .filter(Boolean);

t.check('content.css still has rules to check', cssSelectors.length > 20, true);
t.check('options.css still has rules to check', optionSelectors.length > 10, true);

const withHas = allSelectors.filter((s) => s.includes(':has('));
t.check('no selector uses :has()', withHas, []);

/* PeopleSoft ids contain "$", which is not valid unquoted, and one bad
   selector voids every rule it shares a block with. */
const withDollarId = allSelectors.filter((s) => /#[^"'\s]*\$/.test(s));
t.check('no unquoted $ in an id selector', withDollarId, []);

t.section('background script runs in all three');
t.check('importScripts is guarded', /typeof importScripts === 'function'/.test(backgroundJs), true);
t.check('chrome namespace guarded', /typeof chrome !== 'undefined'/.test(backgroundJs), true);

process.exit(t.finish() ? 0 : 1);
