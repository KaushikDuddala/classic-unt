/* classic-unt options page */

(function () {
  'use strict';

  var statusEl = document.getElementById('status');
  var panelPrivacy = document.getElementById('panel-privacy');
  var panelClassic = document.getElementById('panel-classic');
  var resetBtn = document.getElementById('reset');
  var statusTimer = 0;

  function notify(message) {
    statusEl.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () { statusEl.textContent = ''; }, 2200);
  }

  function load() {
    chrome.storage.sync.get(null, function (stored) {
      var s = fillDefaults(stored || {});
      render(s);
    });
  }

  function render(s) {
    var radios = document.querySelectorAll('input[name="mode"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === s.mode;

    /* Highlight the chosen card. Done in JS so the stylesheet does not need
       :has(), which older Firefox does not support. */
    var cards = document.querySelectorAll('.opt');
    for (var c = 0; c < cards.length; c++) {
      var input = cards[c].querySelector('input[name="mode"]');
      cards[c].classList.toggle('on', !!input && input.checked);
    }

    panelPrivacy.hidden = s.mode !== 'privacy';
    panelClassic.hidden = s.mode !== 'classic';

    var groups = document.querySelectorAll('[data-group]');
    for (var g = 0; g < groups.length; g++) {
      var input = groups[g];
      input.checked = !!s[input.dataset.group][input.dataset.key];
    }

    var tops = document.querySelectorAll('[data-top]');
    for (var t = 0; t < tops.length; t++) {
      var field = tops[t];
      if (field.type === 'checkbox') field.checked = !!s[field.dataset.top];
      else field.value = String(s[field.dataset.top]);
    }
  }

  function save(patch, message) {
    /* Read-modify-write so nested groups are never dropped. */
    chrome.storage.sync.get(null, function (stored) {
      var s = fillDefaults(stored || {});
      var key;

      for (key in patch) {
        if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
          var sub;
          for (sub in patch[key]) s[key][sub] = patch[key][sub];
        } else {
          s[key] = patch[key];
        }
      }

      chrome.storage.sync.set(s, function () {
        render(s);
        if (message) notify(message);
      });
    });
  }

  /* checkboxes give a boolean, selects give a string */
  function fieldValue(field) {
    return field.type === 'checkbox' ? field.checked : field.value;
  }

  function patchFromEvent(target) {
    if (target.name === 'mode') return { mode: target.value };
    if (target.dataset.group) {
      var group = {};
      group[target.dataset.key] = fieldValue(target);
      var out = {};
      out[target.dataset.group] = group;
      return out;
    }
    if (target.dataset.top) {
      var top = {};
      top[target.dataset.top] = fieldValue(target);
      return top;
    }
    return null;
  }

  document.addEventListener('change', function (ev) {
    var target = ev.target;
    if (!target) return;
    if (!target.name && !target.dataset.top && !target.dataset.group) return;
    var patch = patchFromEvent(target);
    if (patch) save(patch);
  });

  resetBtn.addEventListener('click', function () {
    chrome.storage.sync.set(DEFAULTS, function () {
      render(DEFAULTS);
      notify('Back to defaults.');
    });
  });

  load();
})();
