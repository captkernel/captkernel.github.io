// Slice tab: the board parses docs/design/VERTICAL-SLICE.md (private repo, read through the viewer's token at view time)
// into rows grouped by milestone, gives each row a lamp from its status wording, rolls the milestones up and links
// open .agents/tasks files that name a row. The fixture below is synthetic: same format, made-up content.
// Run: node AKAGames/tests/slice-tab.test.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { grab, html } = require('./board-harness.cjs');

const code = ['TASK_KEYS', 'flat', 'parse', 'taskOf', 'SLICE_WAIT_RE', 'sliceCells', 'sliceStatus', 'parseSlice', 'sliceRollup', 'sliceRowRefs', 'sliceTaskLinks', 'sliceDecision'].map(grab).join('\n');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${code}\nglobalThis.api = { parse, taskOf, sliceCells, sliceStatus, parseSlice, sliceRollup, sliceRowRefs, sliceTaskLinks, sliceDecision };`, ctx);
const { parse, taskOf, sliceCells, sliceStatus, parseSlice, sliceRowRefs, sliceTaskLinks, sliceDecision } = ctx.api;
const J = (x) => JSON.parse(JSON.stringify(x)); // results come from another vm realm

const FIXTURE = `# Vertical slice: Testville (the single target)

_Decided by someone, 2026-01-01. **This is the one definition of done.**_

**Owner: Karan.** Intro paragraph.

## Done when
A fresh player finishes the route in about **15 minutes** at a **steady 60 fps**, with **no console errors**. Two such
playtests, with fixes between them.

## The slice area
About **100 × 200 m** around the test square.

| Place | Marker | Position (x, z) | State |
|---|---|---|---|
| Square | \`spawn_default\` | 1, 2 | built |

Edges: the box lives in \`src/world/slice_area.gd\`.

## The route (about 15 min, draft)
Arrive → shop → fight → portal → end card.

## Scope: one of everything (all rows: Karan)

| # | Item | Starting point | Status 2026-01-02 | Milestone |
|---|---|---|---|---|
| 1 | Fence the area | \`data/markers.json\`, team memory | **done 2026-01-02**: markers moved, soft fence | M0 |
| 2 | Load time ≤ 2 s | \`src/bench.gd\` | **done 2026-01-02**: progressive boot | M0 |
| 3 | NPC archetypes | \`src/npc/\`, \`data/npcs.json\` (old ones) | none in Testville | M1 |
| 4 | A branching quest | \`src/quest/\` | to write + extend | M1 |
| 5 | One combat encounter | \`src/combat/\` | **built 2026-01-03**: \`src/combat/encounter/\`; placeholder spot | M1 |
| 6 | Portal \\| era switch | Old portal markers as the model | waiting on karan: which flag opens it | M1 |
| 7 | Inventory pass | \`src/inventory/\` | not checked | M2 |
| 8 | Save anywhere | \`src/core/save_manager.gd\` | gaps (no atomic write) | M2 |
| 9 | Combat feel | \`src/player/combat/\` | numbers are code constants | M2 |
| 10 | Art pass | \`docs/ART.md\` | Blender pipeline + kit block-out built 2026-01-03; terrain blocked | M3 |
| 11 | Audio | \`src/audio/\` | not started | M3 |
| 12 | Playtests | — | none yet | M4 |

**Row 6 gaps (audit 2026-01-04):** the mythic streets are empty.

**Milestones, in order:** M0 fence + measure → M1 playable spine (rows 3–6) → M2 systems complete (7–9) → M3 art and
audio (10–11) → M4 ship-quality pass + playtests (12). Pull detail from the polish list as each row starts.

## Playtest log
_(none yet: date · tester · duration · where they hesitated · what changed)_
`;

// ---- table cells: escaped pipes and code spans stay in their cell
assert.deepEqual(J(sliceCells('| 6 | Portal \\| era | `a|b` | x |')), ['6', 'Portal | era', '`a|b`', 'x']);

// ---- parsing
const s = parseSlice(FIXTURE);
assert.equal(s.title, 'Vertical slice: Testville (the single target)');
assert.equal(s.rows.length, 12);
assert.equal(s.asOf, '2026-01-02');
const r = (n) => s.rows.find((x) => x.n === n);
assert.equal(r(1).what, 'Fence the area');
assert.equal(r(1).where, '`data/markers.json`, team memory');
assert.match(r(1).status, /^\*\*done 2026-01-02\*\*: markers moved/);
assert.equal(r(1).ms, 'M0');
assert.equal(r(6).what, 'Portal | era switch');
assert.equal(r(12).where, '—');
assert.deepEqual(J(r(6).notes), ['**Row 6 gaps (audit 2026-01-04):** the mythic streets are empty.'], 'a "**Row n" paragraph becomes that row\'s notes');
assert.equal(s.notes.length, 0, 'the milestones line is not a stray note');
assert.deepEqual(J(s.named), [
  { id: 'M0', name: 'fence + measure', span: '' },
  { id: 'M1', name: 'playable spine', span: 'rows 3–6' },
  { id: 'M2', name: 'systems complete', span: '7–9' },
  { id: 'M3', name: 'art and audio', span: '10–11' },
  { id: 'M4', name: 'ship-quality pass + playtests', span: '12' },
], 'milestone names come from the wrapped "Milestones, in order" line');
assert.equal(s.msNote, 'Pull detail from the polish list as each row starts.');
assert.match(s.done.join(' '), /about \*\*15 minutes\*\*/);
assert.match(s.area.join('\n'), /test square/);
assert.equal(s.routeTitle, 'The route (about 15 min, draft)');
assert.match(s.log.join(''), /none yet/);
// CRLF files parse the same
assert.equal(parseSlice(FIXTURE.replace(/\n/g, '\r\n')).rows.length, 12);
// a doc without a scope table still parses, with no rows
assert.equal(parseSlice('# X\n\n## Done when\nSoon.\n').rows.length, 0);

// ---- status lamps from the status wording
const key = (t) => sliceStatus(t).key;
assert.deepEqual(J(s.rows.map((x) => [x.n, x.state.key])), [
  [1, 'done'], [2, 'done'], [3, 'todo'], [4, 'todo'], [5, 'done'], [6, 'waiting'],
  [7, 'todo'], [8, 'todo'], [9, 'todo'], [10, 'progress'], [11, 'todo'], [12, 'todo'],
]);
assert.equal(sliceStatus('**done 2026-10-23**: x').txt, 'DONE');
assert.equal(sliceStatus('to do').txt, 'TO DO');
assert.equal(sliceStatus('in progress: parser half written').txt, 'IN PROGRESS');
assert.deepEqual(J(sliceStatus('Waiting on Karan: pick the spot')), { key: 'waiting', who: 'karan', txt: 'WAITING ON KARAN' });
assert.equal(sliceStatus('Ash to decide the combo').who, 'ash');
for (const t of ['to do', 'none', 'none yet', 'not started', 'not checked', 'unmeasured', '—', '', 'to design', 'gaps (no atomic write)', 'no export preset yet', 'nothing built yet'])
  assert.equal(key(t), 'todo', t);
for (const t of ['done', '**Done**', 'built 2026-10-24: x', 'complete', 'shipped'])
  assert.equal(key(t), 'done', t);
for (const t of ['started, half the NPCs placed', 'WIP on a branch', 'kit block-out built; terrain blocked', 'parser works, needs tests'])
  assert.equal(key(t), 'progress', t);

// ---- milestone rollup: done when all rows are done, in progress once any row moved, else not started; first open = now
const ms = s.milestones;
assert.deepEqual(J(ms.map((m) => [m.id, m.state, m.done, m.total, m.now])), [
  ['M0', 'done', 2, 2, false],
  ['M1', 'progress', 1, 4, true],
  ['M2', 'todo', 0, 3, false],
  ['M3', 'progress', 0, 2, false],
  ['M4', 'todo', 0, 1, false],
]);
assert.deepEqual(J(ms[1].rows.map((x) => x.n)), [3, 4, 5, 6]);
// a milestone named in the line but with no rows yet is not started; rows with no milestone get their own group
const s2 = parseSlice(FIXTURE.replace('| 12 | Playtests | — | none yet | M4 |', '| 12 | Playtests | — | none yet | |').replace('→ M4 ship', '→ M5 extra → M4 ship'));
assert.deepEqual(J(s2.milestones.map((m) => [m.id, m.state, m.total])), [['M0', 'done', 2], ['M1', 'progress', 4], ['M2', 'todo', 3], ['M3', 'progress', 2], ['M4', 'todo', 0], ['M5', 'todo', 0], ['', 'todo', 1]]);
// every row done -> every milestone done, none is "now"
const allDone = parseSlice(FIXTURE.replace(/\| ([^|]*) \| (M\d) \|$/gm, '| done | $2 |'));
assert.ok(allDone.milestones.every((m) => m.state === 'done' && !m.now));

// ---- task linking: the row numbers in a task's headline (before the first colon)
const refs = (t) => J(sliceRowRefs(t).rows);
assert.deepEqual(refs('Slice row 7: the portal and era switch'), [7]);
assert.deepEqual(refs('Slice encounter (row 5) decisions: (3) loading a save resets the fight until row 10 saves enemy state'), [5], 'a row named after the colon does not link');
assert.deepEqual(refs('Slice rows 3 and 8: NPCs and the object of power'), [3, 8]);
assert.deepEqual(refs('Slice rows 9-14: systems'), [9, 10, 11, 12, 13, 14]);
assert.deepEqual(refs('Slice rows 3, 4 & 6: x'), [3, 4, 6]);
assert.deepEqual(refs('Tree perf in the Testville slice (measured): x'), []);
assert.equal(sliceRowRefs('Tidy the slice row notes: x').slice, true);
assert.equal(sliceRowRefs('Tree perf in the slice: x').slice, false);

const mk = (file, text) => { const p = parse(text); return taskOf(file, 'sha-' + file, p.meta, p.body); };
const tasks = [
  mk('1-karan-enc.md', '---\nkind: human\nowner: karan\nstatus: open\n---\nSlice encounter (row 5) decisions: (1) spot? (3) until row 10 saves enemy state: OK?\n'),
  mk('2-karan-row6.md', '---\nkind: agent\nowner: karan\nstatus: done\n---\nSlice row 6 (shop), RESUME: x\n'),
  mk('3-karan-rows.md', '---\nkind: agent\nowner: karan\nstatus: open\n---\nSlice rows 3 and 8: NPCs\n'),
  mk('4-ash-row5.md', '---\nkind: human\nowner: ash\nstatus: open\n---\nSlice row 5: film the fight\n'),
  mk('5-karan-gen.md', '---\nkind: agent\nowner: karan\nstatus: open\n---\nRe-check every slice row against the doc\n'),
  mk('6-karan-other.md', '---\nkind: human\nowner: karan\nstatus: open\n---\nMeasure the castle door\n'),
];
const links = sliceTaskLinks(tasks);
assert.deepEqual(J(Object.fromEntries(Object.entries(links.byRow).map(([k, v]) => [k, v.map((t) => t.file)]))),
  { 3: ['3-karan-rows.md'], 5: ['1-karan-enc.md', '4-ash-row5.md'], 8: ['3-karan-rows.md'] }, 'done tasks and passing mentions are left out');
assert.deepEqual(J(links.general.map((t) => t.file)), ['5-karan-gen.md']);
// "needs your decision": an open human task among the row's links, the viewer's own first
assert.equal(sliceDecision(links.byRow[5], 'karan').mine, true);
assert.equal(sliceDecision(links.byRow[5], 'karan').task.file, '1-karan-enc.md');
assert.equal(sliceDecision(links.byRow[5], 'ash').task.file, '4-ash-row5.md');
assert.deepEqual(J([sliceDecision(links.byRow[5], 'hahn').mine, sliceDecision(links.byRow[5], 'hahn').owner]), [false, 'karan']);
assert.equal(sliceDecision(links.byRow[3], 'karan'), null, 'agent tasks link but need no decision');

// ---- the tab is wired: nav, view, hash aliases, and nothing from the private doc is in the public page
assert.match(html, /\{ id: "slice", label: "Slice" \}/);
assert.match(html, /id="v-slice"/);
assert.match(html, /"vertical-slice": "slice", rows: "slice"/);
assert.ok(!/^\| \d+ \| [^|\n]+ \| [^|\n]+ \| [^|\n]+ \| M\d+ \|$/m.test(html), 'no scope-table rows copied into index.html');
assert.ok(!/Testville/.test(html), 'the fixture stays in the test');

console.log('PASS slice: table parse, row notes, milestone names, status lamps, milestone rollup, task links, decision chip, wiring');
