/* Validates the issue forms and the repo metadata. A malformed form only fails
   when somebody tries to file a report, which is the worst time to find out.

   node tests/forms.test.js
*/

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { createReporter, ROOT } = require('./helpers');

const t = createReporter('classic-unt GitHub forms and repo config');

const FORMS = ['bug_report.yml', 'feature_request.yml'];
const VALID_INPUTS = ['markdown', 'input', 'textarea', 'dropdown', 'checkboxes'];
const ID_RE = /^[A-Za-z0-9_-]+$/;
const REPO = 'github.com/KaushikDuddala/classic-unt';

const formsDir = path.join(ROOT, '.github/ISSUE_TEMPLATE');

function loadYaml(file) {
  const text = fs.readFileSync(file, 'utf8');
  return yaml.load(text, { filename: file });
}

t.section('issue templates exist');
for (const f of FORMS) {
  t.check(`${f} present`, fs.existsSync(path.join(formsDir, f)), true);
}
t.check('config.yml present', fs.existsSync(path.join(formsDir, 'config.yml')), true);

t.section('every form is well formed');
for (const f of FORMS) {
  const file = path.join(formsDir, f);
  let form = null;
  let parseError = null;
  try {
    form = loadYaml(file);
  } catch (err) {
    parseError = err.reason || err.message;
  }
  t.check(`${f} parses as yaml`, parseError, null);
  if (!form) continue;

  t.check(`${f} has a name`, typeof form.name === 'string' && form.name.length > 0, true);
  t.check(`${f} has a description`,
    typeof form.description === 'string' && form.description.length > 0, true);
  t.check(`${f} body is a non-empty list`,
    Array.isArray(form.body) && form.body.length > 0, true);
  t.check(`${f} has a title prefix or none`, form.title === undefined || typeof form.title === 'string', true);
  t.check(`${f} labels are a list`,
    form.labels === undefined || Array.isArray(form.labels), true);

  const ids = [];
  const badTypes = [];
  const missingLabel = [];
  const missingOptions = [];
  const longDescriptions = [];

  for (const item of form.body || []) {
    if (!VALID_INPUTS.includes(item.type)) badTypes.push(String(item.type));
    if (item.id) ids.push(item.id);
    if (item.id && !ID_RE.test(item.id)) badTypes.push('malformed id: ' + item.id);
    if (item.type !== 'markdown' && !(item.attributes && item.attributes.label)) {
      missingLabel.push(item.id || item.type);
    }
    if (item.type === 'dropdown') {
      const opts = item.attributes && item.attributes.options;
      if (!Array.isArray(opts) || opts.length === 0) missingOptions.push(item.id);
    }
    if (item.type === 'checkboxes') {
      const opts = item.attributes && item.attributes.options;
      if (!Array.isArray(opts) || opts.length === 0) missingOptions.push(item.id);
    }
    // github truncates the summary at 120 characters
    const label = item.attributes && item.attributes.label;
    if (typeof label === 'string' && label.length > 120) longDescriptions.push(item.id);
  }

  t.check(`${f} uses only known input types`, badTypes, []);
  t.check(`${f} every non-markdown input has a label`, missingLabel, []);
  t.check(`${f} every dropdown and checkbox group has options`, missingOptions, []);
  t.check(`${f} ids are unique`, ids.length === new Set(ids).size, true);
  t.check(`${f} labels fit github's summary limit`, longDescriptions, []);
  t.check(`${f} has at least one required field`,
    (form.body || []).some((i) => i.validations && i.validations.required === true), true);
}

t.section('the bug form asks for what we need to reproduce');
{
  const bug = loadYaml(path.join(formsDir, 'bug_report.yml'));
  const ids = (bug.body || []).map((i) => i.id).filter(Boolean);
  t.check('asks which browser', ids.includes('browser'), true);
  t.check('asks for the browser version', ids.includes('browser-version'), true);
  t.check('asks which mode was active', ids.includes('mode'), true);
  t.check('asks what happened', ids.includes('what-happened'), true);
  t.check('asks for reproduction steps', ids.includes('steps'), true);
  t.check('asks for the window width, which layout bugs need', ids.includes('window-width'), true);
  t.check('offers a screenshot field', ids.includes('screenshot'), true);
}

t.section('config.yml');
{
  const config = loadYaml(path.join(formsDir, 'config.yml'));
  t.check('is a mapping', typeof config === 'object' && !Array.isArray(config), true);
  t.check('blank issues stay available', config.blank_issues_enabled, true);
  t.check('contact links exist', Array.isArray(config.contact_links) &&
    config.contact_links.length > 0, true);
  t.check('contact links point at this repo',
    (config.contact_links || []).every((l) => (l.url || '').includes(REPO)), true);
  t.check('contact links have a name and an about',
    (config.contact_links || []).every((l) => l.name && l.about), true);
}

t.section('no placeholder owner left anywhere');
{
  const files = [
    'CHANGELOG.md', 'CONTRIBUTING.md', 'README.md',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/CONTRIBUTING.md', '.github/CODE_OF_CONDUCT.md'
  ];
  const offenders = files.filter((f) => {
    const p = path.join(ROOT, f);
    return fs.existsSync(p) && /github\.com\/OWNER\b/.test(fs.readFileSync(p, 'utf8'));
  });
  t.check('every github url is real', offenders, []);
}

t.section('community and project files');
{
  for (const f of ['LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', '.editorconfig', 'package.json']) {
    t.check(`${f} present`, fs.existsSync(path.join(ROOT, f)), true);
  }
  t.check('.github/CODE_OF_CONDUCT.md present',
    fs.existsSync(path.join(ROOT, '.github/CODE_OF_CONDUCT.md')), true);
  t.check('LICENSE is MIT', /^MIT License/m.test(
    fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8')), true);

  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  t.check(`changelog documents ${version}`,
    changelog.includes(`## [${version}]`), true);

  const ci = path.join(ROOT, '.github/workflows/ci.yml');
  t.check('ci workflow present', fs.existsSync(ci), true);
  const release = path.join(ROOT, '.github/workflows/release.yml');
  t.check('release workflow present', fs.existsSync(release), true);
  const releaseText = fs.readFileSync(release, 'utf8');
  const ciText = fs.readFileSync(ci, 'utf8');
  t.check('release runs when a release is published',
    /release:\s*\n\s*types:\s*\[published\]/.test(releaseText), true);
  t.check('release checks the version against the tag', /tag says/.test(releaseText), true);
  t.check('release refuses to run without tests', /npm test/.test(releaseText), true);
  t.check('release refuses to attach a key', /PRIVATE KEY/.test(releaseText), true);
  t.check('ci builds no packages', /\.zip/.test(ciText), false);
}

t.section('the signing key is not tracked');
{
  const ignored = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  t.check('keys/ is gitignored', /^keys\/$/m.test(ignored), true);
  t.check('dist/ is gitignored', /^dist\/$/m.test(ignored), true);
  t.check('node_modules/ is gitignored', /^node_modules\/$/m.test(ignored), true);
  t.check('package-lock.json is committed for reproducible ci',
    !/^package-lock\.json$/m.test(ignored), true);
}

process.exit(t.finish() ? 0 : 1);
