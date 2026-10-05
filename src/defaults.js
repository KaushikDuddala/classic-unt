/* Defaults for the extension's pages and background script. content.js keeps
   its own copy, since content scripts can't require() anything. */

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

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/* Fill in any key that storage is missing, without clobbering saved choices. */
function fillDefaults(stored) {
  var merged = JSON.parse(JSON.stringify(DEFAULTS));
  var key;

  for (key in stored) {
    if (!Object.prototype.hasOwnProperty.call(stored, key)) continue;
    if (isObject(DEFAULTS[key]) && isObject(stored[key])) {
      var sub;
      for (sub in stored[key]) {
        if (Object.prototype.hasOwnProperty.call(stored[key], sub)) {
          merged[key][sub] = stored[key][sub];
        }
      }
    } else if (stored[key] !== undefined) {
      merged[key] = stored[key];
    }
  }

  return merged;
}
