import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, page } from './helpers.mjs';

before(setup);
after(teardown);

test('shouldBuild: full when unseen, quick when seen before, false when already built this load', async () => {
  const p = await page({ query: '?ab=reset' });
  const r = await p.evaluate(() => {
    const a = AB.shouldBuild('zz-test');           // never seen
    AB.memory.mark('zz-test');                    // built in this load
    const b = AB.shouldBuild('zz-test');
    AB.memory._resetLoad();                       // simulate a new page load
    const c = AB.shouldBuild('zz-test');
    return [a, b, c];
  });
  assert.deepEqual(r, ['full', false, 'quick']);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test('?ab=off disables every build', async () => {
  const p = await page({ query: '?ab=off' });
  assert.equal(await p.evaluate(() => AB.shouldBuild('about')), false);
  assert.equal(await p.evaluate(() => AB.shouldSwarm()), false);
  await p.context().close();
});

test('reduced motion disables every build', async () => {
  const p = await page({ reducedMotion: 'reduce' });
  assert.equal(await p.evaluate(() => AB.shouldBuild('about')), false);
  assert.equal(await p.evaluate(() => AB.shouldSwarm()), false);
  await p.context().close();
});

test('localStorage throwing behaves like a first visit, without errors', async () => {
  const p = await page({ query: '?ab=off' });
  const r = await p.evaluate(() => {
    const orig = Storage.prototype.getItem, origSet = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try { AB.memory.mark('x'); return [AB.memory.firstVisit(), AB.memory.seen('x')]; }
    finally { Storage.prototype.getItem = orig; Storage.prototype.setItem = origSet; }
  });
  assert.deepEqual(r, [true, false]);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
