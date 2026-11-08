import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, page } from './helpers.mjs';

before(setup);
after(teardown);

test('first-ever visit: 16-agent swarm builds the desktop, then leaves nothing behind', async () => {
  const p = await page();
  await p.waitForSelector('.ab-bp', { state: 'attached', timeout: 2500 });
  assert.equal(await p.locator('.ab-console .ab-chip').count(), 16);
  await p.waitForFunction(() => document.querySelectorAll('.ab-chip.ok').length === 16, null, { timeout: 6000 });
  await p.waitForFunction(() => !document.querySelector('.ab-bp,.ab-ink'), null, { timeout: 3000 });
  const st = await p.evaluate(() => ({
    built: JSON.parse(localStorage.getItem('ckBuilt')),
    heroOpacity: getComputedStyle(WIN.hero.el).opacity,
    hidden: [...document.querySelectorAll('#desktop .wbody *')].filter((e) => e.style.opacity === '0' || /inset\(0(px)? 100%/.test(e.style.clipPath)).length,
  }));
  assert.equal(st.built._boot, 1);
  assert.equal(st.built.hero, 1);
  assert.equal(st.heroOpacity, '1');
  assert.equal(st.hidden, 0);
  assert.deepEqual(p.errors, []);

  // reload = returning visitor: no swarm, home gets the quick crew
  await p.reload();
  await p.waitForFunction(() => typeof window.openApp === 'function');
  await p.waitForTimeout(300);
  assert.equal(await p.locator('.ab-bp').count(), 0);
  await p.context().close();
});

test('any click skips the swarm and the desktop is fully live', async () => {
  const p = await page();
  await p.waitForSelector('.ab-bp', { state: 'attached' });
  await p.waitForTimeout(600);
  await p.mouse.click(5, 300);
  await p.waitForTimeout(450);   // windows fade back in via their CSS opacity transition
  assert.equal(await p.locator('.ab-bp,.ab-ink').count(), 0);
  assert.equal(await p.evaluate(() => getComputedStyle(WIN.fetch.el).opacity), '1');
  await p.context().close();
});

test('a shared ?brief link never waits on the swarm', async () => {
  const p = await page({ query: '?brief=000000000000' });
  await p.waitForTimeout(400);
  assert.equal(await p.locator('.ab-bp').count(), 0);
  await p.context().close();
});

test('?ab=reset replays the first-visit swarm', async () => {
  const p = await page({ query: '?ab=reset', seen: { _boot: 1, hero: 1, fetch: 1 } });
  await p.waitForSelector('.ab-bp', { state: 'attached', timeout: 2500 });
  await p.context().close();
});

test('iOS: 8-agent springboard swarm, then sheets build', async () => {
  const p = await page({ query: '?os=ios', width: 390, height: 844, mobile: true });
  await p.waitForSelector('.ab-bp', { state: 'attached', timeout: 2500 });
  assert.equal(await p.locator('.ab-chip').count(), 8);
  await p.waitForFunction(() => !document.querySelector('.ab-bp'), null, { timeout: 5000 });
  await p.evaluate(() => iosOpen('about'));
  await p.waitForSelector('.ios-sheet .ab-layer', { state: 'attached', timeout: 1500 });
  await p.waitForFunction(() => !document.querySelector('.ab-layer'), null, { timeout: 4000 });
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test('mobile: a section builds when it scrolls into view', async () => {
  const p = await page({ width: 390, height: 844, mobile: true, seen: { _boot: 1 } });
  await p.waitForSelector('#m-work');
  await p.waitForSelector('#m-work .ab-layer', { state: 'attached' });   // waiting, hidden
  assert.equal(await p.locator('#m-work .ab-log .ab-ln').count(), 1);
  await p.evaluate(() => document.getElementById('m-work').scrollIntoView());
  await p.waitForFunction(() => !document.querySelector('#m-work .ab-layer'), null, { timeout: 3000 });
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test('switching OS mid-build finishes it cleanly', async () => {
  const p = await page({ seen: { _boot: 1, hero: 1, fetch: 1 } });
  await p.evaluate(() => openApp('about'));
  await p.waitForSelector('.ab-layer');
  await p.evaluate(() => applyOs('macos'));
  await p.waitForTimeout(60);
  assert.equal(await p.locator('.ab-layer,.ab-wire').count(), 0);
  await p.context().close();
});
