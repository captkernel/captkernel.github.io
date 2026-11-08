import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, page } from './helpers.mjs';

before(setup);
after(teardown);
const RETURNING = { _boot: 1, hero: 1, fetch: 1, create: 1 };
const geom = (p) => p.evaluate(() => { const d = document.getElementById('desktop'), r = WIN.create.el.getBoundingClientRect(); return { fill: r.width >= d.clientWidth - 20 && r.height >= d.clientHeight - 20 }; });

test('Create opens full screen and the studio swarm builds it, inside the window', async () => {
  const p = await page({ seen: RETURNING });
  await p.evaluate(() => openApp('create'));
  assert.equal((await geom(p)).fill, true);
  await p.waitForSelector('.w-create .ab-bp', { state: 'attached', timeout: 500 });
  assert.equal(await p.locator('.ab-console .ab-chip').count(), 16);
  await p.waitForFunction(() => !document.querySelector('.ab-bp,.ab-ink'), null, { timeout: 6000 });
  const st = await p.evaluate(() => ({
    hidden: [...document.querySelectorAll('.w-create .wbody *')].filter((e) => e.style.opacity === '0' || /inset\(0(px)? 100%/.test(e.style.clipPath)).length,
    ph: document.querySelector('.w-create .cr-in').getAttribute('placeholder'),
  }));
  assert.equal(st.hidden, 0);
  assert.match(st.ph, /^e\.g\. a habit tracker/);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test('Create rebuilds on every open: reopen after close, and restore after minimize', async () => {
  const p = await page({ seen: RETURNING });
  await p.evaluate(() => openApp('create'));
  await p.waitForSelector('.w-create .ab-bp', { state: 'attached' });
  await p.keyboard.press('Escape');
  await p.evaluate(() => closeApp('create'));
  await p.waitForTimeout(300);
  await p.evaluate(() => openApp('create'));
  await p.waitForSelector('.w-create .ab-bp', { state: 'attached', timeout: 500 });
  assert.equal((await geom(p)).fill, true);
  await p.keyboard.press('Escape');
  await p.evaluate(() => minApp('create'));
  await p.waitForTimeout(400);
  await p.evaluate(() => openApp('create'));
  await p.waitForSelector('.w-create .ab-bp', { state: 'attached', timeout: 500 });
  assert.equal((await geom(p)).fill, true);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(60);
  assert.equal(await p.locator('.ab-bp,.ab-ink,.ab-console').count(), 0);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test('Create with reduced motion: still full screen, no animation', async () => {
  const p = await page({ seen: RETURNING, reducedMotion: 'reduce' });
  await p.evaluate(() => openApp('create'));
  assert.equal((await geom(p)).fill, true);
  await p.waitForTimeout(150);
  assert.equal(await p.locator('.ab-bp').count(), 0);
  await p.context().close();
});

test('iOS: the Create sheet builds every time it opens', async () => {
  const p = await page({ query: '?os=ios', width: 390, height: 844, mobile: true, seen: { _boot: 1 } });
  for (let i = 0; i < 2; i++) {
    await p.evaluate(() => iosOpen('create'));
    await p.waitForSelector('.ios-sheet .ab-layer', { state: 'attached', timeout: 1500 });
    await p.waitForFunction(() => !document.querySelector('.ab-layer'), null, { timeout: 5000 });
    await p.evaluate(() => iosClose());
    await p.waitForTimeout(300);
  }
  await p.context().close();
});
