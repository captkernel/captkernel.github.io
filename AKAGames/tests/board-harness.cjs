// Loads the board's real state code out of index.html into a sandbox, so tests run the shipped logic.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// One-line `const x = ...;` definitions and `function x(...) { ... }` blocks, taken verbatim.
function grab(name) {
  const c = html.match(new RegExp(`^  const ${name} = .*;$`, 'm'));
  if (c) return c[0];
  const start = html.indexOf(`  function ${name}(`);
  if (start < 0) throw new Error(`not found: ${name}`);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  return html.slice(start, i + 1);
}
const helpers = ['parseAt', 'span', 'up', 'flat', 'clip', 'mins', 'ledDur', 'sessionState', 'answersTo', 'askOpenFor', 'fromText'].map(grab).join('\n');
const states = html.slice(html.indexOf('  // ---------- states (CI-07'), html.indexOf('  const ledTime'));

function load({ team = ['karan', 'ash', 'akshat', 'hahn', 'ttt'], me = 'karan', statuses = [], messages = [], agentMaps = {} } = {}) {
  const names = { karan: 'Karan', ash: 'Ash', akshat: 'Akshat', hahn: 'Hahn', ttt: 'TTT', all: 'Everyone' };
  const context = {
    TEAM: team, me, statuses, messages, agentMaps,
    CODE: { karan: 'KRN', ash: 'ASH', akshat: 'AKS', hahn: 'HHN', ttt: 'TTT' },
    KIND: { main: 'Main agent', watcher: 'Inbox watcher' },
    name: (w) => names[w] || w,
    rel: () => '5 min ago', clock: (d) => d.toISOString().slice(11, 16),
    askLine: (m) => m.body.split('\n')[0],
  };
  vm.createContext(context);
  vm.runInContext(`${helpers}\n${states}\nglobalThis.api = { personState, boardData, subState, blockerOf, sessionStatus, LIVE_MIN, STALE_H, ETA_GRACE_MIN };`, context);
  return context.api;
}
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
module.exports = { load, ago, html };
