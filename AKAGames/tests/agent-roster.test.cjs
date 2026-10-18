// Hahn's roster test (docs/board/patches/hahn-agent-roster.patch), adapted to CI-07: each person now
// has a head row (rows[0]) carrying their state, and sessions/subagents/roster rows are grouped by person.
const assert = require('node:assert/strict');
const { load, ago } = require('./board-harness.cjs');
const roles = ['Feynman', 'DaVinci', 'Link'].map(name => ({ id: name.toLowerCase(), name: `${name}[Hahn]`, description: 'Configured role' }));
function board(map) {
  return load({ team: ['hahn'], me: 'karan', agentMaps: { hahn: map } }).boardData();
}
const main = { id: 'codex-thread', status: 'idle', title: 'Hahn / Codex', started: '', last: ago(1), agents: [] };
let result = board({ sessions: [main], roster: roles });
assert.equal(result.rows.length, 5);
assert.equal(result.rows[0].person, true);
assert.equal(result.rows[1].status.txt, 'READY'); // an idle Codex thread is READY, not "waiting on Hahn"
assert.deepEqual(Array.from(result.rows.slice(2), r => r.name), roles.map(r => r.name));
for (const row of result.rows.slice(2)) {
  assert.equal(row.status.txt, 'READY');
  assert.equal(row.status.cls, 'idle');
  assert.equal(row.group, 'hahn');
  assert.equal(row.code.startsWith('HHN-1.R'), true);
  assert.equal(row.dep, null);
  assert.equal(row.run, '');
  assert.equal(row.sub, true);
}
result = board({ sessions: [{ ...main, agents: [{ id: 'job-one', type: 'feynman', state: 'running', desc: 'Write a quest', started: ago(2), last: ago(1) }] }], roster: roles });
assert.equal(result.rows.length, 5);
assert.equal(result.rows[2].name, 'Feynman[Hahn]');
assert.equal(result.rows[2].status.txt, 'RUNNING');
assert.equal(result.rows[0].status.txt, 'RUNNING');
result = board({ sessions: [{ ...main, agents: [{ id: 'job-one', type: 'feynman', state: 'idle' }] }], roster: roles });
assert.equal(result.rows.length, 5);
assert.equal(result.rows[2].status.txt, 'READY');
result = board({ sessions: [{ ...main, agents: [{ id: 'job-one', type: 'feynman', state: 'done', ended: ago(5) }] }], roster: roles });
assert.equal(result.rows.length, 5);
assert.equal(result.arrived.length, 1);
result = board({ sessions: [{ ...main, status: 'ended' }], roster: roles });
assert.equal(result.rows.length, 4);
assert.match(result.rows[0].task, /no agent session open/);
assert.equal(result.rows[1].code, 'HHN.R1');
assert.equal(result.rows[1].group, 'hahn');
const unpublished = board(null).rows;
assert.equal(unpublished.length, 1);
assert.equal(unpublished[0].status.txt, 'STALE');
assert.match(unpublished[0].task, /agent map not published/);
assert.equal(board({ sessions: [main] }).rows.length, 2);
console.log('PASS agent roster: ready, running, idle, completed, ended, legacy and unpublished states');
