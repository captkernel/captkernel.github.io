# iOS Skin + OS Auto-Detection — Design

**Date:** 2026-08-24 · **Status:** Approved by Karan (metaphor: springboard; interiors: styled sheets v1)

## Goal

captkernel.com adapts to the visitor's device with three skins:

| Visitor | Skin |
|---|---|
| Windows, Android, Linux, unknown | **Linux** (existing, current default) |
| Mac, iPad | **macOS** (existing) |
| iPhone | **iOS** (new) — an iPhone springboard: the site becomes a home screen of "apps" |

The iOS skin completes the site's OS conceit: Linux desktop rice → macOS desktop → iOS home screen.

## Architecture

Third skin inside `index.html` (same pattern as the existing skins — no new page, no redirect):

- `body.ios` class + `osMode === 'ios'`.
- `initIOS()` builds the springboard DOM into its own container, the way `initMobile()` builds `#mobile`. Desktop (`#desktop`) and `#mobile` are hidden under `body.ios`.
- **All content comes from the existing data arrays** (`FEATURED`, `WIP`, `WORKROWS`, kernel items, terminal command logic). No content duplication; a card edit flows to all three skins.

Rejected alternatives: separate `/ios/` page (data drift or a data-extraction refactor, redirect hop); shared `site-data.js` extraction (biggest refactor, not needed for a skin).

## 1. Detection & routing

Resolved once at load, strict priority:

1. `?os=` URL override (`linux` | `macos` | `ios`) — works on any device, for previews.
2. Saved explicit choice — localStorage key written **only** when the user taps the OS switch. Detection must never override it.
3. Platform detection:
   - iPhone: UA contains `iPhone`.
   - Mac: platform starts `Mac` (or `userAgentData.platform === "macOS"`); **iPad** (reports as Mac with `maxTouchPoints > 1`, or UA `iPad`) → **macOS**, not iOS.
   - Everything else (Windows, Android, Linux) → Linux.
4. Fallback: Linux.

The OS switch gains a third button: `Linux · macOS · iOS`. Wrong detection is cosmetic-only; the switch fixes it in one tap and the choice persists.

## 2. Springboard (home screen)

Built by `initIOS()`:

- **Status bar** — live clock (HH:MM), signal/Wi-Fi/battery glyphs. Decorative, static except the clock.
- **Wallpaper** — the existing starfield canvas, reduced star count (mobile perf budget).
- **Hero widget** — one medium widget card at the top (iOS lock-screen-widget style): name, @captkernel, "solo AI builder — I direct, agents build", current status line. This is where the hero facet lives; there is no separate "home app".
- **Icon grid** — app icons with labels: About, Systems, The Kernel, System Info (the fetch window), Connect, C2B (external link to `/c2b/`, same tab).
- **Dock** — 4 pinned icons: Systems, The Kernel, Terminal, Connect. Frosted-glass bar.
- **Home indicator** — bottom pill; tap or swipe up returns to springboard from any app.
- Safe areas respected via `env(safe-area-inset-*)`; `viewport-fit=cover`. Single page of icons — no page dots, no rearranging (YAGNI).

## 3. Apps (v1 = styled sheets)

Tapping an icon zoom-opens a full-screen sheet:

- **iOS nav bar** — `‹ Back` chevron left, app title centered.
- **Visual language** — SF stack (`-apple-system, system-ui`), iOS dark palette, `#0a84ff` accent, grouped cards ~14px radius, subtle translucency/blur.
- **Content** — the existing mobile content blocks, restyled by `body.ios` CSS. Same DOM-building functions, iOS dress. Per-app native patterns (App Store cards, Mail-style feed, contact card) are a **later phase**, deliberately out of scope for v1.
- **Terminal** — the exception: opens as a true full-screen terminal reusing the existing zsh command logic (input, history, all commands).

## 4. Interactions

- Open: quick scale-up + fade from the tapped icon (CSS transitions only, no libraries).
- Close: `‹ Back`, or swipe-up on the home indicator.
- One app open at a time; springboard state is the default.

## 5. Constraints

- Single-file site stays single-file; vanilla JS/CSS; no build step; GitHub Pages static.
- Linux and macOS skins must be pixel-untouched (all new CSS scoped under `body.ios`).
- `theme-color` meta may switch per skin.
- No dates or cadence promises in any new copy (standing rule).

## 6. Testing

- Local server + Playwright iPhone emulation (viewport + UA): detection routes correctly for iPhone/iPad/Mac/Windows/Android UAs; `?os=` beats localStorage beats detection; explicit choice persists across reloads.
- Every app opens, renders its content, and closes both ways; terminal commands run.
- Desktop regression: Linux and macOS skins unchanged at desktop and ≤820px widths.
- Post-deploy spot check on a real iPhone.
