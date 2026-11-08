# Agentic Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every captkernel.com screen look built by visible AI agents the first time it opens, using a crew build (A) per window and a 16-agent blueprint swarm (B) on the first-ever boot.

**Architecture:** One standalone script `agentbuild.js` + `agentbuild.css` exposes `window.AB`. It plans a build from a window's DOM, hides the planned elements, and replays their reveal on a GSAP timeline driven by agent cursors, with a code log. `index.html` gets small guarded hooks (`openApp`, boot, `iosOpen`, `initIOS`, `initMobile`, `applyOs`). If AB or GSAP is missing, every hook is a no-op.

**Tech Stack:** Vanilla JS (ES2017, no build step), GSAP 3.12.5 (already loaded from cdnjs), Playwright 1.62 + `node:test` for tests (in `tests/agentbuild/`, node_modules ignored).

## Global Constraints

- No new runtime dependencies; GSAP 3.12.5 is the only animation library.
- `agentbuild.js` + `agentbuild.css` ≤ ~12 KB gzipped; loaded with `defer`.
- Animate only `transform`, `opacity`, `clip-path`; never mutate real content text or remove real nodes.
- Seen-record: `localStorage.ckBuilt` (JSON object, id→1, plus `_boot`). Storage errors → behave as first visit, no console errors.
- Durations: full crew ≈ 2–2.5s, quick ≈ 0.7s, swarm ≈ 3s (desktop, 16 agents), iOS light ≈ 2s (8 agents).
- `prefers-reduced-motion: reduce` → no builds. `?ab=off` → no builds. `?ab=reset` → clear `ckBuilt` first.
- Skip: pointerdown/wheel inside a building window finishes it; Esc finishes all; any key/click finishes the swarm.
- Agent colours: layout `#61afef`, writer `#46d17a`, stylist `#e5c07b`; blueprint `#0b1622` with `#61afef14` 14px grid.
- Hooks must be guarded: `if (window.AB) …`.

## File map

| File | Responsibility |
|---|---|
| `agentbuild.js` (create) | `AB.memory`, `AB.shouldBuild`, `AB.plan`, log, `AB.crew`, `AB.swarm`, `AB.swarmIOS`, `AB.finishAll` |
| `agentbuild.css` (create) | hidden/wire states, cursors, log strip, blueprint, console |
| `index.html` (modify) | `<link>`/`<script defer>` tags + hooks |
| `tests/agentbuild/package.json` (create) | test deps (`playwright@1.62.1`) |
| `tests/agentbuild/server.mjs` (create) | tiny static server for the repo root |
| `tests/agentbuild/agentbuild.test.mjs` (create) | Playwright behaviour tests |

---

### Task 1: Test harness + AB core (memory, shouldBuild, flags) + openApp hook

**Interfaces — Produces:**
- `AB.memory.seen(id) → bool`, `AB.memory.mark(id)`, `AB.memory.firstVisit() → bool`, `AB.memory.markBoot()`, `AB.memory.builtThisLoad(id) → bool`
- `AB.shouldBuild(id) → false | 'full' | 'quick'` (false if reduced motion, `?ab=off`, no gsap, or already built this load)
- `AB.crew(winEl, {quick, id}) → Promise` (stub in this task: resolves immediately)

- [ ] Write `tests/agentbuild/server.mjs`, `package.json`, and tests:
  `shouldBuild` returns `'full'` for an unseen id, `'quick'` after `mark`, `false` on second call in same load; `?ab=off` → false; reduced motion → false; `localStorage` throwing → `firstVisit()` true with no page errors.
- [ ] Run `node --test tests/agentbuild/` → FAIL (AB undefined).
- [ ] Implement core in `agentbuild.js`; add `<link rel="stylesheet" href="agentbuild.css">` and `<script defer src="agentbuild.js">` **before** the main inline script is not possible with defer — instead load `agentbuild.js` synchronously right after GSAP (it only defines `AB`, no DOM work) and guard hooks with `window.AB`.
- [ ] Hook `openApp`: after `wire(id);relayout();focus(id);markRun();` add
  `if(window.AB){var _m=AB.shouldBuild(id);if(_m){el.classList.remove('opening');AB.crew(el,{quick:_m==='quick',id:id});}}`
- [ ] Run tests → PASS. Commit.

### Task 2: Planner `AB.plan(bodyEl)`

**Interfaces — Produces:** `AB.plan(root) → Step[]`, `Step = {el, kind:'type'|'drop'|'paint'|'instant', agent:'writer'|'layout'|'stylist'|null, chars:number}`

Rules (DOM order, depth-first from `root`'s children):
1. Skip invisible (zero rect), `script/style/template`, `data-ab="skip"`.
2. `data-ab` = type|drop|paint forces kind.
3. Element whose parent has ≥2 element children with same `tagName+className` → `drop` (don't descend).
4. Element with non-whitespace own text and no block-level element children, or `img/svg/canvas/pre/input/button` → `type` (svg/img/canvas/input → `drop`); don't descend.
5. Element with non-transparent background or visible border (computed) → `paint`, then descend.
6. Otherwise descend.
7. Elements whose top is below the root's visible bottom → `instant`.
8. Max 48 animated steps; the rest become `instant`.

- [ ] Tests: on a fresh `about` window, plan has ≥1 `type` step and kinds only from the set; on `work`, ≥3 `drop` steps; every step's `el` is inside the body; no step is a descendant of a `type`/`drop` step.
- [ ] Implement, run, commit.

### Task 3: Crew engine A + code log + skip

**Interfaces — Consumes:** `AB.plan`. **Produces:** `AB.crew(winEl,{quick,id}) → Promise`, `AB.finish(winEl)`, `AB.finishAll()`; DOM: `.ab-layer` (cursors) and `.ab-log` inside `winEl` during build; `winEl.dataset.ab='building'|'done'`.

Behaviour: mark seen + built-this-load immediately; wait one rAF (layout settles); plan `.wbody` (or root itself for iOS/mobile); apply hidden states (`ab-h-type` clip-path inset right 100%, `ab-h-drop` opacity 0 + translateX 28px, `ab-h-paint` wire style); build a GSAP timeline with three lanes (writer/layout/stylist) each moving its cursor to the step rect and revealing; log lines = real code snippets; scale timeline to ≤2.4s full / ≤0.7s quick; on complete or skip → `progress(1)`, remove classes + overlay, log prints `✓ built in Ns · 3 agents` then fades.

- [ ] Tests: opening `about` creates `.ab-layer` within 200ms and removes it within 3.5s; reopen in same load creates none; Esc mid-build → within 100ms no `.ab-layer`, no `[class*="ab-h-"]` left; reduced motion → none ever; second page load → log's first line contains `cache warm`.
- [ ] Implement, run, commit.

### Task 4: Swarm engine B + boot hook + `?brief`

**Interfaces — Produces:** `AB.swarm(desktopEl, {wins:[el…], dock:el, topbar:el|null}) → Promise`, roster DOM `.ab-console .ab-chip` (16), meter `.ab-meter`.

Boot change (desktop branch): `if(window.AB&&AB.shouldSwarm()){openApp('home') /* crews suppressed via AB.suppress */; AB.swarm(...)} else openApp('home')`. `AB.shouldSwarm()` = firstVisit && not reduced/off && no `?brief`. Swarm marks `_boot` + home ids seen.

Lanes: architect (guides), topbar, wm (window frames reveal), dock, icons, starfield, a11y, critic, painter + up to 7 content agents built from `AB.plan` of hero+fetch grouped by top-level element, named from class/tag. Painter wipes the blueprint layer away to reveal the real sky.

- [ ] Tests: clean storage → `.ab-chip` count 16, all `.ok` within 5s, then no `.ab-bp` left and `ckBuilt._boot` set; reload → no `.ab-bp`, hero gets quick crew; `?brief=000000000000` on first visit → no `.ab-bp`.
- [ ] Implement, run, commit.

### Task 5: iOS + mobile + applyOs

- `initIOS` end: `if(window.AB&&AB.shouldSwarm())AB.swarmIOS(host)` (8 agents over widgets, icon grid, search, dock).
- `iosOpen`: after the sheet opens, `if(window.AB){var m=AB.shouldBuild('ios-'+key)… setTimeout(()=>AB.crew(sheet,{quick, id, root:sheet}),360)}` — iOS ids map to the same screen ids (`key`).
- `initMobile`: IntersectionObserver (threshold .25) per `.m-card`; on first intersect `AB.crew(sec,{quick:true,id,root:sec.querySelector('.wbody')})`, then unobserve. Sections are pre-hidden only at intersect time (above-the-fold first section builds immediately).
- `applyOs`: first line `if(window.AB)AB.finishAll();`.

- [ ] Tests: `?os=ios` clean storage → `.ab-chip` count 8; open about sheet → `.ab-layer` appears; width 390 → scrolling to `#m-work` creates a build in that section; switching OS mid-build leaves no `.ab-layer`.
- [ ] Implement, run, commit.

### Task 6: Visual review + budget

- [ ] Screenshot mid-swarm, mid-crew (Linux, macOS, iOS, mobile) and compare against the mockups; fix visual issues.
- [ ] `gzip -c agentbuild.js | wc -c` + css ≤ 12 KB.
- [ ] Full test run; commit.
