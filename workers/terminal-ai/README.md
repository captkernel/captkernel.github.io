# captkernel-terminal

The Claude-backed brain behind the terminal on captkernel.com. With no worker URL set, the
terminal still works offline (built-in commands + keyword answers).

| Route | What |
|---|---|
| `POST /ask` | SSE stream: `text` deltas, `ui` actions (`show_projects`, `open_window`, `render_brief`, `suggest_next`), then `done` with the turn's messages for the client to append |
| `POST /brief` | save a fit/scope brief → `{id}` for a `/?brief=<id>` share link; with `send:true` + `contact` it also lands in Karan's inbox |
| `GET /brief/:id` | public read of a saved brief (90-day TTL) |
| `GET /inbox` | briefs sent to Karan — `Authorization: Bearer $ADMIN_SECRET` |
| `POST /create` | SSE stream of a single-file HTML build (or an edit of one); `done` carries the saved build's `id` |
| `GET /artifact/:id` | a saved build (public by unguessable id; the visitor hash is never returned) |
| `POST /create/plan` | `{id}` → structured go-live plan (hosting, architecture, steps, secrets, costs, checklist); cached per build |
| `POST /host` · `GET /host/:slug` | request `captkernel.com/<slug>` for a build · check its status (`free`/`pending`/`live`/`rejected`/`removed`) |
| `GET /admin` | Karan's console: approve / reject / take down hosting requests, browse the build library |

**Create.** Every finished build (and every edit, linked to its parent) is kept in KV with no expiry; that's
the library. A new build is given the closest earlier build (same kind + overlapping words, latest version
of each lineage, under 45 KB) as a reference to reuse from. Visitors keep their build ids in localStorage
("your builds") and can reopen and keep editing. **Hosting:** a request sits as `pending` until Karan
approves it at `/admin`; approval commits `<slug>/index.html` to `GH_REPO` on `GH_BRANCH` via the GitHub
API, and GitHub Pages publishes it. The page is a thin shell that runs the build in a sandboxed iframe
(opaque origin, CSP: no network/storage), so a hosted build can't touch captkernel.com's own storage or
cookies. Reserved paths (`c2b`, `sky`, `docs`, `admin`, …) and paths that already exist in the repo are refused.

**Grounding.** `build-kb.mjs` builds the knowledge base from `index.html` itself (FEATURED, WIP,
WORKROWS, About, The Kernel) plus `kb-notes.md`, and it runs before `dev`/`deploy`, so the model only
knows what the site says. Edit a project card and the next deploy picks it up. The model never writes
HTML: tools carry project keys and plain strings, and the page renders cards and links from its own data.

**Conversation.** The client keeps the transcript and sends it back unchanged (append-only, so
thinking blocks and the prompt cache stay valid). Capped at 12 questions per session; then `reset`.

## Deploy

```bash
cd workers/terminal-ai
npm install
npx wrangler kv namespace create TERM          # paste the id into wrangler.jsonc
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put IP_SALT                # any random string
npx wrangler secret put ADMIN_SECRET           # for /inbox and /admin
npx wrangler secret put GITHUB_TOKEN           # fine-grained PAT: captkernel.github.io only, Contents: read & write
npm run deploy
```

Then set `var TERM_AI='https://captkernel-terminal.<you>.workers.dev';` in `index.html`.

Read the inbox: `curl -H "Authorization: Bearer $ADMIN_SECRET" https://…/inbox`

Approve hosting: open `https://…/admin`, paste `ADMIN_SECRET` once (kept in that browser), then Approve & publish.

## Cost guards

`MODEL` is `claude-sonnet-5-5` everywhere. `ASK_PER_DAY` (40 per visitor), `ASK_GLOBAL_PER_DAY` (1500), `BRIEF_PER_DAY`,
`CREATE_PER_DAY` (4), `REFINE_PER_DAY` (12), `PLAN_PER_DAY` (8), `HOST_PER_DAY` (3) and `CREATE_GLOBAL_PER_DAY`
(150 builds + edits + plans) live in `wrangler.jsonc` vars. Chat runs at effort `low`; fit/scope/explain/compare
run at `medium`. The system prompt and knowledge base (~5k tokens) are prompt-cached.

## Local dev

`.dev.vars` (git-ignored) holds the secrets for `wrangler dev`. Point the page at it with
`localStorage.ckTermAI = 'http://127.0.0.1:8787'` and serve the site on :8000.
`ANTHROPIC_BASE_URL` in `.dev.vars` can point at a mock API for offline testing, and `GH_API` at a fake
GitHub contents API (local only — never set it in production). On Windows, stopping `wrangler dev` can leave
`workerd.exe` running and still serving the port; kill it before restarting or you'll test stale code/vars.
