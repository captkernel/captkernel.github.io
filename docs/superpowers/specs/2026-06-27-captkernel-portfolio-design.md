# captKernel — Personal Portfolio (captkernel.com)

**Date:** 2026-06-27
**Owner:** Karan Parmar (captKernel)
**Status:** Design — awaiting review

## Purpose

A single-page personal portfolio / personal-brand site hosted on GitHub Pages and
served at the apex domain `captkernel.com` (domain on GoDaddy). It represents Karan
Parmar publicly as an AI builder: by day an AI Decision Science Manager at Accenture,
independently a prolific builder of AI agents, developer tooling, and small desktop apps.

## Success criteria

- Loads at `https://captkernel.com` (and `https://www.captkernel.com`) over HTTPS.
- Dark, technical aesthetic that feels deliberate, fast, and accessible.
- Content is real (drawn from GitHub + confirmed facts), not placeholder.
- Easy for Karan to edit later (no build step, no framework).
- Existing email (Mailgun) on the domain keeps working — DNS change touches only the
  apex `A` records and the `www` CNAME.

## Identity & content (confirmed)

- **Display name:** captKernel (real name Karan Parmar shown in About/footer).
- **Hero headline:** `I build with AI.`
  - **Supporting line:** `Agents, developer tools, and the occasional desktop app.`
- **About:** captKernel is the workshop of Karan Parmar — an AI Decision Science Manager
  at Accenture working at the industrial edge of generative AI. Off the clock he builds
  relentlessly: autonomous agents, developer tooling for Claude Code, and small sharp
  desktop apps. This site is where that work lives.
- **What I do** (replaces a dated work timeline — 3 short cards):
  1. **AI agents & automation** — autonomous, tool-using agents that do real work.
  2. **Developer tooling** — toolkits and skills that make AI coding sharper (Claude Code).
  3. **Desktop & product builds** — polished native apps and end-to-end products.
- **Projects** (public GitHub repos only — private `C:\Claude\` work is NOT named):
  - **SoundDeck** (`sounddeck`, TypeScript) — Windows 11 tray audio control panel:
    switch devices, ride volume, test mics, save profiles. Native acrylic UI, hotkeys,
    auto-update.
  - **Claude Dev Toolkit** (`claude-dev-toolkit`, Python) — CLAUDE.md starter kit,
    secrets manager, frontend self-review, A2A tutorial.
  - **Claude Everyday Tools** (`claude-everyday-tools`, Python) — /flights /farecheck
    /focus /learn and more, plus a wardrobe app.
  - **Claude Writing Tools** (`claude-writing-tools`) — /humanize /tighten /hook and a
    brand+publish pipeline.
  - **Claude Thinking Tools** (`claude-thinking-tools`) — council skill, /brutal
    /premortem /redteam /pressure-test.
  - **Skills Curator** (`Skills_Curator`, Python) — evaluates Claude Code skills before
    installing and persists every decision. *(★ featured — only starred repo.)*
  - Each card: title, one-line description, language tag, GitHub link. Cards link to the
    repo. "See all on GitHub →" link to the profile.
- **Skills** (tag grid): TypeScript, Python, Claude Code / Agent SDK, LLM / GenAI,
  Prompt & agent design, Node.js, Electron, Git/GitHub, Windows tooling, REST APIs.
- **Contact / links:** GitHub (`github.com/captkernel`),
  LinkedIn (`linkedin.com/in/karanparmar99`), X. *(Email NOT shown.)*
  - NOTE: X/Twitter handle is unknown — **placeholder `https://x.com/` until Karan
    supplies the handle**; if none, the X link is omitted.

## Architecture

Deliberately minimal — static files, no build step, no framework.

```
captkernel.github.io/   (GitHub repo, also developed in C:\Claude\Portfolio)
├── index.html          # all sections, semantic HTML
├── styles.css          # dark technical theme, responsive
├── main.js             # scroll-reveal, active-nav highlight (vanilla, progressive)
├── assets/             # favicon, og image, any icons
├── CNAME               # contains: captkernel.com
└── README.md
```

- **Single page**, sticky top nav with smooth-scroll anchors:
  About · What I do · Projects · Skills · Contact.
- **No external runtime dependencies.** Fonts via system stack + optional self-hosted
  monospace (JetBrains Mono) to avoid third-party calls; fall back to system mono.
- JS is **progressive enhancement** — the site is fully readable with JS disabled.

### Visual design (dark & technical)

- Background near-black, GitHub-dark family (`#0d1117` base, `#161b22` panels).
- Single accent: **terminal green `#3fb950`** (with a cyan secondary for hovers).
- Headings/labels in **monospace**; body in a clean sans (system stack).
- Hero motif: a faux terminal prompt (`captkernel:~$`) with the headline "typed" after
  it (CSS, optional JS cursor blink). Tasteful, not a gimmick.
- Project cards: subtle border, hover lift, language shown as a colored dot + label.
- Fully **responsive** (mobile-first), **accessible** (semantic landmarks, alt text,
  ≥4.5:1 contrast, focus-visible states, `prefers-reduced-motion` respected).

## Components (single-purpose units)

| Unit | Purpose | Depends on |
|------|---------|-----------|
| `index.html` | Document structure & all content | none |
| `styles.css` | Theme, layout, responsive, motion | design tokens (CSS vars) |
| `main.js` | Scroll-reveal + active-nav highlight | IntersectionObserver |
| `CNAME` | Binds repo to custom apex domain | GitHub Pages |
| `assets/` | favicon + OpenGraph share image | none |

## Deployment & DNS

1. Build/iterate locally in `C:\Claude\Portfolio` (git repo).
2. Karan creates an **empty** GitHub repo named **`captkernel.github.io`** (user Pages
   site → serves at the domain root). Claude provides exact push commands.
3. Push site to `main`; enable **GitHub Pages** (source: `main` branch, root).
4. Set **custom domain** `captkernel.com` in repo Pages settings (writes/uses CNAME).
5. **GoDaddy DNS** (via GoDaddy API / domain-suite-mcp), changing ONLY:
   - Apex `@` `A` records → GitHub Pages IPs:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (replaces the current WebsiteBuilder `A` record).
   - `www` `CNAME` → `captkernel.github.io` (replaces current `www → @`).
   - **Untouched:** all Mailgun MX/SPF/CNAME (email), NS, `_domainconnect`.
6. Wait for DNS propagation; enable **Enforce HTTPS** in Pages settings.

## Error handling / edge cases

- **DNS rollback:** capture current records (already read) to a backup file before any
  change, so the WebsiteBuilder/www records can be restored if needed.
- **Apex vs www:** both must resolve; `www` CNAME + apex A records cover redirect both ways.
- **HTTPS cert lag:** GitHub issues the cert after DNS resolves; "Enforce HTTPS" may be
  greyed out for a few minutes/hours — expected, not an error.
- **Email safety:** Mailgun records explicitly excluded from the DNS update.
- **Credentials:** GoDaddy key/secret live only in gitignored `.secrets/godaddy.env`.

## Testing / verification

- Local: open `index.html`, check all sections, nav anchors, responsive breakpoints
  (mobile/tablet/desktop), keyboard navigation, reduced-motion, JS-disabled readability.
- Lighthouse pass target: Performance ≥95, Accessibility ≥95, Best Practices ≥95.
- Post-deploy: `https://captkernel.com` and `https://www.captkernel.com` both load over
  HTTPS; `dig`/`nslookup` shows the 4 GitHub A records; send a test email to confirm
  Mailgun still works.

## Out of scope (YAGNI)

- No CMS, no blog (can be added later as a separate sub-project).
- No analytics initially (can add privacy-friendly analytics later if wanted).
- No contact form / backend — links only.
- No framework, bundler, or CI.

## Open items for Karan

1. **X/Twitter handle** (or confirm to omit X).
2. Approve the About copy and "What I do" card wording.
3. Confirm headline `I build with AI.` + supporting line.
4. Optional: a favicon/logo preference (default: monospace `>_` mark in accent green).
