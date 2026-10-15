/**
 * Kids Planet · Campaign review — comments backend
 * Stores every comment from captkernel.com/KPParentsDay as one row in the
 * "Kids Planet · Campaign review comments" Google Sheet, linked to the exact media item.
 *
 * Deploy: Extensions → Apps Script in that sheet (or script.google.com) → paste this file →
 * Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone → Deploy.
 * Put the /exec URL into COMMENTS_ENDPOINT in KPParentsDay/index.html.
 */
const SHEET_ID = '1LCezxsfvZyjfB_vq1gkdnOy8tPs5Kb8W649PhYrJCjs';
const SITE = 'https://captkernel.com/KPParentsDay/';
const HEADERS = ['Comment ID', 'Submitted at', 'Reviewer', 'Comment', 'Status', 'Media ID', 'Media title',
  'Campaign #', 'Campaign', 'Version', 'Type', 'Channel', 'Size', 'Open on site', 'File URL', 'Change notes'];
const COL = Object.fromEntries(HEADERS.map((h, i) => [h, i]));

function sheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

// Keep anything typed by a reviewer from being read as a formula.
function safe_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max || 500);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  const id = String(d.id || '').slice(0, 64);
  const mediaId = String(d.mediaId || '').replace(/[^a-z0-9\-_]/gi, '').slice(0, 120);
  const comment = String(d.comment || '').trim();
  if (!id || !mediaId || !comment) return json_({ ok: false, error: 'missing fields' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const n = sh.getLastRow();
    if (n > 1) {
      const ids = sh.getRange(2, 1, n - 1, 1).getValues().flat();
      if (ids.indexOf(id) !== -1) return json_({ ok: true, duplicate: true });
    }
    const file = String(d.file || '').replace(/[^a-z0-9\-_.\/]/gi, '').slice(0, 200);
    sh.appendRow([
      id, new Date(), safe_(d.reviewer, 80) || 'Anonymous', safe_(comment, 4000), 'Open', mediaId,
      safe_(d.title, 200), Number(d.campaign) || '', safe_(d.campaignName, 120), safe_(d.version, 40),
      safe_(d.kind, 20), safe_(d.channel, 60), safe_(d.size, 30),
      SITE + '#m=' + mediaId, file ? SITE + file : '', ''
    ]);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// GET → all comments (lightweight fields) so the page can show them under each item.
function doGet() {
  const sh = sheet_();
  const n = sh.getLastRow();
  if (n < 2) return json_({ ok: true, comments: [] });
  const rows = sh.getRange(2, 1, n - 1, HEADERS.length).getValues();
  const comments = rows.filter(r => r[COL['Comment ID']]).map(r => ({
    id: r[COL['Comment ID']],
    at: r[COL['Submitted at']] instanceof Date ? r[COL['Submitted at']].toISOString() : String(r[COL['Submitted at']]),
    reviewer: String(r[COL['Reviewer']]).replace(/^'/, ''),
    comment: String(r[COL['Comment']]).replace(/^'/, ''),
    status: String(r[COL['Status']] || 'Open'),
    mediaId: r[COL['Media ID']]
  }));
  return json_({ ok: true, comments });
}
