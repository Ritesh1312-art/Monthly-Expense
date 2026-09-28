# 🚀 PaisaGuru Licensing Server — Deployment Guide (Hindi)

Ye guide owner ke liye hai. App (frontend) GitHub Pages par free chalti hai; ye
guide sirf **licensing server** (trial, keys, accounts, portal, Telegram approve,
cloud backup) ke liye hai.

> ⚠️ Jab tak `rates.json` mein `apiBase` **khali** hai, app bilkul FREE mode mein
> chalti hai — koi trial, koi lock, koi login nahi. Licensing tabhi ON hoti hai
> jab aap server deploy karke uska URL `rates.json` mein daal dein.

---

## 1. Render.com par deploy (free plan)

1. [render.com](https://render.com) par login → **New + → Web Service**
2. Apni GitHub repo `Monthly-Expense` connect karein
3. Settings:

   | Field | Value |
   |---|---|
   | Environment | `Node` |
   | Build Command | `npm install` |
   | Start Command | `node server/index.mjs` |
   | Instance type | Free |

4. **Environment variables** (Advanced → Add Environment Variable):

   | Key | Zaroori? | Example | Kaam |
   |---|---|---|---|
   | `ADMIN_SECRET` | ✅ | `koi-lamba-random-string` | `/admin` panel ka password |
   | `DATA_DIR` | ✅ | `/var/data` | DB file kahan rahegi (persistent disk) |
   | `PORT` | auto | Render khud deta hai | — |
   | `TRIAL_DAYS` | ❌ | `7` | Free trial kitne din |
   | `MAX_TRIALS_PER_IP` | ❌ | `3` | Ek network par max trial devices |
   | `SESSION_DAYS` | ❌ | `30` | Login kitne din tak yaad rahe |
   | `TELEGRAM_BOT_TOKEN` | ❌ | `123456:AA...` | Telegram notifications + approve buttons |
   | `TELEGRAM_CHAT_ID` | ❌ | `987654321` | Aapki personal chat ID |
   | `UPI_ID` | ❌ | `ritesh@okhdfcbank` | Portal par dikhta hai |
   | `UPI_NAME` | ❌ | `Ritesh` | UPI account ka naam |
   | `PRICE_LABEL` | ❌ | `₹299 / saal` | Portal par price text |

5. **Disk** add karein (Render → Disks): Mount path `/var/data`, size 1 GB.
   Iske bina restart par DB udd jayega.
6. Deploy → URL milega, jaise `https://paisaguru-license.onrender.com`

### Health check
```
https://<your-url>/api/health   →  { "ok": true, "telegram": true, ... }
```

---

## 2. App ko server se jodna

`rates.json` mein:

```json
"apiBase": "https://paisaguru-license.onrender.com",
"supportWhatsapp": "919999999999"
```

Commit → push. App agli baar khulte hi licensing ON ho jayegi (app `rates.json`
GitHub se khud fetch karti hai, users ko kuch nahi karna padta).

Wapas free karna ho to `apiBase` dobara `""` kar dein.

---

## 3. Telegram bot setup (5 minute)

1. Telegram par **@BotFather** → `/newbot` → naam + username → **token** milta hai
   → `TELEGRAM_BOT_TOKEN` mein daalein
2. **@userinfobot** ko `/start` → aapki numeric **chat ID** → `TELEGRAM_CHAT_ID`
3. Apne bot ko khud `/start` bhej dein (warna bot message nahi bhej sakta)
4. Render env vars mein dono daal kar **Save → Redeploy**

Ab aapko milega:
- 🆕 naya user register hone par message
- 💰 payment claim par message + **[✅ Approve - Key Do] [❌ Reject]** buttons
- 🔑 kisi ne key activate ki to notification

Approve dabate hi user ko **account-bound key** mil jati hai — user app mein
apne phone/password se login karega aur key apne aap lag jayegi.

Token na ho to server bilkul theek chalta hai, bas Telegram OFF rehta hai.

---

## 4. User ka flow (jo customer karega)

1. App kholi → 7 din ka free trial apne aap shuru
2. Trial khatam → app **read-only** ho jati hai (data safe rehta hai)
3. Lock screen par → “Personal Space / Key Kharido” → portal khulta hai
4. Portal par: naya account (naam, mobile, password) → UPI details dikhte hain
5. Payment karke **“Maine Payment Kar Diya”** dabata hai
6. Aapke Telegram par request aati hai → **Approve** ✅
7. User app mein wahi mobile/password se login → key apne aap lag jati hai +
   cloud backup restore ho jata hai

---

## 5. Roz ka kaam (owner cheat-sheet)

| Kaam | Kahan | Kaise |
|---|---|---|
| Payment approve karna | Telegram | ✅ Approve - Key Do button |
| Approve karna (bina Telegram) | `/admin?key=ADMIN_SECRET` | Purchase Requests → Approve |
| Bina account direct key dena | Admin panel | “Nayi Key Banao” → key WhatsApp par bhejein |
| Kisi user ko seedhe key dena | Admin → Users | 🎁 Key Do |
| User ka phone/ghar badal gaya | Admin → Keys | ♻️ Reset IP |
| Key chori/misuse | Admin → Keys | Block / Unblock |
| Kisi ko dhoondhna | Admin → Keys search | naam / phone / deviceId / key |
| Poora data backup | Admin → Export | passwords sirf hash form mein |

---

## 6. UPI setup

`UPI_ID`, `UPI_NAME`, `PRICE_LABEL` env vars set karte hi portal ke payment box
mein ye details dikhne lagti hain. Koi payment gateway nahi — user seedhe aapke
UPI par bhejta hai, aur aap Telegram se approve karte hain.

---

## 7. Local par chalana / test karna

```bash
npm install
ADMIN_SECRET=dev DATA_DIR=./server/data PORT=3000 node server/index.mjs
# portal : http://localhost:3000/portal
# admin  : http://localhost:3000/admin?key=dev
npm test        # app (jsdom) + server (e2e) — dono suites
```

`server/data/` aur `node_modules/` git mein commit nahi hote (`.gitignore`).

---

## 8. Security notes

- Password `scrypt` (N=16384) se hash hota hai, verify `timingSafeEqual` se —
  plaintext password kahin store/export nahi hota
- Session token sirf **sha256 hash** ke roop mein DB mein rehta hai
- Admin panel `ADMIN_SECRET` se protected hai — lamba random string rakhein
- Har key IP + device se bind hoti hai; naye network par owner reset zaroori
