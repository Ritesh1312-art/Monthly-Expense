/* Admin panel HTML — password-only owner login + in-app password settings. */

export function adminPage({ adminKey }) {
  const k = JSON.stringify(String(adminKey || ''));
  return `<!DOCTYPE html>
<html lang="hi"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PaisaGuru — Admin</title>
<style>
:root{--bg:#0b1018;--card:#151d28;--line:#273344;--txt:#edf3fa;--muted:#94a3b8;--acc:#6366f1;--acc2:#818cf8;--bad:#e5484d;--ok:#2dd4a0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.5 Inter,system-ui,Segoe UI,Roboto,sans-serif;padding:14px}
main{max-width:1180px;margin:auto}h1{font-size:20px;margin:6px 0 14px}.hidden{display:none!important}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:14px;box-shadow:0 18px 50px rgba(0,0,0,.18)}
.card h2{font-size:13px;margin:0 0 10px;color:var(--muted);text-transform:uppercase;letter-spacing:.7px}
.login{width:min(420px,100%);margin:12vh auto 0;padding:24px}.login h1{font-size:24px;margin:0 0 6px}.login p{color:var(--muted);margin:0 0 18px}
.stats{display:flex;flex-wrap:wrap;gap:10px}.stat{background:#0e1621;border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:110px}.stat b{display:block;font-size:22px;color:var(--ok)}
button{background:var(--acc);color:#fff;border:0;border-radius:9px;padding:9px 13px;font-weight:750;cursor:pointer}button:hover{background:var(--acc2)}button.ghost{background:#243044;color:var(--txt)}button.bad{background:var(--bad);color:#fff}
input{background:#0e1621;border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:10px 11px;width:100%;max-width:340px;font:inherit}input:focus{outline:2px solid color-mix(in srgb,var(--acc) 55%,transparent);border-color:var(--acc)}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}code{background:#0e1621;padding:2px 6px;border-radius:6px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.stack{display:grid;gap:9px}.pill{font-size:11px;padding:2px 8px;border-radius:99px;background:#243044}.pill.active{background:#14402f;color:#4ede9f}.pill.blocked{background:#3c1618;color:#ff8b8e}.wrap{overflow:auto}.msg{min-height:22px;color:var(--muted);font-size:13px}.msg.err{color:#ff8b8e}.msg.ok{color:#4ede9f}.top{display:flex;align-items:center;justify-content:space-between;gap:10px}
</style></head><body><main>
<section class="card login ${adminKey ? 'hidden' : ''}" id="loginCard">
  <h1>🔐 PaisaGuru Admin</h1>
  <p>Admin panel kholne ke liye sirf password daalein.</p>
  <form class="stack" onsubmit="return login(event)">
    <input id="adminPassword" type="password" autocomplete="current-password" placeholder="Admin password" required autofocus>
    <button type="submit">Login</button>
    <div class="msg" id="loginMsg"></div>
  </form>
</section>

<section id="adminApp" class="${adminKey ? '' : 'hidden'}">
<div class="top"><h1>🔐 PaisaGuru Admin</h1><button class="ghost" onclick="logout()">Logout</button></div>
<div class="card"><h2>Stats</h2><div class="stats" id="stats">…</div></div>

<div class="card"><h2>Direct Key Generate</h2>
  <div class="row"><button onclick="newKey()">➕ Nayi Key Banao</button><span id="newKeyOut"></span></div>
  <div style="color:#94a3b8;font-size:12px;margin-top:8px">Direct key = bina account ke, app mein type karke activate hoti hai (pehle IP+device par bind ho jati hai).</div>
</div>

<div class="card"><h2>Purchase Requests</h2><div class="wrap"><table id="reqs"></table></div></div>
<div class="card"><h2>Users</h2><div class="wrap"><table id="users"></table></div></div>

<div class="card"><h2>Keys</h2>
  <div class="row" style="margin-bottom:10px"><input id="q" placeholder="Search: naam / phone / deviceId / key" oninput="loadKeys()"></div>
  <div class="wrap"><table id="keys"></table></div>
</div>

<div class="card"><h2>Settings — Admin Password</h2>
  <form class="row" onsubmit="return changePassword(event)">
    <input id="newPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Naya password (kam se kam 6 characters)" required>
    <button type="submit">Password Badlein</button>
  </form>
  <div class="msg" id="passwordMsg">Default password <code>admin123</code> hai — pehli login ke baad badal dein.</div>
</div>

<div class="card"><h2>Export</h2><button class="ghost" onclick="exportDb()">⬇️ Poora DB Export (passwords sirf hash)</button></div>
</section>
</main>

<script>
let ADMIN_KEY = ${k} || sessionStorage.getItem('pg_admin_key') || '';
let H = {};
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function setKey(value){ ADMIN_KEY=String(value||''); H={'Content-Type':'application/json','X-Admin-Key':ADMIN_KEY}; if(ADMIN_KEY)sessionStorage.setItem('pg_admin_key',ADMIN_KEY);else sessionStorage.removeItem('pg_admin_key'); }
setKey(ADMIN_KEY);
async function api(p, body){
  const options=body===undefined?{headers:H}:{method:'POST',headers:H,body:JSON.stringify(body)};
  const response=await fetch(p,options); const data=await response.json().catch(()=>({ok:false,error:'Server response nahi mila'}));
  if(response.status===401 && p!=='/api/admin/login') showLogin(data.error||'Session khatam — dobara login karein');
  return data;
}
function showLogin(message){setKey('');document.getElementById('adminApp').classList.add('hidden');document.getElementById('loginCard').classList.remove('hidden');const m=document.getElementById('loginMsg');m.textContent=message||'';m.className='msg'+(message?' err':'');}
function showApp(){document.getElementById('loginCard').classList.add('hidden');document.getElementById('adminApp').classList.remove('hidden');refresh();}
async function login(e){e.preventDefault();const input=document.getElementById('adminPassword');const password=input.value;const m=document.getElementById('loginMsg');m.textContent='Login ho raha hai…';m.className='msg';const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}).then(x=>x.json()).catch(()=>({ok:false,error:'Server se connection nahi hua'}));if(!r.ok){m.textContent=r.error||'Password galat hai';m.className='msg err';return false;}setKey(password);input.value='';showApp();return false;}
function logout(){showLogin('Aap logout ho gaye.');}
async function changePassword(e){e.preventDefault();const input=document.getElementById('newPassword');const m=document.getElementById('passwordMsg');const next=input.value;if(next.length<6){m.textContent='Password kam se kam 6 characters ka ho';m.className='msg err';return false;}const r=await api('/api/admin/password',{password:next});if(!r.ok){m.textContent=r.error||'Password nahi badla';m.className='msg err';return false;}setKey(next);input.value='';m.textContent='Password safalta se badal gaya ✅';m.className='msg ok';return false;}
async function loadStats(){const r=await api('/api/admin/stats');if(!r.ok)return;const s=r.stats||{};document.getElementById('stats').innerHTML=[['Keys',s.licenses],['Active',s.activeLicenses],['Blocked',s.blocked],['Users',s.users],['Trials',s.trials],['Pending',s.pending]].map(([l,v])=>'<div class="stat"><b>'+(v||0)+'</b>'+l+'</div>').join('');}
async function newKey(){const r=await api('/api/admin/keys/new',{});document.getElementById('newKeyOut').innerHTML=r.ok?'<code>'+esc(r.key)+'</code>':'Fail';loadKeys();loadStats();}
async function loadReqs(){const r=await api('/api/admin/requests');if(!r.ok)return;const rows=(r.requests||[]).slice().reverse().map(q=>'<tr><td><code>'+esc(q.id)+'</code></td><td>'+esc(q.name)+'<div style="color:#94a3b8">'+esc(q.phone)+'</div></td><td><span class="pill">'+esc(q.status)+'</span></td><td>'+(q.status==='pending'?'<div class="row"><button onclick="decide(\\''+q.id+'\\',\\'approve\\')">✅ Approve</button><button class="bad" onclick="decide(\\''+q.id+'\\',\\'reject\\')">❌ Reject</button></div>':'—')+'</td></tr>').join('');document.getElementById('reqs').innerHTML='<tr><th>ID</th><th>User</th><th>Status</th><th></th></tr>'+(rows||'<tr><td colspan="4">Koi request nahi</td></tr>');}
async function decide(id,what){await api('/api/admin/requests/'+id+'/'+what,{});refresh();}
async function loadUsers(){const r=await api('/api/admin/users');if(!r.ok)return;const rows=(r.users||[]).map(u=>'<tr><td>'+esc(u.name)+'</td><td>'+esc(u.phone)+'</td><td>'+(u.key?'<code>'+esc(u.key)+'</code>':'<span style="color:#94a3b8">— koi key nahi —</span>')+'</td><td><button class="ghost" onclick="grant(\\''+u.id+'\\')">🎁 Key Do</button></td></tr>').join('');document.getElementById('users').innerHTML='<tr><th>Naam</th><th>Phone</th><th>Key</th><th></th></tr>'+(rows||'<tr><td colspan="4">Koi user nahi</td></tr>');}
async function grant(userId){await api('/api/admin/grant-key',{userId});loadUsers();loadKeys();loadStats();}
async function loadKeys(){const q=encodeURIComponent(document.getElementById('q').value||'');const r=await api('/api/admin/keys?q='+q);if(!r.ok)return;const rows=(r.keys||[]).slice().reverse().map(l=>'<tr><td><code>'+esc(l.key)+'</code><div style="color:#94a3b8">'+(l.userName?esc(l.userName)+' · '+esc(l.userPhone):'direct key')+'</div></td><td>'+esc(l.ip||'—')+'</td><td>'+esc((l.devices||[]).join(', ')||'—')+'</td><td><span class="pill '+(l.blocked?'blocked':'active')+'">'+(l.blocked?'blocked':'active')+'</span></td><td><div class="row"><button class="ghost" onclick="block(\\''+l.key+'\\','+(!l.blocked)+')">'+(l.blocked?'Unblock':'Block')+'</button><button class="ghost" onclick="resetIp(\\''+l.key+'\\')">♻️ Reset IP</button></div></td></tr>').join('');document.getElementById('keys').innerHTML='<tr><th>Key</th><th>IP</th><th>Devices</th><th>Status</th><th></th></tr>'+(rows||'<tr><td colspan="5">Koi key nahi</td></tr>');}
async function block(key,blocked){await api('/api/admin/keys/block',{key,blocked});loadKeys();loadStats();}
async function resetIp(key){await api('/api/admin/keys/reset-ip',{key});loadKeys();}
async function exportDb(){const r=await api('/api/admin/export');if(!r.ok)return;const blob=new Blob([JSON.stringify(r.db,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='paisaguru-db.json';a.click();}
function refresh(){loadStats();loadReqs();loadUsers();loadKeys();}
if(ADMIN_KEY)showApp();
setInterval(()=>{if(ADMIN_KEY)refresh();},15000);
</script>
</body></html>`;
}
