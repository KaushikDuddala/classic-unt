/* Screenshots the extension's own pages so the icon and layout can be eyeballed.

   These pages pull css, js and images by relative path, so the copy rendered
   here has its refs rewritten to absolute paths into src/. Writing the copy
   into src/ instead would work until a crash left a stray file behind to be
   picked up by the packager. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { EXT, SHOTS } = require('./helpers');
const { collect, screenshotArgs } = require('./browser');

const browser = collect();
if (!browser) { console.log('no browser, skipping'); process.exit(0); }

const STUB = `
  <script>
    window.chrome = {
      storage: { sync: { get: (k, cb) => cb({}), set: (p, cb) => cb && cb() } },
      runtime: { openOptionsPage: function () {} }
    };
  </script>
`;

function absolutise(html) {
  return html.replace(/(?:src|href)="([^"]+)"/g, (whole, ref) => {
    if (/^(?:https?:|data:|#|javascript:)/.test(ref)) return whole;
    const abs = path.join(EXT, ref);
    if (!fs.existsSync(abs)) {
      throw new Error('preview-pages: ' + ref + ' does not exist in src/');
    }
    return whole.replace(ref, 'file://' + abs);
  });
}

function shoot(page, width, height, name) {
  const html = absolutise(fs.readFileSync(path.join(EXT, page), 'utf8'));
  const file = path.join(SHOTS, '_' + name + '.html');
  fs.writeFileSync(file, html.replace('<head>', '<head>' + STUB));
  const png = path.join(SHOTS, name + '.png');
  const args = screenshotArgs(browser, { width, height, png }).concat([`file://${file}`]);
  try {
    execFileSync(browser.bin, args, { stdio: 'ignore', timeout: 60000 });
  } finally {
    fs.unlinkSync(file);
  }
  console.log('  ' + name + '.png');
}

fs.mkdirSync(SHOTS, { recursive: true });
shoot('options.html', 700, 900, 'page-options');
shoot('popup.html', 300, 320, 'page-popup');