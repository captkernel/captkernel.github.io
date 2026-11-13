// The CI badge must stop vouching for main once CI itself has stopped publishing (2026-11-13: the PC watcher
// had been off for two weeks and the badge still read "main is green"). Run: node AKAGames/tests/ci-badge.test.cjs
const assert = require('node:assert');
const vm = require('node:vm');
const { grab, ago } = require('./board-harness.cjs');

function badge(ci) {
  const ctx = { ci, me: 'karan', OWNER: 'o', REPO: 'r', name: (w) => w, esc: (s) => String(s ?? ''), clip: (s) => s, timeEl: (iso, _m, pre = '') => `${pre}${iso}` };
  vm.createContext(ctx);
  vm.runInContext(`${grab('parseAt')}\n${grab('CI_STALE_H')}\n${grab('ciHtml')}\nglobalThis.out = ciHtml();`, ctx);
  return ctx.out;
}
const base = { suite: 'full', commit: 'd4589ce41ccf9e6bb07e12eb86610b24052d9bf1', passed: 121, total: 121, failed: [] };

let h = badge({ ...base, state: 'green', updated: ago(60) });
assert.match(h, /data-ci="green"/); assert.match(h, /main is green/);

h = badge({ ...base, state: 'green', updated: ago(29 * 60) });
assert.match(h, /data-ci="green"/, 'a nightly gap is not stale');

h = badge({ ...base, state: 'green', updated: ago(15 * 24 * 60) });
assert.match(h, /data-ci="stale"/); assert.match(h, /CI has not run for 15 days/); assert.match(h, /last result: green \(121\/121/);
assert.doesNotMatch(h, /main is green/, 'a two-week-old result must not read as green');

h = badge({ ...base, state: 'green', updated: ago(36 * 60) });
assert.match(h, /CI has not run for 36 hours/);

h = badge({ ...base, state: 'red', failed: ['res://tests/a.gd'], updated: ago(5 * 24 * 60) });
assert.match(h, /data-ci="stale"/); assert.match(h, /last result: red/);

h = badge({ ...base, state: 'red', failed: ['res://tests/a.gd'], updated: ago(60) });
assert.match(h, /data-ci="red"/);

h = badge({ ...base, state: 'green' });
assert.match(h, /data-ci="green"/, 'no timestamp: unchanged behaviour');
console.log('ci-badge: all checks passed');
