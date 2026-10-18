// Tasks tab: the board reads and writes .agents/tasks/<stamp>-<owner>-<slug>.md (kind human|agent) in the same format as
// `scripts/agent.sh task` (AKAGames tests/team/test_agent_tasks.sh), and orders each owner's agent queue.
// Run: node AKAGames/tests/tasks.test.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { grab } = require('./board-harness.cjs');

const code = ['TASK_KEYS', 'CODE', 'up', 'parse', 'flat', 'taskOf', 'taskText', 'taskDoneMeta', 'taskSlug', 'queueOrder', 'agentTaskState', 'agentQueue'].map(grab).join('\n');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${code}\nglobalThis.api = { parse, taskOf, taskText, taskDoneMeta, taskSlug, queueOrder, agentTaskState, agentQueue };`, ctx);
const { parse, taskOf, taskText, taskDoneMeta, taskSlug, agentQueue } = ctx.api;
const J = (x) => JSON.parse(JSON.stringify(x)); // results come from another vm realm
const mk = (file, text) => { const p = parse(text); return taskOf(file, 'sha-' + file, p.meta, p.body); };

// ---- a human task exactly as agent.sh writes it
const file = '20261018-220044-karan-measure-jagti-patt-naggar-castle-door.md';
const src = '---\nkind: human\nowner: karan\nstatus: open\ncreated: 2026-10-18T22:00:44\ncreated_by: karan\ncontext: docs/world/landmarks-dept/dossiers/jagti_patt.md\n---\nMeasure Jagti Patt (Naggar Castle) door width or front-wall width; one number fixes every dimension\n';
const p = parse(src), t = taskOf(file, 'abc', p.meta, p.body);
assert.equal(t.kind, 'human'); assert.equal(t.owner, 'karan'); assert.equal(t.done, false); assert.equal(t.by, 'karan');
assert.equal(t.context, 'docs/world/landmarks-dept/dossiers/jagti_patt.md'); assert.equal(t.due, ''); assert.equal(t.answer, '');
// writing it back unchanged reproduces agent.sh's bytes (same key order, no empty keys)
assert.equal(taskText(p.meta, p.body), src);
// an agent task as `agent.sh task queue --after --blocked-by --context` writes it
const asrc = '---\nkind: agent\nowner: karan\nstatus: blocked\ncreated: 2026-10-18T22:25:48\ncreated_by: karan\nafter: a.md\nblocked_by: h.md\ncontext: docs/x.md\n---\nSwap the castle blocks\n';
assert.equal(taskText(parse(asrc).meta, parse(asrc).body), asrc);
// old files without kind are human tasks
assert.equal(mk('o.md', '---\nowner: ash\nstatus: open\n---\nx\n').kind, 'human');

// ---- marking done: status/answer/done_at/done_by added, everything else kept, multi-line answers flattened
const done = taskText(taskDoneMeta(p.meta, 'door 1.42 m wide\nfront wall 7.9 m', 'karan', '2026-10-19T10:00:00'), p.body);
assert.equal(done, '---\nkind: human\nowner: karan\nstatus: done\ncreated: 2026-10-18T22:00:44\ncreated_by: karan\ncontext: docs/world/landmarks-dept/dossiers/jagti_patt.md\nanswer: door 1.42 m wide front wall 7.9 m\ndone_at: 2026-10-19T10:00:00\ndone_by: karan\n---\nMeasure Jagti Patt (Naggar Castle) door width or front-wall width; one number fixes every dimension\n');
const td = mk(file, done);
assert.equal(td.done, true); assert.equal(td.answer, 'door 1.42 m wide front wall 7.9 m'); assert.equal(td.doneBy, 'karan');
// an answer containing a colon survives the round trip (parse splits on the first colon only)
assert.equal(parse(taskText(taskDoneMeta(p.meta, 'board 1: "Gauri Shankar"', 'ash', 'x'), p.body)).meta.answer, 'board 1: "Gauri Shankar"');
// a new task from the board: empty optional fields left out, unknown keys kept after the known ones
assert.equal(taskText({ kind: 'human', owner: 'all', status: 'open', created: '2026-10-18T23:00:00', created_by: 'ash', due: '', after: '', blocked_by: '', context: '' }, ' Read the sign \n'),
  '---\nkind: human\nowner: all\nstatus: open\ncreated: 2026-10-18T23:00:00\ncreated_by: ash\n---\nRead the sign\n');
assert.match(taskText({ extra: 'y', owner: 'ash', status: 'open' }, 'x'), /^---\nowner: ash\nstatus: open\nextra: y\n---/);
// CRLF files and missing/odd owners
const c = mk('f.md', '---\r\nowner: Ash\r\nstatus: DONE\r\n---\r\nPhoto\r\n');
assert.equal(c.owner, 'ash'); assert.equal(c.done, true);
assert.equal(taskOf('f.md', 's', {}, 'x').owner, 'all');

// ---- file-name slugs match agent.sh (the seeded task file names)
assert.equal(taskSlug('Measure Jagti Patt (Naggar Castle) door width or front-wall width; one number fixes every dimension'), 'measure-jagti-patt-naggar-castle-door');
assert.equal(taskSlug('Gauri Shankar, Naggar: read the text of the two boards on the east wall and take one measurement (doorway height or base width)'), 'gauri-shankar-naggar-read-the-text-of');
assert.equal(taskSlug('Murlidhar Krishna temple, Thawa (uphill of Naggar Castle): one tape measurement'), 'murlidhar-krishna-temple-thawa-uphill');
assert.equal(taskSlug("Naggar Chowk: move the bus stop to the OSM bus-stop point (~282,256), spawn_default to the bazaar"), 'naggar-chowk-move-the-bus-stop-to-the');
assert.equal(taskSlug('Photograph'), 'photograph');
assert.equal(taskSlug('???'), 'task');

// ---- agent queue: `after` order beats creation order; states; codes per owner
const ag = (file, owner, status, extra = '') => mk(file, `---\nkind: agent\nowner: ${owner}\nstatus: ${status}\n${extra}---\n${file}\n`);
const H = mk('1-h.md', '---\nkind: human\nowner: karan\nstatus: open\n---\nmeasure\n');
const A = ag('2-a.md', 'karan', 'running');
const B = ag('3-b.md', 'karan', 'blocked', 'after: 5-d.md\nblocked_by: 1-h.md\n');  // created early, queued after D
const C = ag('4-c.md', 'karan', 'open', 'after: 3-b.md\n');
const D = ag('5-d.md', 'karan', 'open', 'after: 2-a.md\n');
const X = ag('6-x.md', 'ash', 'open');
const Z = ag('7-z.md', 'karan', 'done', 'after: 2-a.md\n');
let all = [H, C, X, A, B, Z, D];
let q = agentQueue('karan', all);
assert.deepEqual(J(q.map((r) => r.t.file)), ['2-a.md', '5-d.md', '3-b.md', '4-c.md'], 'after-chain order, done tasks left out');
assert.deepEqual(J(q.map((r) => r.code)), ['KRN-Q1', 'KRN-Q2', 'KRN-Q3', 'KRN-Q4']);
assert.deepEqual(J(q.map((r) => r.state.key)), ['running', 'queued', 'blocked', 'queued'], 'nothing is UP NEXT while one runs');
assert.equal(q[2].state.blocker, H);
assert.deepEqual(J(agentQueue('ash', all).map((r) => [r.code, r.state.key])), [['ASH-Q1', 'next']]);
// the blocking human task is done -> no longer blocked; nothing running -> first open task is UP NEXT
const Hd = mk('1-h.md', '---\nkind: human\nowner: karan\nstatus: done\n---\nmeasure\n');
const Ad = ag('2-a.md', 'karan', 'done');
q = agentQueue('karan', [Hd, Ad, B, C, D]);
assert.deepEqual(J(q.map((r) => [r.t.file, r.state.key, r.state.txt])), [['5-d.md', 'next', 'UP NEXT'], ['3-b.md', 'queued', 'QUEUED'], ['4-c.md', 'queued', 'QUEUED']]);
// status blocked with no blocked_by stays blocked; cycles don't hang
q = agentQueue('karan', [ag('x1-p.md', 'karan', 'blocked'), ag('x2-q.md', 'karan', 'open', 'after: x3-r.md\n'), ag('x3-r.md', 'karan', 'open', 'after: x2-q.md\n')]);
assert.equal(q.length, 3); assert.equal(q[0].state.key, 'blocked'); assert.equal(q[1].state.key, 'next');

console.log('PASS tasks: human + agent files identical to agent.sh, mark done, new task, CRLF, slugs, queue order, queue states');
