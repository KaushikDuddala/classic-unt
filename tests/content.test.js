/* Runs the real content.js against the saved homepage markup: both modes, the
   settings round trip, and the frame guard.

   node tests/content.test.js
*/

const { createReporter, loadPage, pageHtml } = require('./helpers');

const t = createReporter('classic-unt content script');

/* An inner component frame: PT_WRAPPER and PT_CONTENT but no tile grid, so it must never be restyled. */
const INNER_FRAME =
  '<!DOCTYPE html><html><head><title>Billing</title></head><body>' +
  '<div id="PT_WRAPPER" class="ps_wrapper"><div class="ps_mid_section" id="PT_MID_SECTION">' +
  '<div class="ps_content" id="PT_CONTENT"><div class="ps_main" id="PT_MAIN">' +
  '<div class="ps_pagecontainer"><p>$0.00</p></div></div></div></div></div></body></html>';

async function main() {
  if (!pageHtml) {
    console.log('skipped: tests/fixtures/homepage.html is missing');
    process.exit(0);
  }

  /* ------------------------------------------------ option 1: privacy */
  t.section('option 1: hide the specifics');
  {
    const store = { mode: 'privacy' };
    const { window, d } = await loadPage(store);
    const masked = (sel) => d.querySelectorAll(sel + '.classic-unt-mask').length;

    t.check('html has mode class', d.documentElement.classList.contains('classic-unt-mode-privacy'), true);
    t.check('no blur styling class', d.documentElement.className.indexOf('classic-unt-mask-blur'), -1);
    t.check('html removes background', d.documentElement.classList.contains('classic-unt-nobg'), true);

    t.check('GPA masked', masked('.GBSA_gpa'), 1);
    t.check('standing masked', masked('.GBSA_standing'), 1);
    t.check('prior term masked', masked('.GBSA_term'), 1);
    t.check('balance masked', masked('.GBSA_billpay-balance'), 1);
    t.check('due date masked', masked('.GBSA_billpay-status'), 1);
    t.check('aid total masked', masked('.GBSA_aid-total'), 1);
    t.check('aid breakdown masked', masked('.GBSA_breakdown'), 1);
    t.check('student ID masked', masked('.GBSA_profile-header-id'), 1);
    t.check('profile chip masked', masked('.GBSA_profile-header-chip'), 1);
    t.check('profile photo masked', masked('.GBSA_profile-header-photo'), 1);
    t.check('class lines masked', masked('.GBSA_class-line'), 2);
    t.check('cart alert masked', masked('.GBSA_enroll-alert'), 1);
    t.check('appointment masked', masked('.GBSA_appointment'), 1);
    t.check('task rows masked', masked('.GBSA_task-row'), 3);
    t.check('admissions status masked', masked('.psc_tile_livedata_item'), 1);

    // masking the wrapper is enough, the inner rows must not stack on it
    t.check('award rows not double-masked', masked('.GBSA_finaid-award-row'), 0);
    t.check('whole task list not double-masked', masked('.GBSA_tasks-list'), 0);

    // labels and links have to survive
    t.check('"Payment Due" label stays visible', masked('.GBSA_billpay-label'), 0);
    t.check('"Pay now" link stays clickable', masked('.GBSA_button-primary'), 0);
    t.check('tile labels stay visible', masked('.GBSA_label'), 0);
    t.check('course codes stay visible', masked('.GBSA_course-code'), 0);
    t.check('class times stay visible', masked('.GBSA_class-time'), 0);
    t.check('tool links stay visible', masked('.GBSA_tool-grid a'), 0);
    t.check('support cards stay visible', masked('.GBSA_support-card'), 0);

    // hover reveals, click pins, and a click must not launch the tile
    const gpa = d.querySelector('.GBSA_gpa');
    const tile = d.querySelector('.nuilp[groupletid="GBSA_ACADEMICS_TILE_FL"]');
    let launched = 0;
    tile.addEventListener('click', () => launched++);
    gpa.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    t.check('GPA revealed on click', gpa.getAttribute('data-classic-unt-revealed'), '1');
    t.check('GPA still carries mask class', gpa.classList.contains('classic-unt-mask'), true);
    t.check('tile launch suppressed', launched, 0);

    d.querySelector('.GBSA_academic-actions').dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    t.check('unmasked clicks still bubble', launched, 1);

    // a group the user switched off stays visible, heuristic included
    store.privacy = Object.assign({}, store.privacy, { billing: false });
    window.__touchStorage();
    t.check('balance unmasked when group off', masked('.GBSA_billpay-balance'), 0);
    t.check('GPA re-masked after reset', masked('.GBSA_gpa'), 1);
  }

  /* ------------------------------------------------- option 2: classic */
  t.section('option 2: classic layout');
  {
    const store = { mode: 'classic' };
    const { window, d } = await loadPage(store);

    t.check('mode class', d.documentElement.classList.contains('classic-unt-mode-classic'), true);
    t.check('privacy class absent', d.documentElement.classList.contains('classic-unt-mode-privacy'), false);
    t.check('profile box hidden by default', d.documentElement.classList.contains('classic-unt-show-profile'), false);
    t.check('no masks in classic mode', d.querySelectorAll('.classic-unt-mask').length, 0);

    let boxes = Array.from(d.querySelectorAll('.classic-unt-box'));
    t.check('one box per tile', boxes.length, 9);
    t.check('classic tile labels', boxes.map((b) => b.querySelector('.classic-unt-label').textContent), [
      'Profile', 'Tasks', 'Student Account', 'Academic Records', 'Enrollment',
      'Financial Aid & Scholarships', 'Admissions', 'Campus Tools', 'Student Support'
    ]);
    t.check('every box has an icon', boxes.filter((b) => b.querySelector('svg')).length, 9);
    t.check('icons are varied',
      new Set(boxes.map((b) => b.querySelector('svg').innerHTML)).size >= 7, true);
    t.check('box lives inside the tile',
      Array.from(d.querySelectorAll('.nuilp')).every((t2) => t2.firstElementChild.classList.contains('classic-unt-box')), true);
    t.check('accessible label preserved', d.querySelectorAll('.nuilp > .ps_groupleth').length, 9);

    // tiles move into a container we own rather than being restyled in place
    t.check('one grid container', d.querySelectorAll('.classic-unt-tile-grid').length, 1);
    t.check('tiles moved into the grid', d.querySelectorAll('.classic-unt-tile-grid > .nuilp').length, 8);
    t.check('profile tile stays in the page grid',
      d.querySelectorAll('.GBSA_profile-header-row .nuilp').length, 1);
    t.check('the page tile rows are left empty',
      d.querySelectorAll('.nuitilegrid .ps_grid-row .nuilp').length, 0);
    /* the class that lets the stylesheet hide the now-empty page grid */
    t.check('tile host flagged so the scaffolding can be hidden',
      d.querySelectorAll('.lptab-cont.classic-unt-tiles-moved').length, 1);
    t.check('tile order preserved',
      Array.from(d.querySelectorAll('.classic-unt-tile-grid > .nuilp')).map((x) => x.getAttribute('groupletid')),
      ['GBSA_TASKS_TILE_FL', 'GBSA_FINANCES_TILE_FL', 'GBSA_ACADEMICS_TILE_FL',
       'GBSA_ENROLL_TILE_FL', 'GBSA_FINAID_TILE_FL', 'GBGB_1',
       'GBSA_CAMPUSTOOLS_TILE_FL', 'GBSA_SUPPORT_TILE_FL']);

    // grouplets reload over ajax, so applying again must be idempotent
    window.__touchStorage();
    window.__touchStorage();
    t.check('still one box per tile after re-apply', d.querySelectorAll('.classic-unt-box').length, 9);
    t.check('still exactly one grid container', d.querySelectorAll('.classic-unt-tile-grid').length, 1);

    // a tile that arrives later joins the grid too
    const tileGrid = d.querySelector('.nuitilegrid .ps_grid-body');
    const late = d.createElement('div');
    late.className = 'ps_grid-row nuitile rsz_w1 rsz_h1';
    late.innerHTML = '<div class="ps_grid-cell"><div class="nuilp" groupletid="GBSA_NEW_TILE_FL" tabindex="0">' +
      '<div class="ps_groupleth"><span class="ps-label">Brand New</span></div>' +
      '<div class="ps_box-grouplet"></div></div></div>';
    tileGrid.appendChild(late);
    window.__touchStorage();

    boxes = Array.from(d.querySelectorAll('.classic-unt-box'));
    t.check('late tile gets a box', boxes.length, 10);
    t.check('late tile moved into the grid',
      d.querySelectorAll('.classic-unt-tile-grid > .nuilp[groupletid="GBSA_NEW_TILE_FL"]').length, 1);
    t.check('late tile label from groupleth',
      boxes[boxes.length - 1].querySelector('.classic-unt-label').textContent, 'Brand New');
    t.check('unknown tile falls back to folder icon',
      boxes[boxes.length - 1].querySelector('svg').innerHTML.includes('DDE1E7'), true);

    store.classic = { showProfileTile: true };
    window.__touchStorage();
    t.check('profile box now shown', d.documentElement.classList.contains('classic-unt-show-profile'), true);
    t.check('profile tile joins the grid when shown',
      d.querySelectorAll('.classic-unt-tile-grid > .nuilp').length, 10);
    t.check('profile label',
      d.querySelector('.nuilp[groupletid="GBSA_PROFILE_HDR_FL"] .classic-unt-label').textContent,
      'Profile');
  }

  /* --------------------------------------- switching back out again */
  t.section('switching away from classic');
  {
    const store = { mode: 'classic' };
    const { window, d } = await loadPage(store);
    t.check('tiles moved into the grid',
      d.querySelectorAll('.classic-unt-tile-grid > .nuilp').length, 8);

    store.mode = 'privacy';
    window.__touchStorage();
    t.check('grid container removed', d.querySelectorAll('.classic-unt-tile-grid').length, 0);
    t.check('tile host flag removed', d.querySelectorAll('.classic-unt-tiles-moved').length, 0);
    t.check('injected boxes removed', d.querySelectorAll('.classic-unt-box').length, 0);
    t.check('tiles put back in the page grid', d.querySelectorAll('.ps_grid-row .nuilp').length, 9);
    t.check('profile tile put back too',
      d.querySelectorAll('.GBSA_profile-header-row .nuilp').length, 1);
    t.check('privacy masks applied after the switch',
      d.querySelectorAll('.GBSA_gpa.classic-unt-mask').length, 1);
  }

  /* ------------------------------------------------------- mode: off */
  t.section('off');
  {
    const store = { mode: 'off' };
    const { d } = await loadPage(store);
    t.check('no extension classes', /classic-unt-mode|classic-unt-mask|classic-unt-nobg/.test(d.documentElement.className), false);
    t.check('no injected boxes', d.querySelectorAll('.classic-unt-box').length, 0);
    t.check('no masks', d.querySelectorAll('.classic-unt-mask').length, 0);
  }

  /* ------------------------------------------- background photo removal */
  t.section('background photo removal');
  {
    const store = { removeBackground: true };
    const { window, d } = await loadPage(store);

    const style = d.createElement('style');
    style.textContent = '#PT_WRAPPER { background-image: url("/cs/ps/cache_86120/UNT_BG.png"); }';
    d.head.appendChild(style);
    const wrapper = d.getElementById('PT_WRAPPER');

    store.removeBackground = false; window.__touchStorage();
    t.check('background kept when setting off',
      wrapper.style.getPropertyValue('background-image'), '');

    store.removeBackground = true; window.__touchStorage();
    t.check('background cleared when setting on',
      wrapper.style.getPropertyValue('background-image'), 'none');

    store.removeBackground = false; window.__touchStorage();
    t.check('background restored when setting off again',
      wrapper.style.getPropertyValue('background-image'), '');
  }

  /* ------------------------------------- inner frames are left alone */
  t.section('a frame without the tile grid (e.g. Billing)');
  {
    const store = { mode: 'classic' };
    const { d } = await loadPage(store, INNER_FRAME);
    t.check('no classic class on an inner frame',
      d.documentElement.classList.contains('classic-unt-mode-classic'), false);
    t.check('no background override on an inner frame',
      d.documentElement.classList.contains('classic-unt-nobg'), false);
    t.check('no boxes injected into an inner frame',
      d.querySelectorAll('.classic-unt-box').length, 0);
  }

  process.exit(t.finish() ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
