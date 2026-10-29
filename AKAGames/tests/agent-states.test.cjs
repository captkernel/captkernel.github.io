// CI-07: every person resolves to exactly one of AWAITING / BLOCKED / RUNNING / STALE / READY,
// by precedence, and idle sessions never read as a pending human decision. Run: node AKAGames/tests/agent-states.test.cjs
const assert = require('node:assert/strict');
const { load, ago } = require('./board-harness.cjs');

const status = (who, body, updatedMin = 10, etaMin = null) => ({ who, body, updated: ago(updatedMin), eta: etaMin === null ? '' : ago(-etaMin) });
const idleSession = (lastMin = 5) => ({ id: 's-idle', kind: 'main', status: 'idle', started: ago(120), last: ago(lastMin), activity: 'Waiting for karan', agents: [] });
const workingSession = (lastMin = 1, agents = []) => ({ id: 's-work', kind: 'main', status: 'working', started: ago(60), last: ago(lastMin), activity: 'Editing src/player.gd', agents });
const ask = (id, from, to, body) => ({ id, from, to, kind: 'ask', re: '', via: '', at: ago(30), body });
const answer = (id, from, re) => ({ id, from, to: 'all', kind: 'answer', re, via: 'board', at: ago(5), body: 'yes' });
const map = (...sessions) => ({ sessions });

function state(who, opts) { return load(opts).personState(who); }

// READY: an idle session waiting for its next prompt, fresh status, nothing pending
let s = state('ash', { statuses: [status('ash', 'camera polish')], agentMaps: { ash: map(idleSession()) } });
assert.equal(s.key, 'ready'); assert.equal(s.txt, 'READY'); assert.equal(s.cls, 'idle');
assert.match(s.detail, /nothing pending/);
// ...and the idle session row itself is READY, never "WAITING ON YOU"
let api = load({ me: 'ash', statuses: [status('ash', 'camera polish')], agentMaps: { ash: map(idleSession()) } });
assert.equal(api.sessionStatus(idleSession()).txt, 'READY');
for (const r of api.boardData().rows) assert.doesNotMatch(r.status.txt, /WAITING|NEEDS/, `idle row ${r.key} must not read as a decision`);

// RUNNING: working session with a report inside LIVE_MIN; or a running subagent
s = state('ash', { statuses: [status('ash', 'camera polish')], agentMaps: { ash: map(workingSession(2)) } });
assert.equal(s.key, 'running'); assert.match(s.detail, /^1 agent running/);
s = state('ash', { statuses: [status('ash', 'x')], agentMaps: { ash: map({ ...idleSession(), agents: [{ id: 'a1', type: 'seneca', state: 'running', started: ago(3), last: ago(1) }] }) } });
assert.equal(s.key, 'running');

// a working session silent past LIVE_MIN is STALE on its row, and does not count as running
api = load({ statuses: [status('ash', 'x')], agentMaps: { ash: map(workingSession(40)) } });
assert.equal(api.sessionStatus(workingSession(40)).cls, 'stale');
assert.equal(api.personState('ash').key, 'stale');
assert.match(api.personState('ash').detail, /^1 agent marked working but silent for 40 min/);
// a subagent whose SubagentStop was lost (state running, last 5 h ago) is STALE, not RUNNING
assert.equal(api.subState({ state: 'running', started: ago(300), last: ago(300) }), 'stale');
assert.equal(api.subState({ state: 'running', started: ago(2), last: ago(1) }), 'running');

// STALE: status older than STALE_H with no agent activity in that window
s = state('akshat', { statuses: [status('akshat', 'quest beats', 7 * 60)], agentMaps: { akshat: null } });
assert.equal(s.key, 'stale'); assert.match(s.detail, /Status is 7 h old; agent map not published/);
// ...but recent agent activity keeps an old status from going stale
s = state('akshat', { statuses: [status('akshat', 'quest beats', 7 * 60)], agentMaps: { akshat: map(idleSession(30)) } });
assert.equal(s.key, 'ready');
// STALE: ETA passed by more than ETA_GRACE_MIN (but not by 30 min)
s = state('ttt', { statuses: [status('ttt', 'bestiary', 20, -90)], agentMaps: { ttt: map(idleSession()) } });
assert.equal(s.key, 'stale'); assert.match(s.detail, /^ETA \d\d:\d\d passed 1 h 30 min ago/);
s = state('ttt', { statuses: [status('ttt', 'bestiary', 20, -30)], agentMaps: { ttt: map(idleSession()) } });
assert.equal(s.key, 'ready');
// no status and no agent map at all
s = state('ttt', { agentMaps: { ttt: null } });
assert.equal(s.key, 'stale'); assert.match(s.detail, /No status posted/);

// BLOCKED: status text says so; the detail is the blocking sentence
for (const body of ['Navmesh done. Blocked on Ash\'s terrain export.', 'waiting on Hahn for the HUD spec', "Can't proceed until the CI runner exists"]) {
  s = state('karan', { statuses: [status('karan', body)], agentMaps: { karan: map(idleSession()) } });
  assert.equal(s.key, 'blocked', body); assert.equal(s.txt, 'BLOCKED');
}
s = state('karan', { statuses: [status('karan', 'Navmesh done. Blocked on Ash\'s terrain export.')], agentMaps: { karan: map(idleSession()) } });
assert.equal(s.detail, "Blocked on Ash's terrain export.");
assert.equal(state('karan', { statuses: [status('karan', 'unblocked the build, waiting for review')], agentMaps: { karan: null } }).key, 'ready');

// AWAITING (incoming): an open ask to me reads "NEEDS YOUR ANSWER"; to someone else names them
const q = ask('20261018-100000-ash-to-karan-1.md', 'ash', 'karan', 'Respawn thieves only, or reset the whole fight?');
s = state('karan', { me: 'karan', messages: [q], statuses: [status('karan', 'x')], agentMaps: { karan: map(idleSession()) } });
assert.equal(s.key, 'awaiting'); assert.equal(s.dir, 'in'); assert.equal(s.cls, 'hold'); assert.equal(s.txt, 'NEEDS YOUR ANSWER');
assert.equal(s.detail, 'Ash asked you 5 min ago: Respawn thieves only, or reset the whole fight?');
s = state('karan', { me: 'hahn', messages: [q], agentMaps: { karan: map(idleSession()) } });
assert.equal(s.cls, 'wait'); assert.equal(s.txt, 'NEEDS KARAN');
// AWAITING (outgoing): the asker shows "WAITING ON <who>"; red only when it is waiting on the viewer
s = state('ash', { me: 'hahn', messages: [q], statuses: [status('ash', 'x')], agentMaps: { ash: map(workingSession()) } });
assert.equal(s.key, 'awaiting'); assert.equal(s.dir, 'out'); assert.equal(s.txt, 'WAITING ON KARAN'); assert.equal(s.cls, 'wait');
assert.deepEqual(Array.from(s.others), ['running 1 agent']);
s = state('ash', { me: 'karan', messages: [q], agentMaps: { ash: null } });
assert.equal(s.txt, 'WAITING ON YOU'); assert.equal(s.cls, 'hold'); assert.match(s.detail, /^Ash asked you/);
// an answer clears it on both sides
const done = [q, answer('20261018-100500-karan-to-all-2.md', 'karan', q.id)];
assert.equal(state('karan', { messages: done, agentMaps: { karan: map(idleSession()) } }).key, 'ready');
assert.equal(state('ash', { messages: done, agentMaps: { ash: map(idleSession()) } }).key, 'ready');

// precedence: AWAITING > BLOCKED > RUNNING > STALE > READY, with the rest listed as "also"
const everything = { me: 'karan', messages: [q], statuses: [status('karan', 'blocked on terrain', 7 * 60, -120)], agentMaps: { karan: map(workingSession()) } };
s = state('karan', everything); assert.equal(s.key, 'awaiting');
assert.deepEqual(Array.from(s.others), ['blocked', 'running 1 agent', 'stale']);
s = state('karan', { ...everything, messages: [] }); assert.equal(s.key, 'blocked');
s = state('karan', { ...everything, messages: [], statuses: [status('karan', 'terrain', 7 * 60, -120)] }); assert.equal(s.key, 'running');
s = state('karan', { ...everything, messages: [], statuses: [status('karan', 'terrain', 7 * 60, -120)], agentMaps: { karan: map(idleSession(400)) } }); assert.equal(s.key, 'stale');

// the board puts each person's row first in their group, with their state
api = load({ me: 'karan', messages: [q], statuses: [status('karan', 'x')], agentMaps: { karan: map(idleSession()), ash: map(workingSession()), akshat: null, hahn: null, ttt: null } });
const rows = api.boardData().rows;
const head = (who) => rows.find((r) => r.who === who && r.person);
assert.equal(head('karan').status.txt, 'NEEDS YOUR ANSWER');
assert.equal(head('ash').status.txt, 'WAITING ON YOU');
assert.equal(rows.find((r) => r.key === 'karan:s-idle').status.txt, 'READY');
assert.equal(rows.find((r) => r.key === 'ash:s-work').status.txt, 'RUNNING');
assert.ok(rows.every((r) => r.group === r.who));

console.log('PASS agent states: ready, running, stale (status age, ETA, lost subagent), blocked, awaiting in/out, answered, precedence');
