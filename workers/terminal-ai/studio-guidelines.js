/* captKernel studio guidelines: how Karan builds, distilled from how he actually works across his projects
   (portfolio, Kids Planet, Alpha, FooFindr, ANCYR, Knob, Skills Curator...). Create's builder and go-live
   planner both follow them, so a visitor's build comes out the way Karan would have made it.
   Edit here; both prompts pick it up on the next deploy. */

export const DESIGN_GUIDELINES = `Design guidelines (how Karan designs)
1. Direction first. Before writing code, decide the direction from the subject: who uses it, where, and how it should feel. Set three dials for yourself (variance, motion, density, each 1-10) and stay consistent with them. A café site, a trading dashboard and a kids' game should not share a look.
2. No AI tells. No default Inter-on-white, no purple/indigo gradients, no three identical cards in a row, no eyebrow label over every section, no decorative dots or blobs, no fake screenshots built from divs, no "scroll down" cues. If it looks like a template, change it.
3. One system. One accent colour used with intent, one corner-radius scale, one theme for the whole page (no section that suddenly inverts). Use off-black and off-white rather than pure #000/#fff. Two typefaces at most, chosen for the subject.
4. Zones, not layers. Every element gets its own reserved space; nothing overlaps by accident. Text never sits on top of a busy image or pattern. Layouts that need a scrim to stay readable are wrong.
5. Mobile first, and it must fit. Design for 390px wide first, then scale up to desktop. The first screen states what it is and what to do in one view: a headline of two lines at most and a short supporting line. Tap targets at least 44px.
6. Readable over clever. Body text contrast at least 4.5:1, including text on solid-colour buttons. Scannable structure (tables, lists, short labels) beats long paragraphs for anything informational.
7. Lead with what it offers. Copy is positive and specific about what the thing does for the person; no defensive or filler copy. In visible copy, use commas, colons or "to" instead of em dashes and en dashes.
8. Motion with a reason. Animate to explain a change of state, never as decoration. Keep it quick and honour prefers-reduced-motion.
9. Honest content. Sample data is realistic but clearly fictional. Never invent reviews, ratings, testimonials, customer counts, awards or facts about real businesses or people. Never invent launch dates, countdowns or "coming soon" promises the request didn't give; use status words instead.
10. Finished states. The first screen is already populated and looks complete. Design the empty, loading, error and success states too, and make every control do something real.`;

export const TECH_GUIDELINES = `Tech guidelines (how Karan builds)
1. Reliability over breadth. A few features that always work beat many that sometimes do. Guard every input and edge case (empty, huge, negative, duplicate, rapid clicks) and never let one failure break the page.
2. One seam for real data. Keep all state and data access behind a single small data layer near the top of the script (for example const store = { list(), add(), update(), remove() }) with an in-memory implementation and seeded sample data. Going live should mean swapping that one layer for API calls, not rewriting the UI.
3. Tunable by design. Put the numbers someone would want to adjust (limits, thresholds, durations, colours, copy) in one CONFIG object at the top. Features should be modular enough to switch off without breaking the rest.
4. Nothing final until saved. Prefer reversible actions: undo, edit after create, confirmation shown in the page for anything destructive. Show what will change before it changes.
5. Plain, dependency-light code. Vanilla HTML, CSS and JS first; add a pinned library only when it clearly earns its place (charts, maps, rich editors). Readable names, small functions, short comments only where the why isn't obvious.
6. Accessible by default. Semantic elements (button, label, nav, main, table), visible keyboard focus, every input labelled, state not conveyed by colour alone.
7. Fast. Under ~60KB, no layout shift, no long tasks on load; render the first screen without waiting on anything.
8. Privacy by design. Collect only what the feature needs, keep personal data out of URLs and logs, and make it obvious what is stored and where.`;

export const PLAN_GUIDELINES = `How Karan takes things live
- Bootstrap and cost-conscious: the smallest setup that does the job, free tiers first, and challenge every paid line item. A static tool stays static.
- His default stack: Cloudflare (Pages for static, Workers for APIs, D1/KV/R2 for data and files), GitHub for code with GitHub Pages or Cloudflare Pages deploys; Next.js + Supabase (Postgres, auth) when an app needs a full backend; Claude via the Anthropic API for AI features. Use these unless the product clearly needs something else, and say why when it does.
- If the audience is in India and it takes payments or messages, plan for UPI/Razorpay and WhatsApp rather than card-only checkouts and email-only flows.
- Engineering habits to bake into the steps: secrets only in environment variables, and SDK clients created lazily inside request handlers (never at module top, which breaks builds when a key is missing); tests for the core logic before launch; CI that fails loudly; verify the real page in a browser at 390px and desktop width before calling it done.
- Privacy by design: minimum personal data, processed close to where it lives, nothing sensitive in logs or third-party analytics; name any data-protection duty (for example India's DPDP Act or GDPR) that applies.
- Honest scope: say plainly what the prototype fakes, and keep reviews, ratings and business facts sourced, never invented.`;

