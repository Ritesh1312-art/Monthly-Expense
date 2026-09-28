/* ============================================================
   PaisaGuru Licensing Server (v1 + v2)
   ------------------------------------------------------------
   Pure Node.js (node:http) — koi framework nahi, koi npm
   dependency nahi. DB = ek JSON file (DATA_DIR/db.json).

   v1 : 7-din trial (per-IP cap) + direct license keys + IP/device
        binding + admin panel se key generate / block / IP reset
   v2 : user accounts (phone + password), user portal, Telegram
        approve buttons se per-user (account-bound) key, aur
        cloud sync (backup/restore).
   ============================================================ */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { adminPage } from './admin.mjs';
import { portalPage } from './portal.mjs';

/* ---------------- Env ---------------- */
const PORT = Number(process.env.PORT || 3000);
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me';
const DATA_DIR = process.env.DATA_DIR || './data';
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);
const MAX_TRIALS_PER_IP = Number(process.env.MAX_TRIALS_PER_IP || 3);
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const UPI_ID = process.env.UPI_ID || '';
const UPI_NAME = process.env.UPI_NAME || '';
const PRICE_LABEL = process.env.PRICE_LABEL || '\u20b9299 / saal';

const DAY = 24 * 60 * 60 * 1000;

/* ---------------- DB ---------------- */
const DB_FILE = path.join(DATA_DIR, 'db.json');

function emptyDb() {
  return { licenses: [], users: [], sessions: {}, trials: {}, requests: [], backups: {} };
}

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Object.assign(emptyDb(), parsed);
  } catch (e) {
    return emptyDb();
  }
}

let db = loadDb();

function saveDb() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('DB save fail:', e.message);
  }
}

/* ---------------- Small helpers ---------------- */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randChunk(n) {
  let out = '';
  const bytes = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
function genKey() { return 'PG-' + randChunk(5) + '-' + randChunk(5) + '-' + randChunk(5); }
function uid(prefix) { return prefix + crypto.randomBytes(6).toString('hex'); }
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

function hashPass(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pass), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return salt + ':' + hash;
}
function verifyPass(pass, stored) {
  try {
    const [salt, hash] = String(stored || '').split(':');
    if (!salt || !hash) return false;
    const got = crypto.scryptSync(String(pass), salt, 64, { N: 16384, r: 8, p: 1 });
    const want = Buffer.from(hash, 'hex');
    if (got.length !== want.length) return false;
    return crypto.timingSafeEqual(got, want);
  } catch (e) { return false; }
}

function normPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function ipOf(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/* ---------------- Sessions ---------------- */
function newSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[sha256(token)] = { userId, expiresAt: Date.now() + SESSION_DAYS * DAY };
  return token;
}
function userFromToken(token) {
  if (!token) return null;
  const s = db.sessions[sha256(token)];
  if (!s) return null;
  if (s.expiresAt < Date.now()) { delete db.sessions[sha256(token)]; saveDb(); return null; }
  return db.users.find(u => u.id === s.userId) || null;
}

/* ---------------- Licenses ---------------- */
function findKey(key) {
  const k = String(key || '').trim().toUpperCase();
  return db.licenses.find(l => l.key === k) || null;
}
function createLicense(extra) {
  const lic = Object.assign({
    key: genKey(), ip: null, devices: [], blocked: false,
    userId: null, requireLogin: false, createdAt: Date.now()
  }, extra || {});
  db.licenses.push(lic);
  return lic;
}
function licenseOfUser(user) {
  if (!user || !user.key) return null;
  return findKey(user.key);
}
function publicLicense(lic) {
  if (!lic) return null;
  return { key: lic.key, status: lic.blocked ? 'blocked' : 'active' };
}

/**
 * Key ko IP + device se bind karta hai.
 * return: { ok:true, relogin?:bool } ya { error, code, status }
 */
function bindDevice(lic, deviceId, ip) {
  if (lic.blocked) return { status: 403, code: 'blocked', error: 'Ye key block kar di gayi hai' };
  const dev = String(deviceId || '').trim();
  if (!dev) return { status: 400, code: 'bad_device', error: 'deviceId chahiye' };

  if (!lic.ip) {                       // pehli activation
    lic.ip = ip;
    lic.devices = [dev];
    saveDb();
    return { ok: true };
  }
  if (lic.devices.includes(dev)) { saveDb(); return { ok: true }; }
  if (lic.ip === ip) {                 // same ghar/network — naya device
    lic.devices.push(dev);
    saveDb();
    return { ok: true, relogin: true };
  }
  return {
    status: 403, code: 'need_owner_reset',
    error: 'Ye key doosre network par pehle se chalu hai — owner se IP reset karwayein'
  };
}

/* ---------------- HTTP plumbing ---------------- */
function send(res, status, body, headers) {
  const h = Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  }, headers || {});
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    if (!h['Content-Type']) h['Content-Type'] = 'text/html; charset=utf-8';
    res.writeHead(status, h);
    res.end(body);
  } else {
    h['Content-Type'] = 'application/json; charset=utf-8';
    res.writeHead(status, h);
    res.end(JSON.stringify(body));
  }
}
const ok = (res, body) => send(res, 200, Object.assign({ ok: true }, body || {}));
const fail = (res, status, error, code) => send(res, status, { ok: false, error, code });

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function isAdmin(req, url) {
  const given = url.searchParams.get('key') || req.headers['x-admin-key'] || '';
  return String(given) === ADMIN_SECRET && ADMIN_SECRET.length > 0;
}

/* ---------------- Telegram ---------------- */
const telegramOn = () => Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

async function tg(method, payload) {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const r = await fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await r.json();
  } catch (e) { return null; }
}

function sendMessage(text, extra) {
  if (!telegramOn()) return Promise.resolve(null);
  return tg('sendMessage', Object.assign({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }, extra || {}));
}

function purchaseKeyboard(id) {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '\u2705 Approve - Key Do', callback_data: 'appr:' + id },
        { text: '\u274c Reject', callback_data: 'rej:' + id }
      ]]
    }
  };
}

/* Long-poll loop (3 sec) — approve/reject buttons ke liye */
let tgOffset = 0;
let pollTimer = null;

async function pollTelegram() {
  if (!telegramOn()) return;
  const res = await tg('getUpdates', { offset: tgOffset, timeout: 0, allowed_updates: ['callback_query'] });
  if (res && res.ok && Array.isArray(res.result)) {
    for (const up of res.result) {
      tgOffset = up.update_id + 1;
      if (up.callback_query) await handleCallback(up.callback_query);
    }
  }
}

async function handleCallback(cq) {
  const from = cq.message && cq.message.chat && cq.message.chat.id;
  if (String(from) !== String(TELEGRAM_CHAT_ID)) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Not allowed' });
    return;
  }
  const data = String(cq.data || '');
  const [action, id] = data.split(':');
  let text = 'Unknown';
  if (action === 'appr') {
    const r = approveRequest(id);
    text = r.ok ? 'Approved \u2705 key: ' + r.key : (r.error || 'Fail');
    if (r.ok) await sendMessage('\u2705 <b>Approved</b>\nUser: ' + r.user.name + ' (' + r.user.phone + ')\nKey: <code>' + r.key + '</code>\nUser app mein login karke activate kar sakta hai.');
  } else if (action === 'rej') {
    const r = rejectRequest(id);
    text = r.ok ? 'Rejected \u274c' : (r.error || 'Fail');
  }
  await tg('answerCallbackQuery', { callback_query_id: cq.id, text });
}

/* ---------------- Purchase requests ---------------- */
function approveRequest(id) {
  const rq = db.requests.find(r => r.id === id);
  if (!rq) return { ok: false, error: 'Request nahi mili' };
  const user = db.users.find(u => u.id === rq.userId);
  if (!user) return { ok: false, error: 'User nahi mila' };
  let lic = licenseOfUser(user);
  if (!lic) {
    lic = createLicense({ userId: user.id, requireLogin: true });
    user.key = lic.key;
  }
  lic.userId = user.id;
  lic.requireLogin = true;
  rq.status = 'approved';
  rq.decidedAt = Date.now();
  saveDb();
  return { ok: true, key: lic.key, user };
}

function rejectRequest(id) {
  const rq = db.requests.find(r => r.id === id);
  if (!rq) return { ok: false, error: 'Request nahi mili' };
  rq.status = 'rejected';
  rq.decidedAt = Date.now();
  saveDb();
  return { ok: true };
}

/* ---------------- Trials ---------------- */
function trialRecord(deviceId) { return db.trials[deviceId] || null; }
function daysLeftOf(t) { return Math.max(0, Math.ceil((t.endsAt - Date.now()) / DAY)); }

/* ============================================================
   ROUTER
   ============================================================ */
export async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const ip = ipOf(req);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  /* ---------- pages ---------- */
  if (req.method === 'GET' && (p === '/' || p === '/portal')) {
    return send(res, 200, portalPage({ upiId: UPI_ID, upiName: UPI_NAME, price: PRICE_LABEL }));
  }
  if (req.method === 'GET' && p === '/admin') {
    if (!isAdmin(req, url)) return send(res, 401, '<h1>401 — admin key galat hai</h1>');
    return send(res, 200, adminPage({ adminKey: url.searchParams.get('key') || '' }));
  }

  /* ---------- health ---------- */
  if (p === '/api/health') {
    return ok(res, { telegram: telegramOn(), upi: Boolean(UPI_ID), price: PRICE_LABEL, upiId: UPI_ID, upiName: UPI_NAME });
  }

  /* ---------- portal backup download ---------- */
  if (req.method === 'GET' && p === '/api/portal/backup') {
    const user = userFromToken(url.searchParams.get('token'));
    if (!user) return fail(res, 401, 'Login karein', 'no_auth');
    const bucket = db.backups['u:' + user.id];
    const data = bucket ? bucket.data : null;
    return send(res, 200, JSON.stringify({ ok: true, user: { name: user.name, phone: user.phone }, data }, null, 2), {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="paisaguru-backup.json"'
    });
  }

  /* ---------- admin GET APIs ---------- */
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req, url)) return fail(res, 401, 'Admin key galat hai', 'no_admin');
    return adminApi(req, res, url, p);
  }

  if (req.method !== 'POST') return fail(res, 404, 'Not found', 'not_found');
  const body = await readBody(req);

  /* ---------- trial ---------- */
  if (p === '/api/trial/start') {
    const deviceId = String(body.deviceId || '').trim();
    if (!deviceId) return fail(res, 400, 'deviceId chahiye', 'bad_device');
    const existing = trialRecord(deviceId);
    if (existing) return ok(res, { daysLeft: daysLeftOf(existing), alreadyStarted: true });
    const used = Object.values(db.trials).filter(t => t.ip === ip).length;
    if (used >= MAX_TRIALS_PER_IP) {
      return fail(res, 403, 'Is network par trial limit khatam ho gayi hai', 'ip_limit');
    }
    const rec = { deviceId, ip, startedAt: Date.now(), endsAt: Date.now() + TRIAL_DAYS * DAY };
    db.trials[deviceId] = rec;
    saveDb();
    return ok(res, { daysLeft: daysLeftOf(rec) });
  }

  if (p === '/api/trial/status') {
    const rec = trialRecord(String(body.deviceId || '').trim());
    if (!rec) return fail(res, 404, 'Trial nahi mila', 'no_trial');
    return ok(res, { daysLeft: daysLeftOf(rec) });
  }

  /* ---------- activate ---------- */
  if (p === '/api/activate') {
    const deviceId = String(body.deviceId || '').trim();

    if (body.token) {                                  // (b) login activation
      const user = userFromToken(body.token);
      if (!user) return fail(res, 401, 'Session khatam — dobara login karein', 'no_auth');
      const lic = licenseOfUser(user);
      if (!lic) return fail(res, 404, 'Aapke account par abhi koi key nahi hai', 'no_license');
      const b = bindDevice(lic, deviceId, ip);
      if (!b.ok) return send(res, b.status, { ok: false, error: b.error, code: b.code });
      sendMessage('\ud83d\udd11 Activation: ' + user.name + ' (' + user.phone + ')\nKey: <code>' + lic.key + '</code>');
      return ok(res, { activated: true, relogin: Boolean(b.relogin), license: publicLicense(lic) });
    }

    // (a) direct key
    const lic = findKey(body.key);
    if (!lic) return fail(res, 404, 'Key galat hai', 'bad_key');
    if (lic.blocked) return fail(res, 403, 'Ye key block kar di gayi hai', 'blocked');
    if (lic.userId) {
      return fail(res, 403, 'Ye key ek account se judi hai \u2014 app mein login karein', 'account_key');
    }
    const b = bindDevice(lic, deviceId, ip);
    if (!b.ok) return send(res, b.status, { ok: false, error: b.error, code: b.code });
    sendMessage('\ud83d\udd11 Direct key activation: <code>' + lic.key + '</code> (' + ip + ')');
    return ok(res, { activated: true, relogin: Boolean(b.relogin), license: publicLicense(lic) });
  }

  /* ---------- auth ---------- */
  if (p === '/api/auth/register') {
    const name = String(body.name || '').trim();
    const phone = normPhone(body.phone);
    const password = String(body.password || '');
    if (!name) return fail(res, 400, 'Naam chahiye', 'bad_name');
    if (!phone) return fail(res, 400, 'Sahi mobile number daalein', 'bad_phone');
    if (password.length < 4) return fail(res, 400, 'Password kam se kam 4 akshar ka ho', 'bad_pass');
    if (db.users.some(u => u.phone === phone)) return fail(res, 409, 'Ye number pehle se registered hai', 'dup_phone');
    const user = { id: uid('u_'), name, phone, pass: hashPass(password), key: null, createdAt: Date.now() };
    db.users.push(user);
    const token = newSession(user.id);
    saveDb();
    sendMessage('\ud83c\udd95 Naya user: <b>' + name + '</b>\n\ud83d\udcf1 ' + phone);
    return ok(res, { token, user: { name: user.name, phone: user.phone }, license: null });
  }

  if (p === '/api/auth/login') {
    const phone = normPhone(body.phone);
    const user = phone ? db.users.find(u => u.phone === phone) : null;
    if (!user || !verifyPass(String(body.password || ''), user.pass)) {
      return fail(res, 401, 'Number ya password galat hai', 'bad_login');
    }
    const token = newSession(user.id);
    saveDb();
    return ok(res, { token, user: { name: user.name, phone: user.phone }, license: publicLicense(licenseOfUser(user)) });
  }

  if (p === '/api/auth/me') {
    const user = userFromToken(body.token);
    if (!user) return fail(res, 401, 'Session khatam', 'no_auth');
    return ok(res, { user: { name: user.name, phone: user.phone }, license: publicLicense(licenseOfUser(user)) });
  }

  /* ---------- cloud sync ---------- */
  if (p === '/api/sync/save' || p === '/api/sync/load') {
    let bucket = null;
    if (body.token) {
      const user = userFromToken(body.token);
      if (!user) return fail(res, 401, 'Session khatam', 'no_auth');
      bucket = 'u:' + user.id;
    } else if (body.key) {
      const lic = findKey(body.key);
      if (!lic) return fail(res, 404, 'Key galat hai', 'bad_key');
      if (lic.blocked) return fail(res, 403, 'Key blocked', 'blocked');
      if (lic.ip && lic.ip !== ip) return fail(res, 403, 'Key doosre network par bandhi hai', 'need_owner_reset');
      bucket = 'k:' + lic.key;
    } else {
      return fail(res, 400, 'token ya key chahiye', 'no_auth');
    }

    if (p === '/api/sync/save') {
      db.backups[bucket] = { data: body.data || null, updatedAt: body.updatedAt || Date.now() };
      saveDb();
      return ok(res, { savedAt: db.backups[bucket].updatedAt });
    }
    const b = db.backups[bucket] || null;
    return ok(res, { data: b ? b.data : null, updatedAt: b ? b.updatedAt : null });
  }

  /* ---------- purchase ---------- */
  if (p === '/api/purchase/request') {
    const user = userFromToken(body.token);
    if (!user) return fail(res, 401, 'Login karein', 'no_auth');
    const dup = db.requests.find(r => r.userId === user.id && r.status === 'pending');
    if (dup) return ok(res, { already: true, requestId: dup.id });
    const rq = { id: 'PRQ-' + randChunk(6), userId: user.id, status: 'pending', createdAt: Date.now() };
    db.requests.push(rq);
    saveDb();
    sendMessage(
      '\ud83d\udcb0 <b>Payment claim</b>\n\ud83d\udc64 ' + user.name + '\n\ud83d\udcf1 ' + user.phone +
      '\n\ud83e\uddfe ' + rq.id + '\n\nApprove karne par user ko key mil jayegi.',
      purchaseKeyboard(rq.id)
    );
    return ok(res, { requestId: rq.id });
  }

  return fail(res, 404, 'Not found', 'not_found');
}

/* ============================================================
   ADMIN APIs
   ============================================================ */
async function adminApi(req, res, url, p) {
  if (p === '/api/admin/stats') {
    return ok(res, {
      stats: {
        licenses: db.licenses.length,
        activeLicenses: db.licenses.filter(l => !l.blocked).length,
        blocked: db.licenses.filter(l => l.blocked).length,
        users: db.users.length,
        trials: Object.keys(db.trials).length,
        pending: db.requests.filter(r => r.status === 'pending').length
      }
    });
  }

  if (p === '/api/admin/keys') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    let list = db.licenses.map(l => {
      const u = l.userId ? db.users.find(x => x.id === l.userId) : null;
      return Object.assign({}, l, { userName: u ? u.name : '', userPhone: u ? u.phone : '' });
    });
    if (q) {
      list = list.filter(l =>
        l.key.toLowerCase().includes(q) ||
        String(l.userName).toLowerCase().includes(q) ||
        String(l.userPhone).includes(q) ||
        (l.devices || []).some(d => String(d).toLowerCase().includes(q))
      );
    }
    return ok(res, { keys: list });
  }

  if (p === '/api/admin/users') {
    return ok(res, { users: db.users.map(u => ({ id: u.id, name: u.name, phone: u.phone, key: u.key, createdAt: u.createdAt })) });
  }

  if (p === '/api/admin/requests') {
    return ok(res, {
      requests: db.requests.map(r => {
        const u = db.users.find(x => x.id === r.userId);
        return Object.assign({}, r, { name: u ? u.name : '?', phone: u ? u.phone : '?' });
      })
    });
  }

  if (p === '/api/admin/export') {
    return ok(res, { db });   // passwords sirf salt:hash form mein hain
  }

  if (req.method !== 'POST') return fail(res, 404, 'Not found', 'not_found');
  const body = await readBody(req);

  if (p === '/api/admin/keys/new') {
    const lic = createLicense({});
    saveDb();
    return ok(res, { key: lic.key });
  }

  if (p === '/api/admin/grant-key') {
    const user = db.users.find(u => u.id === body.userId);
    if (!user) return fail(res, 404, 'User nahi mila', 'no_user');
    let lic = licenseOfUser(user);
    if (!lic) { lic = createLicense({ userId: user.id, requireLogin: true }); user.key = lic.key; }
    lic.userId = user.id;
    lic.requireLogin = true;
    saveDb();
    return ok(res, { key: lic.key });
  }

  if (p === '/api/admin/keys/block') {
    const lic = findKey(body.key);
    if (!lic) return fail(res, 404, 'Key nahi mili', 'bad_key');
    lic.blocked = body.blocked !== false;
    saveDb();
    return ok(res, { blocked: lic.blocked });
  }

  if (p === '/api/admin/keys/reset-ip') {
    const lic = findKey(body.key);
    if (!lic) return fail(res, 404, 'Key nahi mili', 'bad_key');
    lic.ip = null;
    lic.devices = [];
    saveDb();
    return ok(res, {});
  }

  const m = p.match(/^\/api\/admin\/requests\/([^/]+)\/(approve|reject)$/);
  if (m) {
    const r = m[2] === 'approve' ? approveRequest(m[1]) : rejectRequest(m[1]);
    if (!r.ok) return fail(res, 404, r.error, 'no_request');
    return ok(res, { key: r.key || null });
  }

  return fail(res, 404, 'Not found', 'not_found');
}

/* ============================================================
   BOOT
   ============================================================ */
export function createServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch(err => {
      console.error(err);
      try { fail(res, 500, 'Server error', 'server_error'); } catch (e) {}
    });
  });
}

const isMain = process.argv[1] && import.meta.url === 'file://' + path.resolve(process.argv[1]);
if (isMain) {
  const server = createServer();
  server.listen(PORT, '0.0.0.0', () => {
    console.log('PaisaGuru licensing server: http://0.0.0.0:' + PORT);
    console.log('Telegram: ' + (telegramOn() ? 'ON' : 'OFF') + ' | data: ' + DB_FILE);
  });
  if (telegramOn()) {
    pollTimer = setInterval(() => { pollTelegram().catch(() => {}); }, 3000);
    if (pollTimer.unref) pollTimer.unref();
  }
}

export const _internals = { db, genKey, hashPass, verifyPass, normPhone, approveRequest, rejectRequest };
