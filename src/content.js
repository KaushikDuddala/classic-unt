/* Applies one of two themes to the my.unt.edu homepage:
     privacy  cover account figures until hovered
     classic  icon boxes on the old background
     off      leave the page alone

   Content scripts can't be modules, so DEFAULTS is repeated in defaults.js.
   tests/manifests.test.js checks the two agree. */

(function () {
  'use strict';

  /* Settings */

  var DEFAULTS = {
    mode: 'classic',            // 'off' | 'privacy' | 'classic'
    removeBackground: true,     // drop the UNT background photo
    revealAll: false,           // reveal every masked value
    privacy: {
      profile: true,
      academics: true,
      billing: true,
      finaid: true,
      classes: true,
      tasks: true,
      admissions: true,
      heuristic: true
    },
    classic: {
      showProfileTile: false
    }
  };

  /* Values to cover in privacy mode, grouped so the options page can toggle
     them individually. Class names come from the tile markup. */

  var SENSITIVE = {
    profile: [
      '.GBSA_profile-header-photo',
      '.GBSA_profile-header-id',
      '.GBSA_profile-header-chip',
      '.GBSA_profile-header-name'
    ],
    academics: [
      '.GBSA_gpa',
      '.GBSA_standing',
      '.GBSA_term'
    ],
    billing: [
      '.GBSA_billpay-balance',
      '.GBSA_billpay-status'
    ],
    finaid: [
      '.GBSA_aid-total',
      '.GBSA_breakdown',
      '.GBSA_next-disbursement'
    ],
    classes: [
      '.GBSA_class-line',
      '.GBSA_enroll-alert',
      '.GBSA_appointment',
      '.GBSA_future-enrollment',
      '.GBSA_schedule-update'
    ],
    tasks: [
      '.GBSA_task-row'
    ],
    admissions: [
      '.psc_tile_livedata_item',
      '.psc_tile_livedata-descr'
    ]
  };

  /* Catches values whose class UNT has renamed. Leaf elements only, so a tile
     never gets swallowed whole. */
  var HEURISTIC = [
    /\$\s?\d/,                                   // $1,234.56
    /^\s*(ID|Student ID)\s*[:\-]?\s*\d/i,         // ID: 12345678
    /^\s*\d\.\d{2}\s*$/,                          // 4.00  (GPA)
    /^\s*(due\s+)?\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i, // 08/29/26
    /^\s*\d{6,}\s*$/                              // bare ID numbers
  ];

  var HEURISTIC_SCOPE = '.ps-htmlarea *, .psc_tile_livedata *';
  var HEURISTIC_LIMIT = 3000;

  /* Lets the heuristic above respect a group the user has switched off. */
  var TILE_CATEGORY = {
    GBSA_PROFILE_HDR_FL: 'profile',
    GBSA_ACADEMICS_TILE_FL: 'academics',
    GBSA_FINANCES_TILE_FL: 'billing',
    GBSA_FINAID_TILE_FL: 'finaid',
    GBSA_ENROLL_TILE_FL: 'classes',
    GBSA_TASKS_TILE_FL: 'tasks',
    GBGB_1: 'admissions',
    ADMISSIONS: 'admissions'
  };

  /* Classic tile icons + old myUNT labels */

  var SVG_OPEN = '<svg viewBox="0 0 48 48" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">';
  var SVG_CLOSE = '</svg>';

  var ICONS = {
    tasks:
      '<path d="M24 6 L43 39.5 H5 Z" fill="#F0A32B"/>' +
      '<path d="M24 6 L43 39.5 H5 Z" fill="none" stroke="#C57F10" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<rect x="22.3" y="17" width="3.4" height="12" rx="1.7" fill="#3A3A3A"/>' +
      '<circle cx="24" cy="33.6" r="2" fill="#3A3A3A"/>',

    admissions:
      '<path d="M6 18.5 L24 11 L42 18.5 L24 26 Z" fill="#3D4C93"/>' +
      '<path d="M12 22 V31.5 c0 3.1 5.4 5.6 12 5.6 s12-2.5 12-5.6 V22 L24 27.3 Z" fill="#2C3870"/>' +
      '<path d="M42 18.5 V29" stroke="#E8B32C" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
      '<circle cx="42" cy="31.6" r="2.8" fill="#E8B32C"/>',

    classes:
      '<rect x="4" y="7" width="26" height="18" rx="1.6" fill="#F4F6F9" stroke="#B7BFCC" stroke-width="1.6"/>' +
      '<path d="M8.5 12.5h11M8.5 16.5h16M8.5 20.5h9" stroke="#98A2B1" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="16" cy="31" r="4.4" fill="#2F6DB5"/><path d="M9 41.5c0-3.9 3.1-7 7-7s7 3.1 7 7z" fill="#2F6DB5"/>' +
      '<circle cx="28.5" cy="32" r="4" fill="#E0674A"/><path d="M22.2 41.5c0-3.5 2.8-6.3 6.3-6.3s6.3 2.8 6.3 6.3z" fill="#E0674A"/>' +
      '<circle cx="39.5" cy="33.5" r="3.5" fill="#4FA88B"/><path d="M34.3 41.5c0-2.9 2.3-5.2 5.2-5.2s5.2 2.3 5.2 5.2z" fill="#4FA88B"/>',

    academics:
      '<path d="M7 15a2 2 0 0 1 2-2h9.4l4.2 4H39a2 2 0 0 1 2 2v3H7z" fill="#D9B36B"/>' +
      '<path d="M10 19.5h30V36a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="#EBCF95"/>' +
      '<rect x="15" y="8.5" width="19" height="14" rx="1.6" fill="#FFFFFF" stroke="#D3D8E0" stroke-width="1.5"/>' +
      '<path d="M18.5 13h12M18.5 16.6h9M18.5 20.2h7" stroke="#C1C9D4" stroke-width="1.5" stroke-linecap="round"/>',

    finaid:
      '<path d="M5 17.5 L24 10 L43 17.5 L24 25 Z" fill="#3D4C93"/>' +
      '<path d="M11 21 V30.5 c0 3.1 5.8 5.6 13 5.6 s13-2.5 13-5.6 V21 L24 26.3 Z" fill="#2C3870"/>' +
      '<path d="M30 28.6c0-1.7-1.7-2.5-3.8-2.5-2.1 0-3.6.9-3.6 2.4 0 3.4 7 1.7 7 5.3 0 1.6-1.6 2.6-3.8 2.6-2.3 0-3.9-.9-4.2-2.4" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round"/>' +
      '<path d="M26.6 23.2v14.2" stroke="#E8B32C" stroke-width="2.1" stroke-linecap="round"/>' +
      '<path d="M43 17.5 V27" stroke="#E8B32C" stroke-width="2.1" stroke-linecap="round" fill="none"/>',

    billing:
      '<path d="M5 17 L24 8 L43 17 Z" fill="#98A1AF"/>' +
      '<rect x="7.5" y="18.5" width="33" height="3.4" fill="#B7BEC9"/>' +
      '<rect x="11" y="23" width="4.4" height="12" fill="#C6CCD4"/>' +
      '<rect x="19.3" y="23" width="4.4" height="12" fill="#C6CCD4"/>' +
      '<rect x="27.6" y="23" width="4.4" height="12" fill="#C6CCD4"/>' +
      '<rect x="35" y="23" width="4.4" height="12" fill="#C6CCD4"/>' +
      '<rect x="6" y="35.5" width="36" height="4.4" rx="1.2" fill="#AAB2BD"/>' +
      '<ellipse cx="38" cy="41" rx="7.5" ry="3.2" fill="#E8B32C"/>' +
      '<ellipse cx="38" cy="38.6" rx="7.5" ry="3.2" fill="#F2C94C"/>',

    support:
      '<circle cx="17" cy="15" r="5.6" fill="#8C7BD8"/>' +
      '<path d="M7.5 34c0-5.2 4.3-9.5 9.5-9.5s9.5 4.3 9.5 9.5v1.5H7.5z" fill="#6E5BC4"/>' +
      '<circle cx="32" cy="17" r="5.2" fill="#F0B27A"/>' +
      '<path d="M23.6 34c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4v1.5H23.6z" fill="#E0914F"/>',

    tools:
      '<rect x="5" y="5" width="16" height="16" rx="2" fill="#4FA88B"/>' +
      '<rect x="27" y="5" width="16" height="16" rx="2" fill="#3E8C74"/>' +
      '<rect x="5" y="27" width="16" height="16" rx="2" fill="#3E8C74"/>' +
      '<rect x="27" y="27" width="16" height="16" rx="2" fill="#2F6F5C"/>',

    profile:
      '<circle cx="21" cy="21" r="16" fill="#DDE1E7"/>' +
      '<circle cx="21" cy="17.5" r="6" fill="#98A1AF"/>' +
      '<path d="M10 34c0-6 5-10 11-10s11 4 11 10z" fill="#98A1AF"/>' +
      '<circle cx="34" cy="33" r="8.6" fill="#3FA971"/>' +
      '<path d="M30 33.2l2.8 2.8L38.6 29.8" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',

    add:
      '<circle cx="24" cy="24" r="16" fill="#4CAF50"/>' +
      '<path d="M24 15.5v17M15.5 24h17" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>',

    default:
      '<path d="M5 13.5A2 2 0 0 1 7 11.5h11l4.5 5H41a2 2 0 0 1 2 2v3H5z" fill="#C6CCD4"/>' +
      '<path d="M8 19h32v16.5a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#DDE1E7"/>'
  };

  /* Old myUNT tile names, by grouplet id. Anything absent keeps the name the page gives it. */
  var CLASSIC_LABELS = {
    GBSA_PROFILE_HDR_FL: 'Profile',
    GBSA_TASKS_TILE_FL: 'Tasks',
    GBSA_FINANCES_TILE_FL: 'Student Account',
    GBSA_ACADEMICS_TILE_FL: 'Academic Records',
    GBSA_ENROLL_TILE_FL: 'Enrollment',
    GBSA_FINAID_TILE_FL: 'Financial Aid & Scholarships',
    GBGB_1: 'Admissions',
    ADMISSIONS: 'Admissions'
    /* Campus Tools and Student Support have no old counterpart, so they keep
       the name the page gives them. */
  };

  /* Which icon each grouplet gets. Order matters: first match wins. */
  var CLASSIC_ICONS = [
    [/PROFILE/i, 'profile'],
    [/TASK/i, 'tasks'],
    [/FINANCE|ACCT|BILL|PAYMENT/i, 'billing'],
    [/ACADEM|RECORD|GRADE/i, 'academics'],
    [/ENROLL|CLASS|REGISTR|SSR/i, 'classes'],
    [/FINAID|AID|SCHOLAR|LOAN/i, 'finaid'],
    [/ADMISSION|APPL/i, 'admissions'],
    [/SUPPORT|ADVIS|COUNSEL/i, 'support'],
    [/TOOL|CAMPUS|EMAIL|FORM/i, 'tools']
  ];

  /* State */

  var ROOT = document.documentElement;
  var state = null;
  var ready = false;
  var bgTouched = [];
  var lastRemoveBackground = null;
  var pendingApply = 0;
  var observer = null;

  function isObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function deepMerge(base, over) {
    var out = {};
    var k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    }
    if (!isObject(over)) return out;
    for (k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      if (isObject(base[k]) && isObject(over[k])) out[k] = deepMerge(base[k], over[k]);
      else if (over[k] !== undefined) out[k] = over[k];
    }
    return out;
  }

  function readSettings(done) {
    chrome.storage.sync.get(DEFAULTS, function (items) {
      state = deepMerge(DEFAULTS, items);
      done();
    });
  }

  /* Option 1: masks */

  function isVisible(el) {
    if (!el.getClientRects || el.getClientRects().length === 0) return false;
    return !el.closest('.psc_hidden, .GBSA_hidden, [aria-hidden="true"]');
  }

  function maskElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.classList.contains('classic-unt-mask')) return;
    if (el.hasAttribute('data-classic-unt-revealed')) return;
    if (el.closest('.classic-unt-mask')) return;          // never nest masks
    if (!isVisible(el)) return;                      // nothing to protect
    el.classList.add('classic-unt-mask');
    el.setAttribute('title', 'Hover to read it, click to keep it visible');
    el.setAttribute('data-classic-unt-mask', '1');
  }

  function clearMasks() {
    var nodes = document.querySelectorAll('.classic-unt-mask');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove('classic-unt-mask');
      nodes[i].removeAttribute('data-classic-unt-mask');
      nodes[i].removeAttribute('title');
    }
    var revealed = document.querySelectorAll('[data-classic-unt-revealed]');
    for (var j = 0; j < revealed.length; j++) {
      revealed[j].removeAttribute('data-classic-unt-revealed');
    }
  }

  function applyMasks() {
    var selectors = [];
    var key;
    for (key in SENSITIVE) {
      if (state.privacy[key] && SENSITIVE[key]) selectors = selectors.concat(SENSITIVE[key]);
    }

    if (selectors.length) {
      var picked = document.querySelectorAll(selectors.join(','));
      /* A group may list both a wrapper and its inner value; take the
         innermost so masks never stack. */
      for (var i = 0; i < picked.length; i++) {
        var outer = false;
        for (var j = 0; j < picked.length; j++) {
          if (i !== j && picked[i].contains(picked[j])) { outer = true; break; }
        }
        if (!outer) maskElement(picked[i]);
      }
    }

    if (!state.privacy.heuristic) return;

    /* Leaf-only so we never swallow a whole tile. */
    var leaves = document.querySelectorAll(HEURISTIC_SCOPE);
    var limit = Math.min(leaves.length, HEURISTIC_LIMIT);
    for (var n = 0; n < limit; n++) {
      var el = leaves[n];
      if (el.childElementCount !== 0) continue;

      /* Respect a group the user switched off. */
      var tile = el.closest ? el.closest('.nuilp[groupletid]') : null;
      var groupletId = tile ? (tile.getAttribute('groupletid') || '').toUpperCase() : '';
      var group = TILE_CATEGORY[groupletId];
      if (group && state.privacy[group] === false) continue;

      var text = (el.textContent || '').trim();
      if (!text || text.length > 60) continue;
      for (var p = 0; p < HEURISTIC.length; p++) {
        if (HEURISTIC[p].test(text)) { maskElement(el); break; }
      }
    }
  }

  /* Reveal the one value, without letting the tile's own handler fire. */
  function onClick(ev) {
    var target = ev.target;
    if (!target || !target.closest) return;
    var masked = target.closest('.classic-unt-mask');
    if (!masked) return;
    ev.stopPropagation();
    ev.preventDefault();
    masked.setAttribute('data-classic-unt-revealed', '1');
  }

  /* Option 2: classic tiles */

  function tileLabel(tile, groupletId) {
    if (CLASSIC_LABELS[groupletId]) return CLASSIC_LABELS[groupletId];
    var holder = tile.querySelector('.ps_groupleth');
    var text = holder ? (holder.textContent || '').trim() : '';
    return text || groupletId || 'Tile';
  }

  function tileIcon(groupletId, label) {
    var probe = groupletId + ' ' + label;
    for (var i = 0; i < CLASSIC_ICONS.length; i++) {
      if (CLASSIC_ICONS[i][0].test(probe)) return CLASSIC_ICONS[i][1];
    }
    return 'default';
  }

  var tileHomes = new Map();   // tile -> the grid cell it came from

  /* PeopleSoft lays its grid out with floats and absolute positioning for
     drag, resize and the homepage swipe, which fights anything imposed on top
     of it. So classic mode moves the tiles into a container of our own and
     puts them back on the way out. They are the same elements, so they still
     open their section when clicked. */
  function ensureTileGrid() {
    var tiles = document.querySelectorAll('.nuilp[groupletid]');
    if (!tiles.length) return null;

    var host = tiles[0].closest('.ps_box-scrollarea-row') || tiles[0].parentNode;
    if (!host) return null;

    var grid = null;
    var kids = host.children;
    for (var c = 0; c < kids.length; c++) {
      if (kids[c].classList.contains('classic-unt-tile-grid')) { grid = kids[c]; break; }
    }
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'classic-unt-tile-grid';
      host.appendChild(grid);
    }

    /* The old layout had no profile box, so leave it in the page grid where
         the stylesheet can hide its row. */
    var showProfile = !!state.classic.showProfileTile;

    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var gid = tile.getAttribute('groupletid') || '';
      if (!showProfile && gid.toUpperCase().indexOf('PROFILE') !== -1) continue;
      if (!tileHomes.has(tile)) tileHomes.set(tile, tile.parentNode);
      if (tile.parentNode !== grid) grid.appendChild(tile);
    }

    /* Lets the stylesheet drop the page grid, now empty. A class rather than
         :has(), which older Firefox discards along with the whole rule. */
    host.classList.add('classic-unt-tiles-moved');
    return grid;
  }

  function teardownTileGrid() {
    tileHomes.forEach(function (home, tile) {
      if (home && home.isConnected && tile.isConnected) home.appendChild(tile);
    });
    tileHomes.clear();

    var hosts = document.querySelectorAll('.classic-unt-tiles-moved');
    for (var h = 0; h < hosts.length; h++) hosts[h].classList.remove('classic-unt-tiles-moved');

    var grids = document.querySelectorAll('.classic-unt-tile-grid');
    for (var i = 0; i < grids.length; i++) grids[i].parentNode.removeChild(grids[i]);
  }

  function buildClassicTiles() {
    var tiles = document.querySelectorAll('.nuilp[groupletid]');
    if (!tiles.length) return;

    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var groupletId = tile.getAttribute('groupletid') || '';
      var label = tileLabel(tile, groupletId);

      var box = null;
      for (var c = 0; c < tile.children.length; c++) {
        if (tile.children[c].classList.contains('classic-unt-box')) {
          box = tile.children[c];
          break;
        }
      }

      if (!box) {
        box = document.createElement('div');
        box.className = 'classic-unt-box';
        /* label first, then the icon; the old tiles read name-then-picture */
        box.innerHTML =
          '<span class="classic-unt-label"></span>' +
          '<span class="classic-unt-icon">' + SVG_OPEN +
          ICONS[tileIcon(groupletId, label)] + SVG_CLOSE +
          '</span>';
        tile.insertBefore(box, tile.firstChild);
      }

      var labelEl = box.querySelector('.classic-unt-label');
      if (labelEl && labelEl.textContent !== label) labelEl.textContent = label;
    }

    ensureTileGrid();
  }

  function clearClassicTiles() {
    teardownTileGrid();
    var boxes = document.querySelectorAll('.classic-unt-box');
    for (var i = 0; i < boxes.length; i++) boxes[i].parentNode.removeChild(boxes[i]);
  }

  /* Background image */

  var BG_KNOWN = [
    'html', 'body', '#PT_WRAPPER', '.ps_wrapper', '#PT_HEADER', '.ps_header',
    '#PT_MID_SECTION', '#PT_CONTENT', '#PT_MAIN', '.ps_pagecontainer',
    '.ps_pspagecontainer', '#PT_FOOTER', '.ps_footer', '.pt_homepage',
    '.nuitilegrid', '.ps_box-scrollarea', '.lptab-cont', '.ps_grid-div',
    '.ps_grid-body'
  ].join(',');

  function restoreBackgrounds() {
    for (var i = 0; i < bgTouched.length; i++) {
      bgTouched[i].style.removeProperty('background-image');
    }
    bgTouched = [];
  }

  function killBackgrounds() {
    if (!document.body) return;

    /* Containers the site is known to paint. */
    var known = new Set(document.querySelectorAll(BG_KNOWN));

    var viewport = window.innerWidth || 1280;
    var all = document.querySelectorAll('body, body *');
    var hits = [];

    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.nodeType !== 1) continue;
      if (el.classList && el.classList.contains('nuilp')) continue;
      /* Leave the tiles' own artwork alone. */
      if (el.closest && el.closest('.ps_box-grouplet')) continue;

      var isKnown = known.has(el);
      var wide = el.offsetWidth >= viewport * 0.5 && el.offsetHeight >= 120;
      if (!isKnown && !wide) continue;

      var bg = window.getComputedStyle(el).backgroundImage;
      if (!bg || bg === 'none' || bg.indexOf('url(') === -1) continue;

      el.style.setProperty('background-image', 'none', 'important');
      hits.push(el);
    }

    bgTouched = hits;
  }

  function applyBackground(mode) {
    var want = mode !== 'off' && !!state.removeBackground;
    ROOT.classList.toggle('classic-unt-nobg', want);
    if (want === lastRemoveBackground) return;
    lastRemoveBackground = want;
    restoreBackgrounds();
    if (want) killBackgrounds();
  }

  /* Apply */

  function applyClasses(mode) {
    ROOT.classList.toggle('classic-unt-mode-privacy', mode === 'privacy');
    ROOT.classList.toggle('classic-unt-mode-classic', mode === 'classic');
    ROOT.classList.toggle('classic-unt-reveal-all', mode === 'privacy' && !!state.revealAll);
    ROOT.classList.toggle('classic-unt-show-profile', mode === 'classic' && !!state.classic.showProfileTile);
  }

  /* Only the frame holding the tile grid gets restyled; inner pages such as
     billing keep their normal look. */
  function isHomepageHost() {
    return !!document.getElementById('PT_PANEL2_MAIN') ||
      !!document.querySelector('.nuilp[groupletid]');
  }

  function apply(reset) {
    if (!state) return;

    var mode = isHomepageHost() ? state.mode : 'off';

    applyClasses(mode);
    applyBackground(mode);

    if (mode === 'privacy') {
      if (reset) clearMasks();
      applyMasks();
    } else if (reset || document.querySelector('.classic-unt-mask')) {
      clearMasks();
    }

    if (mode === 'classic') {
      buildClassicTiles();
    } else if (document.querySelector('.classic-unt-box')) {
      clearClassicTiles();
    }
  }

  function scheduleApply() {
    if (pendingApply) return;
    pendingApply = window.setTimeout(function () {
      pendingApply = 0;
      apply(false);
    }, 200);
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(scheduleApply);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* Boot */

  function boot() {
    readSettings(function () {
      ready = true;
      apply(true);
      startObserver();
    });
  }

  document.addEventListener('click', onClick, true);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'sync') return;
    readSettings(function () {
      if (ready) apply(true);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
