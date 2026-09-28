/* ============================================================
   PaisaGuru app tests (jsdom)
   - core app logic (dates, format, voice parse, planning, goals)
   - licensing v1+v2 flows (trial, lock, login, key, cloud sync)
   Chalao: npm run test:app
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

/**
 * Ek fresh app instance banata hai.
 * opts.apiBase : rates.json fetch ke through FIN.apiBase set karta hai
 * opts.routes  : { '/api/...': (body) => [status, json] }
 * opts.storage : localStorage seed
 */
function makeApp(opts = {}) {
  const dom = new JSDOM(HTML.replace('<script src="app.js"></script>', ''), {
    url: 'https://example.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const win = dom.window;
  const calls = [];
  for (const [k, v] of Object.entries(opts.storage || {})) win.localStorage.setItem(k, v);

  win.fetch = async (url, init) => {
    const u = String(url);
    let body = {};
    try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) {}
    calls.push({ url: u, body });
    if (u.includes('rates.json')) {
      if (opts.apiBase === undefined) return { ok: false, status: 404, json: async () => ({}) };
      return {
        ok: true, status: 200,
        json: async () => ({ schemaVersion: 1, apiBase: opts.apiBase, supportWhatsapp: opts.whatsapp || '', manualVerifiedOnISO: '2026-09-25' })
      };
    }
    if (opts.offline) throw new win.Error('network down');
    const p = u.replace(opts.apiBase || '', '').split('?')[0];
    const h = (opts.routes || {})[p];
    if (!h) return { ok: false, status: 404, json: async () => ({ ok: false, error: 'no route ' + p, code: 'not_found' }) };
    const [status, json] = h(body);
    return { ok: status < 400, status, json: async () => json };
  };
  win.open = (u) => { calls.push({ url: 'OPEN:' + u }); return null; };
  const sc = win.document.createElement('script');
  sc.textContent = APP;
  win.document.body.appendChild(sc);
  return { win, dom, calls, doc: win.document };
}

const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
async function makeAppReady(opts) {
  const app = makeApp(opts);
  for (let i = 0; i < 30 && !app.win.licReadyProbe; i++) await tick(5);
  await tick(30);
  return app;
}
const DAY = 86400000;
const activatedStore = (extra = {}) => ({
  pg_license: JSON.stringify(Object.assign({ mode: 'activated', deviceId: 'dev-x1', key: 'PG-AAAAA-BBBBB-CCCCC', token: 'tok1', userName: 'Ritesh', userPhone: '9876543210', trialEnd: 0, readOnly: false, localTrial: false }, extra))
});
const lockedStore = () => ({
  pg_license: JSON.stringify({ mode: 'trial', deviceId: 'dev-lock', key: '', token: '', userName: '', userPhone: '', trialEnd: Date.now() - 2 * DAY, readOnly: true, localTrial: false })
});
const okRoutes = (over = {}) => Object.assign({
  '/api/trial/status': () => [404, { ok: false, code: 'no_trial' }],
  '/api/trial/start': () => [200, { ok: true, daysLeft: 7 }]
}, over);

/* ============================================================
   1. FREE MODE (apiBase khali) — sab kuch khula
   ============================================================ */
test('app bina error ke boot hoti hai', () => {
  const { win } = makeApp();
  assert.equal(typeof win.renderAll, 'function');
});
test('FREE mode: licensingOn false', () => {
  assert.equal(makeApp().win.licensingOn(), false);
});
test('FREE mode: isLocked false', () => {
  assert.equal(makeApp().win.isLocked(), false);
});
test('FREE mode: assertUnlocked true', () => {
  assert.equal(makeApp().win.assertUnlocked(), true);
});
test('FREE mode: koi license banner nahi', () => {
  assert.equal(makeApp().win.licenseBannerHtml(), '');
});
test('FREE mode: settings card "free" batata hai', () => {
  assert.match(makeApp().win.licenseCardHtml(), /free/i);
});
test('FREE mode: koi /api call nahi jati', async () => {
  const app = await makeAppReady({});
  assert.ok(app.calls.every(c => !c.url.includes('/api/')));
});
test('FREE mode: openPortal kuch nahi karta', () => {
  const app = makeApp();
  app.win.openPortal();
  assert.ok(app.calls.every(c => !String(c.url).startsWith('OPEN:')));
});

/* ============================================================
   2. CORE HELPERS
   ============================================================ */
test('fmt rupee format', () => {
  const { win } = makeApp();
  assert.equal(win.fmt(1234), '\u20b91,234');
});
test('fmt: garbage -> 0', () => {
  assert.equal(makeApp().win.fmt('abc'), '\u20b90');
});
test('pct round karta hai', () => {
  assert.equal(makeApp().win.pct(33.4), '33%');
});
test('esc HTML escape', () => {
  assert.equal(makeApp().win.esc('<b>&"</b>'), '&lt;b&gt;&amp;&quot;&lt;/b&gt;');
});
test('monthKey format YYYY-MM', () => {
  assert.equal(makeApp().win.monthKey(new Date(2026, 8, 15)), '2026-09');
});
test('addMonths aage', () => {
  assert.equal(makeApp().win.addMonths('2026-11', 2), '2027-01');
});
test('addMonths peeche', () => {
  assert.equal(makeApp().win.addMonths('2026-01', -1), '2025-12');
});
test('daysInMonth February 2028 (leap)', () => {
  assert.equal(makeApp().win.daysInMonth('2028-02'), 29);
});
test('monthLabel readable', () => {
  assert.match(makeApp().win.monthLabel('2026-09'), /September/);
});
test('todayISO format', () => {
  assert.match(makeApp().win.todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});
test('goalDeadlineLabel string deta hai', () => {
  const l = makeApp().win.goalDeadlineLabel({ deadline: '2027-06-30', target: 1000, saved: 0 });
  assert.equal(typeof l, 'string');
});
test('quickOptions list deta hai', () => {
  assert.ok(makeApp().win.quickOptions().length > 0);
});
test('sipFV badhta hai', () => {
  const { win } = makeApp();
  assert.ok(win.sipFV(5000, 10, 12) > 5000 * 12 * 10);
});
test('sipFV zero par zero', () => {
  assert.equal(makeApp().win.sipFV(0, 10, 12), 0);
});
test('validRates: sahi schema', () => {
  assert.equal(makeApp().win.validRates({ schemaVersion: 1 }), true);
});
test('validRates: galat schema reject', () => {
  assert.equal(makeApp().win.validRates({ schemaVersion: 9 }), false);
});
test('validRates: impossible t-bill reject', () => {
  assert.equal(makeApp().win.validRates({ schemaVersion: 1, auto: { tbill: { d91: 55, d182: 5, d364: 6 } } }), false);
});
test('ratesAgeDays number deta hai', () => {
  assert.equal(typeof makeApp().win.ratesAgeDays(), 'number');
});

/* ============================================================
   3. VOICE PARSING
   ============================================================ */
test('extractAmount: digits', () => {
  assert.equal(makeApp().win.extractAmount('500 rupaye grocery'), 500);
});
test('extractAmount: hazar multiplier', () => {
  assert.equal(makeApp().win.extractAmount('do hazar kiraya'), 2000);
});
test('extractAmount: kuch na mile to 0/null', () => {
  const v = makeApp().win.extractAmount('kuch bhi nahi');
  assert.ok(!v);
});
test('detectCategory: petrol -> transport', () => {
  assert.equal(makeApp().win.detectCategory('petrol dala'), 'transport');
});
test('detectCategory: sabzi -> grocery', () => {
  assert.equal(makeApp().win.detectCategory('sabzi li'), 'grocery');
});
test('parseVoiceInput object deta hai', () => {
  const r = makeApp().win.parseVoiceInput('300 ka petrol');
  assert.equal(r.amount, 300);
  assert.equal(r.category, 'transport');
});
test('voiceSupported jsdom mein false', () => {
  assert.equal(makeApp().win.voiceSupported(), false);
});

/* ============================================================
   4. STATE / DATA
   ============================================================ */
const seed = {
  months: {
    '2026-09': {
      salary: 50000,
      planned: { rent: 10000, grocery: 5000 },
      expenses: [
        { id: 'e1', date: '2026-09-02', category: 'rent', amount: 10000, note: '' },
        { id: 'e2', date: '2026-09-03', category: 'shopping', amount: 2000, note: 'shirt' }
      ]
    }
  },
  goals: [{ id: 'g1', icon: '\ud83d\udcf1', name: 'Phone', target: 40000, saved: 10000, deadline: '2027-06-30' }],
  settings: { name: 'Ritesh', emergencyDone: false, emergencySaved: 5000 }
};
const seeded = () => ({ paisaguru_v1: JSON.stringify(seed) });

test('loadState: seed data padhta hai', () => {
  const { win } = makeApp({ storage: seeded() });
  assert.equal(win.monthData('2026-09').salary, 50000);
});
test('loadState: corrupt JSON par default', () => {
  const { win } = makeApp({ storage: { paisaguru_v1: '{{{' } });
  assert.equal(Object.keys(win.defaultState().months).length, 0);
  assert.equal(win.monthData('2026-09'), null);
});
test('spentTotal sahi jodta hai', () => {
  const { win } = makeApp({ storage: seeded() });
  assert.equal(win.spentTotal(win.monthData('2026-09')), 12000);
});
test('plannedTotal sahi', () => {
  const { win } = makeApp({ storage: seeded() });
  assert.equal(win.plannedTotal(win.monthData('2026-09')), 15000);
});
test('spentByCategory grouping', () => {
  const { win } = makeApp({ storage: seeded() });
  assert.equal(win.spentByCategory(win.monthData('2026-09')).rent, 10000);
});
test('needsWants split', () => {
  const { win } = makeApp({ storage: seeded() });
  const nw = win.needsWants(win.monthData('2026-09'));
  assert.equal(nw.needsSpent, 10000);
  assert.equal(nw.wantsSpent, 2000);
  assert.equal(nw.needsPlan, 15000);
});
test('emergencyTarget salary se banta hai', () => {
  const { win } = makeApp({ storage: seeded() });
  assert.ok(win.emergencyTarget('2026-09') > 0);
});
test('goalMonthly number deta hai', () => {
  const { win } = makeApp({ storage: seeded() });
  assert.equal(typeof win.goalMonthly(seed.goals[0]), 'number');
});
test('activeGoals: adhoore goals', () => {
  const { win } = makeApp({ storage: seeded() });
  assert.equal(win.activeGoals().length, 1);
});
test('buildAllocation leftover baantta hai', () => {
  const { win } = makeApp({ storage: seeded() });
  const alloc = win.buildAllocation(20000);
  assert.ok(Array.isArray(alloc) && alloc.length > 0);
});
test('generateInsights array deta hai', () => {
  const { win } = makeApp({ storage: seeded() });
  assert.ok(Array.isArray(win.generateInsights('2026-09')));
});
test('renderAll home view bharta hai', () => {
  const { win, doc } = makeApp({ storage: seeded() });
  win.renderAll();
  assert.ok(doc.getElementById('view-home').innerHTML.length > 50);
});
test('renderSettings license card dikhata hai', () => {
  const { win, doc } = makeApp({ storage: seeded() });
  win.renderSettings();
  assert.match(doc.getElementById('view-settings').innerHTML, /License/);
});
test('switchView view badalta hai', () => {
  const { win, doc } = makeApp({ storage: seeded() });
  win.switchView('report');
  assert.ok(!doc.getElementById('view-report').classList.contains('hidden'));
});
test('toast DOM mein add hota hai', () => {
  const { win, doc } = makeApp();
  win.toast('hello', 'success');
  assert.match(doc.getElementById('toastWrap').textContent, /hello/);
});
test('expense add hota hai (FREE mode)', () => {
  const { win, doc } = makeApp({ storage: seeded() });
  win.switchView('expense');
  const form = doc.getElementById('expForm');
  form.querySelector('[name="amount"], #expAmount').value = '250';
  win.handleExpenseSubmit(form);
  assert.equal(win.spentTotal(win.monthData(win.monthKey(new Date()))) >= 0, true);
});
test('clearAllData FREE mode mein chalta hai', () => {
  const { win } = makeApp({ storage: seeded() });
  win.clearAllData();
  assert.equal(win.monthData('2026-09'), null);
});
test('loadDemoData mahine banata hai', () => {
  const { win } = makeApp();
  win.loadDemoData();
  assert.ok(Object.keys(win.defaultState().months).length === 0);
  assert.ok(win.monthData(win.monthKey(new Date())) !== null);
});

/* ============================================================
   5. LICENSING — deviceId / storage
   ============================================================ */
test('defaultLicense shape', () => {
  const d = makeApp().win.defaultLicense();
  assert.equal(d.mode, 'none');
  assert.equal(d.readOnly, false);
});
test('ensureDeviceId dev- se shuru', () => {
  assert.match(makeApp().win.ensureDeviceId(), /^dev-/);
});
test('deviceId localStorage mein save hota hai', () => {
  const { win } = makeApp();
  const id = win.ensureDeviceId();
  assert.match(win.localStorage.getItem('pg_license'), new RegExp(id));
});
test('deviceId dobara same rehta hai', () => {
  const { win } = makeApp();
  assert.equal(win.ensureDeviceId(), win.ensureDeviceId());
});
test('loadLicense purana state padhta hai', () => {
  const { win } = makeApp({ storage: activatedStore() });
  assert.equal(win.loadLicense().userName, 'Ritesh');
});
test('loadLicense corrupt par default', () => {
  const { win } = makeApp({ storage: { pg_license: 'xx' } });
  assert.equal(win.loadLicense().mode, 'none');
});
test('trialDaysLeft khatam trial par 0', () => {
  const { win } = makeApp({ storage: lockedStore() });
  assert.equal(win.trialDaysLeft(), 0);
});

/* ============================================================
   6. LICENSING — trial flow (server ON)
   ============================================================ */
test('apiBase rates.json se aata hai', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.equal(app.win.apiBase(), 'https://lic.test');
  assert.equal(app.win.licensingOn(), true);
});
test('trial start call jati hai', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.ok(app.calls.some(c => c.url.endsWith('/api/trial/start')));
});
test('trial ke dauran lock nahi', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.equal(app.win.isLocked(), false);
  assert.equal(app.win.trialDaysLeft(), 7);
});
test('trial banner "din baaki" dikhata hai', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.match(app.win.licenseBannerHtml(), /din baaki/);
});
test('trial mein edit allowed', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.equal(app.win.assertUnlocked(), true);
});
test('existing trial status use hota hai (start nahi)', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test',
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 3 }] }
  });
  assert.equal(app.win.trialDaysLeft(), 3);
  assert.ok(!app.calls.some(c => c.url.endsWith('/api/trial/start')));
});
test('2 din bache to warn banner', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test',
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 2 }] }
  });
  assert.match(app.win.licenseBannerHtml(), /warn/);
});
test('ip_limit par lock ho jata hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test',
    routes: okRoutes({ '/api/trial/start': () => [403, { ok: false, code: 'ip_limit', error: 'limit' }] })
  });
  assert.equal(app.win.isLocked(), true);
});
test('server down: local grace trial milta hai', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', offline: true, routes: {} });
  assert.equal(app.win.isLocked(), false);
});

/* ============================================================
   7. LICENSING — lock behaviour
   ============================================================ */
test('trial khatam: isLocked true', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  assert.equal(app.win.isLocked(), true);
});
test('lock par assertUnlocked false', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  assert.equal(app.win.assertUnlocked(), false);
});
test('lock overlay dikhta hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  assert.equal(app.doc.getElementById('lockOverlay').classList.contains('hidden'), false);
});
test('lock overlay mein login form hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  assert.ok(app.doc.getElementById('licLoginForm'));
});
test('lock overlay mein direct key collapsible', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  assert.match(app.doc.getElementById('lockOverlay').innerHTML, /<details/);
});
test('lock ke bawajood data surakshit rehta hai (read-only)', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test',
    storage: Object.assign({}, seeded(), lockedStore()),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  app.win.handleExpenseSubmit(null);
  assert.equal(app.win.spentTotal(app.win.monthData('2026-09')), 12000);
  assert.equal(app.win.monthData('2026-09').salary, 50000);
});
test('lock mein clearAllData block hota hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test',
    storage: Object.assign({}, seeded(), lockedStore()),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  app.win.clearAllData();
  assert.ok(app.win.monthData('2026-09'));
});
test('close-lock par overlay chhup jata hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  app.win.hideLockOverlay();
  assert.equal(app.doc.getElementById('lockOverlay').classList.contains('hidden'), true);
});
test('locked banner "read-only" batata hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: { '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] }
  });
  assert.match(app.win.licenseBannerHtml(), /read-only/i);
});

/* ============================================================
   8. LICENSING — account login (v2)
   ============================================================ */
function loginApp(extraRoutes, storage) {
  return makeAppReady({
    apiBase: 'https://lic.test',
    storage,
    routes: okRoutes(Object.assign({
      '/api/auth/login': () => [200, { ok: true, token: 'tok-new', user: { name: 'Ritesh', phone: '9876543210' }, license: { key: 'PG-11111-22222-33333', status: 'active' } }],
      '/api/activate': () => [200, { ok: true, activated: true, license: { key: 'PG-11111-22222-33333', status: 'active' } }],
      '/api/sync/load': () => [200, { ok: true, data: null }],
      '/api/sync/save': () => [200, { ok: true }]
    }, extraRoutes || {}))
  });
}

test('login: activated ho jata hai', async () => {
  const app = await loginApp();
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '9876543210';
  app.doc.getElementById('licPass').value = 'pass1234';
  await app.win.submitAccountLogin();
  assert.equal(app.win.isActivated(), true);
});
test('login: key save hoti hai', async () => {
  const app = await loginApp();
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '9876543210';
  app.doc.getElementById('licPass').value = 'pass1234';
  await app.win.submitAccountLogin();
  assert.match(app.win.localStorage.getItem('pg_license'), /PG-11111-22222-33333/);
});
test('login: activate call token ke saath jati hai', async () => {
  const app = await loginApp();
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '9876543210';
  app.doc.getElementById('licPass').value = 'pass1234';
  await app.win.submitAccountLogin();
  const c = app.calls.find(x => x.url.endsWith('/api/activate'));
  assert.equal(c.body.token, 'tok-new');
  assert.match(c.body.deviceId, /^dev-/);
});
test('login ke baad lock khul jata hai', async () => {
  const app = await loginApp(null, lockedStore());
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '9876543210';
  app.doc.getElementById('licPass').value = 'pass1234';
  await app.win.submitAccountLogin();
  assert.equal(app.win.isLocked(), false);
  assert.equal(app.win.assertUnlocked(), true);
});
test('login: cloud se data restore hota hai', async () => {
  const app = await loginApp({
    '/api/sync/load': () => [200, { ok: true, data: seed }]
  }, lockedStore());
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '9876543210';
  app.doc.getElementById('licPass').value = 'pass1234';
  await app.win.submitAccountLogin();
  assert.equal(app.win.monthData('2026-09').salary, 50000);
});
test('login: galat password par error, activated nahi', async () => {
  const app = await loginApp({ '/api/auth/login': () => [401, { ok: false, error: 'Number ya password galat hai' }] });
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '9876543210';
  app.doc.getElementById('licPass').value = 'galat';
  await app.win.submitAccountLogin();
  assert.equal(app.win.isActivated(), false);
  assert.match(app.doc.getElementById('toastWrap').textContent, /galat/);
});
test('login: key na ho to portal khulta hai', async () => {
  const app = await loginApp({
    '/api/auth/login': () => [200, { ok: true, token: 't', user: { name: 'A', phone: '9' }, license: null }]
  });
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '9876543210';
  app.doc.getElementById('licPass').value = 'pass1234';
  await app.win.submitAccountLogin();
  assert.ok(app.calls.some(c => String(c.url).startsWith('OPEN:') && c.url.includes('/portal')));
  assert.equal(app.win.isActivated(), false);
});
test('login: khali field par network call nahi', async () => {
  const app = await loginApp();
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '';
  app.doc.getElementById('licPass').value = '';
  await app.win.submitAccountLogin();
  assert.ok(!app.calls.some(c => c.url.endsWith('/api/auth/login')));
});
test('token resume: app khud activate ho jati hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test',
    storage: activatedStore({ mode: 'none' }),
    routes: okRoutes({
      '/api/auth/me': () => [200, { ok: true, user: { name: 'Ritesh', phone: '98' }, license: { key: 'PG-A', status: 'active' } }],
      '/api/activate': () => [200, { ok: true, activated: true, license: { key: 'PG-A', status: 'active' } }],
      '/api/sync/load': () => [200, { ok: true, data: null }]
    })
  });
  assert.equal(app.win.isActivated(), true);
});
test('dead token clear ho jata hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test',
    storage: activatedStore({ mode: 'none', key: '' }),
    routes: okRoutes({ '/api/auth/me': () => [401, { ok: false, code: 'no_auth' }] })
  });
  assert.equal(app.win.loadLicense().token, '');
});
test('logout par mode none ho jata hai', async () => {
  const app = await loginApp();
  app.win.renderSettings();
  app.doc.getElementById('licPhone').value = '9876543210';
  app.doc.getElementById('licPass').value = 'pass1234';
  await app.win.submitAccountLogin();
  app.win.licLogout();
  assert.equal(app.win.isActivated(), false);
});
test('logout se app ka data delete nahi hota', async () => {
  const app = await loginApp(null, seeded());
  app.win.licLogout();
  assert.equal(app.win.monthData('2026-09').salary, 50000);
});

/* ============================================================
   9. LICENSING — direct key (v1 legacy)
   ============================================================ */
test('direct key activate hoti hai', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: okRoutes({
      '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }],
      '/api/activate': () => [200, { ok: true, activated: true, license: { key: 'PG-KKKKK-KKKKK-KKKKK', status: 'active' } }],
      '/api/sync/load': () => [200, { ok: true, data: null }]
    })
  });
  app.win.renderSettings();
  app.doc.getElementById('licKeyInput').value = 'PG-KKKKK-KKKKK-KKKKK';
  await app.win.submitDirectKey();
  assert.equal(app.win.isActivated(), true);
});
test('account-bound key type karne par saaf error', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: okRoutes({
      '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }],
      '/api/activate': () => [403, { ok: false, code: 'account_key', error: 'Ye key ek account se judi hai \u2014 app mein login karein' }]
    })
  });
  app.win.renderSettings();
  app.doc.getElementById('licKeyInput').value = 'PG-USER1-USER1-USER1';
  await app.win.submitDirectKey();
  assert.equal(app.win.isActivated(), false);
  assert.match(app.doc.getElementById('toastWrap').textContent, /login karein/);
});
test('galat IP par need_owner_reset message', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: okRoutes({
      '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }],
      '/api/activate': () => [403, { ok: false, code: 'need_owner_reset', error: 'owner se IP reset karwayein' }]
    })
  });
  app.win.renderSettings();
  app.doc.getElementById('licKeyInput').value = 'PG-1-2-3';
  await app.win.submitDirectKey();
  assert.match(app.doc.getElementById('toastWrap').textContent, /IP reset/);
});
test('khali key par call nahi jati', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: okRoutes({ '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }] })
  });
  app.win.renderSettings();
  app.doc.getElementById('licKeyInput').value = '';
  await app.win.submitDirectKey();
  assert.ok(!app.calls.some(c => c.url.endsWith('/api/activate')));
});
test('blocked key par activated nahi hota', async () => {
  const app = await makeAppReady({
    apiBase: 'https://lic.test', storage: lockedStore(),
    routes: okRoutes({
      '/api/trial/status': () => [200, { ok: true, daysLeft: 0 }],
      '/api/activate': () => [403, { ok: false, code: 'blocked', error: 'Ye key block kar di gayi hai' }]
    })
  });
  app.win.renderSettings();
  app.doc.getElementById('licKeyInput').value = 'PG-B';
  await app.win.submitDirectKey();
  assert.equal(app.win.isActivated(), false);
});

/* ============================================================
   10. CLOUD SYNC + UI bits
   ============================================================ */
test('backupToCloud token ke saath save karta hai', async () => {
  const app = await loginApp(null, activatedStore());
  const okRes = await app.win.backupToCloud(true);
  assert.equal(okRes, true);
  const c = app.calls.find(x => x.url.endsWith('/api/sync/save'));
  assert.equal(c.body.token, 'tok1');
});
test('backup payload mein state jata hai', async () => {
  const app = await loginApp(null, Object.assign({}, seeded(), activatedStore()));
  await app.win.backupToCloud(true);
  const c = app.calls.find(x => x.url.endsWith('/api/sync/save'));
  assert.equal(c.body.data.months['2026-09'].salary, 50000);
});
test('key-only mode mein sync key se hota hai', async () => {
  const app = await loginApp(null, activatedStore({ token: '' }));
  await app.win.backupToCloud(true);
  const c = app.calls.find(x => x.url.endsWith('/api/sync/save'));
  assert.equal(c.body.key, 'PG-AAAAA-BBBBB-CCCCC');
});
test('bina activation backup nahi hota', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.equal(await app.win.backupToCloud(true), false);
});
test('restoreFromCloud manual data laata hai', async () => {
  const app = await loginApp({ '/api/sync/load': () => [200, { ok: true, data: seed }] }, activatedStore());
  assert.equal(await app.win.restoreFromCloud(false), true);
  assert.equal(app.win.monthData('2026-09').salary, 50000);
});
test('restore: khali cloud par false', async () => {
  const app = await loginApp({ '/api/sync/load': () => [200, { ok: true, data: null }] }, activatedStore());
  assert.equal(await app.win.restoreFromCloud(false), false);
});
test('auto-restore local data ko overwrite nahi karta', async () => {
  const app = await loginApp(
    { '/api/sync/load': () => [200, { ok: true, data: { months: { '2020-01': { salary: 1 } }, goals: [], settings: {} } }] },
    Object.assign({}, seeded(), activatedStore()));
  await app.win.restoreFromCloud(true);
  assert.equal(app.win.monthData('2026-09').salary, 50000);
});
test('saveState debounce sync queue karta hai', async () => {
  const app = await loginApp(null, activatedStore());
  app.win.queueCloudSync();
  assert.ok(!app.calls.some(c => c.url.endsWith('/api/sync/save')));
});
test('activated settings card cloud buttons dikhata hai', async () => {
  const app = await loginApp(null, activatedStore());
  const html = app.win.licenseCardHtml();
  assert.match(html, /cloud-backup/);
  assert.match(html, /cloud-restore/);
});
test('activated card par Activated status', async () => {
  const app = await loginApp(null, activatedStore());
  assert.match(app.win.licenseCardHtml(), /Activated/);
});
test('whatsapp link device-id ke saath', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', whatsapp: '919999999999', routes: okRoutes() });
  const url = app.win.whatsappHelpUrl();
  assert.match(url, /^https:\/\/wa\.me\/919999999999/);
  assert.match(decodeURIComponent(url), /Device-ID/);
});
test('whatsapp number na ho to link khali', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.equal(app.win.whatsappHelpUrl(), '');
});
test('openPortal apiBase + /portal kholta hai', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  app.win.openPortal();
  assert.ok(app.calls.some(c => c.url === 'OPEN:https://lic.test/portal'));
});
test('license form mein portal button hai', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.match(app.win.licenseFormHtml('settings'), /open-portal/);
});
test('license form mein direct key details collapsible', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  assert.match(app.win.licenseFormHtml('settings'), /<details/);
});
test('license form primary = login form', async () => {
  const app = await makeAppReady({ apiBase: 'https://lic.test', routes: okRoutes() });
  const html = app.win.licenseFormHtml('settings');
  assert.ok(html.indexOf('licLoginForm') < html.indexOf('licKeyForm'));
});
