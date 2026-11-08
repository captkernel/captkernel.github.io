# Agentic Build — every screen looks built by agents on arrival

**Date:** 2026-11-08 · **Branch:** `agentic-build` · **Status:** approved design, pending plan

## Goal

When captkernel.com is opened fresh, and whenever a screen is opened for the first time in
that page load, the screen should look like it is being created from scratch by a team of AI
agents: visible agent cursors doing real work on the UI, with the code they "write"
streaming in a log beside or below it.

This is choreographed theatre over the site's real content (hybrid option C). A real
AI "rebuild this screen" path is **phase 2** and out of scope here.

## Two looks

### A — Crew build (every screen)
Three named, colour-coded agent cursors work on the window body at the same time:

- **layout** (blue `#61afef`) drags out boxes and slides repeated items (rows, cards, links) into place
- **writer** (green `#46d17a`) types headings and short text with a caret
- **stylist** (yellow `#e5c07b`) opens a swatch and paints containers, borders and colours

A code log strip (~90px, `#070a08`) runs along the bottom of the window, with each line
prefixed by the agent's name. When the build ends, the cursors fade, the log prints
`✓ built in N.Ns · 3 agents`, and the strip collapses.

### B — Hero swarm (first-ever desktop boot only)
The whole desktop starts as a blueprint (`#0b1622`, 14px blue grid). **16 agents** work in
parallel: architect, topbar, wm, eyebrow, headline, copy, cta, stats, ascii, fetch-data,
dock, icons, starfield, a11y, critic, painter. Each draws labelled blueprint boxes for its
region, and that region **paints into its real themed UI the moment its agent finishes**.
`a11y` stamps tab-order badges; `critic` flags one real-looking issue in red and fixes it to
green. `painter` then sweeps the night sky in and the blueprint fades out.

A console sits along the bottom: a roster of agent chips (dim, then lit while running, then
green when done) next to the interleaved code log. A meter shows
`agents N running · M/16 done · T s`. Total about 3s. On iOS a lighter variant uses 8 agents.

The reference mockups are `.superpowers/brainstorm/*/content/build-style-v3.html` (A) and
`hero-boot.html` (B). Visuals should match them.

## When each build plays

| Situation | Plays | Duration |
|---|---|---|
| First-ever visit, desktop (Linux/macOS skin) | B hero swarm, then home windows appear built | ~3s |
| Returning visit, home desktop | A, quick | ~0.7s |
| Window's first open in this page load, never seen in this browser | A, full | ~2–2.5s |
| Window's first open in this page load, seen on an earlier visit | A, quick | ~0.7s |
| Window reopened in the same page load | nothing (opens instantly, as today) | 0 |
| iOS springboard, first-ever visit | B light (8 agents placing icons) | ~2s |
| iOS app sheet | A (full or quick by the same rules) | — |
| Mobile stacked view | Each section builds A-quick the first time it scrolls into view; log is a thin strip under that section | ~0.7s |

"Seen" is per browser (`localStorage`), shared across OS skins. "This page load" is
in-memory: a reload is a new load.

Quick mode uses the same agents, faster, and the log's first line is
`cache warm · rebuilding…`.

### Always-on rules
- **Skip:** a click inside a building window, or Esc, finishes that build immediately (the
  click still goes through). During B, any key or click finishes the whole desktop.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, no build plays.
- **Content never blocked:** the real content is in the DOM from the start and only hidden
  visually during the build. Screen readers, crawlers and no-JS visitors are unaffected.
- **Tailored log lines:** each run adds local context lines such as `skin: macos`,
  `local time 23:40 → night palette` and `referrer: github` (hostname only).
- **Overrides:** `?ab=reset` clears the seen-record (replays the first visit);
  `?ab=off` disables the effect for that load.

## Architecture

New files: `agentbuild.js` and `agentbuild.css` in the repo root, loaded by `index.html`
with `defer`. They use the GSAP 3.12.5 the site already loads; one GSAP timeline per build,
so skip is `tl.progress(1)`. No new dependencies.

Global namespace `AB` with these units:

| Unit | Responsibility | Interface |
|---|---|---|
| `AB.memory` | seen-record in `localStorage.ckBuilt` (JSON map id→1) plus the in-memory set for this load; storage errors are treated as a first visit, silently | `seen(id)`, `mark(id)`, `firstVisit()`, `builtThisLoad(id)` |
| `AB.shouldBuild(id)` | applies the table above, reduced-motion and `?ab=` | returns `false`, `'full'` or `'quick'` |
| `AB.plan(bodyEl)` | walks the window body and returns ordered steps. Headings and short text → writer/type; repeated siblings (≥2 of the same tag+class: rows, cards, links, li) → layout/drop; containers with border/background → stylist/paint. Per-element override `data-ab="type\|drop\|paint\|skip"`. Off-screen elements become instant reveals | `plan(el) → Step[]` |
| `AB.log` | creates a log strip and appends lines. Code lines are **real snippets** of the element being built (outerHTML opening tag + text, truncated to ~70 chars, syntax-coloured) plus the tailored context lines; keeps the last ~14 lines | `log.create(host)`, `line(agent, html)` |
| `AB.crew(winEl, {quick})` | engine A: hides the body's content, runs 3 cursor lanes over the plan in parallel, reveals each element when its step completes, then removes the overlay and log and marks the window as seen | `→ Promise` (resolves on finish or skip) |
| `AB.swarm(desktopEl, {agents})` | engine B: blueprint layer, 16 (or 8) agent lanes, per-region paint-on-finish, sky sweep, roster console. The hero and fastfetch regions use `AB.plan`; topbar, dock, stars, a11y, critic and painter are fixed lanes | `→ Promise` |

Cursor positions are always calculated from live `getBoundingClientRect()` values at run
time, so the effect works at any window size. Only `transform` and `opacity` are animated.

### Hook points in `index.html` (small, guarded edits)
- `openApp(id)` (~line 1360), after `desktop.appendChild(el)` and `relayout()`:
  `if (window.AB) { var m = AB.shouldBuild(id); if (m) AB.crew(el, {quick: m === 'quick'}); }`
- Boot (~line 2575), desktop branch: on a first visit, `AB.swarm(desktop).then(...)` with the
  home windows opened before the swarm starts and hidden under the blueprint until their
  regions paint; otherwise `openApp('home')` as today, which then gets A-quick through the
  hook above.
- `iosOpen(...)`: the same `AB.crew` call on the sheet body. `initIOS`: B-light on a first visit.
- `initMobile()`: an IntersectionObserver on each section calls `AB.crew(section, {quick:true})` once.
- `applyOs(...)`: call `AB.finishAll()` before switching.

If `agentbuild.js` fails to load or throws, `window.AB` is undefined, the hooks are skipped,
and the site behaves exactly as it does today.

## Edge cases
- Close, minimise, maximise or drag mid-build: the build finishes instantly and its overlay
  and log are removed; nothing is left behind.
- Several windows building at once: independent crews, each with its own log.
- `?brief=<id>` deep link on a first visit: the swarm is replaced by A-quick so the brief
  appears within ~1s.
- Content that arrives asynchronously (Create library, terminal-AI output) is not part of
  the build; it appears as it does today.
- Window too small for the log strip (height < 220px): the log shows as a one-line overlay.

## Performance
- `agentbuild.js` + `.css` stay under ~12 KB gzipped.
- 60fps target for B on a mid-range laptop; respects the existing `P.count` star caps.
- Builds never delay first paint (`defer` load; B starts after `DOMContentLoaded`).

## Testing (Playwright)
1. First visit (clean storage) → swarm runs, roster reaches 16/16, `ckBuilt` contains the home ids.
2. Reload → home gets A-quick (log first line `cache warm`).
3. Open `about` for the first time → A full; close and reopen → no build.
4. Esc during a build → content is fully visible within 1 frame; no overlay nodes remain.
5. `prefers-reduced-motion` emulated → no overlay nodes ever created.
6. `localStorage` throwing → behaves like a first visit, with no console errors.
7. `?ab=off` → no builds; `?ab=reset` → swarm again.
8. One pass each: Linux skin, macOS skin, iOS skin, mobile width (390px).

## Out of scope (phase 2)
- "↻ rebuild with AI": a real terminal-AI worker call that generates a fresh variant of a
  screen. Needs its own prompt design, cost limits and failure UX.
- Builds for nested in-window views (e.g. a project detail inside `~/systems`).
