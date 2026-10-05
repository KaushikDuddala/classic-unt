/* classic-unt toolbar popup */

(function () {
  'use strict';

  var NOTES = {
    privacy: 'Specifics are covered until you point at them.',
    classic: 'One box per section, old light background.',
    off: 'my.unt.edu is untouched.'
  };

  var buttons = document.querySelectorAll('.modes button');
  var noteEl = document.getElementById('note');
  var bgToggle = document.getElementById('bg');
  var revealToggle = document.getElementById('reveal');
  var revealRow = document.getElementById('revealRow');
  var optionsLink = document.getElementById('options');

  function render(s) {
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].dataset.mode === s.mode;
      buttons[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
    noteEl.textContent = NOTES[s.mode] || '';
    bgToggle.checked = !!s.removeBackground;
    bgToggle.disabled = s.mode === 'off';
    revealRow.hidden = s.mode !== 'privacy';
    revealToggle.checked = !!s.revealAll;
  }

  function update(patch) {
    chrome.storage.sync.get(null, function (stored) {
      var s = fillDefaults(stored || {});
      var key;
      for (key in patch) s[key] = patch[key];
      chrome.storage.sync.set(s, function () { render(s); });
    });
  }

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function (ev) {
      update({ mode: ev.currentTarget.dataset.mode });
    });
  }

  bgToggle.addEventListener('change', function () {
    update({ removeBackground: bgToggle.checked });
  });

  revealToggle.addEventListener('change', function () {
    update({ revealAll: revealToggle.checked });
  });

  optionsLink.addEventListener('click', function (ev) {
    ev.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.sync.get(null, function (stored) {
    render(fillDefaults(stored || {}));
  });
})();
