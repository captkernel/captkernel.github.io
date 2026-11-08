import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, page } from './helpers.mjs';

before(setup);
after(teardown);
const RETURNING = { _boot: 1, hero: 1, fetch: 1 };

test('plan: about has typed text, work has dropped rows, steps never nest', async () => {
  const p = await page({ query: '?ab=off', seen: RETURNING });
  const r = await p.evaluate(() => {
    openApp('about'); openApp('work');
    const out = {};
    for (const id of ['about', 'work']) {
      const body = WIN[id].el.querySelector('.wbody'), steps = AB.plan(body);
      const animated = steps.filter((s) => s.kind !== 'instant');
      out[id] = {
        kinds: [...new Set(steps.map((s) => s.kind))],
        type: animated.filter((s) => s.kind === 'type').length,
        drop: animated.filter((s) => s.kind === 'drop').length,
        inside: steps.every((s) => body.contains(s.el)),
        nested: steps.some((a) => steps.some((b) => a !== b && (b.kind === 'type' || b.kind === 'drop') && b.el.contains(a.el))),
      };
    }
    return out;
  });
  for (const id of ['about', 'work']) {
    assert.ok(r[id].kinds.every((k) => ['type', 'drop', 'paint', 'instant'].includes(k)), id + ' kinds');
    assert.ok(r[id].inside, id + ' inside');
    assert.equal(r[id].nested, false, id + ' nested');
  }
  assert.ok(r.about.type >= 1, 'about types text');
  assert.ok(r.work.drop >= 3, 'work drops rows');
  await p.context().close();
});

test('crew: first open builds with a layer + log, then cleans up; reopen does not rebuild', async () => {
  const p = await page({ seen: RETURNING });
  await p.evaluate(() => openApp('about'));
  await p.waitForSelector('.w-about .ab-layer', { timeout: 500 });
  assert.ok(await p.locator('.w-about .ab-log .ab-ln').count() >= 1);
  await p.waitForSelector('.w-about[data-ab="done"]', { timeout: 6000 });
  await p.waitForFunction(() => !document.querySelector('.ab-layer,.ab-log,.ab-wire'), null, { timeout: 2500 });
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('.w-about .wbody *')].some((e) => e.style.clipPath && e.style.clipPath !== 'none')), false);
  await p.evaluate(() => { closeApp('about'); });
  await p.waitForTimeout(300);
  await p.evaluate(() => openApp('about'));
  await p.waitForTimeout(150);
  assert.equal(await p.locator('.ab-layer').count(), 0);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test('crew: Esc skips instantly and leaves nothing behind', async () => {
  const p = await page({ seen: RETURNING });
  await p.evaluate(() => openApp('work'));
  await p.waitForSelector('.ab-layer');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(80);
  const left = await p.evaluate(() => ({
    overlay: document.querySelectorAll('.ab-layer,.ab-log,.ab-wire').length,
    hidden: [...document.querySelectorAll('.w-work .wbody *')].filter((e) => e.style.opacity === '0' || /inset\(0(px)? 100%/.test(e.style.clipPath)).length,
  }));
  assert.deepEqual(left, { overlay: 0, hidden: 0 });
  await p.context().close();
});

test('crew: a screen seen on a past visit gets the quick build', async () => {
  const p = await page({ seen: { ...RETURNING, kernel: 1 } });
  await p.evaluate(() => openApp('kernel'));
  await p.waitForSelector('.w-kernel .ab-log .ab-ln');
  assert.match(await p.locator('.w-kernel .ab-log .ab-ln').first().innerText(), /cache warm/);
  const t = Date.now();
  await p.waitForSelector('.w-kernel[data-ab="done"]', { timeout: 2000 });
  assert.ok(Date.now() - t < 1500, 'quick build under ~1.5s');
  await p.context().close();
});

test('crew: reduced motion never builds', async () => {
  const p = await page({ seen: RETURNING, reducedMotion: 'reduce' });
  await p.evaluate(() => openApp('about'));
  await p.waitForTimeout(200);
  assert.equal(await p.locator('.ab-layer').count(), 0);
  await p.context().close();
});
