/* Measures the classic layout for overflow and clipping at a range of widths.
   Needs tests/screenshots/classic.html, so run tests/preview.js first:
     node tests/preview.js && node tests/measure.js
*/

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { SHOTS } = require('./helpers');
const { collect, screenshotArgs } = require('./browser');

const WIDTHS = [1440, 1280, 1100, 980, 820, 700];

const browser = collect();
if (!browser) {
  console.log('no headless shell found, skipping measurements');
  process.exit(0);
}

const probe = `
<script>
(function(){
  var out = [];
  var grid = document.querySelector('.classic-unt-tile-grid');
  if (!grid) { document.title = 'NOGRID'; return; }

  // does the grid itself stick out of its container?
  var host = grid.parentNode;
  var hb = host.getBoundingClientRect();
  var gb = grid.getBoundingClientRect();
  out.push('host.clientWidth=' + host.clientWidth + ' grid.width=' + Math.round(gb.width));
  out.push('grid.scrollWidth=' + grid.scrollWidth);
  out.push('grid overflows host by ' + Math.round(gb.width - host.clientWidth) + 'px');

  // find the first ancestor that clips horizontally
  var node = grid.parentNode, clipper = null;
  while (node && node !== document.documentElement) {
    var cs = getComputedStyle(node);
    if (/hidden|clip|auto|scroll/.test(cs.overflowX)) {
      var nb = node.getBoundingClientRect();
      var rightMost = 0;
      document.querySelectorAll('.classic-unt-tile-grid > .nuilp').forEach(function(t){
        var r = t.getBoundingClientRect();
        if (r.right > rightMost) rightMost = r.right;
      });
      clipper = node.className + ' overflowX=' + cs.overflowX +
        ' edge=' + Math.round(nb.right) + ' tileRight=' + Math.round(rightMost);
      break;
    }
    node = node.parentNode;
  }
  out.push('clipper: ' + (clipper || 'none'));

  // A shadow reaches past the border box, so "fits inside the clipper" is not
  // enough on its own. Worst case is the hover shadow, 0 8px 22px, so it needs
  // about 22px of slack beyond the box's own edge.
  function gapToClipper(right) {
    var n = grid.parentNode;
    while (n && n !== document.documentElement) {
      if (/hidden|clip|auto|scroll/.test(getComputedStyle(n).overflowX)) {
        return n.getBoundingClientRect().right - right;
      }
      n = n.parentNode;
    }
    return 1e6;
  }

  var worstSlack = Infinity, worstTile = null;
  document.querySelectorAll('.classic-unt-tile-grid > .nuilp').forEach(function(t){
    var r = t.getBoundingClientRect();
    var gap = gapToClipper(r.right);
    if (gap < worstSlack) { worstSlack = gap; worstTile = Math.round(gap); }
  });
  out.push('closest tile to the clipper edge: ' + worstTile + 'px of slack');

  document.title = 'RESULT::' + out.join(' | ');
})();
</script>
`;

const html = fs.readFileSync(path.join(SHOTS, 'classic.html'), 'utf8');
const tmp = path.join(SHOTS, '_measure.html');
fs.writeFileSync(tmp, html.replace('</body>', probe + '</body>'));

let bad = 0;
for (const width of WIDTHS) {
  let dom = '';
  try {
    const args = [
      '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--window-size=${width},900`, '--virtual-time-budget=2500', '--dump-dom'
    ];
    if (!browser.isShell) args.unshift('--headless=new');
    args.push(`file://${tmp}`);
    dom = execFileSync(browser.bin, args,
      { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    console.log(`${width}px  ERROR ${err.message.split('\n')[0]}`);
    bad++;
    continue;
  }
  const m = dom.match(/RESULT::([^<]*)/);
  if (!m) { console.log(`${width}px  no result`); bad++; continue; }
  const parts = m[1].split(' | ');
  const overflow = /overflows host by (-?\d+)px/.exec(parts[2]);
  const slack = /closest tile to the clipper edge: (-?\d+)px/.exec(parts[4]);
  // the boxes need room for a hover shadow of roughly 22px
  const SHADOW_NEEDED = 22;
  const ok = overflow && Number(overflow[1]) <= 0 && slack && Number(slack[1]) >= SHADOW_NEEDED;
  if (!ok) bad++;
  console.log(`${String(width).padStart(5)}px  ${ok ? 'ok  ' : 'BAD '} ${parts[2]}`);
  console.log(`         ${parts[3]}`);
  console.log(`         ${parts[4]}${ok ? '' : '   <-- needs ' + SHADOW_NEEDED + 'px for the hover shadow'}`);
}

fs.unlinkSync(tmp);
console.log(bad ? `\n${bad} width(s) overflow or clip` : '\nno overflow at any tested width');
process.exit(bad ? 1 : 0);
