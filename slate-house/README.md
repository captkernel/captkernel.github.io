# Slate House

A static bed and breakfast site: home page with a scroll-driven floor-by-floor sequence,
a page for each kind of room, the house, visit information and an enquiry builder.
No framework and no dependencies. Hosted at `/slate-house/` on GitHub Pages.

## Layout

| Path | What it is |
| --- | --- |
| `src/content.json` | All names, rooms, rates, seasons, policies, FAQ and contact details |
| `src/build.py` | Generates every HTML page, the manifest and the sitemap from `content.json` |
| `assets/site.css` | All styles |
| `assets/stage.js` | Home page sequence that takes the house apart floor by floor |
| `assets/site.js` | Menu and the enquiry builder (dates, estimate, WhatsApp and email links) |
| `assets/img/` | Photo in three widths, detail crops, icons and the social sharing image |
| `index.html`, `rooms/`, `house/`, `visit/`, `enquire/` | Generated. Do not edit by hand |

## Changing content

1. Edit `src/content.json`.
2. Run `python3 src/build.py` from this folder (Python 3.8 or later, standard library only).
3. Preview with `python3 -m http.server 8080` from the repository root, then open
   `http://localhost:8080/slate-house/`.
4. Commit the generated pages along with the content change.

Room rates, peak dates and capacities in `content.json` also drive the enquiry estimate.
Floor plans are drawn in `build.py` (`plan_valley`, `plan_balcony`, `plan_terrace`, `plan_loft`), in metres.
The floor outlines used on the home page and room pages are the `poly` lists under `floors`,
in the photo's 2000 x 1500 coordinate space. Replace them if the main photo changes.

## Before going live

Everything below is placeholder content and needs replacing in `content.json`:

- [ ] Name, description and `site.url` (used for canonical links, sharing tags and the sitemap)
- [ ] Phone, WhatsApp number, email and address. The enquiry buttons send to these
- [ ] Room names, counts, sizes, beds, amenities and floor plans
- [ ] Rates, peak dates, extra bed charge
- [ ] Breakfast menu, facilities, directions, house rules, booking and cancellation terms, FAQ
- [ ] Interior photographs. The site currently uses one exterior photo and crops of it
- [ ] Set `site.indexable` to `true` to remove the `noindex` tag, and `site.demo_notice` to `false`
- [ ] Add the sitemap to the domain's `robots.txt` once the site is indexable

The enquiry builder opens WhatsApp or the visitor's email app with the message filled in.
It does not store or send anything itself, so there is no form backend to run.
