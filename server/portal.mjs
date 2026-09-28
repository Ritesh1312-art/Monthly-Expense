/* User portal HTML (Hindi UI) — login/register/forgot + personal space + UPI payment */

export function portalPage({ upiId, upiName, price }) {
  const cfg = JSON.stringify({ upiId: upiId || '', upiName: upiName || '', price: price || '' });
  return `<!DOCTYPE html>
<html lang="hi"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PaisaGuru — Personal Space</title>
<style>
:root{--bg:#f4f7f6;--card:#fff;--line:#e2e8e6;--txt:#12211d;--muted:#66807a;--acc:#0b6b5a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.6 system-ui,Segoe UI,Roboto,sans-serif;padding:16px;max-width:520px;margin-inline:auto}
h1{font-size:22px;margin:4px 0 2px}
.sub{color:var(--muted);font-size:14px;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.tabs{display:flex;gap:6px;margin-bottom:12px}
.tabs button{flex:1;padding:10px 6px;font-size:13px}
label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}
input{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;font-size:16px}
button{background:var(--acc);color:#fff;border:0;border-radius:10px;padding:12px 14px;font-weight:700;font-size:15px;cursor:pointer;width:100%}
button.ghost{background:#eaf2f0;color:var(--acc)}
.keybox{background:#0b6b5a;color:#fff;border-radius:12px;padding:14px;text-align:center;letter-spacing:2px;font-weight:800;font-size:18px;word-break:break-all}
.nokey{background:#fff6e5;border:1px dashed #e0b25a;color:#7a5a10;border-radius:12px;padding:14px;text-align:center}
.upi{background:#f2fbf8;border:1px solid #cdeae2;border-radius:12px;padding:14px}
.muted{color:var(--muted);font-size:13px}
.hidden{display:none}
.msg{margin-top:10px;font-size:14px}
.msg.err{color:#b3261e}.msg.ok{color:#0b6b5a}
.stack>*+*{margin-top:10px}
.link-btn{background:none;border:none;color:var(--acc);font-size:13px;cursor:pointer;padding:0;width:auto;text-decoration:underline}
</style></head><body>

<h1>💰 PaisaGuru</h1>
<div class="sub">Aapka personal space — key, payment aur backup</div>

<div class="card" id="authCard">
  <div class="tabs">
    <button id="tabLogin" onclick="setTab('login')">Login</button>
    <button id="tabReg" class="ghost" onclick="setTab('reg')">Naya Account</button>
    <button id="tabForgot" class="ghost" onclick="setTab('forgot')">Password Bhool Gaye?</button>
  </div>

  <form id="loginForm" onsubmit="return doLogin(event)">
    <label>Mobile number ya Email</label><input id="lPhone" placeholder="98XXXXXXXX ya email" required>
    <label>Password</label><input id="lPass" type="password" required>
    <div style="height:12px"></div>
    <button type="submit">Login karein</button>
    <div style="text-align:center;margin-top:12px">
      <button type="button" class="link-btn" onclick="setTab('forgot')">Password bhool gaye?</button>
    </div>
  </form>

  <form id="regForm" class="hidden" onsubmit="return doReg(event)">
    <label>Aapka naam</label><input id="rName" required>
    <label>Mobile number</label><input id="rPhone" inputmode="numeric" required>
    <label>Email (password reset ke liye — optional)</label><input id="rEmail" type="email" placeholder="naam@gmail.com">
    <label>Password banayein</label><input id="rPass" type="password" required>
    <div style="height:12px"></div>
    <button type="submit">Account banayein</button>
  </form>

  <form id="forgotForm" class="hidden" onsubmit="return handleForgotSubmit(event)">
    <div id="forgotStep1">
      <label>Registered Mobile number ya Email</label>
      <input id="fIdentifier" placeholder="98XXXXXXXX ya email" required>
      <div style="height:12px"></div>
      <button type="button" id="btnGetOtp" onclick="doForgot()">OTP Mangwayein</button>
    </div>

    <div id="forgotStep2" class="hidden stack" style="margin-top:12px">
      <div class="muted" id="otpSentInfo"></div>
      <div>
        <label>6-digit OTP</label>
        <input id="fOtp" inputmode="numeric" maxlength="6" placeholder="123456">
      </div>
      <div>
        <label>Naya Password</label>
        <input id="fNewPass" type="password" placeholder="Kam se kam 4 akshar">
      </div>
      <div style="height:4px"></div>
      <button type="button" onclick="doReset()">Password Reset Karein</button>
      <button type="button" class="ghost" style="margin-top:6px" onclick="doForgot()">Dobara OTP Bhejein</button>
    </div>
  </form>

  <div class="msg" id="authMsg"></div>
</div>

<div id="space" class="hidden">
  <div class="card">
    <div class="muted">Namaste</div>
    <h1 id="uName" style="margin-top:0"></h1>
    <div id="uDetails" class="muted" style="margin-bottom:10px"></div>
    <div id="keyWrap" class="stack"></div>
  </div>

  <div class="card stack" id="emailCard">
    <b>📧 Email Address</b>
    <div class="muted">Password reset OTP isi email par bheja jayega.</div>
    <div style="display:flex;gap:8px">
      <input id="uEmailInput" type="email" placeholder="naam@gmail.com" style="flex:1">
      <button onclick="saveEmail()" style="width:auto;padding:11px 16px">Save</button>
    </div>
    <div class="msg" id="emailMsg"></div>
  </div>

  <div class="card upi" id="upiCard">
    <b>💳 Payment</b>
    <div class="stack" style="margin-top:8px">
      <div id="upiInfo" class="muted"></div>
      <button onclick="claim()">✅ Maine Payment Kar Diya</button>
      <div class="muted">Payment ke baad ye button dabayein — owner approve karte hi aapki key yahi dikh jayegi (page refresh karein).</div>
      <div class="msg" id="buyMsg"></div>
    </div>
  </div>

  <div class="card stack">
    <b>☁️ Backup</b>
    <div class="muted">Aapka app data server par surakshit hai — yahan se download kar sakte hain.</div>
    <button class="ghost" onclick="dl()">⬇️ Backup Download</button>
    <button class="ghost" onclick="logout()">Logout</button>
  </div>
</div>

<script>
const CFG = ${cfg};
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const api = (p, body) => fetch(p, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }).then(r=>r.json());
let token = localStorage.getItem('pg_token') || '';

function setTab(t){
  document.getElementById('loginForm').classList.toggle('hidden', t!=='login');
  document.getElementById('regForm').classList.toggle('hidden', t!=='reg');
  document.getElementById('forgotForm').classList.toggle('hidden', t!=='forgot');
  document.getElementById('tabLogin').className = t==='login' ? '' : 'ghost';
  document.getElementById('tabReg').className = t==='reg' ? '' : 'ghost';
  document.getElementById('tabForgot').className = t==='forgot' ? '' : 'ghost';
  document.getElementById('authMsg').textContent = '';
}
function msg(id, text, kind){ const e=document.getElementById(id); e.className='msg '+(kind||''); e.textContent=text; }

async function doLogin(ev){
  ev.preventDefault();
  const r = await api('/api/auth/login', { phone: lPhone.value, password: lPass.value });
  if (!r.ok) { msg('authMsg', r.error || 'Login fail', 'err'); return false; }
  token = r.token; localStorage.setItem('pg_token', token);
  show(r.user, r.license);
  return false;
}

async function doReg(ev){
  ev.preventDefault();
  const r = await api('/api/auth/register', {
    name: rName.value,
    phone: rPhone.value,
    email: rEmail.value || undefined,
    password: rPass.value
  });
  if (!r.ok) { msg('authMsg', r.error || 'Register fail', 'err'); return false; }
  token = r.token; localStorage.setItem('pg_token', token);
  show(r.user, null);
  return false;
}

function handleForgotSubmit(ev){
  ev.preventDefault();
  const step2 = document.getElementById('forgotStep2');
  if (step2.classList.contains('hidden')) doForgot();
  else doReset();
  return false;
}

async function doForgot(){
  const identifier = document.getElementById('fIdentifier').value.trim();
  if (!identifier) { msg('authMsg', 'Mobile number ya email daalein', 'err'); return; }
  msg('authMsg', 'OTP bhej rahe hain...', '');
  const r = await api('/api/auth/forgot', { identifier });
  if (!r.ok) { msg('authMsg', r.error || 'OTP fail', 'err'); return; }
  document.getElementById('forgotStep2').classList.remove('hidden');
  const info = r.email ? ('OTP bhej diya gaya: <b>' + esc(r.email) + '</b> (10 min valid)') : (r.message || 'Agar account juda hai to OTP bhej diya gaya hai');
  document.getElementById('otpSentInfo').innerHTML = info;
  msg('authMsg', 'Email check karein aur OTP daalein', 'ok');
}

async function doReset(){
  const identifier = document.getElementById('fIdentifier').value.trim();
  const otp = document.getElementById('fOtp').value.trim();
  const password = document.getElementById('fNewPass').value;
  if (!otp) { msg('authMsg', 'OTP daalein', 'err'); return; }
  if (!password || password.length < 4) { msg('authMsg', 'Password kam se kam 4 akshar ka ho', 'err'); return; }
  msg('authMsg', 'Password reset kar rahe hain...', '');
  const r = await api('/api/auth/reset', { identifier, otp, password });
  if (!r.ok) { msg('authMsg', r.error || 'Reset fail', 'err'); return; }
  token = r.token; localStorage.setItem('pg_token', token);
  show(r.user, r.license);
  msg('authMsg', 'Password reset kamiyab ho gaya ✅', 'ok');
}

async function saveEmail(){
  const email = document.getElementById('uEmailInput').value.trim();
  msg('emailMsg', 'Save ho raha hai...', '');
  const r = await api('/api/auth/email', { token, email });
  if (!r.ok) { msg('emailMsg', r.error || 'Email save fail', 'err'); return; }
  msg('emailMsg', 'Email save ho gaya ✅', 'ok');
  document.getElementById('uDetails').textContent = (r.user.phone ? '📱 ' + r.user.phone : '') + (r.user.email ? ' · 📧 ' + r.user.email : '');
}

function show(user, license){
  document.getElementById('authCard').classList.add('hidden');
  document.getElementById('space').classList.remove('hidden');
  document.getElementById('uName').textContent = user.name;
  document.getElementById('uDetails').textContent = (user.phone ? '📱 ' + user.phone : '') + (user.email ? ' · 📧 ' + user.email : '');
  if (user.email) document.getElementById('uEmailInput').value = user.email;
  document.getElementById('keyWrap').innerHTML = license && license.key
    ? '<div class="muted">Aapki license key</div><div class="keybox">' + esc(license.key) + '</div>' +
      '<div class="muted">App mein isi account se login karein — key apne aap lag jayegi.</div>'
    : '<div class="nokey">Aapke paas abhi key nahi hai — payment karke neeche wala button dabayein.</div>';
  document.getElementById('upiCard').classList.toggle('hidden', Boolean(license && license.key));
  document.getElementById('upiInfo').innerHTML = CFG.upiId
    ? 'UPI ID: <b>' + esc(CFG.upiId) + '</b><br>Naam: <b>' + esc(CFG.upiName) + '</b><br>Amount: <b>' + esc(CFG.price) + '</b>'
    : 'Payment details ke liye owner se sampark karein. (' + esc(CFG.price) + ')';
}

async function claim(){
  const r = await api('/api/purchase/request', { token });
  if (!r.ok) { msg('buyMsg', r.error || 'Fail', 'err'); return; }
  msg('buyMsg', r.already ? 'Aapki request pehle se pending hai ⏳' : 'Request bhej di gayi ✔ Owner approve karega.', 'ok');
}

function dl(){ window.location = '/api/portal/backup?token=' + encodeURIComponent(token); }
function logout(){ localStorage.removeItem('pg_token'); location.reload(); }

(async function init(){
  if (location.hash === '#forgot' || location.search.includes('tab=forgot')) {
    setTab('forgot');
  }
  if (!token) return;
  const r = await api('/api/auth/me', { token });
  if (r.ok) show(r.user, r.license);
  else localStorage.removeItem('pg_token');
})();
</script>
</body></html>`;
}
