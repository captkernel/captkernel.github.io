/* c2b-transcribe: fast-mode transcription + public inbox for the C2B console. */

const ALLOWED_ORIGINS = new Set([
  "https://captkernel.com",
  "https://www.captkernel.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;       // inbox cap (spec)
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;        // /transcribe WAV chunk cap
const MAX_NOTE_BYTES = 2048;
const QUEUE_CAP = 200;
const INBOX_PER_DAY = 5;
const TRANSCRIBE_PER_DAY = 120;                  // ~1h of audio in 30s chunks
const AUDIO_TYPES = /^(audio\/|video\/(mp4|webm))/;

function cors(origin) {
  const o = ALLOWED_ORIGINS.has(origin) ? origin : "https://captkernel.com";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
const json = (obj, status, hdrs) =>
  new Response(JSON.stringify(obj), { status: status || 200,
    headers: { "content-type": "application/json", ...hdrs } });

async function ipHash(req, env) {
  const ip = req.headers.get("cf-connecting-ip") || "0.0.0.0";
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(ip + (env.PULL_SECRET || "salt")));
  return [...new Uint8Array(buf)].slice(0, 8)
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

/* KV daily counter. Returns true when the caller is over the limit. */
async function rateLimited(env, route, hash, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:${route}:${hash}:${day}`;
  const n = parseInt((await env.RATE.get(key)) || "0", 10);
  if (n >= limit) return true;
  await env.RATE.put(key, String(n + 1), { expirationTtl: 86400 });
  return false;
}

function authed(req, env) {
  return req.headers.get("Authorization") === `Bearer ${env.PULL_SECRET}`;
}

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const sanitize = name =>
  (name || "note").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const hdrs = cors(req.headers.get("Origin") || "");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: hdrs });

    try {
      if (url.pathname === "/transcribe" && req.method === "POST")
        return await transcribe(req, env, hdrs);
      if (url.pathname === "/inbox" && req.method === "POST")
        return await inboxPost(req, env, hdrs);
      if (url.pathname === "/inbox" && req.method === "GET")
        return authed(req, env) ? await inboxList(env, hdrs)
                                : json({ error: "unauthorized" }, 401, hdrs);
      const m = url.pathname.match(/^\/inbox\/([A-Za-z0-9-]+)$/);
      if (m && (req.method === "GET" || req.method === "DELETE")) {
        if (!authed(req, env)) return json({ error: "unauthorized" }, 401, hdrs);
        return req.method === "GET" ? await inboxGet(env, m[1], hdrs)
                                    : await inboxDelete(env, m[1], hdrs);
      }
      return json({ error: "not found" }, 404, hdrs);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, hdrs);
    }
  },
};

async function transcribe(req, env, hdrs) {
  const hash = await ipHash(req, env);
  if (await rateLimited(env, "t", hash, TRANSCRIBE_PER_DAY))
    return json({ error: "daily transcription limit reached — use local mode" }, 429, hdrs);
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > MAX_CHUNK_BYTES)
    return json({ error: "chunk must be 1B–2MB of WAV audio" }, 413, hdrs);
  const out = await env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio: b64(buf) });
  return json({ text: (out && out.text || "").trim() }, 200, hdrs);
}

async function inboxPost(req, env, hdrs) {
  const hash = await ipHash(req, env);
  if (await rateLimited(env, "i", hash, INBOX_PER_DAY))
    return json({ error: "daily submission limit reached (5/day)" }, 429, hdrs);

  // each item = audio object + .json sidecar → list enough keys to see QUEUE_CAP sidecars
  const listed = await env.INBOX.list({ prefix: "inbox/", limit: QUEUE_CAP * 2 + 2 });
  if (listed.objects.filter(o => o.key.endsWith(".json")).length >= QUEUE_CAP)
    return json({ error: "inbox is full — try again in a few days" }, 503, hdrs);

  const form = await req.formData();
  const audio = form.get("audio");
  const note = String(form.get("note") || "").slice(0, MAX_NOTE_BYTES);
  if (!(audio instanceof File)) return json({ error: "missing audio file" }, 400, hdrs);
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: "audio over 10MB" }, 413, hdrs);
  if (!AUDIO_TYPES.test(audio.type || ""))
    return json({ error: "not an audio file" }, 415, hdrs);

  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const ext = (audio.name.match(/\.[A-Za-z0-9]{1,5}$/) || [".m4a"])[0].toLowerCase();
  await env.INBOX.put(`inbox/${id}${ext}`, audio.stream(),
    { httpMetadata: { contentType: audio.type } });
  await env.INBOX.put(`inbox/${id}.json`, JSON.stringify({
    id, key: `inbox/${id}${ext}`, filename: sanitize(audio.name), note, ip: hash,
    uploaded: new Date().toISOString(), size: audio.size,
  }));
  return json({ id }, 200, hdrs);
}

async function inboxList(env, hdrs) {
  const listed = await env.INBOX.list({ prefix: "inbox/", limit: 1000 });
  const items = [];
  for (const o of listed.objects) {
    if (!o.key.endsWith(".json")) continue;
    const meta = await env.INBOX.get(o.key);
    if (meta) items.push(await meta.json());
  }
  return json({ items }, 200, hdrs);
}

async function findAudioKey(env, id) {
  const listed = await env.INBOX.list({ prefix: `inbox/${id}`, limit: 10 });
  return (listed.objects.find(o => !o.key.endsWith(".json")) || {}).key;
}

async function inboxGet(env, id, hdrs) {
  const key = await findAudioKey(env, id);
  if (!key) return json({ error: "not found" }, 404, hdrs);
  const obj = await env.INBOX.get(key);
  const metaObj = await env.INBOX.get(`inbox/${id}.json`);
  const meta = metaObj ? await metaObj.json() : {};
  return new Response(obj.body, { headers: {
    "content-type": obj.httpMetadata && obj.httpMetadata.contentType || "application/octet-stream",
    "x-c2b-filename": meta.filename || key.slice("inbox/".length),
    "x-c2b-note": encodeURIComponent(meta.note || ""),
    ...hdrs } });
}

async function inboxDelete(env, id, hdrs) {
  const key = await findAudioKey(env, id);
  if (key) await env.INBOX.delete(key);
  await env.INBOX.delete(`inbox/${id}.json`);
  return json({ deleted: true }, 200, hdrs);
}
