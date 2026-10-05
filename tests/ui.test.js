/* Drives options.html and popup.html with their real inline scripts.

   node tests/ui.test.js
*/

const { createReporter, loadExtensionPage } = require('./helpers');

const t = createReporter('classic-unt settings UI');

const tick = () => new Promise((r) => setTimeout(r, 25));

function fire(window, el, type) {
  el.dispatchEvent(new window.Event(type, { bubbles: true }));
}

async function main() {
  /* ---------------------------------------------------- options page */
  t.section('options page');
  {
    const store = { mode: 'classic', privacy: { billing: false, tasks: true } };
    const { window, d } = await loadExtensionPage('options.html', store);
    const q = (s) => d.querySelector(s);

    t.check('classic radio checked', q('input[name="mode"][value="classic"]').checked, true);
    t.check('privacy panel hidden in classic', q('#panel-privacy').hidden, true);
    t.check('classic panel shown', q('#panel-classic').hidden, false);
    t.check('billing checkbox reflects stored value',
      q('[data-group="privacy"][data-key="billing"]').checked, false);
    t.check('tasks checkbox reflects stored value',
      q('[data-group="privacy"][data-key="tasks"]').checked, true);
    t.check('partially stored privacy group is completed',
      q('[data-group="privacy"][data-key="academics"]').checked, true);
    t.check('cover-style control removed', q('[data-top="maskStyle"]'), null);
    /* the selected card is highlighted by a class, not by :has() */
    t.check('selected card is highlighted',
      d.querySelectorAll('.opt.on').length, 1);
    t.check('the highlighted card is the classic one',
      d.querySelector('.opt.on input').value, 'classic');

    // switch to privacy mode
    const radio = q('input[name="mode"][value="privacy"]');
    radio.checked = true;
    fire(window, radio, 'change');
    await tick();
    t.check('mode saved', store.mode, 'privacy');
    t.check('privacy panel now shown', q('#panel-privacy').hidden, false);
    t.check('classic panel now hidden', q('#panel-classic').hidden, true);
    t.check('highlight followed the selection',
      d.querySelector('.opt.on input').value, 'privacy');

    // a nested checkbox must not drop its siblings
    const gpa = q('[data-group="privacy"][data-key="academics"]');
    gpa.checked = false;
    fire(window, gpa, 'change');
    await tick();
    t.check('nested setting saved without dropping siblings', store.privacy, {
      profile: true, academics: false, billing: false, finaid: true,
      classes: true, tasks: true, admissions: true, heuristic: true
    });

    // top-level checkbox
    const bg = q('[data-top="removeBackground"]');
    bg.checked = false;
    fire(window, bg, 'change');
    await tick();
    t.check('background toggle saved', store.removeBackground, false);

    // a <select> has to be read with .value, not .checked
    store.classic = store.classic || {};
    const profileTile = q('[data-group="classic"][data-key="showProfileTile"]');
    profileTile.checked = true;
    fire(window, profileTile, 'change');
    await tick();
    t.check('profile toggle saved', store.classic.showProfileTile, true);

    // reset
    q('#reset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await tick();
    t.check('reset restores the default mode', store.mode, 'classic');
    t.check('reset restores background', store.removeBackground, true);
    t.check('reset restores profile toggle', store.classic.showProfileTile, false);
    t.check('reset re-checks the radios', q('input[name="mode"][value="classic"]').checked, true);
  }

  /* ---------------------------------------------------------- popup */
  t.section('popup');
  {
    const store = {};
    const { window, d } = await loadExtensionPage('popup.html', store);
    const btn = (m) => d.querySelector(`.modes button[data-mode="${m}"]`);

    t.check('classic is the default mode', btn('classic').getAttribute('aria-checked'), 'true');
    t.check('privacy not selected', btn('privacy').getAttribute('aria-checked'), 'false');
    t.check('note shown', d.querySelector('#note').textContent.length > 0, true);
    t.check('background toggle on', d.querySelector('#bg').checked, true);
    t.check('reveal row hidden in classic', d.querySelector('#revealRow').hidden, true);

    btn('privacy').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await tick();
    t.check('clicking Privacy saves the mode', store.mode, 'privacy');
    t.check('privacy button now selected', btn('privacy').getAttribute('aria-checked'), 'true');
    t.check('reveal row appears in privacy mode', d.querySelector('#revealRow').hidden, false);
    t.check('background toggle usable in privacy', d.querySelector('#bg').disabled, false);
    t.check('note updated', d.querySelector('#note').textContent,
      'Specifics are covered until you point at them.');

    const bg = d.querySelector('#bg');
    bg.checked = false;
    fire(window, bg, 'change');
    await tick();
    t.check('background toggle saved', store.removeBackground, false);

    btn('off').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await tick();
    t.check('off mode saved', store.mode, 'off');
    t.check('off disables the background toggle', d.querySelector('#bg').disabled, true);
    t.check('previous background choice kept', store.removeBackground, false);

    let opened = 0;
    window.chrome.runtime.openOptionsPage = () => opened++;
    d.querySelector('#options').dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    t.check('options link opens the options page', opened, 1);
  }

  process.exit(t.finish() ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
