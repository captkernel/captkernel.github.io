/* Slate House: menu and enquiry builder. Every page works without this file except the enquiry builder. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var DAY = 86400000;

  /* ---------- pure helpers (also exposed for tests) ---------- */
  function parseDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = new Date(t);
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : null;
  }
  function isoOf(t) { return new Date(t).toISOString().slice(0, 10); }
  function todayUTC() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  function nightsBetween(inIso, outIso) {
    var a = parseDate(inIso), b = parseDate(outIso);
    return a === null || b === null ? null : Math.round((b - a) / DAY);
  }
  function isPeak(t, ranges) {
    var md = isoOf(t).slice(5);
    return (ranges || []).some(function (r) { return r.from <= r.to ? (md >= r.from && md <= r.to) : (md >= r.from || md <= r.to); });
  }
  /* One room type, `count` rooms, `guests` people. Returns null when the dates don't make a stay. */
  function estimate(inIso, outIso, room, count, guests, ranges) {
    var n = nightsBetween(inIso, outIso), start = parseDate(inIso);
    if (n === null || n < 1 || !room) return null;
    var peak = 0, i;
    for (i = 0; i < n; i++) if (isPeak(start + i * DAY, ranges)) peak++;
    var extras = Math.max(0, (guests || 0) - room.sleeps * count);
    var extraCost = room.extra_bed ? extras * room.extra_bed * n : 0;
    return { nights: n, peakNights: peak, extras: room.extra_bed ? extras : 0,
             total: count * (peak * room.rate_peak + (n - peak) * room.rate) + extraCost };
  }
  function capacity(room, count) { return (room.sleeps + (room.extra_bed ? 1 : 0)) * count; }
  window.SlateHouse = { parseDate: parseDate, nightsBetween: nightsBetween, isPeak: isPeak, estimate: estimate, capacity: capacity };

  /* ---------- menu: close on outside click or Escape ---------- */
  var menu = document.querySelector('.menu');
  if (menu) {
    document.addEventListener('click', function (ev) { if (menu.open && !menu.contains(ev.target)) menu.open = false; });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
  }

  /* ---------- enquiry builder ---------- */
  var form = $('enq');
  if (!form) return;
  var data;
  try { data = JSON.parse($('site-data').textContent); } catch (err) { return; }

  var fIn = $('f-in'), fOut = $('f-out'), fGuests = $('f-guests'), fCount = $('f-count'), fRoom = $('f-room'), fName = $('f-name'), fNote = $('f-note');
  var msg = $('f-msg'), total = $('total'), problem = $('problem'), copied = $('copied'), wa = $('send-wa'), mail = $('send-mail');
  var KEY = 'slate-house-enquiry';
  var inr = function (n) { return '₹' + n.toLocaleString('en-IN'); };
  var int = function (el, lo, hi) { return Math.min(hi, Math.max(lo, parseInt(el.value, 10) || lo)); };
  var nice = function (iso) {
    var t = parseDate(iso);
    return t === null ? '' : new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  var s = function (n) { return n === 1 ? '' : 's'; };

  var today = todayUTC();
  fIn.min = isoOf(today); fOut.min = isoOf(today + DAY);

  // start from a saved draft, then the room named in the link, then sensible defaults
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (err) { saved = {}; }
  var savedIn = parseDate(saved.checkin), savedOut = parseDate(saved.checkout);
  if (savedIn !== null && savedOut !== null && savedIn >= today && savedOut > savedIn) { fIn.value = saved.checkin; fOut.value = saved.checkout; }
  else { fIn.value = isoOf(today + 14 * DAY); fOut.value = isoOf(today + 16 * DAY); }
  if (saved.guests) fGuests.value = saved.guests;
  if (saved.count) fCount.value = saved.count;
  if (saved.name) fName.value = saved.name;
  var wanted = null;
  try { wanted = new URLSearchParams(location.search).get('room'); } catch (err) { wanted = null; }
  var pick = wanted || saved.room || '';
  if (data.rooms.some(function (r) { return r.slug === pick; })) fRoom.value = pick;

  function build() {
    var guests = int(fGuests, 1, 32), count = int(fCount, 1, 12);
    var room = data.rooms.filter(function (r) { return r.slug === fRoom.value; })[0] || null;
    var n = nightsBetween(fIn.value, fOut.value), start = parseDate(fIn.value);
    var issue = '';

    if (start !== null) fOut.min = isoOf(start + DAY);
    if (n === null) issue = 'Choose a check-in and a check-out date.';
    else if (start < today) issue = 'That check-in date has passed.';
    else if (n < 1) issue = 'Check-out needs to be after check-in.';
    else if (n > data.maxNights) issue = 'For stays longer than ' + data.maxNights + ' nights, write to us directly.';
    else if (room && count > room.count) issue = 'We have ' + room.count + ' ' + room.name + s(room.count) + '. Choose fewer rooms or another kind.';
    else if (room && guests > capacity(room, count)) {
      var need = Math.ceil(guests / (room.sleeps + (room.extra_bed ? 1 : 0)));
      issue = 'A ' + room.name + ' sleeps ' + room.sleeps + (room.extra_bed ? ', or ' + (room.sleeps + 1) + ' with an extra bed' : '') + '. ' +
              guests + ' guests need ' + need + ' room' + s(need) + (need > room.count ? ', and we have ' + room.count + '. Try another kind or write to us.' : '.');
    }
    problem.textContent = issue; problem.hidden = !issue;

    var lines = ['Hello ' + data.name + ','];
    lines.push('');
    if (n !== null && n >= 1) lines.push("I'd like to stay " + n + ' night' + s(n) + ', from ' + nice(fIn.value) + ' to ' + nice(fOut.value) + ', for ' + guests + ' guest' + s(guests) + '.');
    else lines.push("I'd like to stay for " + guests + ' guest' + s(guests) + '. My dates are flexible.');
    lines.push(room ? 'Room: ' + count + ' × ' + room.name + '.' : 'Room: no preference' + (count > 1 ? ', ' + count + ' rooms' : '') + '. Please suggest one.');
    if (fNote.value.trim()) lines.push('Note: ' + fNote.value.trim());
    lines.push('', "Please let me know what's available and the rate.", '', 'Thank you' + (fName.value.trim() ? ',' : ''));
    if (fName.value.trim()) lines.push(fName.value.trim());
    msg.value = lines.join('\n');

    var est = issue ? null : estimate(fIn.value, fOut.value, room, count, guests, data.peak);
    if (est) {
      var bits = [est.nights + ' night' + s(est.nights), count + ' room' + s(count)];
      if (est.peakNights) bits.push(est.peakNights + ' at peak rate');
      if (est.extras) bits.push(est.extras + ' extra bed' + s(est.extras));
      total.innerHTML = '';
      var b = document.createElement('b'); b.textContent = inr(est.total);
      var sp = document.createElement('span'); sp.className = 'mono'; sp.textContent = 'estimate · ' + bits.join(' · ') + ' · breakfast included · plus GST';
      total.appendChild(b); total.appendChild(sp);
    } else {
      total.innerHTML = '';
      var hint = document.createElement('span'); hint.className = 'mono';
      hint.textContent = issue ? 'Fix the dates or room above to see an estimate' : 'Choose a room to see an estimate';
      total.appendChild(hint);
    }

    var subject = 'Enquiry' + (n !== null && n >= 1 ? ': ' + nice(fIn.value) + ', ' + n + ' night' + s(n) : '');
    wa.href = 'https://wa.me/' + data.whatsapp + '?text=' + encodeURIComponent(msg.value);
    mail.href = 'mailto:' + data.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg.value);
    copied.textContent = '';

    try { localStorage.setItem(KEY, JSON.stringify({ checkin: fIn.value, checkout: fOut.value, guests: guests, count: count, room: fRoom.value, name: fName.value.trim() })); } catch (err) { /* storage is optional */ }
  }

  [fIn, fOut, fGuests, fCount, fRoom, fName, fNote].forEach(function (el) { el.addEventListener('input', build); el.addEventListener('change', build); });
  fIn.addEventListener('change', function () {            // keep check-out after check-in
    var a = parseDate(fIn.value), b = parseDate(fOut.value);
    if (a !== null && (b === null || b <= a)) { fOut.value = isoOf(a + 2 * DAY); build(); }
  });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var fallback = function () { msg.focus(); msg.select(); copied.textContent = 'Selected. Copy it from the box'; };
    try { navigator.clipboard.writeText(msg.value).then(function () { copied.textContent = 'Copied'; }, fallback); } catch (err) { fallback(); }
  });
  build();
})();
