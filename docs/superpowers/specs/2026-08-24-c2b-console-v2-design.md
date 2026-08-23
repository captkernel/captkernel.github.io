# C2B Console v2 — Design Spec

Date: 2026-08-24
Repos touched: `Portfolio` (console page + Cloudflare Worker), `Chat2Business` (crew pull command)
Status: awaiting user review

## Goal

Upgrade the hosted C2B console (captkernel.com/c2b/, source `Portfolio/c2b/index.html`) with:

1. **Voice-note input** — upload a voice memo or record live, transcribed to text that feeds the existing pipeline.
2. **A redesigned UI** matching the main site's desktop metaphor, with the same Linux/macOS skin switch.
3. **A public inbox** that queues voice notes for Karan's local Chat2Business pipeline, processed on his machine (subscription via `claude -p`) whenever he drains the queue.

Explicitly out of scope: subscription-based execution *in the page* (impossible — browsers cannot authenticate with a Claude subscription; verified Aug 2026 that the Anthropic API also has no audio input). The page remains BYO-API-key for in-page runs.

## Architecture

```
Portfolio/c2b/index.html          one self-contained static page (unchanged deployment)
Portfolio/workers/c2b-transcribe/ one Cloudflare Worker + R2 bucket (new, owner-deployed)
Chat2Business/crew/pull.py        queue drainer → OneDrive Inbox → existing watcher pipeline
```

The page has three actions:

| Action | Needs | What happens |
|---|---|---|
| Run here (existing) | visitor's Anthropic key | structure → research → council → verdict → MVP, client-side |
| Transcribe voice note | nothing (local) or Worker (fast mode) | audio → text into the idea box |
| Send to the C2B pipeline | nothing | audio + optional note queued to R2; Karan's machine processes later |

## Component 1: Voice input (page)

- New "voice note" window above the idea box: drag-drop / file-pick (m4a, mp3, wav, ogg, webm) **and** mic record via `MediaRecorder`.
- Audio decoded in-browser to 16 kHz mono PCM with `AudioContext.decodeAudioData` (handles iPhone .m4a natively in all major browsers).
- Transcript streams into the existing idea textarea — editable before Run. Pipeline stages untouched.

## Component 2: Transcription engines (page)

Two engines behind one interface; per-run choice, default local.

- **Local (default):** `whisper-base` via `@huggingface/transformers@4.2.0` (jsDelivr ESM import), `device: webgpu` when `navigator.gpu` exists else `wasm`, `dtype: 'q8'`, `chunk_length_s: 30, stride_length_s: 5`. Runs in an inline Web Worker (Blob URL — page stays single-file). One-time ~100–200 MB model download with progress bar; browser-cached afterwards. Audio never leaves the device. Fallback pin if v4 misbehaves: `@3.8.1`.
- **Fast mode (toggle):** page slices the already-decoded PCM into ~30 s WAV chunks client-side and POSTs them sequentially to `POST /transcribe` on the Worker, which calls Workers AI `@cf/openai/whisper-large-v3-turbo` (~$0.0005/audio-min, free tier likely sufficient). Client-side chunking sidesteps the Worker's ~1 MB body limit and all container-format doubts. Owner-funded; page shows "fast mode unavailable" gracefully if the Worker isn't deployed.

## Component 3: Cloudflare Worker (`Portfolio/workers/c2b-transcribe/`)

Single Worker, three routes, CORS locked to `https://captkernel.com` (+ localhost for dev):

- `POST /transcribe` — body: WAV chunk; runs Workers AI whisper-large-v3-turbo; returns `{text}`. Rate-limited per IP.
- `POST /inbox` — public. Multipart: one audio file ≤ 10 MB (content-type must be audio/*) + optional text note (≤ 2 KB). Guards: per-IP rate limit ~5/day, global queue cap ~200 objects (reject with friendly message when full). Stores to R2 as `inbox/<timestamp>-<random>.<ext>` + sidecar JSON (note, UA, IP hash, received-at). Returns a short confirmation ID.
- `GET /inbox` + `GET /inbox/<id>` + `DELETE /inbox/<id>` — require `Authorization: Bearer <PULL_SECRET>` (Worker secret). List / download / delete queue items.

Bindings: `AI`, R2 bucket `c2b-inbox`, KV or rate-limit binding for per-IP counters. Config in `wrangler.jsonc`. Deployment is part of this task (wrangler, Karan's CF account).

## Component 4: `crew pull` (Chat2Business)

- `py -m crew.pull` — GETs the queue with `PULL_SECRET` (read from `.secrets`/env, never committed), downloads each item into the OneDrive Inbox folder the existing watcher ingests (audio file + `<name>.note.txt` when a text note exists), then DELETEs it from R2. Idempotent; skips already-downloaded IDs.
- `crew/watch.py` gains an optional pre-scan hook: if pull is configured, drain the queue at the start of each watch cycle. No other pipeline changes — `captured → transcribed → structured → reviewed` runs exactly as today, on the subscription.
- Abuse posture: nothing processes unsupervised unless the watcher is armed; crew's existing consent-manifest/budget/kill-switch model applies. Junk triage is manual.

## Component 5: UI redesign (taste-skill)

- Restyle the console to the main site's desktop-metaphor language: window chrome (`.wbar`-style bars), matching accents and typography discipline.
- **OS switch identical to the main site:** same `.osswitch` control (bottom-left), same `body.macos` skin conventions (traffic-light window controls, SF/system font stack, system-blue accent, vibrancy), and the **same `localStorage.ckOS` key** so the choice carries between captkernel.com and /c2b/ in both directions. Linux skin (refined current terminal-green) is the default.
- Applied with the installed `taste-skill` (audit-first redesign flow). Single file; no third-party scripts beyond the transformers CDN import. Privacy footer rewritten to state exactly what loads and where audio goes in each mode (local = never leaves device; fast mode = transits Worker, not stored; send-to-pipeline = stored until Karan pulls it).

## Error handling

- No WebGPU → WASM silently. Decode failure → message naming supported formats. Model download failure → retry + offer fast mode.
- Fast-mode failure (network/quota) → one-click fallback to local whisper.
- Inbox full / rate-limited → friendly message, suggest running here instead.
- Existing Anthropic API error handling unchanged.

## Testing

- Serve page locally; Playwright-drive both skins; verify `ckOS` persistence across main site ↔ /c2b/.
- Transcribe a real sample voice memo (m4a + webm from MediaRecorder) through the local engine; through fast mode once the Worker is deployed.
- Worker: `wrangler dev` tests for route auth, size cap, rate limit, CORS; then deployed smoke test.
- `crew pull`: unit test against a stubbed queue; live test end-to-end (page → R2 → pull → Inbox → watcher run).

## Decisions log

- API-key only in-page; no local bridge for execution (user, 2026-08-24).
- Transcription: both in-browser whisper (default) and hosted fast mode (user).
- Voice input: file upload + live recording, available to all visitors (user).
- Inbox: public, anyone can submit; guarded by size/rate/queue caps (user).
- "Send to pipeline" sits beside "Run here", not replacing it (user).
- taste-skill (Leonxlnx/taste-skill) installed and security-scanned for the redesign (curator verdict: ADOPT).
