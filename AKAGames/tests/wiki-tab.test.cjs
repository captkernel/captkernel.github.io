// Wiki tab: docs/wiki/wiki.html is read from the private repo's main through the token, shown in a
// sandboxed iframe, and never served from this public repo. Static checks on the shipped source plus the
// script-stripping used for "Open in new tab" (the blob URL shares the board's origin, so no script may run there).
const assert = require('node:assert/strict');
const { html, grab } = require('./board-harness.cjs');

assert.match(grab('VIEWS'), /"wiki"/, 'wiki is a view');
assert.match(html, /\{ id: "wiki", label: "Wiki" \}/, 'Wiki is in the nav');
assert.match(html, /<section class="view hidden" id="v-wiki"/, 'wiki section exists');
assert.match(html, /const WIKI_DIR = "docs\/wiki", WIKI_FILE = "wiki.html";/, 'reads docs/wiki/wiki.html');
assert.match(html, /gh\(`\/git\/blobs\/\$\{wikiSha\}`\)/, 'fetched with the blobs API (100 MB), not the 1 MB contents API');
assert.doesNotMatch(html, /contents\/docs\/wiki/, 'never the contents API for the wiki');
assert.match(html, /\/commits\?sha=\$\{BRANCH\}&path=\$\{encodeURIComponent\(wikiPath\(\)\)\}/, 'commit/date comes from main');
const sandbox = html.match(/id="wikiFrame"[^>]*sandbox="([^"]*)"/);
assert.ok(sandbox, 'iframe is sandboxed');
assert.doesNotMatch(sandbox[1], /allow-same-origin/, 'the wiki cannot reach the board or its stored token');
assert.doesNotMatch(sandbox[1], /allow-top-navigation/, 'the wiki cannot navigate the board away');
assert.match(html, /\.replace\(\/<script\\b\[\\s\\S\]\*\?<\\\/script>\/gi, ""\)/, 'new-tab copy strips scripts');
assert.match(html, /Content-Security-Policy" content="script-src 'none'/, 'new-tab copy carries a no-script CSP');
assert.match(html, /wikiReload|wikiOpen/, 'Reload and Open in new tab controls exist');

// The strip regex, applied to the shape build_html.py emits.
const strip = (s) => s.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<head\b[^>]*>/i, (m) => `${m}<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'">`);
const sample = '<!doctype html><html><head><meta charset="utf-8"><title>w</title></head><body><nav></nav><main><h1>x</h1></main>\n<script>\n  const links = [...document.querySelectorAll(".nav-link")];\n</script>\n<SCRIPT src="x.js"></SCRIPT></body></html>';
const out = strip(sample);
assert.doesNotMatch(out, /<script/i);
assert.match(out, /<head><meta http-equiv="Content-Security-Policy"/);
assert.match(out, /<h1>x<\/h1>/);
console.log('PASS wiki tab: view wired, blobs API from main, sandboxed frame, scripted-free new-tab copy');
