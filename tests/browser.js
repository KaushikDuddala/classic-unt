/* Finds a browser for the screenshot and measurement scripts. The headless
   shell is preferred: it is faster and needs no --headless flag. */
const fs = require('fs');
const os = require('os');
const path = require('path');

function collect() {
  const out = [];
  if (process.env.CHROME_BIN) out.push(process.env.CHROME_BIN);

  const cacheDirs = [
    path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    path.join(os.homedir(), '.cache/ms-playwright')
  ];
  const shells = [];
  for (const cache of cacheDirs) {
    let entries;
    try { entries = fs.readdirSync(cache); } catch { continue; }
    for (const dir of entries) {
      if (!dir.startsWith('chromium_headless_shell')) continue;
      const base = path.join(cache, dir);
      let subs;
      try { subs = fs.readdirSync(base); } catch { continue; }
      for (const sub of subs) {
        const flat = path.join(base, sub, 'chrome-headless-shell');
        if (fs.existsSync(flat)) shells.push(flat);
        for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64',
          'chrome-headless-shell-linux64', 'chrome-headless-shell-linux']) {
          const p = path.join(base, sub, arch, 'chrome-headless-shell');
          if (fs.existsSync(p)) shells.push(p);
        }
      }
    }
  }
  out.push(...shells);

  // Full browsers, including the ones CI images ship with
  out.push(
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  );

  for (const bin of out) {
    if (bin && fs.existsSync(bin)) return { bin, isShell: bin.includes('headless-shell') };
  }
  return null;
}

/* Flags for a one-shot screenshot. */
function screenshotArgs(browser, { width, height, png }) {
  const args = [
    '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--window-size=${width},${height}`,
    '--virtual-time-budget=3000',
    `--screenshot=${png}`
  ];
  if (!browser.isShell) args.unshift('--headless=new');
  return args;
}

module.exports = { collect, screenshotArgs };
