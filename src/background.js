/* Fills in any settings storage is missing, on install.

   A service worker on Chromium, a background page on Firefox and Safari, where
   the manifest lists defaults.js first instead of using importScripts(). */

if (typeof importScripts === 'function') importScripts('defaults.js');

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.sync.get(null, function (stored) {
      chrome.storage.sync.set(fillDefaults(stored || {}));
    });
  });
}
