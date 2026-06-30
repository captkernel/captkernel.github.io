# Featured Work Redesign — captkernel.com (`~/systems`)

**Date:** 2026-07-01
**Goal:** Publish **Knob**, **Skills Curator**, and **Claunchpad** as the flagship finished
pieces of work, with real flair and detail, and curate the rest of the `~/systems` list.

## Problem

The `work` window (`~/systems — all work`) is a flat 30-row Finder list with no hierarchy,
detail, or flair. Skills Curator appears twice (rows 01 + 08), Knob is buried at row 02 as
"sounddeck / knob", and Claunchpad isn't listed at all. Nothing communicates that these are
finished, shippable products.

## Approved design (Approach A)

All changes stay self-contained in `index.html` (inline CSS/JS, existing palette).

### 1. Featured "★ shipped" band
A pinned band at the top of the `w-work` window with three rich cards:

| Project | Tagline | CTAs |
|---|---|---|
| **Knob** | Windows audio + display control, one hotkey | `Download ↓` (releases/latest), `GitHub` |
| **Skills Curator** | The intelligence layer for Claude skills | `GitHub`, `What it does` (→ detail) |
| **Claunchpad** | One skill; Claude works like a pro, zero setup | `See showcase`, `GitHub` |

Each card: wordmark/icon, tagline, 2–3 feature chips, a status/`● live` badge, CTA buttons.
Clicking the card body (not a button) opens the detail view.

### 2. In-window detail view
Clicking a card swaps the band+list area for a detail panel (pure JS state, no new window):
ASCII/emoji header, a tightened README pitch, grouped feature bullets, an "under the hood"
stack line, and the CTA buttons. A `← back` control restores the band+list.

### 3. Curated list (below the band)
- Flagships removed from the list (now in the band).
- The 4 public toolkit repos (dev/everyday/writing/thinking) collapse into **one "Toolkits"
  collection** entry linking to GitHub.
- **Removed from public site:** `awesome-agent-skills` (fork), `skills (intel layer)`
  (duplicate of Skills Curator), `instacomp`, `tcw` (personal IG bots), `alpha indoor games`
  (early client site).
- **Kept:** Hal, FooFindr, ANCYR, Smart Metronome, Image-Blaster, Chat2Business,
  Dashboard (PCC), Memory Manager, captkernel.com, Accenture, plus existing `⚠` client/private
  rows still auto-hidden by the `⚠` filter.

### 4. Flair + responsive
Accent-bordered cards, subtle hover-lift, mono tech-tags, `● live` / `↓` badges, existing
palette (`--accent #46d17a`, `--blue`, `--yellow`). The 3-card grid collapses to one column
under the `≤820px` mobile breakpoint; detail view works identically in the `#mobile` card.

## URLs
- Knob — https://github.com/captkernel/Knob (download: `/releases/latest`)
- Skills Curator — https://github.com/captkernel/Skills_Curator
- Claunchpad — https://github.com/captkernel/Claunchpad
  (showcase: `https://htmlpreview.github.io/?https://github.com/captkernel/Claunchpad/blob/master/showcase.html`)

## Deploy
Commit as `17477913+captkernel@users.noreply.github.com`, push `master` (Pages serves
`master`/root), confirm the build.
