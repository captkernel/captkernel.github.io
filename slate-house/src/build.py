#!/usr/bin/env python3
"""Builds the Slate House site from content.json.

    python3 src/build.py

Writes index.html, rooms/, house/, visit/ and enquire/ next to the assets folder.
Standard library only. Edit content.json, run this, commit the result.
"""
import hashlib
import html
import json
import math
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C = json.loads((ROOT / "src" / "content.json").read_text(encoding="utf-8"))
SITE, ROOMS, FLOORS, HOUSE, VISIT, SEASONS = C["site"], C["rooms"], C["floors"], C["house"], C["visit"], C["seasons"]
CONTACT = SITE["contact"]
ROOM = {r["slug"]: r for r in ROOMS}
FLOOR = {f["k"]: f for f in FLOORS}
U_W, U_H = 2000, 1500          # the photo's coordinate space for floor outlines

e = lambda s: html.escape(str(s), quote=True)
inr = lambda n: "₹" + f"{n:,}"
sqft = lambda m2: int(round(m2 * 10.764 / 5.0) * 5)
pct = lambda v, of: f"{v / of * 100:.3f}%"


def ver(name):
    return hashlib.sha1((ROOT / "assets" / name).read_bytes()).hexdigest()[:8]


def unit(room):
    return "suite" if "Suite" in room["name"] else ("loft" if room["name"] == "Loft" else "room")


def plural(n, word):
    return f"{n} {word}" + ("" if n == 1 else "s")


# ---------------------------------------------------------------- shared parts

NAV = [("rooms/", "Rooms"), ("house/", "The house"), ("visit/", "Visit")]


def header(R, current, on_stage=False):
    cur = lambda href: ' aria-current="page"' if current == href else ""
    links = "".join(f'<a href="{R}{href}"{cur(href)}>{e(label)}</a>' for href, label in NAV)
    menu = "".join(f'<li><a href="{R}{href}">{e(label)}</a></li>' for href, label in [("", "Home")] + NAV + [("enquire/", "Enquire")])
    return f'''<header class="head {'head-stage' if on_stage else 'head-page'}">
  <a class="mark" href="{R}">{e(SITE["name"])}<small>B&amp;B</small></a>
  <nav class="nav mono" aria-label="Main">
    {links}
    <a class="btn" href="{R}enquire/">Enquire</a>
    <details class="menu"><summary>Menu</summary><ul>{menu}</ul></details>
  </nav>
</header>'''


def footer(R):
    rooms = "".join(f'<li><a href="{R}rooms/{r["slug"]}/">{e(r["name"])}</a></li>' for r in ROOMS)
    addr = "<br>".join(e(a) for a in CONTACT["address"])
    demo = "<span>Demo site. Name, rooms, rates and contact details are placeholders.</span>" if SITE["demo_notice"] else ""
    return f'''<footer class="foot">
  <div class="foot-in">
    <div>
      <a class="mark" href="{R}">{e(SITE["name"])}</a>
      <p class="note">{e(SITE["description"])}</p>
    </div>
    <div>
      <h2>Explore</h2>
      <ul>
        <li><a href="{R}rooms/">All rooms and rates</a></li>
        <li><a href="{R}house/">The house</a></li>
        <li><a href="{R}house/#brick-room">Breakfast</a></li>
        <li><a href="{R}visit/">Getting here</a></li>
        <li><a href="{R}visit/#booking">Booking and cancelling</a></li>
        <li><a href="{R}visit/#faq">Questions</a></li>
      </ul>
    </div>
    <div>
      <h2>Rooms</h2>
      <ul>{rooms}</ul>
    </div>
    <div>
      <h2>Find us</h2>
      <address>{addr}<br><br>
        <a href="tel:{e(CONTACT["phone_e164"])}">{e(CONTACT["phone_display"])}</a><br>
        <a href="mailto:{e(CONTACT["email"])}">{e(CONTACT["email"])}</a>
      </address>
    </div>
  </div>
  <div class="foot-note mono">
    <span>© {date.today().year} {e(SITE["name"])}</span>
    {demo}
  </div>
</footer>'''


def band(R, title="Pick your dates", text=None, href="enquire/", label="Enquire"):
    text = text or SITE["opening_note"]
    return f'''<div class="band-wrap"><section class="band" aria-label="Enquire">
  <div><h2>{e(title)}</h2><p>{e(text)}</p></div>
  <a class="btn btn-solid" href="{R}{href}">{e(label)}</a>
</section></div>'''


def srcset(R):
    return ", ".join(f"{R}assets/img/house-{w}.webp {w}w" for w in (960, 1440, 2000))


def lit(R, floor_key, caption=None, eager=False):
    """The house photo with one floor at full brightness."""
    f = FLOOR[floor_key]
    clip = ",".join(f"{pct(x, U_W)} {pct(y, U_H)}" for x, y in f["poly"])
    pts = " ".join(f"{x},{y}" for x, y in f["poly"])
    sizes = "(min-width:860px) 36rem, 100vw"
    cap = caption or f'{f["level"]} · {f["elev"]}'
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f'''<figure class="lit">
  <img class="dim" src="{R}assets/img/house-1440.jpg" srcset="{srcset(R)}" sizes="{sizes}" width="2000" height="1500" {load} decoding="async" alt="The front of the house, with the {e(f["level"].lower())} highlighted.">
  <img src="{R}assets/img/house-1440.jpg" srcset="{srcset(R)}" sizes="{sizes}" width="2000" height="1500" {load} decoding="async" alt="" style="clip-path:polygon({clip})">
  <svg viewBox="0 0 {U_W} {U_H}" preserveAspectRatio="none" aria-hidden="true"><polygon points="{pts}"/></svg>
  <figcaption class="mono"><b>{e(f["k"])}</b>{e(cap)}</figcaption>
</figure>'''


def room_keys(r, short=False):
    f = FLOOR[r["floor"]]
    rows = [("Size", f'{r["size_m2"]} m²', f'{sqft(r["size_m2"])} sq ft'),
            ("Sleeps", str(r["sleeps"]), "plus one extra bed" if r["extra_bed"] else ""),
            ("Floor", f["level"].replace(" floor", ""), f["elev"])]
    if not short:
        rows += [("Bed", r["bed_short"], ""), ("Outside", r["outdoor"].split(" balcony")[0] if "balcony" in r["outdoor"] else "—", "balcony" if "balcony" in r["outdoor"] else r["outdoor"]),
                 ("Of this kind", str(r["count"]), f'Nos. {r["numbers"]}')]
    return '<dl class="keys">' + "".join(
        f'<div><dt class="mono">{e(k)}</dt><dd>{e(v)}' + (f'<small>{e(s)}</small>' if s and not short else "") + '</dd></div>' for k, v, s in rows) + '</dl>'


def room_card(R, r):
    f = FLOOR[r["floor"]]
    return f'''<article class="card">
  <div class="mono eyebrow">{e(f["level"])} · {plural(r["count"], unit(r))}</div>
  <h3><a href="{R}rooms/{r["slug"]}/">{e(r["name"])}</a></h3>
  <p>{e(r["summary"])}</p>
  {room_keys(r, short=True)}
  <div class="card-foot"><b>{inr(r["rate"])}<small>per night, with breakfast</small></b><a class="more" href="{R}rooms/{r["slug"]}/">Room details</a></div>
</article>'''


def page(path, title, desc, body, *, current="", home=False, head_extra="", scripts=("site.js",), ld=None):
    depth = path.count("/")
    R = "../" * depth
    url = SITE["url"] + (path[:-len("index.html")] if path.endswith("index.html") else path)
    full_title = f'{SITE["name"]} · {SITE["kind"]}' if home else f'{title} · {SITE["name"]}'
    robots = "" if SITE["indexable"] else '<meta name="robots" content="noindex">\n'
    ld_tag = f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n' if ld else ""
    data = {"name": SITE["name"], "email": CONTACT["email"], "whatsapp": CONTACT["whatsapp"],
            "peak": [{"from": p["from"], "to": p["to"]} for p in SEASONS["peak"]], "maxNights": SEASONS["max_nights"],
            "rooms": [{k: r[k] for k in ("slug", "name", "sleeps", "count", "rate", "rate_peak", "extra_bed")} for r in ROOMS]}
    script_tags = "".join(f'<script src="{R}assets/{s}?v={ver(s)}" defer></script>\n' for s in scripts)
    out = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(full_title)}</title>
<meta name="description" content="{e(desc)}">
{robots}<link rel="canonical" href="{e(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{e(SITE["name"])}">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(SITE["url"])}assets/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#10151a">
<link rel="icon" href="{R}assets/img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{R}assets/img/apple-touch-icon.png">
<link rel="manifest" href="{R}site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&amp;family=DM+Mono:wght@400;500&amp;family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&amp;display=swap">
<link rel="stylesheet" href="{R}assets/site.css?v={ver("site.css")}">
{head_extra}{ld_tag}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
{"" if home else header("{R}", current)}
{body}
{footer("{R}")}
<script type="application/json" id="site-data">{json.dumps(data, ensure_ascii=False)}</script>
{script_tags}</body>
</html>
'''
    out = out.replace('href="{R}"', 'href="' + (R or "./") + '"').replace("{R}", R)
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(out, encoding="utf-8")
    return path


# ---------------------------------------------------------------- floor plans

class Plan:
    """A small plan drawing. Coordinates are metres, x across and y down."""
    S = 70

    def __init__(self, w, h, top=0.0):
        self.w, self.h, self.top = w, h, top
        self.ml, self.mt, self.mr, self.mb = 62, 22 + top * self.S, 16, 60
        self.parts = []

    def X(self, x): return round(self.ml + x * self.S, 1)
    def Y(self, y): return round(self.mt + y * self.S, 1)

    def wall(self, *segs):
        for x1, y1, x2, y2 in segs:
            self.parts.append(f'<line class="wall" x1="{self.X(x1)}" y1="{self.Y(y1)}" x2="{self.X(x2)}" y2="{self.Y(y2)}"/>')

    def win(self, x1, y1, x2, y2):
        dx, dy = (3, 0) if x1 == x2 else (0, 3)
        for s in (-1, 1):
            self.parts.append(f'<line class="thin" x1="{self.X(x1) + s * dx}" y1="{self.Y(y1) + s * dy}" x2="{self.X(x2) + s * dx}" y2="{self.Y(y2) + s * dy}"/>')

    def rect(self, x, y, w, h, cls="furn"):
        self.parts.append(f'<rect class="{cls}" x="{self.X(x)}" y="{self.Y(y)}" width="{round(w * self.S, 1)}" height="{round(h * self.S, 1)}"/>')

    def circle(self, x, y, r, cls="furn"):
        self.parts.append(f'<circle class="{cls}" cx="{self.X(x)}" cy="{self.Y(y)}" r="{round(r * self.S, 1)}"/>')

    def line(self, x1, y1, x2, y2, cls="thin"):
        self.parts.append(f'<line class="{cls}" x1="{self.X(x1)}" y1="{self.Y(y1)}" x2="{self.X(x2)}" y2="{self.Y(y2)}"/>')

    def door(self, hx, hy, r, closed, opened):
        """Hinge point, leaf length, and the closed and open angles in degrees (0 = east, 90 = south)."""
        p = lambda a: (self.X(hx + r * math.cos(math.radians(a))), self.Y(hy + r * math.sin(math.radians(a))))
        (cx, cy), (ox, oy) = p(closed), p(opened)
        sweep = 1 if ((opened - closed) % 360) < 180 else 0
        rr = round(r * self.S, 1)
        self.parts.append(f'<path class="thin" d="M{self.X(hx)} {self.Y(hy)} L{ox} {oy} M{cx} {cy} A{rr} {rr} 0 0 {sweep} {ox} {oy}"/>')

    def label(self, x, y, text):
        self.parts.append(f'<text x="{self.X(x)}" y="{self.Y(y)}" text-anchor="middle">{e(text)}</text>')

    def bed(self, x, y, w, h, head="top"):
        self.rect(x, y, w, h)
        n = 2 if (w if head in ("top", "bottom") else h) > 1.2 else 1
        if head in ("top", "bottom"):
            pw = (w - 0.2 - 0.1 * (n - 1)) / n
            py = y + 0.1 if head == "top" else y + h - 0.48
            for i in range(n):
                self.rect(x + 0.1 + i * (pw + 0.1), py, pw, 0.38)
            fy = y + 0.72 if head == "top" else y + h - 0.72
            self.line(x, fy, x + w, fy)
        else:
            ph = (h - 0.2 - 0.1 * (n - 1)) / n
            px = x + w - 0.48 if head == "right" else x + 0.1
            for i in range(n):
                self.rect(px, y + 0.1 + i * (ph + 0.1), 0.38, ph)
            fx = x + w - 0.72 if head == "right" else x + 0.72
            self.line(fx, y, fx, y + h)

    def bath(self, shower, wc, basin, basins=1):
        sx, sy, ss = shower
        self.rect(sx, sy, ss, ss, "wet"); self.line(sx, sy, sx + ss, sy + ss); self.line(sx + ss, sy, sx, sy + ss)
        wx, wy, up = wc
        self.rect(wx - 0.225, wy - (0.5 if up else -0.25), 0.45, 0.25, "wet"); self.circle(wx, wy, 0.22, "wet")
        bx, by, bw = basin
        self.rect(bx, by, bw, 0.48, "wet")
        for i in range(basins):
            self.circle(bx + bw * (i + 0.5) / basins, by + 0.24, 0.13, "wet")

    def dim_h(self, x1, x2, text):
        y = self.Y(self.h) + 30
        a, b = self.X(x1), self.X(x2)
        self.parts.append(f'<path class="dimline" d="M{a} {y} H{b} M{a} {y - 6} v12 M{b} {y - 6} v12"/>'
                          f'<text class="dimtext" x="{(a + b) / 2}" y="{y + 20}" text-anchor="middle">{e(text)}</text>')

    def dim_v(self, y1, y2, text):
        x = self.X(0) - 30
        a, b = self.Y(y1), self.Y(y2)
        m = (a + b) / 2
        self.parts.append(f'<path class="dimline" d="M{x} {a} V{b} M{x - 6} {a} h12 M{x - 6} {b} h12"/>'
                          f'<text class="dimtext" x="{x - 10}" y="{m}" text-anchor="middle" transform="rotate(-90 {x - 10} {m})">{e(text)}</text>')

    def svg(self, title):
        W = self.ml + self.w * self.S + self.mr
        H = self.mt + self.h * self.S + self.mb
        return f'<svg viewBox="0 0 {round(W)} {round(H)}" role="img" aria-label="{e(title)}">' + "".join(self.parts) + '</svg>'


def plan_valley():
    p = Plan(7.3, 4.0)
    p.rect(6, 0, 1.3, 4, "out")
    p.wall((0, 0, 6, 0), (0, 4, 6, 4), (0, 0, 0, 2.95), (0, 3.85, 0, 4), (6, 0, 6, 1.0), (6, 3.0, 6, 4),
           (2.0, 0, 2.0, 2.3), (0, 2.3, 1.15, 2.3), (1.95, 2.3, 2.0, 2.3))
    p.win(6, 1.0, 6, 3.0)
    p.door(0, 3.85, 0.9, -90, 0); p.door(1.95, 2.3, 0.8, 180, 270)
    p.bath((0.08, 0.08, 0.95), (1.55, 0.62, True), (0.1, 1.72, 0.62))
    p.rect(2.08, 0.08, 0.6, 1.5); p.line(2.08, 0.08, 2.68, 1.58)
    p.rect(2.8, 0.08, 0.42, 0.42); p.bed(3.3, 0.08, 1.6, 2.0); p.rect(4.98, 0.08, 0.42, 0.42)
    p.rect(2.7, 3.42, 1.3, 0.5); p.circle(3.35, 3.1, 0.22)
    p.circle(5.35, 3.35, 0.33)
    p.circle(6.65, 1.45, 0.24); p.circle(6.65, 2.05, 0.13); p.circle(6.65, 2.65, 0.24)
    p.label(1.05, 1.45, "Bath"); p.label(6.65, 0.5, "Balcony"); p.label(1.55, 3.62, "Entry")
    p.dim_h(0, 6, "6.0 m"); p.dim_h(6, 7.3, "1.3 m"); p.dim_v(0, 4, "4.0 m")
    return p


def plan_balcony():
    p = Plan(9.0, 4.5)
    p.rect(7.6, 0, 1.4, 4.5, "out")
    p.wall((0, 0, 7.6, 0), (0, 4.5, 7.6, 4.5), (0, 0, 0, 3.45), (0, 4.35, 0, 4.5), (7.6, 0, 7.6, 1.1), (7.6, 3.4, 7.6, 4.5),
           (2.4, 0, 2.4, 2.6), (0, 2.6, 1.5, 2.6), (2.3, 2.6, 2.4, 2.6))
    p.win(7.6, 1.1, 7.6, 3.4)
    p.door(0, 4.35, 0.9, -90, 0); p.door(2.3, 2.6, 0.8, 180, 270)
    p.bath((0.08, 0.08, 1.1), (1.9, 0.62, True), (0.1, 2.02, 1.3), basins=2)
    p.rect(2.48, 0.08, 0.6, 1.8); p.line(2.48, 0.08, 3.08, 1.88)
    p.rect(3.2, 0.08, 0.42, 0.42); p.bed(3.7, 0.08, 1.8, 2.0); p.rect(5.58, 0.08, 0.42, 0.42)
    p.bed(5.3, 3.52, 1.9, 0.9, head="left")
    p.circle(6.55, 2.55, 0.26); p.circle(5.95, 2.75, 0.24); p.circle(6.85, 1.95, 0.24)
    p.rect(3.0, 3.92, 1.3, 0.5); p.circle(3.65, 3.6, 0.22)
    p.circle(8.3, 1.65, 0.24); p.circle(8.3, 2.25, 0.13); p.circle(8.3, 2.85, 0.24)
    p.label(1.25, 1.65, "Bath"); p.label(8.3, 0.5, "Balcony"); p.label(1.55, 4.1, "Entry"); p.label(6.25, 3.35, "Daybed")
    p.dim_h(0, 7.6, "7.6 m"); p.dim_h(7.6, 9.0, "1.4 m"); p.dim_v(0, 4.5, "4.5 m")
    return p


def plan_terrace():
    p = Plan(9.6, 6.5)
    p.rect(8, 0, 1.6, 6.5, "out")
    p.wall((0, 0, 8, 0), (0, 6.5, 8, 6.5), (0, 0, 0, 2.2), (0, 3.1, 0, 6.5),
           (8, 0, 8, 0.9), (8, 2.7, 8, 4.3), (8, 5.7, 8, 6.5),
           (0, 3.4, 3.0, 3.4), (3.9, 3.4, 8, 3.4), (2.6, 3.4, 2.6, 3.75), (2.6, 4.55, 2.6, 6.5))
    p.win(8, 0.9, 8, 2.7); p.win(8, 4.3, 8, 5.7)
    p.door(0, 3.1, 0.9, -90, 0); p.door(3.9, 3.4, 0.9, 180, 90); p.door(2.6, 4.55, 0.8, -90, 180)
    p.rect(0.08, 0.08, 0.6, 1.9); p.line(0.08, 0.08, 0.68, 1.98)
    p.rect(2.8, 0.08, 0.42, 0.42); p.bed(3.3, 0.08, 1.8, 2.0); p.rect(5.18, 0.08, 0.42, 0.42)
    p.circle(6.35, 0.55, 0.3); p.circle(6.85, 1.1, 0.14); p.circle(7.35, 0.55, 0.3)
    p.bed(4.3, 4.42, 0.9, 2.0, head="bottom"); p.rect(5.39, 5.98, 0.42, 0.42); p.bed(6.0, 4.42, 0.9, 2.0, head="bottom")
    p.rect(2.68, 5.0, 0.5, 1.3); p.circle(3.5, 5.65, 0.22)
    p.bath((0.08, 5.32, 1.1), (2.1, 5.95, False), (0.1, 3.5, 1.4), basins=2)
    p.circle(8.8, 1.2, 0.24); p.circle(8.8, 1.8, 0.13); p.circle(8.8, 2.4, 0.24)
    p.label(1.95, 2.85, "Bedroom"); p.label(5.6, 4.0, "Twin room"); p.label(1.3, 4.8, "Bath"); p.label(8.8, 3.6, "Terrace")
    p.dim_h(0, 8, "8.0 m"); p.dim_h(8, 9.6, "1.6 m"); p.dim_v(0, 6.5, "6.5 m")
    return p


def plan_loft():
    p = Plan(7.0, 4.0, top=0.6)
    p.wall((0, 0, 2.4, 0), (3.6, 0, 4.8, 0), (6.0, 0, 7, 0), (2.4, 0, 2.4, -0.55), (3.6, 0, 3.6, -0.55), (4.8, 0, 4.8, -0.55), (6.0, 0, 6.0, -0.55),
           (0, 4, 7, 4), (0, 0, 0, 2.9), (0, 3.8, 0, 4), (7, 0, 7, 1.5), (7, 2.5, 7, 4),
           (2.0, 0, 2.0, 2.2), (0, 2.2, 1.1, 2.2), (1.9, 2.2, 2.0, 2.2))
    p.win(2.4, -0.55, 3.6, -0.55); p.win(4.8, -0.55, 6.0, -0.55); p.win(7, 1.5, 7, 2.5)
    p.door(0, 3.8, 0.9, -90, 0); p.door(1.9, 2.2, 0.8, 180, 270)
    p.bath((0.08, 0.08, 0.95), (1.55, 0.62, True), (0.1, 1.62, 0.62))
    p.circle(3.0, 0.35, 0.33)
    p.rect(4.8, -0.47, 1.2, 0.5); p.circle(5.4, 0.4, 0.22)
    p.rect(6.5, 0.7, 0.42, 0.42); p.bed(4.92, 1.2, 2.0, 1.6, head="right"); p.rect(6.5, 2.88, 0.42, 0.42)
    p.rect(2.4, 3.5, 3.4, 0.42)
    p.line(2.15, 2.0, 4.75, 2.0, "dash")
    p.label(1.05, 1.4, "Bath"); p.label(3.45, 1.85, "Ridge 3.1 m"); p.label(4.1, 3.35, "Eaves 1.4 m"); p.label(1.55, 3.6, "Entry")
    p.dim_h(0, 7, "7.0 m"); p.dim_v(0, 4, "4.0 m")
    return p


PLANS = {"valley": plan_valley, "balcony": plan_balcony, "terrace": plan_terrace, "loft": plan_loft}


def plan_figure(r):
    svg = PLANS[r["plan"]]().svg(f'Floor plan of a {r["name"]}')
    extra = f' plus {r["outdoor"]}' if "balcony" in r["outdoor"] else ""
    return f'''<figure class="plan">{svg}
  <figcaption class="mono">Typical {e(r["name"].lower())} · {r["size_m2"]} m²{e(extra)} · corner rooms differ slightly</figcaption>
</figure>'''


# ---------------------------------------------------------------- pages

def floor_specs(f):
    if "room" in f:
        r = ROOM[f["room"]]
        return [[unit(r).capitalize() + "s", str(r["count"])], ["Sleeps", f'{r["sleeps"]} each'], ["From", inr(r["rate"])]]
    return f["specs"]


def build_home():
    sizes = "max(100vw, 133.4vh)"
    slices, cards = [], []
    for f in FLOORS:
        clip = ",".join(f"{pct(x, U_W)} {pct(y, U_H)}" for x, y in f["poly"])
        pts = " ".join(f"{x},{y}" for x, y in f["poly"])
        slices.append(f'''      <div class="slice" style="--ax:{pct(f["at"][0], U_W)};--ay:{pct(f["at"][1], U_H)}">
        <div class="cut{' fade' if f.get("fade") else ''}">
          <img src="{{R}}assets/img/house-1440.jpg" srcset="{srcset("{R}")}" sizes="{sizes}" alt="" decoding="async" style="clip-path:polygon({clip})">
          <svg viewBox="0 0 {U_W} {U_H}" preserveAspectRatio="none" aria-hidden="true"><polygon points="{pts}"/><line x1="36" y1="{f["at"][1]}" x2="{f["at"][0] - 6}" y2="{f["at"][1]}"/></svg>
        </div>
        <button class="tag" type="button" aria-label="{e(f["level"])}: {e(f["name"])}"><span class="tag-k">{e(f["k"])}</span><span class="tag-e">{e(f["elev"])}</span></button>
      </div>''')
        href, label = (f'rooms/{f["room"]}/', "Room details") if "room" in f else (f["link"], f["link_label"])
        specs = "".join(f'<div><dt class="mono">{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in floor_specs(f))
        cards.append(f'''      <article>
        <div class="mono lvl">{e(f["level"])} · {e(f["elev"])}</div>
        <h2>{e(f["name"])}</h2>
        <p>{e(f["line"])}</p>
        <dl class="specs">{specs}</dl>
        <a class="more" href="{{R}}{href}">{e(label)}</a>
      </article>''')

    directory = []
    for f in reversed(FLOORS):
        if "room" in f:
            r = ROOM[f["room"]]
            name = f'<a href="{{R}}rooms/{r["slug"]}/">{e(f["name"])}</a>'
            meta = f'{e(f["level"])} · {e(f["elev"])}<br>{plural(r["count"], unit(r))} · sleeps {r["sleeps"]} each'
            rate = f'<b>{inr(r["rate"])}</b><span class="mono">per night, with breakfast</span><a class="more" href="{{R}}rooms/{r["slug"]}/">{e(r["name"])}</a>'
        else:
            name = f'<a href="{{R}}{f["link"]}">{e(f["name"])}</a>'
            meta = f'{e(f["level"])} · {e(f["elev"])}<br>{e(f["meta"])}'
            rate = f'<span class="mono">Open to every guest</span><a class="more" href="{{R}}{f["link"]}">{e(f["link_label"])}</a>'
        directory.append(f'''    <li>
      <span class="dir-k" aria-hidden="true">{e(f["k"])}</span>
      <div><h3>{name}</h3><p>{e(f["line"])}</p></div>
      <div class="dir-meta mono">{meta}</div>
      <div class="dir-rate">{rate}</div>
    </li>''')

    total_rooms = sum(r["count"] for r in ROOMS)
    total_sleeps = sum(r["count"] * r["sleeps"] for r in ROOMS)
    low = min(r["rate"] for r in ROOMS)
    body = f'''<div class="track" id="track">
  <section class="stage on-stage" id="stage" aria-label="{e(SITE["name"])}, floor by floor">
    <div class="plate" id="plate">
      <img class="base" id="base" src="{{R}}assets/img/house-1440.jpg" srcset="{srcset("{R}")}" sizes="{sizes}" width="2000" height="1500" fetchpriority="high" alt="A five-storey mountain house clad in dark slate, with pale limestone balcony bands, a gabled roof and forested slopes behind it.">
{chr(10).join(slices)}
    </div>
    <div class="scrim" id="scrim"></div>
    {header("{R}", "", on_stage=True)}
    <div class="hero" id="hero">
      <div class="mono">{e(SITE["kind"])} · Five floors · {total_rooms} rooms</div>
      <h1>{e(SITE["name"])}</h1>
      <div class="hero-row">
        <p>A mountain house stacked five floors high in slate and limestone. Scroll and it comes apart, one floor at a time.</p>
        <div class="acts">
          <a class="btn btn-solid" href="{{R}}enquire/">Check dates</a>
          <a class="btn" href="{{R}}rooms/" id="rooms-link">See the rooms</a>
          <button class="btn" type="button" id="open" hidden>Open the house</button>
        </div>
      </div>
    </div>
    <div class="panel" id="panel">
{chr(10).join(cards)}
    </div>
    <div class="end" id="end">
      <div class="mono hint">Back in one piece</div>
      <h2>Five floors, one front door.</h2>
      <div class="acts"><a class="btn btn-solid" href="{{R}}enquire/">Check dates</a><a class="btn" href="{{R}}rooms/">Rooms and rates</a></div>
    </div>
  </section>
</div>

<main id="main">
  <section class="sec">
    <div class="split lean">
      <div>
        <div class="mono eyebrow">The house</div>
        <h2 class="title">{total_rooms} rooms, one long breakfast table</h2>
        <div class="prose">
          <p>{e(SITE["name"])} is a family-run bed and breakfast on a lane above the bazaar. The rooms are stacked the way the house is built: balcony rooms on the first two floors, family suites on the terrace floor and two lofts under the gables.</p>
          <p>Everyone comes down to the same place in the morning. Breakfast is cooked to order in the Brick Room, the terrace is open to all, and nothing in the house is more than four flights from anything else.</p>
        </div>
        <div class="cta-row"><a class="more" href="{{R}}house/">Around the house</a><a class="more" href="{{R}}visit/">Getting here</a></div>
      </div>
      <dl class="keys">
        <div><dt class="mono">Rooms</dt><dd>{total_rooms}<small>in four kinds</small></dd></div>
        <div><dt class="mono">Sleeps</dt><dd>{total_sleeps}<small>across the house</small></dd></div>
        <div><dt class="mono">From</dt><dd>{inr(low)}<small>per night, with breakfast</small></dd></div>
        <div><dt class="mono">Check-in</dt><dd>{e(SITE["checkin"])}<small>out by {e(SITE["checkout"])}</small></dd></div>
      </dl>
    </div>
  </section>

  <section class="sec" id="rooms">
    <div class="mono eyebrow">Rooms</div>
    <h2 class="title">Four kinds of room</h2>
    <p class="lede">Each floor has its own kind of room. Rates are per room, per night, and include breakfast for everyone staying in it.</p>
    <div class="cards">
{chr(10).join(room_card("{R}", r) for r in ROOMS)}
    </div>
    <div class="cta-row"><a class="btn" href="{{R}}rooms/">Compare all rooms and rates</a></div>
  </section>

  <section class="sec" id="floors">
    <div class="mono eyebrow">Directory</div>
    <h2 class="title">The house, top to bottom</h2>
    <ol class="dir" reversed>
{chr(10).join(directory)}
    </ol>
  </section>

  <section class="sec">
    <div class="split">
      <div>
        <figure class="pic"><img src="{{R}}assets/img/brick.webp" width="800" height="600" loading="lazy" decoding="async" alt="The brick ground floor of the house, seen through trees."><figcaption class="mono">Ground floor · the Brick Room</figcaption></figure>
        <h3 class="sub" style="margin-top:1em">Breakfast, cooked to order</h3>
        <p class="prose">{e(HOUSE["breakfast"]["intro"])} Served {e(HOUSE["breakfast"]["hours"])}.</p>
        <a class="more" href="{{R}}house/#brick-room">What's for breakfast</a>
      </div>
      <div>
        <figure class="pic"><img src="{{R}}assets/img/pergola.webp" width="800" height="600" loading="lazy" decoding="async" alt="The white steel pergola over the third-floor terrace."><figcaption class="mono">Third floor · the terrace</figcaption></figure>
        <h3 class="sub" style="margin-top:1em">A terrace for everyone</h3>
        <p class="prose">The third-floor terrace sits under a white steel pergola at the corner of the house. It's open to every guest until 10 pm.</p>
        <a class="more" href="{{R}}house/#terrace">The terrace</a>
      </div>
    </div>
  </section>

  <section class="sec" id="stay">
    <div class="mono eyebrow">The stay</div>
    <h2 class="title">What a night includes</h2>
    <dl class="facts">
      <div><dt class="mono">Breakfast</dt><dd>Cooked to order in the Brick Room, {e(HOUSE["breakfast"]["hours"])}. Tea and coffee are out all day.</dd></div>
      <div><dt class="mono">Arriving</dt><dd>Check in from {e(SITE["checkin"])}, check out by {e(SITE["checkout"])}. Bags can wait at reception either side.</dd></div>
      <div><dt class="mono">Warmth</dt><dd>Every room is heated from October to March, with extra quilts in the wardrobe.</dd></div>
      <div><dt class="mono">Driving</dt><dd>Four cars fit off the lane. Tell us you're driving and we'll hold a space.</dd></div>
      <div><dt class="mono">Getting upstairs</dt><dd>The lift runs from the ground floor to the third. The Lofts are one flight further.</dd></div>
      <div><dt class="mono">Opening</dt><dd>{e(SITE["opening_note"])}</dd></div>
    </dl>
    <div class="cta-row"><a class="more" href="{{R}}visit/">Plan your visit</a><a class="more" href="{{R}}visit/#faq">Common questions</a></div>
  </section>

  {band("{R}")}
</main>'''

    ld = {
        "@context": "https://schema.org", "@type": "BedAndBreakfast", "name": SITE["name"], "description": SITE["description"],
        "url": SITE["url"], "image": SITE["url"] + "assets/img/og.jpg", "telephone": CONTACT["phone_e164"], "email": CONTACT["email"],
        "address": {"@type": "PostalAddress", "streetAddress": ", ".join(CONTACT["address"][:2]), "addressLocality": CONTACT["address"][2],
                    "addressRegion": CONTACT["region"], "addressCountry": CONTACT["country"]},
        "checkinTime": SITE["checkin_iso"], "checkoutTime": SITE["checkout_iso"], "numberOfRooms": total_rooms,
        "priceRange": f'{inr(low)} to {inr(max(r["rate_peak"] for r in ROOMS))}',
        "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": n, "value": True} for n in ("Breakfast included", "Free Wi-Fi", "Parking", "Lift", "Terrace")],
        "containsPlace": [{"@type": "HotelRoom", "name": r["name"], "url": SITE["url"] + f'rooms/{r["slug"]}/',
                           "occupancy": {"@type": "QuantitativeValue", "maxValue": r["sleeps"] + (1 if r["extra_bed"] else 0)},
                           "floorSize": {"@type": "QuantitativeValue", "value": r["size_m2"], "unitCode": "MTK"}} for r in ROOMS],
    }
    preload = f'<link rel="preload" as="image" href="{{R}}assets/img/house-1440.jpg" imagesrcset="{srcset("{R}")}" imagesizes="{sizes}" fetchpriority="high">\n'
    return page("index.html", SITE["name"], SITE["description"], body, home=True, head_extra=preload, scripts=("stage.js", "site.js"), ld=ld)


def rates_rows(r):
    peak = "; ".join(p["label"] for p in SEASONS["peak"])
    return f'''<tr><th scope="row">Regular</th><td>All other dates</td><td class="num">{inr(r["rate"])}</td></tr>
        <tr><th scope="row">Peak</th><td>{e(peak)}</td><td class="num">{inr(r["rate_peak"])}</td></tr>'''


def build_rooms_index():
    blocks = []
    for r in ROOMS:
        f = FLOOR[r["floor"]]
        blocks.append(f'''  <section class="sec" id="{r["slug"]}">
    <div class="split">
      {lit("{R}", r["floor"], eager=(r is ROOMS[0]))}
      <div>
        <div class="mono eyebrow">{e(f["level"])} · {plural(r["count"], unit(r))} · Nos. {e(r["numbers"])}</div>
        <h2 class="title"><a href="{{R}}rooms/{r["slug"]}/" style="text-decoration:none">{e(r["name"])}</a></h2>
        <p class="prose">{e(r["summary"])}</p>
        {room_keys(r, short=True)}
        <ul class="ticks" style="margin-top:1.4em">{"".join(f"<li>{e(h)}</li>" for h in r["highlights"])}</ul>
        <div class="cta-row"><a class="btn btn-solid" href="{{R}}rooms/{r["slug"]}/">Room details</a><span class="mono eyebrow">From {inr(r["rate"])} per night, with breakfast</span></div>
      </div>
    </div>
  </section>''')
    rows = "".join(f'''<tr><th scope="row"><a href="{{R}}rooms/{r["slug"]}/">{e(r["name"])}</a></th><td>{e(FLOOR[r["floor"]]["level"])}</td><td>{r["size_m2"]} m²</td><td>{e(r["bed_short"])}</td><td>{r["sleeps"]}{" + 1" if r["extra_bed"] else ""}</td><td>{r["count"]}</td><td class="num">{inr(r["rate"])}</td><td class="num">{inr(r["rate_peak"])}</td></tr>''' for r in ROOMS)
    peak = " and ".join(p["label"] for p in SEASONS["peak"])
    body = f'''<main id="main">
  <header class="page-head">
    <div class="mono eyebrow">Rooms and rates</div>
    <h1>Four kinds of room</h1>
    <p class="lede">Twelve rooms on four floors. The higher you go, the longer the view and the quieter the night. Every rate includes breakfast.</p>
  </header>
{chr(10).join(blocks)}
  <section class="sec" id="compare">
    <div class="mono eyebrow">Side by side</div>
    <h2 class="title">Compare rooms</h2>
    <div class="tbl-wrap"><table>
      <thead><tr><th class="mono" scope="col">Room</th><th class="mono" scope="col">Floor</th><th class="mono" scope="col">Size</th><th class="mono" scope="col">Bed</th><th class="mono" scope="col">Sleeps</th><th class="mono" scope="col">Rooms</th><th class="mono num" scope="col">Regular</th><th class="mono num" scope="col">Peak</th></tr></thead>
      <tbody>{rows}</tbody>
    </table></div>
    <p class="note" style="margin-top:1.4em">Rates are per room, per night, with breakfast. Peak dates are {e(peak)}. GST is added at the current rate.</p>
  </section>
  {band("{R}")}
</main>'''
    return page("rooms/index.html", "Rooms and rates", "Four kinds of room across four floors: Valley Rooms, Balcony Suites, Terrace Family Suites and Lofts. Sizes, beds and nightly rates.", body, current="rooms/")


def build_room(i, r):
    f = FLOOR[r["floor"]]
    prev, nxt = ROOMS[i - 1], ROOMS[(i + 1) % len(ROOMS)]
    li = lambda items: "".join(f"<li>{e(x)}</li>" for x in items)
    extra = (f'One extra bed is {inr(r["extra_bed"])} per night, with breakfast.' if r["extra_bed"] else "This room can't take an extra bed.")
    body = f'''<main id="main">
  <header class="page-head">
    <ol class="crumbs mono"><li><a href="{{R}}">Home</a></li><li><a href="{{R}}rooms/">Rooms</a></li><li aria-current="page">{e(r["name"])}</li></ol>
    <div class="mono eyebrow">{e(f["level"])} · {e(f["elev"])} · Nos. {e(r["numbers"])}</div>
    <h1>{e(r["name"])}</h1>
    <p class="lede">{e(r["summary"])}</p>
  </header>

  <section class="sec">
    <div class="split lean">
      <div>
        {room_keys(r)}
        <div class="prose" style="margin-top:1.6em">{"".join(f"<p>{e(p)}</p>" for p in r["body"])}</div>
        <div class="cta-row"><a class="btn btn-solid" href="{{R}}enquire/?room={r["slug"]}">Enquire about this room</a><span class="mono eyebrow">From {inr(r["rate"])} per night</span></div>
      </div>
      {lit("{R}", r["floor"], f'Where it is · {f["level"].lower()}', eager=True)}
    </div>
  </section>

  <section class="sec" id="plan">
    <div class="mono eyebrow">Layout</div>
    <h2 class="title">The plan</h2>
    <div class="split lean">
      {plan_figure(r)}
      <div>
        <h3 class="mono" style="color:var(--tin);margin:0 0 14px">Why choose it</h3>
        <ul class="ticks">{li(r["highlights"])}</ul>
        <dl class="keys" style="margin-top:1.8em;grid-template-columns:minmax(0,1fr)">
          <div><dt class="mono">Bed</dt><dd style="font-size:1.4rem">{e(r["bed"])}</dd></div>
          <div><dt class="mono">View</dt><dd style="font-size:1.4rem">{e(r["view"])}</dd></div>
        </dl>
      </div>
    </div>
  </section>

  <section class="sec" id="included">
    <div class="mono eyebrow">What's there</div>
    <h2 class="title">In the room</h2>
    <div class="cols">
      <div><h3 class="mono">The room</h3><ul class="ticks">{li(r["in_room"])}</ul></div>
      <div><h3 class="mono">The bathroom</h3><ul class="ticks">{li(r["bathroom"])}</ul></div>
      <div><h3 class="mono">Good to know</h3><ul class="ticks">{li(r["know"])}</ul></div>
    </div>
  </section>

  <section class="sec" id="rates">
    <div class="mono eyebrow">Rates</div>
    <h2 class="title">Per night, with breakfast</h2>
    <div class="tbl-wrap" style="max-width:46rem"><table class="wraps">
      <thead><tr><th class="mono" scope="col">Season</th><th class="mono" scope="col">Dates</th><th class="mono num" scope="col">Per night</th></tr></thead>
      <tbody>
        {rates_rows(r)}
      </tbody>
    </table></div>
    <p class="note" style="margin-top:1.4em">The rate covers up to {r["sleeps"]} guests and includes breakfast. {e(extra)} GST is added at the current rate. <a href="{{R}}visit/#booking">Booking and cancelling</a>.</p>
    <div class="cta-row"><a class="btn btn-solid" href="{{R}}enquire/?room={r["slug"]}">Enquire about this room</a></div>
  </section>

  <section class="sec">
    <nav class="pager" aria-label="Other rooms">
      <a href="{{R}}rooms/{prev["slug"]}/"><span class="mono eyebrow">Previous room</span><b>{e(prev["name"])}</b></a>
      <a href="{{R}}rooms/{nxt["slug"]}/"><span class="mono eyebrow">Next room</span><b>{e(nxt["name"])}</b></a>
    </nav>
  </section>
</main>'''
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE["url"]},
        {"@type": "ListItem", "position": 2, "name": "Rooms", "item": SITE["url"] + "rooms/"},
        {"@type": "ListItem", "position": 3, "name": r["name"], "item": SITE["url"] + f'rooms/{r["slug"]}/'}]}
    return page(f'rooms/{r["slug"]}/index.html', r["name"], r["summary"], body, current="rooms/", ld=ld)


def build_house():
    b = HOUSE["breakfast"]
    menu = "".join(f'<div><dt class="mono">{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in b["menu"])
    fac = "".join(f'<div><dt class="mono">{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in HOUSE["facilities"])
    shots = "".join(f'''<figure><img src="{{R}}assets/img/{m["img"]}.webp" width="800" height="600" loading="lazy" decoding="async" alt="Detail of the house: {e(m["name"].lower())}."><figcaption><b>{e(m["name"])}</b><span>{e(m["text"])}</span></figcaption></figure>''' for m in HOUSE["materials"])
    body = f'''<main id="main">
  <header class="page-head">
    <div class="mono eyebrow">The house</div>
    <h1>Built to be read from the lane</h1>
    <p class="lede">Slate walls, limestone slabs and five gables. Inside, the shared rooms sit at the bottom and the top, with the bedrooms between them.</p>
  </header>

  <section class="sec" id="brick-room">
    <div class="split lean">
      <div>
        <div class="mono eyebrow">Ground floor · ±0.00 m</div>
        <h2 class="title">The Brick Room</h2>
        <div class="prose"><p>{e(b["intro"])}</p><p>The Brick Room is also reception, the place to leave a bag and where the kettle is always on. It keeps the only brick walls in the house.</p></div>
        <dl class="keys" style="margin-block:1.4em"><div><dt class="mono">Breakfast</dt><dd>{e(b["hours"])}</dd></div><div><dt class="mono">Seats</dt><dd>24</dd></div><div><dt class="mono">Packed breakfast</dt><dd>From 6 am</dd></div></dl>
        <dl class="facts">{menu}</dl>
        <p class="note" style="margin-top:1.6em">{e(b["notes"])}</p>
      </div>
      <figure class="pic"><img src="{{R}}assets/img/brick.webp" width="800" height="600" loading="lazy" decoding="async" alt="The brick ground floor of the house, seen through trees."><figcaption class="mono">The brick storey, from the lane</figcaption></figure>
    </div>
  </section>

  <section class="sec" id="terrace">
    <div class="split lean">
      <div>
        <div class="mono eyebrow">Third floor · +9.90 m</div>
        <h2 class="title">The terrace</h2>
        <p class="prose">{e(HOUSE["terrace"])}</p>
        <div class="cta-row"><a class="more" href="{{R}}rooms/terrace-suite/">Rooms that open onto it</a></div>
      </div>
      <figure class="pic"><img src="{{R}}assets/img/pergola.webp" width="800" height="600" loading="lazy" decoding="async" alt="The white steel pergola and louvred screen on the terrace."><figcaption class="mono">The pergola, from below</figcaption></figure>
    </div>
  </section>

  <section class="sec" id="facilities">
    <div class="mono eyebrow">Around the house</div>
    <h2 class="title">What's here</h2>
    <dl class="facts">{fac}</dl>
  </section>

  <section class="sec" id="materials">
    <div class="mono eyebrow">Materials</div>
    <h2 class="title">What it's built from</h2>
    <div class="shots">{shots}</div>
  </section>

  <section class="sec" id="access">
    <div class="mono eyebrow">Access</div>
    <h2 class="title">Getting around inside</h2>
    <p class="prose">{e(HOUSE["access"])}</p>
    <div class="cta-row"><a class="more" href="{{R}}enquire/">Ask us about access</a></div>
  </section>
  {band("{R}")}
</main>'''
    return page("house/index.html", "The house", "Breakfast in the Brick Room, the shared terrace, facilities and the materials the house is built from.", body, current="house/")


def build_visit():
    dl = lambda rows: "".join(f'<div><dt class="mono">{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in rows)
    seasons = "".join(f'<tr><th scope="row">{e(a)}</th><td>{e(b)}</td><td class="num">{e(c)}</td></tr>' for a, b, c in VISIT["seasons"])
    faq = "".join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in VISIT["faq"])
    addr = ", ".join(CONTACT["address"])
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in VISIT["faq"]]}
    body = f'''<main id="main">
  <header class="page-head">
    <div class="mono eyebrow">Visit</div>
    <h1>Plan your stay</h1>
    <p class="lede">How to reach the house, when to come, and what to know before you book.</p>
  </header>

  <section class="sec" id="getting-here">
    <div class="mono eyebrow">Directions</div>
    <h2 class="title">Getting here</h2>
    <p class="lede">{e(addr)}. {e(CONTACT["reception"])}.</p>
    <dl class="facts">{dl(VISIT["getting_here"])}</dl>
  </section>

  <section class="sec" id="seasons">
    <div class="mono eyebrow">The year</div>
    <h2 class="title">When to come</h2>
    <div class="tbl-wrap" style="max-width:52rem"><table class="wraps">
      <thead><tr><th class="mono" scope="col">Months</th><th class="mono" scope="col">What it's like</th><th class="mono num" scope="col">Rates</th></tr></thead>
      <tbody>{seasons}</tbody>
    </table></div>
    <p class="note" style="margin-top:1.4em">Peak rates apply {e(" and ".join(p["label"] for p in SEASONS["peak"]))}. <a href="{{R}}rooms/#compare">See rates for each room</a>.</p>
  </section>

  <section class="sec" id="rules">
    <div class="mono eyebrow">House rules</div>
    <h2 class="title">While you're here</h2>
    <ul class="ticks">{"".join(f"<li>{e(x)}</li>" for x in VISIT["rules"])}</ul>
  </section>

  <section class="sec" id="booking">
    <div class="mono eyebrow">Booking</div>
    <h2 class="title">Booking and cancelling</h2>
    <dl class="facts">{dl(VISIT["booking"])}</dl>
  </section>

  <section class="sec" id="faq">
    <div class="mono eyebrow">Questions</div>
    <h2 class="title">Things people ask</h2>
    <div class="faq">{faq}</div>
  </section>
  {band("{R}", "Still deciding?", "Send your dates and we'll tell you what's free and which floor would suit you.")}
</main>'''
    return page("visit/index.html", "Plan your stay", "Directions to the house, the best months to visit, house rules, booking and cancellation terms, and answers to common questions.", body, current="visit/", ld=faq_ld)


def build_enquire():
    opts = "".join(f'<option value="{r["slug"]}">{e(r["name"])} · sleeps {r["sleeps"]} · from {inr(r["rate"])}</option>' for r in ROOMS)
    addr = "<br>".join(e(a) for a in CONTACT["address"])
    body = f'''<main id="main">
  <header class="page-head">
    <div class="mono eyebrow">Enquire</div>
    <h1>Pick your dates</h1>
    <p class="lede">Choose your dates and a room. The message writes itself as you go. Send it by WhatsApp or email and we'll reply with what's free.</p>
  </header>

  <section class="sec" style="padding-top:0">
    <form class="enq" id="enq" novalidate>
      <div class="fields">
        <label class="mono" for="f-in">Check-in<input id="f-in" name="checkin" type="date" required></label>
        <label class="mono" for="f-out">Check-out<input id="f-out" name="checkout" type="date" required></label>
        <label class="mono" for="f-guests">Guests<input id="f-guests" name="guests" type="number" min="1" max="32" value="2" inputmode="numeric"></label>
        <label class="mono" for="f-count">Rooms<input id="f-count" name="rooms" type="number" min="1" max="12" value="1" inputmode="numeric"></label>
        <label class="mono full" for="f-room">Room<select id="f-room" name="room"><option value="">No preference, suggest one</option>{opts}</select></label>
        <label class="mono full" for="f-name">Your name<input id="f-name" name="name" type="text" autocomplete="name"></label>
        <label class="mono full" for="f-note">Anything we should know<input id="f-note" name="note" type="text" placeholder="Arrival time, children, access needs"></label>
        <p class="problem" id="problem" role="alert" hidden></p>
      </div>
      <div class="out">
        <label class="mono" for="f-msg">Your enquiry<textarea id="f-msg" readonly></textarea></label>
        <p class="total" id="total"></p>
        <div class="send">
          <a class="btn btn-solid" id="send-wa" href="https://wa.me/{e(CONTACT["whatsapp"])}" target="_blank" rel="noopener">Send on WhatsApp</a>
          <a class="btn" id="send-mail" href="mailto:{e(CONTACT["email"])}">Send by email</a>
          <button class="btn" type="submit">Copy</button>
        </div>
        <p class="mono send-status" id="copied" aria-live="polite"></p>
        <p class="note">Sending opens WhatsApp or your email app with the message filled in. Nothing is booked until we confirm. {e(CONTACT["reply"])}</p>
      </div>
    </form>
    <noscript><p class="note">The enquiry builder needs JavaScript. You can write to us directly using the details below.</p></noscript>
  </section>

  <section class="sec" id="contact">
    <div class="mono eyebrow">Direct</div>
    <h2 class="title">Or just get in touch</h2>
    <div class="split">
      <dl class="contact">
        <div><dt class="mono">Phone and WhatsApp</dt><dd><a href="tel:{e(CONTACT["phone_e164"])}">{e(CONTACT["phone_display"])}</a></dd></div>
        <div><dt class="mono">Email</dt><dd><a href="mailto:{e(CONTACT["email"])}">{e(CONTACT["email"])}</a></dd></div>
        <div><dt class="mono">Address</dt><dd>{addr}</dd></div>
        <div><dt class="mono">Reception</dt><dd>{e(CONTACT["reception"])}. {e(CONTACT["reply"])}</dd></div>
      </dl>
      <div>
        <p class="prose">Booking the whole house, a long stay or a group? Write with your dates and numbers and we'll put a rate together.</p>
        <div class="cta-row"><a class="more" href="{{R}}visit/#booking">Booking and cancelling</a><a class="more" href="{{R}}visit/#getting-here">Getting here</a></div>
      </div>
    </div>
  </section>
</main>'''
    return page("enquire/index.html", "Enquire", "Choose your dates and a room, see an estimate, and send your enquiry by WhatsApp or email.", body, current="enquire/")


def build_manifest():
    m = {"name": SITE["name"], "short_name": SITE["name"], "start_url": "./", "display": "browser",
         "background_color": "#10151a", "theme_color": "#10151a",
         "icons": [{"src": "assets/img/icon.svg", "sizes": "any", "type": "image/svg+xml"},
                   {"src": "assets/img/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}]}
    (ROOT / "site.webmanifest").write_text(json.dumps(m, indent=2) + "\n", encoding="utf-8")


def build_sitemap(paths):
    urls = "".join(f"  <url><loc>{e(SITE['url'] + p[:-len('index.html')])}</loc></url>\n" for p in paths)
    (ROOT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n', encoding="utf-8")


if __name__ == "__main__":
    built = [build_home(), build_rooms_index()] + [build_room(i, r) for i, r in enumerate(ROOMS)] + [build_house(), build_visit(), build_enquire()]
    build_manifest()
    build_sitemap(built)
    print("built", len(built), "pages:", ", ".join(built))
