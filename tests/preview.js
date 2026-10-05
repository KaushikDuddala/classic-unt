/* Renders the homepage in each mode and screenshots it.

 * The real stylesheets live on my.unt.edu behind a login, so this stubs enough
 * CSS to exercise the extension's own layout. Not a substitute for looking at
 * the live page, but it does catch layout regressions.

 * node tests/preview.js
*/

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');
const { SHOTS, contentJs, contentCss, pageHtml } = require('./helpers');
const { collect, screenshotArgs } = require('./browser');

/* Stand-in for the PeopleSoft stylesheet. */
const PAGE_CSS = `
  body { margin: 0; }
  .ps_header { background: #fff; border-bottom: 1px solid #ddd; padding: 10px 14px; }
  .ps_pagetitle { font-size: 20px; color: #00853d; margin: 0; }
  .psc_hidden, .psc_hidden-readable, .psc_force-hidden, .lpnotile,
  .nuihide, .nuihdr_gb, .ps_box-title, #win10divPTNUI_LAND_WRK_GROUPBOX9 {
    display: none !important;
  }
  #PT_PAGETITLE, #win10hdrdivPT_PAGETITLE { display: none; }
  /* PeopleSoft clips its content chain; the stub does too, so overflow bugs
     show up here rather than only on the live page. */
  .ps_wrapper, .ps_content, .ps_main, .ps_pagecontainer,
  .ps_pspagecontainer, .psc_panel-content, .psc_panel-contentinterior {
    overflow: hidden;
  }
  .ps_box-scrollarea { overflow: hidden; }
  .ps_box-scrollarea-row { display: block; }
  .ps_grid-row { display: block; overflow: hidden; }
  .ps_grid-cell { float: left; padding: 4px; }
  .rsz_w1 .ps_grid-cell { width: 320px; }
  .rsz_w2 .ps_grid-cell { width: 640px; }
  .ps_grid-body::after { content: ""; display: table; clear: both; }
  .nuilp { border: 1px solid #ddd; border-radius: 6px; background: #fff; padding: 10px; }
  .ps_groupleth { font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #555; }
  .GBSA_tile-body, .ps_box-grouplet { font-size: 13px; color: #333; }
  .GBSA_gpa { font-size: 30px; font-weight: bold; }
  .GBSA_billpay-balance { font-size: 22px; font-weight: bold; }
  .GBSA_aid-total { font-size: 20px; font-weight: bold; }
  .GBSA_profile-header { display: flex; gap: 12px; align-items: center; padding: 8px; }
  .GBSA_profile-header-photo { width: 64px; height: 64px; border-radius: 50%; background: #ccd; }
  .GBSA_profile-header-greeting { font-size: 18px; margin: 2px 0; }
  .GBSA_profile-header-meta, .GBSA_profile-header-chip, .GBSA_profile-header-id { font-size: 12px; color: #555; }
  .GBSA_profile-header-id { font-weight: bold; }
  .GBSA_profile-header-details { display: flex; gap: 8px; align-items: center; }
  .GBSA_task-row { display: flex; gap: 8px; padding: 3px 0; }
  .GBSA_task-count { min-width: 18px; }
  .GBSA_academic-actions, .GBSA_tool-grid, .GBSA_support-grid { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .GBSA_tool-grid a, .GBSA_support-card, .GBSA_action-card {
    border: 1px solid #e4e4ea; border-radius: 4px; padding: 6px 8px; font-size: 12px;
    color: #333; text-decoration: none;
  }
  .GBSA_class-line { border-left: 3px solid #00853d; padding-left: 8px; margin: 4px 0; }
  .GBSA_class-main { display: flex; gap: 10px; }
  .GBSA_class-location, .GBSA_billpay-status, .GBSA_term { font-size: 12px; color: #666; }
  .GBSA_enroll-alert { background: #fdf3e2; border-radius: 4px; padding: 8px; margin: 6px 0; }
  .GBSA_appointment { display: flex; gap: 10px; align-items: center; border: 1px solid #e4e4ea; border-radius: 4px; padding: 8px; margin-top: 6px; }
  .GBSA_appointment-date { text-align: center; }
  .GBSA_breakdown { list-style: none; padding: 0; margin: 4px 0; }
  .GBSA_finaid-award-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
  .GBSA_aid-bar { height: 8px; border-radius: 4px; background: #eee; overflow: hidden; display: flex; margin: 6px 0; }
  .GBSA_aid-cat-scholarship { background: #00853d; }
  .GBSA_aid-cat-loan { background: #4a90d9; }
  .GBSA_aid-cat-other { background: #c0c0c8; }
  .GBSA_button-primary { display: inline-block; margin-top: 8px; color: #00853d; font-weight: bold; }
  .GBSA_aid-alert { background: #fdf3e2; border-radius: 4px; padding: 6px 8px; margin: 6px 0; font-size: 12px; }
  .psc_tile-img img { max-width: 100%; height: 60px; }
  .lppagehdr h2 { font-size: 13px; color: #555; }
  .ps_footer { height: 18px; }
`;

const VARIANTS = [
  { name: 'before', store: null, width: 1280, height: 1500 },
  { name: 'privacy', store: { mode: 'privacy', removeBackground: true }, width: 1280, height: 1500 },
  { name: 'classic', store: { mode: 'classic' }, width: 1280, height: 900 },
  { name: 'classic-narrow', store: { mode: 'classic' }, width: 700, height: 1000 },
  { name: 'classic-profile', store: { mode: 'classic', classic: { showProfileTile: true } }, width: 900, height: 700 }
];

/* --- build one preview html --------------------------------------------- */
async function build(name, store) {
  const dom = new JSDOM(pageHtml, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 100, height: 20, top: 0, left: 0 }];
  const listeners = [];
  window.chrome = {
    storage: {
      sync: {
        get(keys, cb) {
          const out = {};
          const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
          for (const k of list) out[k] = k in store ? store[k] : (keys || {})[k];
          cb(out);
        },
        set(patch, cb) { Object.assign(store, patch); if (cb) cb(); }
      },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    },
    runtime: { onMessage: { addListener() {} } }
  };

  return new Promise((resolve) => {
    window.addEventListener('load', () => {
      const finish = () => {
        const d = window.document;
        const style = d.createElement('style');
        style.textContent = PAGE_CSS + '\n' + contentCss;
        d.head.appendChild(style);
        // nothing may reach the network: the real stylesheets need a login
        d.querySelectorAll('link[rel="stylesheet"], script[src]').forEach((n) => n.remove());
        d.querySelectorAll('img').forEach((img) => {
          const keep = img.classList.contains('GBSA_profile-header-photo');
          img.removeAttribute('src');
          if (!keep) img.remove();
        });
        d.querySelectorAll('[style*="url("]').forEach((n) => n.removeAttribute('style'));

        fs.mkdirSync(SHOTS, { recursive: true });
        const file = path.join(SHOTS, name + '.html');
        fs.writeFileSync(file, '<!DOCTYPE html>\n' + d.documentElement.outerHTML);
        resolve(file);
      };
      if (!store) return finish();
      window.eval(contentJs);
      setTimeout(finish, 60);
    });
  });
}

async function main() {
  const browser = collect();
  if (!browser) {
    console.log('no Chrome or Chromium found -- skipping screenshots.');
    console.log('set CHROME_BIN to point at one.');
    process.exit(0);
  }
  console.log('rendering with:', browser.bin);

  for (const variant of VARIANTS) {
    const html = await build(variant.name, variant.store ? { ...variant.store } : {});
    const png = path.join(SHOTS, variant.name + '.png');
    const args = screenshotArgs(browser, {
      width: variant.width, height: variant.height, png
    }).concat([`file://${html}`]);
    try {
      execFileSync(browser.bin, args, { stdio: ['ignore', 'ignore', 'ignore'], timeout: 60000 });
      console.log(`  ${variant.name.padEnd(18)} -> tests/screenshots/${variant.name}.png`);
    } catch (err) {
      console.log(`  ${variant.name.padEnd(18)} -> screenshot failed (${err.message.split('\n')[0]})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
