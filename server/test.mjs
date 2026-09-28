/* ============================================================
   PaisaGuru licensing server — end-to-end tests
   Server ek child process mein boot hota hai (PORT 3998, temp
   DATA_DIR) aur sab kuch asli HTTP fetch se test hota hai.
   Chalao: node server/test.mjs   (ya npm test)
   ============================================================ */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.TEST_PORT || 3998);
const BASE = 'http://127.0.0.1:' + PORT;
const ADMIN = 'test-admin-secret';
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-test-'));

let child = null;

function boot() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(HERE, 'index.mjs')], {
      env: Object.assign({}, process.env, {
        PORT: String(PORT), ADMIN_SECRET: ADMIN, DATA_DIR,
        TRIAL_DAYS: '7', MAX_TRIALS_PER_IP: '3', SESSION_DAYS: '30',
        UPI_ID: 'owner@upi', UPI_NAME: 'Owner', PRICE_LABEL: '\u20b9299 / saal',
        TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: ''
      }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stderr.on('data', d => process.stderr.write('[server] ' + d));
    const t = setTimeout(() => reject(new Error('server boot timeout')), 15000);
    child.stdout.on('data', d => {
      if (String(d).includes('licensing server')) { clearTimeout(t); resolve(); }
    });
    child.on('exit', c => { if (c !== 0 && c !== null) reject(new Error('server exited ' + c)); });
  });
}

function kill() {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) return resolve();
    child.on('exit', () => resolve());
    child.kill('SIGTERM');
  });
}

async function post(p, body, ip) {
  const res = await fetch(BASE + p, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ip ? { 'X-Forwarded-For': ip } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: res.status, body: await res.json() };
}
async function get(p, headers) {
  const res = await fetch(BASE + p, { headers: headers || {} });
  const txt = await res.text();
  let body = null;
  try { body = JSON.parse(txt); } catch (e) { body = txt; }
  return { status: res.status, body, headers: res.headers };
}
const adminGet = p => get(p, { 'X-Admin-Key': ADMIN });
const adminPost = (p, body) => fetch(BASE + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json() }));

before(async () => { await boot(); });
after(async () => {
  await kill();
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (e) {}
});

/* ---------------- shared state across tests ---------------- */
const S = {};

/* ============================================================
   1. HEALTH + PAGES
   ============================================================ */
test('health: ok true', async () => {
  const r = await get('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});
test('health: telegram OFF jab token na ho', async () => {
  assert.equal((await get('/api/health')).body.telegram, false);
});
test('health: upi flag aur upiId', async () => {
  const b = (await get('/api/health')).body;
  assert.equal(b.upi, true);
  assert.equal(b.upiId, 'owner@upi');
});
test('health: price label', async () => {
  assert.match((await get('/api/health')).body.price, /299/);
});
test('CORS header * hai', async () => {
  const r = await get('/api/health');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});
test('OPTIONS preflight 204', async () => {
  const r = await fetch(BASE + '/api/activate', { method: 'OPTIONS' });
  assert.equal(r.status, 204);
});
test('GET /portal HTML deta hai', async () => {
  const r = await get('/portal');
  assert.equal(r.status, 200);
  assert.match(r.body, /Personal Space|PaisaGuru/);
});
test('portal mein login aur register form hai', async () => {
  const html = (await get('/portal')).body;
  assert.match(html, /loginForm/);
  assert.match(html, /regForm/);
});
test('portal mein UPI id aur price dikhte hain', async () => {
  const html = (await get('/portal')).body;
  assert.match(html, /owner@upi/);
  assert.match(html, /pg_token/);
});
test('portal mein "Maine Payment Kar Diya" button', async () => {
  assert.match((await get('/portal')).body, /Maine Payment Kar Diya/);
});
test('GET / bhi portal deta hai', async () => {
  assert.equal((await get('/')).status, 200);
});
test('admin bina key 401', async () => {
  assert.equal((await get('/admin')).status, 401);
});
test('admin query key se khulta hai', async () => {
  const r = await get('/admin?key=' + ADMIN);
  assert.equal(r.status, 200);
  assert.match(r.body, /PaisaGuru Admin/);
});
test('admin panel mein Purchase Requests card', async () => {
  assert.match((await get('/admin?key=' + ADMIN)).body, /Purchase Requests/);
});
test('admin panel mein Reset IP button code', async () => {
  assert.match((await get('/admin?key=' + ADMIN)).body, /Reset IP/);
});
test('unknown route 404', async () => {
  assert.equal((await post('/api/nope', {})).status, 404);
});

/* ============================================================
   2. TRIAL
   ============================================================ */
test('trial start: 7 din', async () => {
  const r = await post('/api/trial/start', { deviceId: 'dev-A1' }, '10.0.0.1');
  assert.equal(r.status, 200);
  assert.equal(r.body.daysLeft, 7);
});
test('trial start dobara: same device, error nahi', async () => {
  const r = await post('/api/trial/start', { deviceId: 'dev-A1' }, '10.0.0.1');
  assert.equal(r.body.ok, true);
  assert.equal(r.body.alreadyStarted, true);
});
test('trial status: daysLeft', async () => {
  const r = await post('/api/trial/status', { deviceId: 'dev-A1' }, '10.0.0.1');
  assert.equal(r.body.daysLeft, 7);
});
test('trial status: unknown device 404', async () => {
  const r = await post('/api/trial/status', { deviceId: 'dev-unknown' });
  assert.equal(r.status, 404);
  assert.equal(r.body.code, 'no_trial');
});
test('trial start: deviceId chahiye', async () => {
  const r = await post('/api/trial/start', {});
  assert.equal(r.status, 400);
});
test('per-IP 2nd device chalta hai', async () => {
  assert.equal((await post('/api/trial/start', { deviceId: 'dev-A2' }, '10.0.0.1')).body.ok, true);
});
test('per-IP 3rd device chalta hai', async () => {
  assert.equal((await post('/api/trial/start', { deviceId: 'dev-A3' }, '10.0.0.1')).body.ok, true);
});
test('per-IP 4th device 403 ip_limit', async () => {
  const r = await post('/api/trial/start', { deviceId: 'dev-A4' }, '10.0.0.1');
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'ip_limit');
});
test('doosre IP par trial phir bhi chalta hai', async () => {
  assert.equal((await post('/api/trial/start', { deviceId: 'dev-B1' }, '10.0.0.2')).body.ok, true);
});
test('X-Forwarded-For ka pehla IP use hota hai', async () => {
  const r = await post('/api/trial/start', { deviceId: 'dev-B2' }, '10.0.0.2, 7.7.7.7');
  assert.equal(r.body.ok, true);
});

/* ============================================================
   3. ADMIN: direct key generate
   ============================================================ */
test('admin stats bina key 401', async () => {
  assert.equal((await get('/api/admin/stats')).status, 401);
});
test('admin stats milta hai', async () => {
  const r = await adminGet('/api/admin/stats');
  assert.equal(r.body.ok, true);
  assert.ok(r.body.stats.trials >= 5);
});
test('direct key generate hoti hai', async () => {
  const r = await adminPost('/api/admin/keys/new', {});
  assert.equal(r.body.ok, true);
  S.directKey = r.body.key;
  assert.ok(S.directKey);
});
test('key format PG-XXXXX-XXXXX-XXXXX', () => {
  assert.match(S.directKey, /^PG-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
});
test('har key unique hoti hai', async () => {
  const a = (await adminPost('/api/admin/keys/new', {})).body.key;
  const b = (await adminPost('/api/admin/keys/new', {})).body.key;
  S.spareKey = a;
  S.blockKey = b;
  assert.notEqual(a, b);
});
test('admin keys list mein nayi key hai', async () => {
  const r = await adminGet('/api/admin/keys');
  assert.ok(r.body.keys.some(k => k.key === S.directKey));
});

/* ============================================================
   4. ACTIVATE — direct key (v1)
   ============================================================ */
test('galat key 404 bad_key', async () => {
  const r = await post('/api/activate', { key: 'PG-XXXXX-XXXXX-XXXXX', deviceId: 'd1' }, '20.0.0.1');
  assert.equal(r.status, 404);
  assert.equal(r.body.code, 'bad_key');
});
test('pehli activation: IP+device bind', async () => {
  const r = await post('/api/activate', { key: S.directKey, deviceId: 'd1' }, '20.0.0.1');
  assert.equal(r.status, 200);
  assert.equal(r.body.activated, true);
  assert.equal(r.body.license.status, 'active');
});
test('same device dobara activate: ok, relogin nahi', async () => {
  const r = await post('/api/activate', { key: S.directKey, deviceId: 'd1' }, '20.0.0.1');
  assert.equal(r.body.ok, true);
  assert.equal(r.body.relogin, false);
});
test('same IP naya device: relogin true', async () => {
  const r = await post('/api/activate', { key: S.directKey, deviceId: 'd2' }, '20.0.0.1');
  assert.equal(r.body.ok, true);
  assert.equal(r.body.relogin, true);
});
test('alag IP: 403 need_owner_reset', async () => {
  const r = await post('/api/activate', { key: S.directKey, deviceId: 'd9' }, '99.99.99.99');
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'need_owner_reset');
});
test('bound device alag IP se bhi chalta hai', async () => {
  const r = await post('/api/activate', { key: S.directKey, deviceId: 'd1' }, '99.99.99.99');
  assert.equal(r.body.ok, true);
});
test('key lowercase mein type ki jaye to bhi chalti hai', async () => {
  const r = await post('/api/activate', { key: S.directKey.toLowerCase(), deviceId: 'd1' }, '20.0.0.1');
  assert.equal(r.body.ok, true);
});
test('deviceId missing: 400', async () => {
  const r = await post('/api/activate', { key: S.spareKey }, '21.0.0.1');
  assert.equal(r.status, 400);
});
test('admin IP reset ke baad nayi IP bind hoti hai', async () => {
  await adminPost('/api/admin/keys/reset-ip', { key: S.directKey });
  const r = await post('/api/activate', { key: S.directKey, deviceId: 'd9' }, '99.99.99.99');
  assert.equal(r.body.ok, true);
});
test('block ki hui key 403', async () => {
  await post('/api/activate', { key: S.blockKey, deviceId: 'db' }, '22.0.0.1');
  await adminPost('/api/admin/keys/block', { key: S.blockKey, blocked: true });
  const r = await post('/api/activate', { key: S.blockKey, deviceId: 'db' }, '22.0.0.1');
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'blocked');
});
test('unblock ke baad phir chalti hai', async () => {
  await adminPost('/api/admin/keys/block', { key: S.blockKey, blocked: false });
  const r = await post('/api/activate', { key: S.blockKey, deviceId: 'db' }, '22.0.0.1');
  assert.equal(r.body.ok, true);
});
test('block: unknown key 404', async () => {
  assert.equal((await adminPost('/api/admin/keys/block', { key: 'PG-A-B-C' })).status, 404);
});
test('reset-ip: unknown key 404', async () => {
  assert.equal((await adminPost('/api/admin/keys/reset-ip', { key: 'PG-A-B-C' })).status, 404);
});

/* ============================================================
   5. ACCOUNTS (v2)
   ============================================================ */
test('register: token milta hai', async () => {
  const r = await post('/api/auth/register', { name: 'Ritesh', phone: '9876543210', password: 'pass1234' }, '30.0.0.1');
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  S.token = r.body.token;
  S.user = r.body.user;
});
test('register: naye user ke paas license null', async () => {
  const r = await post('/api/auth/me', { token: S.token });
  assert.equal(r.body.license, null);
});
test('register: naam wapas aata hai', () => {
  assert.equal(S.user.name, 'Ritesh');
});
test('register: phone normalize hota hai (+91, spaces)', async () => {
  const r = await post('/api/auth/register', { name: 'Anita', phone: '+91 98765 11111', password: 'abcd' });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.user.phone, '919876511111');
  S.token2 = r.body.token;
});
test('duplicate phone: 409', async () => {
  const r = await post('/api/auth/register', { name: 'Dusra', phone: '9876543210', password: 'xyz123' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'dup_phone');
});
test('register: chhota phone reject', async () => {
  assert.equal((await post('/api/auth/register', { name: 'A', phone: '12345', password: 'abcd' })).status, 400);
});
test('register: naam khali reject', async () => {
  assert.equal((await post('/api/auth/register', { name: '  ', phone: '9000000001', password: 'abcd' })).status, 400);
});
test('register: chhota password reject', async () => {
  assert.equal((await post('/api/auth/register', { name: 'A', phone: '9000000002', password: '1' })).status, 400);
});
test('login: sahi password', async () => {
  const r = await post('/api/auth/login', { phone: '9876543210', password: 'pass1234' });
  assert.equal(r.body.ok, true);
  assert.ok(r.body.token);
  S.token = r.body.token;
});
test('login: user info', async () => {
  const r = await post('/api/auth/login', { phone: '9876543210', password: 'pass1234' });
  assert.equal(r.body.user.name, 'Ritesh');
  assert.equal(r.body.user.phone, '9876543210');
});
test('login: galat password 401', async () => {
  const r = await post('/api/auth/login', { phone: '9876543210', password: 'galat' });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'bad_login');
});
test('login: unknown phone 401', async () => {
  assert.equal((await post('/api/auth/login', { phone: '9000009999', password: 'x' })).status, 401);
});
test('login: dashes waale number se bhi chalta hai', async () => {
  const r = await post('/api/auth/login', { phone: '98765-43210', password: 'pass1234' });
  assert.equal(r.body.ok, true);
});
test('me: token se user', async () => {
  const r = await post('/api/auth/me', { token: S.token });
  assert.equal(r.body.user.name, 'Ritesh');
});
test('me: galat token 401', async () => {
  const r = await post('/api/auth/me', { token: 'nakli' });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'no_auth');
});
test('me: token missing 401', async () => {
  assert.equal((await post('/api/auth/me', {})).status, 401);
});
test('bina key activate (token): 404 no_license', async () => {
  const r = await post('/api/activate', { token: S.token, deviceId: 'ud1' }, '30.0.0.1');
  assert.equal(r.status, 404);
  assert.equal(r.body.code, 'no_license');
});
test('activate: dead token 401', async () => {
  assert.equal((await post('/api/activate', { token: 'nakli', deviceId: 'ud1' })).status, 401);
});

/* ============================================================
   6. PURCHASE REQUEST + APPROVE / REJECT
   ============================================================ */
test('purchase request: PRQ id', async () => {
  const r = await post('/api/purchase/request', { token: S.token });
  assert.equal(r.body.ok, true);
  assert.match(r.body.requestId, /^PRQ-[A-Z0-9]{6}$/);
  S.reqId = r.body.requestId;
});
test('duplicate purchase request: already true', async () => {
  const r = await post('/api/purchase/request', { token: S.token });
  assert.equal(r.body.already, true);
  assert.equal(r.body.requestId, S.reqId);
});
test('purchase request bina login 401', async () => {
  assert.equal((await post('/api/purchase/request', {})).status, 401);
});
test('admin requests list mein pending dikhti hai', async () => {
  const r = await adminGet('/api/admin/requests');
  const rq = r.body.requests.find(x => x.id === S.reqId);
  assert.equal(rq.status, 'pending');
  assert.equal(rq.phone, '9876543210');
});
test('approve: key ban jati hai', async () => {
  const r = await adminPost('/api/admin/requests/' + S.reqId + '/approve', {});
  assert.equal(r.body.ok, true);
  assert.match(r.body.key, /^PG-/);
  S.userKey = r.body.key;
});
test('approve ke baad /me mein license dikhta hai', async () => {
  const r = await post('/api/auth/me', { token: S.token });
  assert.equal(r.body.license.key, S.userKey);
  assert.equal(r.body.license.status, 'active');
});
test('approve ke baad request status approved', async () => {
  const r = await adminGet('/api/admin/requests');
  assert.equal(r.body.requests.find(x => x.id === S.reqId).status, 'approved');
});
test('account-bound key TYPE karne par 403 account_key', async () => {
  const r = await post('/api/activate', { key: S.userKey, deviceId: 'ud1' }, '30.0.0.1');
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'account_key');
  assert.match(r.body.error, /login/i);
});
test('token se activate chalta hai', async () => {
  const r = await post('/api/activate', { token: S.token, deviceId: 'ud1' }, '30.0.0.1');
  assert.equal(r.body.ok, true);
  assert.equal(r.body.activated, true);
  assert.equal(r.body.license.key, S.userKey);
});
test('token activate: same IP naya device relogin', async () => {
  const r = await post('/api/activate', { token: S.token, deviceId: 'ud2' }, '30.0.0.1');
  assert.equal(r.body.relogin, true);
});
test('token activate: alag IP 403 need_owner_reset', async () => {
  const r = await post('/api/activate', { token: S.token, deviceId: 'ud3' }, '31.0.0.1');
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'need_owner_reset');
});
test('login response mein license aata hai', async () => {
  const r = await post('/api/auth/login', { phone: '9876543210', password: 'pass1234' });
  assert.equal(r.body.license.key, S.userKey);
});
test('reject: request rejected ho jati hai', async () => {
  const r2 = await post('/api/purchase/request', { token: S.token2 });
  const r = await adminPost('/api/admin/requests/' + r2.body.requestId + '/reject', {});
  assert.equal(r.body.ok, true);
  const list = await adminGet('/api/admin/requests');
  assert.equal(list.body.requests.find(x => x.id === r2.body.requestId).status, 'rejected');
});
test('reject ke baad user ko key nahi milti', async () => {
  const r = await post('/api/auth/me', { token: S.token2 });
  assert.equal(r.body.license, null);
});
test('unknown request approve: 404', async () => {
  assert.equal((await adminPost('/api/admin/requests/PRQ-NOPE00/approve', {})).status, 404);
});
test('admin grant-key: user ko seedhe key', async () => {
  const r = await adminPost('/api/admin/grant-key', { userId: (await adminGet('/api/admin/users')).body.users.find(u => u.phone === '919876511111').id });
  assert.equal(r.body.ok, true);
  S.key2 = r.body.key;
  const me = await post('/api/auth/me', { token: S.token2 });
  assert.equal(me.body.license.key, S.key2);
});
test('grant-key dobara: wahi key reuse hoti hai', async () => {
  const uid = (await adminGet('/api/admin/users')).body.users.find(u => u.phone === '919876511111').id;
  const r = await adminPost('/api/admin/grant-key', { userId: uid });
  assert.equal(r.body.key, S.key2);
});
test('grant-key: unknown user 404', async () => {
  assert.equal((await adminPost('/api/admin/grant-key', { userId: 'u_nope' })).status, 404);
});
test('admin users list mein dono users', async () => {
  const r = await adminGet('/api/admin/users');
  assert.ok(r.body.users.length >= 2);
});
test('admin users list mein password field nahi', async () => {
  const r = await adminGet('/api/admin/users');
  assert.ok(r.body.users.every(u => !('pass' in u)));
});
test('admin keys search: phone se', async () => {
  const r = await adminGet('/api/admin/keys?q=9876543210');
  assert.equal(r.body.keys.length, 1);
  assert.equal(r.body.keys[0].key, S.userKey);
});
test('admin keys search: naam se', async () => {
  const r = await adminGet('/api/admin/keys?q=ritesh');
  assert.equal(r.body.keys[0].userName, 'Ritesh');
});
test('admin keys search: deviceId se', async () => {
  const r = await adminGet('/api/admin/keys?q=ud1');
  assert.ok(r.body.keys.some(k => k.key === S.userKey));
});
test('admin keys search: kuch na mile to khali', async () => {
  assert.equal((await adminGet('/api/admin/keys?q=zzzznope')).body.keys.length, 0);
});

/* ============================================================
   7. SYNC (cloud backup)
   ============================================================ */
test('sync save: token mode', async () => {
  const r = await post('/api/sync/save', { token: S.token, data: { months: { '2026-09': { salary: 50000 } } }, updatedAt: 111 });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.savedAt, 111);
});
test('sync load: token mode', async () => {
  const r = await post('/api/sync/load', { token: S.token });
  assert.equal(r.body.data.months['2026-09'].salary, 50000);
});
test('sync save overwrite', async () => {
  await post('/api/sync/save', { token: S.token, data: { v: 2 }, updatedAt: 222 });
  const r = await post('/api/sync/load', { token: S.token });
  assert.equal(r.body.data.v, 2);
  assert.equal(r.body.updatedAt, 222);
});
test('sync: dusre user ka data alag bucket', async () => {
  await post('/api/sync/save', { token: S.token2, data: { v: 'anita' } });
  assert.equal((await post('/api/sync/load', { token: S.token })).body.data.v, 2);
  assert.equal((await post('/api/sync/load', { token: S.token2 })).body.data.v, 'anita');
});
test('sync save: key mode (direct key)', async () => {
  const r = await post('/api/sync/save', { key: S.spareKey, data: { legacy: true } }, '40.0.0.1');
  assert.equal(r.body.ok, true);
});
test('sync load: key mode', async () => {
  const r = await post('/api/sync/load', { key: S.spareKey }, '40.0.0.1');
  assert.equal(r.body.data.legacy, true);
});
test('sync key mode: galat IP 403', async () => {
  await post('/api/activate', { key: S.spareKey, deviceId: 'sd1' }, '40.0.0.1');
  const r = await post('/api/sync/load', { key: S.spareKey }, '41.0.0.1');
  assert.equal(r.status, 403);
});
test('sync: galat key 404', async () => {
  assert.equal((await post('/api/sync/load', { key: 'PG-1-2-3' })).status, 404);
});
test('sync: bina token/key 400', async () => {
  assert.equal((await post('/api/sync/load', {})).status, 400);
});
test('sync: dead token 401', async () => {
  assert.equal((await post('/api/sync/save', { token: 'nakli', data: {} })).status, 401);
});
test('sync load: naye user ka data null', async () => {
  const reg = await post('/api/auth/register', { name: 'Naya', phone: '9000012345', password: 'abcd' });
  const r = await post('/api/sync/load', { token: reg.body.token });
  assert.equal(r.body.data, null);
});

/* ============================================================
   8. PORTAL BACKUP DOWNLOAD
   ============================================================ */
test('portal backup: token se JSON', async () => {
  const r = await get('/api/portal/backup?token=' + S.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.v, 2);
});
test('portal backup: attachment header', async () => {
  const r = await get('/api/portal/backup?token=' + S.token);
  assert.match(r.headers.get('content-disposition'), /attachment/);
});
test('portal backup: user info', async () => {
  const r = await get('/api/portal/backup?token=' + S.token);
  assert.equal(r.body.user.phone, '9876543210');
});
test('portal backup: bina token 401', async () => {
  assert.equal((await get('/api/portal/backup?token=nakli')).status, 401);
});

/* ============================================================
   9. EXPORT — koi plaintext password nahi
   ============================================================ */
test('export: db aata hai', async () => {
  const r = await adminGet('/api/admin/export');
  assert.equal(r.body.ok, true);
  S.export = r.body.db;
  assert.ok(Array.isArray(S.export.users));
});
test('export mein plaintext password NAHI hai', () => {
  assert.ok(!JSON.stringify(S.export).includes('pass1234'));
});
test('export mein password salt:hash format mein hai', () => {
  const u = S.export.users.find(x => x.phone === '9876543210');
  assert.match(u.pass, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});
test('export mein sessions hashed tokens hain', () => {
  assert.ok(!Object.keys(S.export.sessions).includes(S.token));
});
test('export mein licenses, trials, requests, backups', () => {
  for (const k of ['licenses', 'trials', 'requests', 'backups']) assert.ok(k in S.export);
});
test('export bina admin key 401', async () => {
  assert.equal((await get('/api/admin/export')).status, 401);
});

/* ============================================================
   10. RESTART PERSISTENCE
   ============================================================ */
test('server restart hota hai (same DATA_DIR)', async () => {
  await kill();
  await boot();
  assert.equal((await get('/api/health')).body.ok, true);
});
test('restart ke baad session zinda', async () => {
  const r = await post('/api/auth/me', { token: S.token });
  assert.equal(r.body.user.name, 'Ritesh');
});
test('restart ke baad key bachi hai', async () => {
  assert.equal((await post('/api/auth/me', { token: S.token })).body.license.key, S.userKey);
});
test('restart ke baad backup bacha hai', async () => {
  assert.equal((await post('/api/sync/load', { token: S.token })).body.data.v, 2);
});
test('restart ke baad trial bacha hai', async () => {
  assert.equal((await post('/api/trial/status', { deviceId: 'dev-A1' })).body.daysLeft, 7);
});
test('restart ke baad IP cap yaad hai', async () => {
  assert.equal((await post('/api/trial/start', { deviceId: 'dev-A5' }, '10.0.0.1')).status, 403);
});
test('restart ke baad direct key activate hoti hai', async () => {
  const r = await post('/api/activate', { key: S.directKey, deviceId: 'd9' }, '99.99.99.99');
  assert.equal(r.body.ok, true);
});
test('restart ke baad login chalta hai', async () => {
  assert.equal((await post('/api/auth/login', { phone: '9876543210', password: 'pass1234' })).body.ok, true);
});
test('restart ke baad requests list bachi hai', async () => {
  const r = await adminGet('/api/admin/requests');
  assert.ok(r.body.requests.some(x => x.id === S.reqId));
});
test('restart ke baad stats sahi', async () => {
  const r = await adminGet('/api/admin/stats');
  assert.ok(r.body.stats.users >= 3);
  assert.ok(r.body.stats.licenses >= 4);
});
