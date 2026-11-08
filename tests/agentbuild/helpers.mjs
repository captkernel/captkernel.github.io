import { chromium } from 'playwright';
import { serve } from './server.mjs';

let server, browser;
export async function setup() {
  server = await serve();
  browser = await chromium.launch();
  return server.url;
}
export async function teardown() { await browser?.close(); server?.close(); }

// A fresh context = clean localStorage (a "first-ever visit").
// seen: preset ckBuilt (e.g. { _boot: 1 } = returning visitor, so no swarm).
export async function page({ query = '', width = 1440, height = 900, reducedMotion = 'no-preference', ctx, seen, mobile = false } = {}) {
  const context = ctx || await browser.newContext({ viewport: { width, height }, reducedMotion, isMobile: mobile, hasTouch: mobile });
  if (seen && !ctx) await context.addInitScript((v) => { if (window !== window.top) return; if (!sessionStorage.getItem('abSeeded')) { localStorage.setItem('ckBuilt', v); sessionStorage.setItem('abSeeded', '1'); } }, JSON.stringify(seen));
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(String(e)));
  // keep the terminal-AI worker out of tests
  await p.route(/workers\.dev|127\.0\.0\.1:8787/, (r) => r.abort());
  await p.goto(server.url + query);
  await p.waitForFunction(() => typeof window.openApp === 'function');
  return p;
}
