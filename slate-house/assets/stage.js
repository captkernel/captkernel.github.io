/* Home page stage: take the house apart, show each floor, put it back.
   The markup is complete without this file; with it, scrolling drives the sequence. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var track = $('track'), stage = $('stage'), plate = $('plate'), base = $('base');
  if (!track || !stage || !plate || !base) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!(window.CSS && CSS.supports && CSS.supports('clip-path', 'polygon(0 0, 1px 0, 0 1px)'))) return;

  var scrim = $('scrim'), hero = $('hero'), panel = $('panel'), end = $('end'), openBtn = $('open');
  var slices = Array.prototype.slice.call(plate.querySelectorAll('.slice'));
  var cards = Array.prototype.slice.call(panel.children);
  var N = slices.length;
  if (!N || cards.length !== N) return;

  // photo units: the building's centre, width and height inside the 2000 x 1500 frame
  var U = { w: 2000, h: 1500, cx: 847, cy: 704, bw: 1590, span: 1022 }, GAP = 120;
  // the sequence, in screens of scroll
  var T = 7.2, T_OPEN = 1.4, T_FLOOR = 0.9, T_CLOSE = T_OPEN + N * T_FLOOR;

  document.documentElement.classList.add('is-live');
  if (openBtn) openBtn.hidden = false;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smooth(a, b, v) { var x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }

  var vw, vh, wide, s0, s1, tx0, ty0, c1x, c1y;
  function layout() {
    vw = stage.clientWidth; vh = stage.clientHeight; wide = vw >= 900;
    s0 = Math.max(vw / U.w, vh / U.h);
    var W0 = U.w * s0, H0 = U.h * s0;
    var focus = vw / vh < 0.9 ? 500 : U.cx;            // tall screens frame the balcony corner
    tx0 = clamp(vw / 2 - focus * s0, vw - W0, 0);
    ty0 = clamp(vh * 0.56 - U.cy * s0, vh - H0, 0);
    var tall = U.span + (N - 1) * GAP;
    if (wide) {                                         // fit the open house between the left margin and the text panel
      var gutter = Math.min(44, Math.max(16, vw * 0.04)), left = gutter + 112, right = vw * 0.62 - 28, units = 1629;
      s1 = Math.min(0.78 * vh / tall, (right - left) / units);
      c1x = (left + right) / 2 + (U.cx - 869.5) * s1; c1y = vh * 0.52;
    }
    else { s1 = Math.min(0.92 * vw / U.bw, 0.44 * vh / tall); c1x = vw / 2; c1y = Math.max(70 + tall * s1 / 2, (70 + vh - 290) / 2); }
    plate.style.width = W0 + 'px'; plate.style.height = H0 + 'px';
  }

  function travel() { return track.offsetHeight - stage.offsetHeight; }
  function goal() { var d = travel(); return d > 0 ? clamp(-track.getBoundingClientRect().top / d, 0, 1) : 0; }
  function jump(t) {
    window.scrollTo({ top: window.pageYOffset + track.getBoundingClientRect().top + (t / T) * travel(), behavior: 'smooth' });
  }
  slices.forEach(function (el, i) {
    var tag = el.querySelector('.tag');
    if (tag) tag.addEventListener('click', function () { jump(T_OPEN + T_FLOOR * (i + 0.5)); });
  });
  if (openBtn) openBtn.addEventListener('click', function () { jump(T_OPEN + T_FLOOR * 0.5); });

  var cur = -1, live = slices.map(function () { return 0; }), hl = 0, shown = -2, raf = 0;

  function render() {
    var t = cur * T;
    var e = t < 0.4 ? 0 : t < T_OPEN ? smooth(0.4, T_OPEN, t) : t < T_CLOSE ? 1 : 1 - smooth(T_CLOSE, T_CLOSE + 0.9, t);
    var fade = smooth(0, 0.38, e), move = smooth(0.1, 1, e), sep = smooth(0.3, 1, e), line = smooth(0.35, 0.8, e);
    var active = (t >= T_OPEN - 0.12 && t < T_CLOSE + 0.04) ? clamp(Math.floor((t - T_OPEN) / T_FLOOR), 0, N - 1) : -1;

    var busy = false, hlGoal = active >= 0 ? 1 : 0;
    hl += (hlGoal - hl) * 0.14;
    if (Math.abs(hlGoal - hl) < 0.004) hl = hlGoal; else busy = true;

    var s = s0 + (s1 - s0) * move;
    var c0x = tx0 + U.cx * s0, c0y = ty0 + U.cy * s0;
    var cx = c0x + (c1x - c0x) * move, cy = c0y + (c1y - c0y) * move;
    plate.style.transform = 'translate3d(' + (cx - U.cx * s).toFixed(2) + 'px,' + (cy - U.cy * s).toFixed(2) + 'px,0) scale(' + (s / s0).toFixed(5) + ')';
    plate.style.setProperty('--inv', (s0 / s).toFixed(4));
    plate.style.setProperty('--o', line.toFixed(3));
    plate.classList.toggle('is-open', line > 0.5);
    base.style.opacity = (1 - fade).toFixed(3);
    scrim.style.opacity = (1 - fade).toFixed(3);

    slices.forEach(function (el, i) {
      var g = i === active ? 1 : 0;
      live[i] += (g - live[i]) * 0.14;
      if (Math.abs(g - live[i]) < 0.004) live[i] = g; else busy = true;
      var x = wide ? live[i] * 2.2 : 0;
      var y = -(i - (N - 1) / 2) * GAP / U.h * 100 * sep;
      el.style.transform = 'translate3d(' + x.toFixed(3) + '%,' + y.toFixed(3) + '%,0)';
      el.style.opacity = (1 - hl * (1 - live[i]) * 0.6).toFixed(3);
    });

    if (active !== shown) {
      shown = active;
      slices.forEach(function (el, i) { el.classList.toggle('is-active', i === active); });
      cards.forEach(function (el, i) { el.classList.toggle('on', i === active); });
    }
    panel.style.opacity = hl.toFixed(3);

    var h = 1 - smooth(0.1, 0.42, t);
    hero.style.opacity = h.toFixed(3);
    hero.style.transform = 'translate3d(0,' + ((1 - h) * -28).toFixed(1) + 'px,0)';
    hero.style.visibility = h < 0.02 ? 'hidden' : 'visible';
    var z = smooth(T_CLOSE + 0.6, T_CLOSE + 0.95, t);
    end.style.opacity = z.toFixed(3);
    end.style.transform = 'translate3d(0,' + ((1 - z) * 28).toFixed(1) + 'px,0)';
    end.style.visibility = z < 0.02 ? 'hidden' : 'visible';
    return busy;
  }

  function tick() {
    var g = goal();
    if (cur < 0) cur = g;
    cur += (g - cur) * 0.13;
    var settled = Math.abs(g - cur) < 0.0003;
    if (settled) cur = g;
    var busy = render();
    raf = (!settled || busy) ? requestAnimationFrame(tick) : 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(tick); }
  function relayout() { layout(); wake(); }

  layout(); cur = goal(); render();
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  window.addEventListener('pageshow', relayout);
  if (!base.complete) base.addEventListener('load', relayout);
  wake();
})();
