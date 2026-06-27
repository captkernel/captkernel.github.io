# captkernel.com

Personal portfolio for **captKernel** (Karan Parmar) — a single static page hosted on
GitHub Pages at the apex domain `captkernel.com`.

## Stack

No build step, no framework. Just:

- `index.html` — all content, semantic HTML
- `styles.css` — dark technical theme (terminal green accent), responsive
- `main.js` — scroll-reveal + active-nav highlight (vanilla, progressive enhancement)
- `CNAME` — binds the repo to `captkernel.com`

## Local preview

Open `index.html` in a browser, or serve it:

```bash
python -m http.server 8080   # then visit http://localhost:8080
```

## Deploy

Hosted via GitHub Pages from the `main` branch of `captkernel/captkernel.github.io`.
DNS (apex A records + `www` CNAME) is managed on GoDaddy. See
`docs/superpowers/specs/2026-06-27-captkernel-portfolio-design.md` for the full design,
deployment steps, and DNS plan.

## Editing

- Add the X/Twitter link: uncomment the `<!-- X: ... -->` line in `index.html`.
- Projects are hardcoded cards in `index.html` under `#projects`.
