/* captKernel — Agentic Build.
   Every screen looks built by AI agents the first time it opens:
   A "crew" (layout / writer / stylist cursors working on the window + a code log), and on the
   first-ever visit a 16-agent blueprint "swarm" that builds the whole desktop.
   Pure theatre over the real DOM: content is never rewritten, only hidden and revealed.
   Spec: docs/superpowers/specs/2026-11-08-agentic-build-design.md */
(function () {
  'use strict';

  /* ---------------- memory + switches ---------------- */
  var KEY = 'ckBuilt';
  var Q; try { Q = new URLSearchParams(location.search); } catch (e) { Q = { get: function () { return null; } }; }
  var FLAG = Q.get('ab');
  if (FLAG === 'reset') { try { localStorage.removeItem(KEY); } catch (e) {} }

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  var thisLoad = {}, suppressed = {};

  var memory = {
    seen: function (id) { return !!load()[id]; },
    mark: function (id) { var o = load(); o[id] = 1; save(o); thisLoad[id] = 1; },
    firstVisit: function () { return !load()._boot; },
    markBoot: function () { var o = load(); o._boot = 1; save(o); },
    builtThisLoad: function (id) { return !!thisLoad[id]; },
    _resetLoad: function () { thisLoad = {}; }
  };

  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function enabled() { return FLAG !== 'off' && !reduced() && !!window.gsap; }
  function shouldBuild(id) {
    if (!enabled() || thisLoad[id] || suppressed[id]) return false;
    return memory.seen(id) ? 'quick' : 'full';
  }
  function shouldSwarm() { return enabled() && memory.firstVisit() && !Q.get('brief'); }
  /* the swarm builds these itself, so openApp must not start crews on them */
  function suppress(ids, on) { ids.forEach(function (i) { if (on) suppressed[i] = 1; else delete suppressed[i]; }); }

  /* ---------------- helpers ---------------- */
  function mk(parent, cls, css, html) {
    var e = document.createElement('div'); if (cls) e.className = cls; if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hex(c) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || ''); if (!m) return c;
    if (m[4] !== undefined && +m[4] === 0) return 'transparent';
    return '#' + [m[1], m[2], m[3]].map(function (n) { return (+n).toString(16).padStart(2, '0'); }).join('');
  }
  var COL = { layout: '#61afef', writer: '#46d17a', stylist: '#e5c07b' };
  var SWARM_COL = ['#61afef', '#46d17a', '#e5c07b', '#c678dd', '#56b6c2', '#e06c75', '#d19a66', '#98c379',
    '#7aa2f7', '#f7768e', '#9ece6a', '#bb9af7', '#2ac3de', '#ff9e64', '#73daca', '#e0af68'];
  var ARROW = '<svg width="13" height="17" viewBox="0 0 14 18" aria-hidden="true"><path d="M1 1l11 8-5 1-2 6z" fill="currentColor" stroke="#0a0d0b" stroke-width="1"/></svg>';
  function cursor(layer, name, color) {
    var c = mk(layer, 'ab-cur', 'color:' + color, ARROW + '<span style="background:' + color + '">' + esc(name) + '</span>');
    return c;
  }
  function relRect(el, host) {
    var r = el.getBoundingClientRect(), h = host.getBoundingClientRect();
    return { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height };
  }
  function context() {
    var d = new Date(), hh = d.getHours(), t = hh + ':' + String(d.getMinutes()).padStart(2, '0');
    var skin = document.body.classList.contains('ios') ? 'ios' : document.body.classList.contains('macos') ? 'macos'
      : document.body.classList.contains('mobile') ? 'mobile' : 'linux';
    var ref = ''; try { if (document.referrer) { var h = new URL(document.referrer).hostname; if (h && h !== location.hostname) ref = h.replace(/^www\./, ''); } } catch (e) {}
    return { skin: skin, time: t, night: hh >= 19 || hh < 6, ref: ref };
  }

  /* ---------------- planner ---------------- */
  var MEDIA = /^(IMG|SVG|CANVAS|VIDEO|INPUT|TEXTAREA|SELECT|IFRAME|PICTURE)$/;
  var SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|BR)$/;
  function ownText(el) { for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true; return false; }
  function blockKids(el) {
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
      var d = getComputedStyle(c).display; if (d !== 'inline' && d !== 'none' && d !== 'contents') return true;
    }
    return false;
  }
  function repeated(el) {
    var p = el.parentElement; if (!p) return false; var n = 0, sig = el.tagName + '|' + el.className;
    for (var c = p.firstElementChild; c; c = c.nextElementSibling) if (c.tagName + '|' + c.className === sig && ++n > 1) return true;
    return false;
  }
  function painted(el) {
    var s = getComputedStyle(el);
    if (s.backgroundImage !== 'none') return true;
    if (hex(s.backgroundColor) !== 'transparent') return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some(function (k) { return parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none'; });
  }
  function plan(root) {
    var steps = [], rb = root.getBoundingClientRect(), bottom = rb.top + Math.max(root.clientHeight || rb.height, 1);
    function add(el, kind, agent) {
      var r = el.getBoundingClientRect();
      if (r.top > bottom) { kind = 'instant'; agent = null; }
      steps.push({ el: el, kind: kind, agent: agent, chars: (el.textContent || '').trim().length });
    }
    function walk(p) {
      for (var c = p.firstElementChild; c; c = c.nextElementSibling) {
        var tag = c.tagName.toUpperCase(); if (SKIP.test(tag) || c.classList.contains('ab-layer') || c.classList.contains('ab-log')) continue;
        var f = c.getAttribute('data-ab'); if (f === 'skip') continue;
        var r = c.getBoundingClientRect(); if (!r.width && !r.height) continue;
        if (f === 'type') { add(c, 'type', 'writer'); continue; }
        if (f === 'drop') { add(c, 'drop', 'layout'); continue; }
        if (f === 'paint') { add(c, 'paint', 'stylist'); walk(c); continue; }
        if (MEDIA.test(tag)) { add(c, 'drop', 'layout'); continue; }
        if (repeated(c)) { add(c, 'drop', 'layout'); continue; }
        if (tag === 'PRE' || tag === 'BUTTON' || (ownText(c) && !blockKids(c)) || (!c.firstElementChild && (c.textContent || '').trim())) { add(c, 'type', 'writer'); continue; }
        if (painted(c)) { add(c, 'paint', 'stylist'); walk(c); continue; }
        walk(c);
      }
    }
    walk(root);
    var n = 0; steps.forEach(function (s) { if (s.kind !== 'instant' && ++n > 48) { s.kind = 'instant'; s.agent = null; } });
    return steps;
  }

  /* hide / reveal / restore one planned step (inline styles are saved and put back exactly) */
  function hide(s) {
    var st = s.el.style; s.prev = { clip: st.clipPath, op: st.opacity, tf: st.transform, tr: st.transition };
    if (s.kind === 'type') st.clipPath = 'inset(0 100% 0 0)';
    else if (s.kind === 'drop') { st.opacity = '0'; }
    else if (s.kind === 'paint') s.el.classList.add('ab-wire');
  }
  function restore(s) {
    if (!s.prev) return; var st = s.el.style;
    if (window.gsap) gsap.killTweensOf(s.el);
    st.clipPath = s.prev.clip; st.opacity = s.prev.op; st.transform = s.prev.tf; st.transition = s.prev.tr;
    s.el.classList.remove('ab-wire', 'ab-paint-in'); s.prev = null;
  }
  function revealAt(tl, s, at, d) {
    if (s.kind === 'type') {
      var n = Math.max(4, Math.min(s.chars, 40));
      tl.fromTo(s.el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: d, ease: 'steps(' + n + ')', immediateRender: false }, at);
    } else if (s.kind === 'drop') {
      tl.fromTo(s.el, { opacity: 0, x: 26 }, { opacity: 1, x: 0, duration: d, ease: 'power3.out', immediateRender: false }, at);
    } else if (s.kind === 'paint') {
      tl.call(function () { s.el.classList.add('ab-paint-in'); s.el.classList.remove('ab-wire'); }, null, at);
    }
  }
  function snippet(s) {
    var el = s.el, tag = el.tagName.toLowerCase(), cls = (typeof el.className === 'string' && el.className.trim().split(/\s+/)[0]) || '';
    if (s.kind === 'paint') {
      var cs = getComputedStyle(el), bits = [];
      var bg = hex(cs.backgroundColor); if (bg !== 'transparent') bits.push('<i class="y">background</i>:<i class="s">' + bg + '</i>');
      if (parseFloat(cs.borderTopWidth) > 0) bits.push('<i class="y">border</i>:<i class="s">' + cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + hex(cs.borderTopColor) + '</i>');
      if (parseFloat(cs.borderTopLeftRadius) > 0) bits.push('<i class="y">radius</i>:<i class="s">' + cs.borderTopLeftRadius + '</i>');
      return '<i class="p">' + (cls ? '.' + esc(cls) : esc(tag)) + '</i>{' + (bits.join(';') || '<i class="y">display</i>:<i class="s">' + cs.display + '</i>') + '}';
    }
    var txt = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (txt.length > 34) txt = txt.slice(0, 33) + '…';
    var open = '<i class="k">&lt;' + tag + '</i>' + (cls ? ' <i class="p">class</i>=<i class="s">"' + esc(cls) + '"</i>' : '') + '<i class="k">&gt;</i>';
    return open + esc(txt) + (txt ? '<i class="k">&lt;/' + tag + '&gt;</i>' : '');
  }

  /* ---------------- code log ---------------- */
  function makeLog(host, compact) {
    var el = mk(host, 'ab-log' + (compact ? ' compact' : ''), '');
    return {
      el: el,
      line: function (who, color, html) {
        var d = mk(el, 'ab-ln', '', '<b style="color:' + color + '">' + esc(who) + '</b> › ' + html);
        while (el.children.length > (compact ? 1 : 12)) el.removeChild(el.firstChild);
        return d;
      }
    };
  }

  /* ---------------- A: crew build ---------------- */
  var live = [];
  function crew(win, opt) {
    opt = opt || {};
    if (!window.gsap || !win) return Promise.resolve();
    if (opt.id) memory.mark(opt.id);
    var root = opt.root || win.querySelector('.wbody') || win;
    var steps = plan(root).filter(function (s) { return s.kind !== 'instant'; });
    if (!steps.length) return Promise.resolve();
    steps.forEach(hide);

    var prevPos = win.style.position;
    if (getComputedStyle(win).position === 'static') win.style.position = 'relative';
    var layer = mk(win, 'ab-layer', ''), wh = win.getBoundingClientRect().height;
    var log = makeLog(win, wh < 220), ctx = context(), t0 = performance.now();
    win.dataset.ab = 'building';
    var curs = { layout: cursor(layer, 'layout', COL.layout), writer: cursor(layer, 'writer', COL.writer), stylist: cursor(layer, 'stylist', COL.stylist) };

    var tl = gsap.timeline({ paused: true });
    var lanes = { layout: 0, writer: 0.12, stylist: 0.24 }, MV = 0.2;
    if (opt.quick) log.line('crew', '#7e8c84', 'cache warm · rebuilding…');
    else log.line('planner', COL.writer, steps.length + ' steps · 3 agents · skin <i class="s">' + ctx.skin + '</i> · ' + ctx.time + (ctx.night ? ' → night palette' : ''));
    steps.forEach(function (s) {
      var a = s.agent, at = lanes[a];
      var d = s.kind === 'type' ? Math.min(0.75, 0.16 + Math.min(s.chars, 60) * 0.01) : s.kind === 'drop' ? 0.3 : 0.26;
      tl.call(moveTo, [curs[a], s, MV], at);
      tl.call(function () { log.line(a, COL[a], snippet(s)); }, null, at + MV);
      revealAt(tl, s, at + MV, d);
      if (s.kind === 'type') tl.call(sweep, [curs[a], s, d], at + MV);
      lanes[a] = at + MV + d + 0.04;
    });
    var total = Math.max(lanes.layout, lanes.writer, lanes.stylist);
    var target = opt.quick ? 0.7 : Math.min(2.4, Math.max(1.3, total));
    var scale = total / target; tl.timeScale(scale);

    function moveTo(c, s, mv) {
      var r = relRect(s.el, win);
      var x = s.kind === 'drop' ? r.x + Math.min(r.w, 60) : s.kind === 'paint' ? r.x + r.w - 10 : r.x;
      gsap.to(c, { x: x, y: r.y + Math.min(r.h / 2, 14), opacity: 1, duration: mv / scale, ease: 'power2.inOut' });
    }
    function sweep(c, s, d) { var r = relRect(s.el, win); gsap.to(c, { x: r.x + Math.min(r.w, 420), duration: d / scale, ease: 'none' }); }

    return new Promise(function (resolve) {
      var job = { win: win, finish: finish, done: false };
      live.push(job);
      function finish(skipped) {
        if (job.done) return; job.done = true;
        tl.kill(); steps.forEach(restore);
        win.removeEventListener(skipEv, onSkip, true); win.removeEventListener('wheel', onSkip, true);
        if (job.io) job.io.disconnect();
        live = live.filter(function (j) { return j !== job; });
        win.dataset.ab = 'done';
        Object.keys(curs).forEach(function (k) { gsap.killTweensOf(curs[k]); });
        var secs = ((performance.now() - t0) / 1000).toFixed(1);
        log.line('crew', COL.writer, skipped ? '<i class="s">⏭ skipped · content live</i>' : '<i class="s">✓ built in ' + secs + 's · 3 agents</i>');
        layer.remove();
        var gone = function () { log.el.remove(); win.style.position = prevPos; };
        if (skipped) gone(); else gsap.to(log.el, { opacity: 0, delay: 0.7, duration: 0.3, onComplete: gone });
        resolve();
      }
      var skipEv = opt.skipOn || 'pointerdown';
      function onSkip() { finish(true); }
      win.addEventListener(skipEv, onSkip, true); win.addEventListener('wheel', onSkip, { capture: true, passive: true });
      tl.eventCallback('onComplete', function () { finish(false); });
      /* waitVisible: hidden now, built when it scrolls into view (mobile); delay: let a sheet slide in first (iOS) */
      function go() { if (!job.done) { t0 = performance.now(); tl.play(0); } }
      if (opt.waitVisible && 'IntersectionObserver' in window) {
        job.io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { job.io.disconnect(); go(); } }, { threshold: 0.15 });
        job.io.observe(win);
      } else if (opt.delay) setTimeout(go, opt.delay);
      else requestAnimationFrame(go);
    });
  }
  function finishAll() { live.slice().forEach(function (j) { j.finish(true); }); if (swarmJob) swarmJob.finish(true); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && (live.length || swarmJob)) finishAll(); });

  /* ---------------- B: swarm (first-ever boot) ---------------- */
  var swarmJob = null;
  var FILLERS = [
    ['fonts', 'Inter 800 · JetBrains Mono <i class="s">✓ loaded</i>'],
    ['tokens', '<i class="y">--accent</i>:<i class="s">#46d17a</i> · <i class="y">--win</i>:<i class="s">#0f1411</i>'],
    ['perf', 'LCP <i class="s">0.9s</i> · CLS <i class="s">0.00</i> ✓'],
    ['seo', '<i class="k">&lt;title&gt;</i>captKernel<i class="k">&lt;/title&gt;</i> ✓'],
    ['i18n', 'lang=<i class="s">"en"</i> · dir=<i class="s">"ltr"</i> ✓'],
    ['motion', 'easing <i class="s">cubic-bezier(.2,.85,.25,1)</i>']
  ];
  /* regions: [{el, name}] built by the swarm; opt.total agents (16 desktop / 8 iOS) */
  function swarm(opt) {
    if (!window.gsap) return Promise.resolve();
    memory.markBoot();
    (opt.ids || []).forEach(function (id) { memory.mark(id); });
    var W = innerWidth, H = innerHeight, ctx = context(), t0 = performance.now();
    var bp = mk(null, 'ab-bp', ''); (opt.bpParent || document.body).insertBefore(bp, opt.bpBefore || (opt.bpParent || document.body).firstChild);
    var ink = mk(document.body, 'ab-ink', '');
    var con = mk(document.body, 'ab-console' + (W < 700 ? ' narrow' : ''), '');
    var roster = mk(con, 'ab-roster', ''), lg = makeLog(con, false), meter = mk(con, 'ab-meter', '');
    lg.el.classList.add('ab-swarmlog');

    /* real content regions, hidden until their agent paints them */
    var frames = (opt.frames || []).filter(Boolean), hidden = [];
    frames.forEach(function (f) { hidden.push({ el: f, op: f.style.opacity }); f.style.opacity = '0'; });
    var groups = [];
    (opt.content || []).forEach(function (root) {
      if (!root) return;
      var by = new Map();
      plan(root).forEach(function (s) {
        if (s.kind === 'instant') return;
        var top = s.el; while (top.parentElement && top.parentElement !== root) top = top.parentElement;
        if (!by.has(top)) by.set(top, []); by.get(top).push(s);
      });
      by.forEach(function (st, top) {
        var nm = (typeof top.className === 'string' && top.className.trim().split(/\s+/)[0]) || top.tagName.toLowerCase();
        groups.push({ name: nm.replace(/^(m-|w-|ab-)/, '').slice(0, 12), steps: st });
      });
    });
    var all = []; groups.forEach(function (g) { g.steps.forEach(function (s) { hide(s); all.push(s); }); });

    var fixed = opt.fixed;   /* names of the fixed lanes in this variant */
    var slots = Math.max(0, opt.total - fixed.length);
    while (groups.length > slots) { var a = groups.pop(); groups[groups.length - 1].steps = groups[groups.length - 1].steps.concat(a.steps); }
    var guard = 0;
    while (groups.length < slots && guard++ < 40) {
      var big = groups.slice().sort(function (x, y) { return y.steps.length - x.steps.length; })[0];
      if (!big || big.steps.length < 2) break;
      var half = big.steps.splice(Math.ceil(big.steps.length / 2));
      groups.push({ name: big.name + '·2', steps: half });
    }
    var fillers = FILLERS.slice(0, Math.max(0, slots - groups.length));
    var names = fixed.concat(groups.map(function (g) { return g.name; }), fillers.map(function (f) { return f[0]; }));
    var used = {}; names = names.map(function (n) { var k = n; while (used[k]) k = n + '·' + (++used[n]); used[k] = 1; return k; });

    var agents = {};
    names.forEach(function (n, i) {
      var c = SWARM_COL[i % SWARM_COL.length];
      var chip = mk(roster, 'ab-chip', '', '<i style="background:' + c + '"></i>' + esc(n));
      var cur = cursor(ink, n, c); gsap.set(cur, { x: W / 2 + (i - names.length / 2) * 16, y: H + 20, opacity: 0 });
      agents[n] = { name: n, color: c, chip: chip, cur: cur };
    });
    var done = 0;
    var tl = gsap.timeline({ paused: true, onUpdate: function () {
      meter.innerHTML = 'agents <b>' + (names.length - done) + '</b> running · ' + done + '/' + names.length + ' done · ' + ((performance.now() - t0) / 1000).toFixed(1) + 's';
    } });
    function say(a, html, at) { tl.call(function () { lg.line(a.name, a.color, html); }, null, at); }
    function start(a, at) { tl.call(function () { a.chip.classList.add('run'); }, null, at); }
    function end(a, at) { tl.call(function () { a.chip.classList.remove('run'); a.chip.classList.add('ok'); done++; gsap.to(a.cur, { opacity: 0, duration: 0.2 }); }, null, at); }
    function go(a, x, y, at, d) { tl.to(a.cur, { x: x, y: y, opacity: 1, duration: d || 0.3, ease: 'power2.inOut' }, at); }
    function box(a, r, label, at, d) {
      var b = mk(ink, 'ab-box', 'left:' + r.x + 'px;top:' + r.y + 'px;width:0;height:' + r.h + 'px', label ? esc(label) : '');
      go(a, r.x, r.y, at, 0.2);
      tl.to(b, { width: r.w, duration: d || 0.35, ease: 'power2.out' }, at + 0.2);
      tl.to(a.cur, { x: r.x + r.w - 4, y: r.y + r.h - 4, duration: d || 0.35, ease: 'power2.out' }, at + 0.2);
      return b;
    }
    function vr(el) { var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
    function label(el) { var c = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''; return el.tagName.toLowerCase() + (c ? '.' + c : ''); }

    if (ctx.ref) lg.line('boot', '#7e8c84', 'referrer <i class="s">' + esc(ctx.ref) + '</i> · tailoring copy');
    lg.line('boot', '#7e8c84', '<i class="s">spawning ' + names.length + ' agents</i> · skin ' + ctx.skin + ' · ' + ctx.time + (ctx.night ? ' → night palette' : ''));

    var lane = opt.lanes({ agents: agents, tl: tl, say: say, start: start, end: end, go: go, box: box, vr: vr, ink: ink, bp: bp, W: W, H: H, mk: mk, label: label });

    /* content agents: box each step on the blueprint, then reveal it */
    groups.forEach(function (g, gi) {
      var a = agents[names[fixed.length + gi]], at = lane.contentStart + gi * 0.07;
      var gap = Math.min(0.28, (lane.contentBudget || 1.2) / g.steps.length), bd = Math.min(0.22, gap + 0.06);   /* every agent fits its budget */
      start(a, at);
      g.steps.forEach(function (s, si) {
        var r = vr(s.el), b = box(a, r, si === 0 ? label(s.el) : '', at, bd);
        if (si === 0 || s.kind === 'paint') say(a, snippet(s), at + 0.2);
        revealAt(tl, s, at + 0.2 + bd, s.kind === 'type' ? 0.32 : 0.26);
        tl.to(b, { opacity: 0, duration: 0.2 }, at + 0.5 + bd);
        at += gap;
      });
      end(a, at + 0.3);
    });
    fillers.forEach(function (f, fi) {
      var a = agents[f[0]], at = 0.5 + fi * 0.25;
      start(a, at); go(a, W * (0.2 + 0.12 * fi), H * (0.25 + 0.1 * (fi % 3)), at, 0.5); say(a, f[1], at + 0.5); end(a, at + 1.0 + fi * 0.15);
    });
    var paintAt = Math.max(lane.paintAt, tl.duration() - 0.2);
    lane.paint(paintAt);

    return new Promise(function (resolve) {
      var job = { finish: finish, done: false }; swarmJob = job;
      function finish(skipped) {
        if (job.done) return; job.done = true; swarmJob = null;
        tl.kill(); all.forEach(restore);
        hidden.forEach(function (h) { h.el.style.opacity = h.op; });
        if (lane.cleanup) lane.cleanup();
        removeEventListener('pointerdown', onSkip, true); removeEventListener('keydown', onSkip, true);
        Object.keys(agents).forEach(function (k) { gsap.killTweensOf(agents[k].cur); });
        var secs = ((performance.now() - t0) / 1000).toFixed(1);
        meter.innerHTML = skipped ? '<b class="ok">⏭ skipped</b> · content live' : '<b class="ok">✓ desktop live</b> · ' + names.length + ' agents · ' + secs + 's';
        lg.line('boot', '#46d17a', skipped ? 'skipped by visitor · all regions painted' : '<i class="s">✓ captKernel booted in ' + secs + 's — welcome.</i>');
        ink.remove(); bp.remove();
        if (skipped) con.remove(); else gsap.to(con, { opacity: 0, y: 12, delay: 1.1, duration: 0.4, onComplete: function () { con.remove(); } });
        resolve();
      }
      function onSkip(e) { if (e.type === 'keydown' && /^(Shift|Control|Alt|Meta|Tab)$/.test(e.key)) return; finish(true); }
      addEventListener('pointerdown', onSkip, true); addEventListener('keydown', onSkip, true);
      tl.eventCallback('onComplete', function () { finish(false); });
      requestAnimationFrame(function () { if (!job.done) tl.play(0); });
    });
  }

  /* shared fixed lanes ------------------------------------------------------------------ */
  function starfield(k, a, at, until) {
    var n = k.W < 700 ? 40 : 80, stars = [];
    k.start(a, at); k.say(a, '<i class="k">sky</i> HIP catalogue · <i class="y">' + n + '</i> anchors', at + 0.05);
    for (var i = 0; i < n; i++) stars.push(k.mk(k.bp, 'ab-star', 'left:' + (Math.random() * k.W) + 'px;top:' + (Math.random() * k.H) + 'px'));
    var step = (until - at) / Math.ceil(n / 6);
    for (var j = 0; j < n; j += 6) {
      var t = at + (j / 6) * step;
      k.go(a, parseFloat(stars[j].style.left), parseFloat(stars[j].style.top), t, step * 0.9);
      k.tl.to(stars.slice(j, j + 6), { opacity: function () { return 0.3 + Math.random() * 0.7; }, duration: 0.2 }, t + step * 0.8);
    }
    k.end(a, until + 0.1);
  }
  function a11yLane(k, a, at, scope) {
    var f = []; scope.forEach(function (s) { if (s) f = f.concat([].slice.call(s.querySelectorAll('a,button,[tabindex="0"],input'))); });
    f = f.filter(function (e) { var r = e.getBoundingClientRect(); return r.width > 4 && r.top > 0 && r.top < k.H; }).slice(0, 6);
    k.start(a, at);
    f.forEach(function (el, i) {
      var r = k.vr(el), b = k.mk(k.ink, 'ab-badge', 'left:' + (r.x - 7) + 'px;top:' + (r.y - 7) + 'px;opacity:0', String(i + 1));
      k.go(a, r.x - 7, r.y - 7, at + i * 0.1, 0.09); k.tl.to(b, { opacity: 1, duration: 0.1 }, at + i * 0.1 + 0.09);
      k.tl.to(b, { opacity: 0, duration: 0.25 }, at + f.length * 0.1 + 0.3);
    });
    k.say(a, 'tab order <i class="s">' + f.length + ' stops ✓</i> · contrast <i class="y">7.2:1</i> ✓', at + f.length * 0.1);
    k.end(a, at + f.length * 0.1 + 0.35);
  }
  function criticLane(k, a, at, pair) {
    k.start(a, at);
    if (pair && pair[0] && pair[1]) {
      var r1 = pair[0].getBoundingClientRect(), r2 = pair[1].getBoundingClientRect();
      var horiz = Math.abs(r2.top - r1.top) < 4, gap = Math.round(horiz ? r2.left - r1.right : r2.top - r1.bottom);
      var x = horiz ? r1.right : r1.left, y = horiz ? r1.top - 16 : r1.bottom;
      var fl = k.mk(k.ink, 'ab-flag', 'left:' + x + 'px;top:' + y + 'px;opacity:0', 'gap ' + (gap - 1) + ' ≠ ' + gap);
      k.go(a, x, y + 10, at, 0.3); k.tl.to(fl, { opacity: 1, duration: 0.1 }, at + 0.3);
      k.say(a, '<i class="k">✗</i> gap ' + (gap - 1) + 'px → <i class="s">' + gap + 'px</i> (8pt grid)', at + 0.32);
      k.tl.call(function () { fl.classList.add('ok'); fl.textContent = '✓ fixed'; }, null, at + 0.75);
      k.tl.to(fl, { opacity: 0, duration: 0.2 }, at + 1.2);
    }
    k.say(a, 'layout review <i class="s">✓ pass</i>', at + 1.0);
    k.end(a, at + 1.25);
  }
  function painterLane(k, a, at) {
    k.start(a, at); k.say(a, '<i class="k">apply</i> theme · sky · <i class="s">' + context().skin + '</i>', at);
    var o = { p: 0 };
    k.tl.to(o, { p: 100, duration: 0.6, ease: 'power1.inOut', onUpdate: function () {
      k.bp.style.clipPath = 'inset(0 0 0 ' + o.p + '%)';
      gsap.set(a.cur, { x: k.W * o.p / 100, y: k.H / 2, opacity: 1 });
    } }, at);
    k.tl.to(k.ink.querySelectorAll('.ab-box,.ab-guide,.ab-dim'), { opacity: 0, duration: 0.3 }, at);
    k.end(a, at + 0.62);
  }

  /* desktop variant: 16 agents */
  function swarmDesktop(o) {
    var wins = o.wins.filter(Boolean), dock = o.dock, top = o.topbar && getComputedStyle(o.topbar).display !== 'none' ? o.topbar : null;
    var fixed = ['architect', 'wm'].concat(top ? ['topbar'] : [], ['dock', 'icons', 'starfield', 'a11y', 'critic', 'painter']);
    var icons = dock ? [].slice.call(dock.querySelectorAll('.app')) : [];
    var savedIcons = icons.map(function (i) { return i.style.opacity; });
    if (dock && window.dockUp) window.dockUp();
    return swarm({
      total: 16, fixed: fixed, ids: o.ids,
      frames: wins.concat(top ? [top] : [], dock ? [dock] : []),
      content: wins.map(function (w) { return w.querySelector('.wbody'); }),
      bpParent: document.body, bpBefore: document.getElementById('desktop'),
      lanes: function (k) {
        var A = k.agents, g = 0;
        /* architect: guides along each window edge */
        k.start(A.architect, 0); k.say(A.architect, '<i class="k">grid</i> 14px · gutters <i class="y">12</i>', 0.05);
        wins.forEach(function (w) {
          var r = k.vr(w), v = k.mk(k.ink, 'ab-guide', 'left:' + r.x + 'px;top:0;width:1px;height:0'), h = k.mk(k.ink, 'ab-guide', 'left:0;top:' + r.y + 'px;height:1px;width:0');
          k.go(A.architect, r.x, r.y, g, 0.25);
          k.tl.to(v, { height: k.H, duration: 0.4 }, g + 0.2); k.tl.to(h, { width: k.W, duration: 0.4 }, g + 0.2);
          k.mk(k.ink, 'ab-dim', 'left:' + (r.x + 4) + 'px;top:' + (r.y - 13) + 'px', '← ' + Math.round(r.x));
          g += 0.25;
        });
        if (wins.length > 1) { var r0 = k.vr(wins[0]), r1 = k.vr(wins[1]); k.say(A.architect, 'split <i class="y">' + Math.round(r0.w / (r0.w + r1.w) * 100) + '%</i> / ' + Math.round(r1.w / (r0.w + r1.w) * 100) + '%', g + 0.2); }
        k.end(A.architect, g + 0.5);
        /* wm: window frames */
        k.start(A.wm, 0.2); var t = 0.2;
        wins.forEach(function (w) {
          var nm = (w.querySelector('.wbar .name') || {}).textContent || 'window';
          k.box(A.wm, k.vr(w), 'window · ' + nm, t, 0.4);
          k.tl.to(w, { opacity: 1, duration: 0.25 }, t + 0.6);
          t += 0.45;
        });
        k.say(A.wm, '<i class="k">openApp</i>(' + o.ids.map(function (i) { return '<i class="s">"' + i + '"</i>'; }).join(', ') + ')', t);
        k.end(A.wm, t + 0.3);
        if (top) { k.start(A.topbar, 0.3); k.box(A.topbar, k.vr(top), 'menubar', 0.3, 0.4); k.tl.to(top, { opacity: 1, duration: 0.25 }, 0.95); k.say(A.topbar, '<i class="k">&lt;nav</i> menus · clock<i class="k">&gt;</i>', 0.9); k.end(A.topbar, 1.1); }
        if (dock) {
          k.start(A.dock, 0.55); k.box(A.dock, k.vr(dock), 'dock', 0.55, 0.4); k.tl.to(dock, { opacity: 1, duration: 0.25 }, 1.15);
          k.say(A.dock, '<i class="k">&lt;nav.dock&gt;</i> ' + icons.length + ' slots', 1.1); k.end(A.dock, 1.3);
          k.start(A.icons, 1.2);
          icons.forEach(function (ic, i) { ic.style.opacity = '0'; var r = k.vr(ic); k.go(A.icons, r.x + r.w / 2, r.y + 4, 1.2 + i * 0.12, 0.1); k.tl.fromTo(ic, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2, immediateRender: false }, 1.3 + i * 0.12); });
          k.say(A.icons, 'icons <i class="y">×' + icons.length + '</i> · tooltips · run dots', 1.3 + icons.length * 0.12);
          k.end(A.icons, 1.4 + icons.length * 0.12);
        } else { k.start(A.dock, 0.5); k.end(A.dock, 0.8); k.start(A.icons, 0.6); k.end(A.icons, 0.9); }
        starfield(k, A.starfield, 0.05, 2.2);
        a11yLane(k, A.a11y, 1.6, wins.concat([dock]));
        var btns = wins[0] ? wins[0].querySelectorAll('.ctas .btn') : [];
        criticLane(k, A.critic, 1.45, btns.length > 1 ? [btns[0], btns[1]] : null);
        return {
          contentStart: 0.8, contentBudget: 0.9, paintAt: 2.4,
          paint: function (at) { painterLane(k, A.painter, at); },
          cleanup: function () {
            icons.forEach(function (ic, i) { gsap.killTweensOf(ic); ic.style.opacity = savedIcons[i]; ic.style.transform = ''; });
            wins.forEach(function (w) { gsap.killTweensOf(w); });
            if (window.dockPeekReveal) window.dockPeekReveal(1600);
          }
        };
      }
    });
  }

  /* iOS variant: 8 agents over the springboard */
  function swarmIOS(host) {
    var sb = host.querySelector('.sb'); if (!sb) return Promise.resolve();
    var widgets = [].slice.call(sb.querySelectorAll('.sb-widgets > .wg'));
    var grid = [].slice.call(sb.querySelectorAll('.sb-grid > *')), dockIc = [].slice.call(sb.querySelectorAll('.sb-dock > *'));
    var search = sb.querySelector('.sb-search'), status = sb.querySelector('.sb-status');
    var parts = widgets.concat(grid, dockIc, [search, status]).filter(Boolean), saved = parts.map(function (p) { return p.style.opacity; });
    var prevZ = sb.style.zIndex, prevPos = sb.style.position;
    sb.style.position = 'relative'; sb.style.zIndex = '1';
    return swarm({
      total: 8, fixed: ['architect', 'status', 'widgets', 'icons', 'search', 'dock', 'critic', 'painter'],
      frames: [], content: [], bpParent: host, bpBefore: sb, ids: [],
      lanes: function (k) {
        var A = k.agents;
        parts.forEach(function (p) { p.style.opacity = '0'; });
        k.start(A.architect, 0); k.say(A.architect, '<i class="k">grid</i> 4 × 6 · safe areas ✓', 0.05);
        var c = k.mk(k.ink, 'ab-guide', 'left:' + (k.W / 2) + 'px;top:0;width:1px;height:0'); k.go(A.architect, k.W / 2, 40, 0, 0.3); k.tl.to(c, { height: k.H, duration: 0.4 }, 0.2); k.end(A.architect, 0.7);
        function region(a, els, name, at, line) {
          k.start(a, at);
          els.forEach(function (el, i) { var r = k.vr(el), b = k.box(a, r, i ? '' : name, at + i * 0.16, 0.2); k.tl.fromTo(el, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.25, immediateRender: false }, at + i * 0.16 + 0.35); k.tl.to(b, { opacity: 0, duration: 0.2 }, at + i * 0.16 + 0.6); });
          k.say(a, line, at + 0.3); k.end(a, at + els.length * 0.16 + 0.5);
        }
        if (status) region(A.status, [status], 'status', 0.15, '<i class="k">&lt;status&gt;</i> clock · glyphs'); else { k.start(A.status, 0); k.end(A.status, 0.2); }
        region(A.widgets, widgets, 'widget', 0.3, 'widgets <i class="y">×' + widgets.length + '</i> · Liquid Glass');
        region(A.icons, grid, 'icon', 0.55, 'icons <i class="y">×' + grid.length + '</i> · 60pt squircles');
        if (search) region(A.search, [search], 'search', 0.9, '<i class="k">&lt;button</i> role=<i class="s">"search"</i><i class="k">&gt;</i>'); else { k.start(A.search, 0); k.end(A.search, 0.2); }
        region(A.dock, dockIc, 'dock', 1.0, 'dock <i class="y">×' + dockIc.length + '</i>');
        criticLane(k, A.critic, 1.4, grid.length > 1 ? [grid[0], grid[1]] : null);
        return {
          contentStart: 0, paintAt: 1.9,
          paint: function (at) { painterLane(k, A.painter, at); },
          cleanup: function () { parts.forEach(function (p, i) { gsap.killTweensOf(p); p.style.opacity = saved[i]; p.style.transform = ''; }); sb.style.zIndex = prevZ; sb.style.position = prevPos; }
        };
      }
    });
  }

  window.AB = {
    memory: memory, shouldBuild: shouldBuild, shouldSwarm: shouldSwarm, suppress: suppress,
    plan: plan, crew: crew, finishAll: finishAll, swarmDesktop: swarmDesktop, swarmIOS: swarmIOS,
    busy: function () { return live.length > 0 || !!swarmJob; }
  };
})();
