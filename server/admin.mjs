/* Admin panel HTML — owner ke liye (ADMIN_SECRET se khulta hai) */

export function adminPage({ adminKey }) {
  const k = JSON.stringify(String(adminKey || ''));
  return `<!DOCTYPE html>
<html lang="hi"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PaisaGuru — Admin</title>
<style>
:root{--bg:#0f1720;--card:#17212b;--line:#25323f;--txt:#e7eef5;--muted:#93a4b3;--acc:#19b98a;--bad:#e5484d}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif;padding:14px}
h1{font-size:20px;margin:6px 0 14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px}
.card h2{font-size:15px;margin:0 0 10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.stats{display:flex;flex-wrap:wrap;gap:10px}
.stat{background:#101a23;border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:110px}
.stat b{display:block;font-size:22px;color:var(--acc)}
button{background:var(--acc);color:#04231b;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer}
button.ghost{background:#22303d;color:var(--txt)}
button.bad{background:var(--bad);color:#fff}
input{background:#101a23;border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 10px;width:100%;max-width:320px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600}
code{background:#101a23;padding:2px 6px;border-radius:6px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pill{font-size:11px;padding:2px 8px;border-radius:99px;background:#22303d}
.pill.active{background:#14402f;color:#4ede9f}
.pill.blocked{background:#3c1618;color:#ff8b8e}
.wrap{overflow:auto}
</style></head><body>
<h1>🔐 PaisaGuru Admin</h1>

<div class="card"><h2>Stats</h2><div class="stats" id="stats">…</div></div>

<div class="card"><h2>Direct Key Generate</h2>
  <div class="row"><button onclick="newKey()">➕ Nayi Key Banao</button><span id="newKeyOut"></span></div>
  <div style="color:#93a4b3;font-size:12px;margin-top:8px">Direct key = bina account ke, app mein type karke activate hoti hai (pehle IP+device par bind ho jati hai).</div>
</div>

<div class="card"><h2>Purchase Requests</h2><div class="wrap"><table id="reqs"></table></div></div>

<div class="card"><h2>Users</h2><div class="wrap"><table id="users"></table></div></div>

<div class="card"><h2>Keys</h2>
  <div class="row" style="margin-bottom:10px">
    <input id="q" placeholder="Search: naam / phone / deviceId / key" oninput="loadKeys()">
  </div>
  <div class="wrap"><table id="keys"></table></div>
</div>

<div class="card"><h2>Export</h2>
  <button class="ghost" onclick="exportDb()">⬇️ Poora DB Export (passwords sirf hash)</button>
</div>

<script>
const ADMIN_KEY = ${k};
const H = { 'Content-Type':'application/json', 'X-Admin-Key': ADMIN_KEY };
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const api = (p, body) => fetch(p, body ? { method:'POST', headers:H, body:JSON.stringify(body) } : { headers:H }).then(r=>r.json());

async function loadStats(){
  const r = await api('/api/admin/stats'); const s = r.stats||{};
  document.getElementById('stats').innerHTML = [
    ['Keys', s.licenses], ['Active', s.activeLicenses], ['Blocked', s.blocked],
    ['Users', s.users], ['Trials', s.trials], ['Pending', s.pending]
  ].map(([l,v])=>'<div class="stat"><b>'+(v||0)+'</b>'+l+'</div>').join('');
}
async function newKey(){
  const r = await api('/api/admin/keys/new', {});
  document.getElementById('newKeyOut').innerHTML = r.ok ? '<code>'+esc(r.key)+'</code>' : 'Fail';
  loadKeys(); loadStats();
}
async function loadReqs(){
  const r = await api('/api/admin/requests');
  const rows = (r.requests||[]).slice().reverse().map(q =>
    '<tr><td><code>'+esc(q.id)+'</code></td><td>'+esc(q.name)+'<div style="color:#93a4b3">'+esc(q.phone)+'</div></td>'+
    '<td><span class="pill">'+esc(q.status)+'</span></td><td>'+
    (q.status==='pending'
      ? '<div class="row"><button onclick="decide(\\''+q.id+'\\',\\'approve\\')">✅ Approve</button><button class="bad" onclick="decide(\\''+q.id+'\\',\\'reject\\')">❌ Reject</button></div>'
      : '—') + '</td></tr>').join('');
  document.getElementById('reqs').innerHTML = '<tr><th>ID</th><th>User</th><th>Status</th><th></th></tr>' + (rows || '<tr><td colspan="4">Koi request nahi</td></tr>');
}
async function decide(id, what){
  await api('/api/admin/requests/'+id+'/'+what, {});
  loadReqs(); loadKeys(); loadUsers(); loadStats();
}
async function loadUsers(){
  const r = await api('/api/admin/users');
  const rows = (r.users||[]).map(u =>
    '<tr><td>'+esc(u.name)+'</td><td>'+esc(u.phone)+'</td><td>'+(u.key?'<code>'+esc(u.key)+'</code>':'<span style="color:#93a4b3">— koi key nahi —</span>')+'</td>'+
    '<td><button class="ghost" onclick="grant(\\''+u.id+'\\')">🎁 Key Do</button></td></tr>').join('');
  document.getElementById('users').innerHTML = '<tr><th>Naam</th><th>Phone</th><th>Key</th><th></th></tr>' + (rows || '<tr><td colspan="4">Koi user nahi</td></tr>');
}
async function grant(userId){ await api('/api/admin/grant-key', { userId }); loadUsers(); loadKeys(); loadStats(); }
async function loadKeys(){
  const q = encodeURIComponent(document.getElementById('q').value||'');
  const r = await api('/api/admin/keys?q='+q);
  const rows = (r.keys||[]).slice().reverse().map(l =>
    '<tr><td><code>'+esc(l.key)+'</code><div style="color:#93a4b3">'+(l.userName?esc(l.userName)+' · '+esc(l.userPhone):'direct key')+'</div></td>'+
    '<td>'+esc(l.ip||'—')+'</td><td>'+esc((l.devices||[]).join(', ')||'—')+'</td>'+
    '<td><span class="pill '+(l.blocked?'blocked':'active')+'">'+(l.blocked?'blocked':'active')+'</span></td>'+
    '<td><div class="row"><button class="ghost" onclick="block(\\''+l.key+'\\','+(!l.blocked)+')">'+(l.blocked?'Unblock':'Block')+'</button>'+
    '<button class="ghost" onclick="resetIp(\\''+l.key+'\\')">♻️ Reset IP</button></div></td></tr>').join('');
  document.getElementById('keys').innerHTML = '<tr><th>Key</th><th>IP</th><th>Devices</th><th>Status</th><th></th></tr>' + (rows || '<tr><td colspan="5">Koi key nahi</td></tr>');
}
async function block(key, blocked){ await api('/api/admin/keys/block', { key, blocked }); loadKeys(); loadStats(); }
async function resetIp(key){ await api('/api/admin/keys/reset-ip', { key }); loadKeys(); }
async function exportDb(){
  const r = await api('/api/admin/export');
  const blob = new Blob([JSON.stringify(r.db, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'paisaguru-db.json'; a.click();
}
function refresh(){ loadStats(); loadReqs(); loadUsers(); loadKeys(); }
refresh();
setInterval(refresh, 15000);
</script>
</body></html>`;
}
