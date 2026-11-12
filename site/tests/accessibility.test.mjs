// These contracts protect copy, focus and CSS decisions. Browser QA verifies real reflow and hit boxes;
// a source check alone cannot establish that a screen fits a viewport or passes accessibility testing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const route = read('js/pengyu/route.js');
const css = read('pengu.css').replace(/\/\*[\s\S]*?\*\//g, '');
const h = (tag, attrs, ...kids) => ({ tag, attrs, kids: kids.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false) });
const text = (node) => typeof node === 'object' ? node.kids.map(text).join('') : String(node);
const all = (node) => typeof node === 'object' ? [node, ...node.kids.flatMap(all)] : [];
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({ selectors: selectors.split(',').map((s) => s.trim()), body }));
const rule = (selector) => rules.filter((r) => r.selectors.includes(selector));

function functionSource(name, nextName) {
  const start = route.indexOf(`function ${name}(`);
  const end = route.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `actual ${name} implementation is present`);
  return route.slice(start, end);
}

test('the first three rows explain chosen workouts, one train station per log and both upgrade types in short sentences', () => {
  const rows = vm.runInNewContext(`${functionSource('howItWorks', 'firstGoalCard')}\nhowItWorks();`, {
    h, icon: () => h('svg', {}), S: { TARGETS: [2, 3, 4] },
  }).kids.map(text);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /Plan\s+2 to 4 workouts this week\./);
  assert.match(rows[1], /Log\s+each finished workout\. Your train moves one station\./);
  assert.match(rows[2], /Earn Fish\s+for Pengu’s gear and train upgrades\./);
  for (const row of rows) for (const sentence of row.split(/(?<=[.!?])\s+/)) {
    assert.ok(sentence.trim().split(/\s+/).length < 15, `under 15 words: ${sentence}`);
  }
});

test('the reward opens with focus on its readable heading rather than scrolling to the bottom action', () => {
  const panel = { children: [], append(...nodes) { this.children.push(...nodes); }, querySelector() { return null; } };
  vm.runInNewContext(`${functionSource('openReward', 'openTip')}\nopenReward({});`, {
    h, icon: () => h('svg', {}),
    rewardCopy: () => ({ title: 'Workout logged.', lines: ['+10 Fish'], stamp: false, extra: null, postcard: false, stop: '' }),
    openSheet: (_className, _label, build) => build(panel, () => {}),
    goalBlock: () => null, bandsArt: () => null, faceArt: () => null, rise() {},
  });
  const nodes = panel.children.flatMap(all);
  const heading = nodes.find((n) => n.tag === 'h2' && n.attrs.id === 'py-reward-title');
  const done = nodes.find((n) => n.tag === 'button' && text(n) === 'Nice');
  assert.ok(heading && done);
  assert.equal(heading.attrs.tabindex, '-1');
  assert.equal(heading.attrs.autofocus, true);
  assert.equal(done.attrs.autofocus, undefined);
});

test('large reward sheets keep vertical scrolling instead of clipping reward text and controls', () => {
  const rewardRules = rule('.py-reward .py-sheet-panel');
  assert.ok(rewardRules.length);
  assert.ok(rewardRules.some((r) => /overflow-y\s*:\s*auto\b/.test(r.body)));
  for (const { body } of rewardRules) {
    assert.doesNotMatch(body, /overflow(?:-y)?\s*:\s*(?:hidden|clip)\b/, 'vertical overflow cannot be clipped');
  }
});

test('action links keep 44px targets; the compact days control has an explicit 44px hit strip', () => {
  assert.match(css, /--tap\s*:\s*44px\b/);
  assert.ok(rule('.link').some((r) => /min-height\s*:\s*var\(--tap\)/.test(r.body)));
  assert.ok(rule('.chip').some((r) => /min-height\s*:\s*var\(--tap\)/.test(r.body)));
  for (const { selectors, body } of rules) {
    // Other 32px labels are decorative; actionable link classes must not override the shared target.
    if (!selectors.some((s) => /(?:\.link|\.py-(?:onward-goal|plan-next|window-btn|session-move))\b/.test(s))) continue;
    for (const match of body.matchAll(/min-height\s*:\s*(\d+(?:\.\d+)?)px\b/g)) {
      assert.ok(Number(match[1]) >= 44, `${selectors.join(', ')} retains a full target`);
    }
  }
  assert.ok(rule('.py-days-btn').some((r) => /min-height\s*:\s*32px/.test(r.body)));
  assert.ok(rule('.py-days-btn::before').some((r) => /inset\s*:\s*-6px 0/.test(r.body)), '32 + 6 + 6 = 44px');
});

test('the short-phone adjustment reduces spacing and decorative train height without hiding controls or shrinking type', () => {
  const media = /@media\s*\([^)]*max-height[^)]*\)\s*and\s*\([^)]*max-width[^)]*\)\s*\{/.exec(css);
  assert.ok(media, 'short phone rules are explicit');
  let depth = 1;
  let end = media.index + media[0].length;
  const start = end;
  while (end < css.length && depth) {
    if (css[end] === '{') depth++;
    if (css[end] === '}') depth--;
    end++;
  }
  const compact = css.slice(start, end - 1);
  assert.match(compact, /\.py-today\s*\{/);
  assert.match(compact, /--th\s*:/, 'only decorative train geometry is reduced');
  assert.doesNotMatch(compact, /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:|line-height\s*:|zoom\s*:|transform\s*:\s*scale|overflow(?:-y)?\s*:\s*hidden/);
});

test('station labels respond to the route container in font-relative units, including Today', () => {
  assert.ok(rule('.py-route-wrap').some((r) => /container-type\s*:\s*inline-size\b/.test(r.body)));
  const query = /@container\s*\(\s*max-width\s*:\s*\d+(?:\.\d+)?em\s*\)\s*\{/.exec(css);
  assert.ok(query, 'large root text must trigger compact labels without a smaller CSS viewport');
  let depth = 1;
  let end = query.index + query[0].length;
  const start = end;
  while (end < css.length && depth) {
    if (css[end] === '{') depth++;
    if (css[end] === '}') depth--;
    end++;
  }
  const compact = css.slice(start, end - 1);
  assert.match(compact, /\.py-stop-long\s*\{\s*display\s*:\s*none/);
  assert.match(compact, /\.py-stop-short\s*\{\s*display\s*:\s*inline/);

  const station = vm.runInNewContext(`${functionSource('stationNode', 'routeBlock')}\nstationNode({day:'2026-11-11',status:'today'},1,3,false);`, {
    h: (...args) => ({ ...h(...args), style: { setProperty() {} } }),
    icon: () => h('svg', {}), lineArt: () => h('svg', {}), ring: () => '', check: () => '',
    S: { state: { log: {} }, parseKey: (key) => new Date(`${key}T12:00`) },
    weekday: (date, style = 'long') => date.toLocaleDateString('en-US', { weekday: style }),
    SAY: { today: 'planned for today' },
  });
  const nodes = all(station);
  assert.equal(text(nodes.find((n) => n.attrs.class === 'py-stop-long')), 'Today');
  assert.equal(text(nodes.find((n) => n.attrs.class === 'py-stop-short')), 'We');
  assert.ok(nodes.some((n) => n.attrs.class === 'sr-only' && text(n) === 'Wednesday: planned for today'));
});

test('Privacy grid tracks and children can shrink and long words wrap at large text sizes', () => {
  assert.ok(rule('.doc-page').some((r) => /grid-template-columns\s*:\s*minmax\(\s*0\s*,\s*1fr\s*\)/.test(r.body)), 'track cannot retain an overflowing min-content minimum');
  assert.ok(rule('.doc-page').some((r) => /overflow-wrap\s*:\s*anywhere\b/.test(r.body)), 'long headings and storage names can wrap');
  for (const selector of ['.doc-head', '.doc-sec', '.doc-list']) {
    assert.ok(rule(selector).some((r) => /min-width\s*:\s*0(?:\s|;|$)/.test(r.body)), `${selector} can shrink inside the grid`);
  }
});
