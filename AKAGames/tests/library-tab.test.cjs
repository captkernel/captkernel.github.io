// Library tab: catalogue/index.html is read from the private repo's orphan branch `library` through the token, shown in a
// sandboxed iframe, and never served from this public repo. The "Open on claude.ai" link is read at runtime from
// .agents/board/links.json on main, so the URL is never in this source. Static checks on the shipped source, plus the
// shipped link filter and new-tab wrapper run in a sandbox.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const { html, grab: grabSync } = require('./board-harness.cjs');
// the harness grabs `function x(`; the library's loaders are `async function x(`
const grab = (name) => {
  const i = html.indexOf(`  async function ${name}(`);
  if (i < 0) return grabSync(name);
  let depth = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++) { if (html[j] === '{') depth++; else if (html[j] === '}' && --depth === 0) break; }
  return html.slice(i, j + 1);
};

assert.match(grab('VIEWS'), /"library"/, 'library is a view');
assert.match(html, /\{ id: "library", label: "Library" \}/, 'Library is in the nav');
assert.match(html, /<section class="view hidden" id="v-library"/, 'library section exists');
assert.match(html, /catalogue: "library", systems: "library"/, '#catalogue and #systems open the Library');
assert.match(html, /\.tabbar \{ grid-template-columns: repeat\(7, 1fr\); \}/, 'mobile tab bar has seven columns');
assert.match(html, /const LIB_BRANCH = "library", LIB_DIR = "catalogue", LIB_FILE = "index.html";/, 'reads catalogue/index.html on library');
assert.match(html, /gh\(`\/git\/ref\/heads\/\$\{LIB_BRANCH\}`/, 'resolves the library branch head, not main');
assert.match(html, /gh\(`\/git\/blobs\/\$\{libSha\}`\)/, 'fetched with the blobs API');
assert.doesNotMatch(html, /contents\/catalogue/, 'never the contents API for the catalogue');
assert.match(html, /\/commits\?sha=\$\{LIB_BRANCH\}&path=\$\{encodeURIComponent\(libPath\(\)\)\}&per_page=1/, 'commit note comes from library');
assert.match(html, /await load\(\); await checkLibrary\(\); schedule\(\);/, 'the newer-library check rides the main poll');
assert.match(grab('checkLibrary'), /"If-None-Match": libEtag/, 'the poll is a conditional request (304s are free)');
assert.match(grab('checkLibrary'), /!libInfo/, 'nothing is polled until the Library tab has loaded once');
const sandbox = html.match(/id="libFrame"[^>]*sandbox="([^"]*)"/);
assert.ok(sandbox, 'iframe is sandboxed');
assert.match(sandbox[1], /allow-scripts/, 'the catalogue needs its filter/search script');
assert.doesNotMatch(sandbox[1], /allow-same-origin|allow-top-navigation/, 'the catalogue cannot reach the board, its token, or navigate it');
assert.doesNotMatch(grab('saveBlobCache'), /lib/, 'the catalogue is never written to the aka.blobs cache');

// the claude.ai link: from links.json through the token, never in this public source
assert.doesNotMatch(html, /claude\.ai\/artifact/, 'no artifact URL in the public source');
assert.match(html, /e\.path === "board" && e\.type === "tree"/, 'finds .agents/board on main');
assert.match(grab('readLinks'), /e\.path === "links\.json"[\s\S]*gh\(`\/git\/blobs\/\$\{f\.sha\}`\)[\s\S]*j\.library_artifact/, 'reads library_artifact from links.json');
assert.match(grab('renderLibrary'), /target="_blank" rel="noopener noreferrer">Open on claude\.ai</, 'link opens safely');
assert.match(grab('renderLibrary'), /link \? `<a /, 'link only renders when the file and key exist');
const { safeLink } = vm.runInNewContext(`${grab('safeLink')}; ({ safeLink })`, { URL });
assert.equal(safeLink('https://claude.ai/artifact/abc'), 'https://claude.ai/artifact/abc');
for (const bad of [undefined, null, '', 'javascript:alert(1)', 'http://claude.ai/x', 'https://evil.example/claude.ai', 'https://claude.ai.evil.example/']) assert.equal(safeLink(bad), null, `rejects ${bad}`);

// "Open in new tab": a blob: URL shares the board's origin, so its top level runs no script; the catalogue runs in a
// null-origin sandbox inside it, allowed only by the hash of its own inline script.
(async () => {
  const pages = [];
  const ctx = { window: { crypto: webcrypto }, crypto: webcrypto, TextEncoder, btoa, Uint8Array, Blob: class { constructor(parts) { pages.push(parts.join('')); } },
    URL: { createObjectURL: () => 'blob:x' }, esc: vm.runInNewContext(`(${grab('esc').replace(/^  const esc = /, '').replace(/;$/, '')})`) };
  vm.createContext(ctx);
  vm.runInContext(`${grab('libWrapperUrl')}; globalThis.wrap = libWrapperUrl;`, ctx);
  const script = '\nconst DATA = {"cards":[]};\ndocument.getElementById("out").textContent = "x" + "</p>";\n';
  const cat = `<!doctype html><html><head><title>AKAGames Systems Library</title><style>p{}</style></head><body><div id="out"></div><script>${script}</script></body></html>`;
  assert.equal(await ctx.wrap(cat), 'blob:x');
  const page = pages[0];
  const sha = createHash('sha256').update(script, 'utf8').digest('base64');
  assert.match(page, new RegExp(`Content-Security-Policy" content="script-src &#39;sha256-${sha.replace(/[+/]/g, '\\$&')}&#39;; object-src &#39;none&#39;`), 'CSP allows only the catalogue script by hash');
  const outside = page.replace(/srcdoc="[^"]*"/, 'srcdoc=""');
  assert.doesNotMatch(outside, /<script/i, 'no script at the wrapper top level');
  assert.match(outside, /<iframe title="AKAGames Systems Library" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"/, 'catalogue sandboxed in the new tab too');
  assert.doesNotMatch(outside, /allow-same-origin/);
  const srcdoc = page.match(/srcdoc="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.equal(srcdoc, cat, 'srcdoc round-trips the catalogue exactly');
  console.log('PASS library tab: view wired, library branch via blobs API, sandboxed frame, link from links.json only, hashed new-tab wrapper');
})().catch((e) => { console.error(e); process.exit(1); });
