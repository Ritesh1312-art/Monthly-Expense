# 💰 PaisaGuru — Monthly Expense Tracker & Smart Saving Advisor

> **Problem:** Logo ki salary aati hai aur paisa ese hi kharch ho jaata hai — na saving hoti hai, na samajh aata hai ki paisa kahan invest karein.
>
> **Solution:** PaisaGuru — ek app jo salary aane par **khud poochhti hai** ki paisa kaha-kaha kharch hoga, phir jo bacha usse **invest karne ki salah** deti hai, aur har mahine **pichle mahine se compare karke** batati hai ki is baar kahan paise save ho sakte hain.

---

## 🔄 Ye Kaaise Kaam Karti Hai? (The Working)

### Step 1 — 💵 Salary Received
Mahine ki salary aane par app mein amount daalein (aur date). Bas — aapki planning shuru.

### Step 2 — 🗺️ App Khud Poochhegi: "Paisa Kaha-Kaha Kharch Hoga?"
App har category ka andaza maangti hai — Grocery, Medical, Shopping, Kiraya, Bills, Transport, EMI, Entertainment, etc.
- Pichle mahine ke kharche se **suggestion auto-bhar jaate hain** 🤖
- Live dikhta rahega: *Salary − Plan = Kitna bacha*

### Step 3 — 💡 Jo Bacha, Uski Investment Salah
Bacha hua paisa dekh kar app batati hai:
- 🛡️ **Emergency fund** pehle (3-6 mahine ka kharcha, liquid fund/savings mein)
- 📈 **Index Fund SIP** (long term ~12% average)
- 🏦 **FD / T-Bill / RD** (kam waqt ke liye, safe 6-7%)
- 🥇 **Gold (SGB)** (inflation se bachav)
- 🧾 **ELSS / PPF** (Section 80C mein tax bachat)
- ⚡ **"Kam waqt mein profit"** ke sahi options ki table — aur ye sachai ki *"1 mahine mein paisa double" nahi hota, jo bole wo scam hai*

### Step 4 — 📊 Har Mahine Ka Vishleshan (Analysis Report)
- ✅ Plan vs Asli kharcha — category-wise progress bars
- 🔄 **Pichle mahine se comparison**: "Shopping mein pichle mahine ₹12,600 gaya tha, is baar ab tak ₹3,100 — wahin se sabse zyada bachat ho rahi hai!"
- 🏆 **Saving Grade** (A+ se D tak) — salary ka kitna % bach raha hai
- 🎯 **"Is baar yahan paise save karein"** — app khud batati hai kaunsi category kassni chahiye
- 🏃 Kharche ki speed ka warning — "mahine ka 25% beetā hai, kharcha 40% ho chuka!"
- 📈 6 mahine ka trend chart

### Plus 🎤 Voice Input — Bolkar Kharcha Add Karein
Mic dabayein aur boliye — **"aaj paanch sau ki sabzi"**, **"do hazaar petrol"**, **"महीने का किराया दस हज़ार"** — app khud amount nikaalega, category pehchanega (🛒 Grocery, 🚗 Transport, 🏠 Rent...) aur form bhar dega. Hinglish, देवनागरी aur English — teeno samajh aata hai. *(Chrome/Edge mein best chalta hai)*

### Plus 🎯 Savings Goals — Sapne Pakke Kadam
Phone chahiye? Gaadi? Trip? Goal banayein — app khud calculate karega:
- **"Naya Phone ₹40,000 — 4 mahine mein" → har mahine ₹7,000 jodo**
- Progress bar, contribution add karna, complete hone par 🏆 celebration
- Salah tab mein: "bacha hua ₹X mein se goals ke ₹Y — phir bhi ₹Z invest ke liye bachega"
- Goals vs bachat ka warning jab deadline tight ho

### Plus 🧾 Kharcha Tracking
Mahine bhar har kharcha add karein (category + note + date). Budget cross hone par turant warning milti hai.

### Plus 🔗 Verified Invest/Save Links — Click Karke Seedha Invest
Salah tab ke har suggestion (FD, SIP, T-Bill, Gold ETF, PPF, ELSS, tax filing...) ke saath ek **verified link** hota hai — click karte hi seedha us official/SEBI-registered/RBI/Govt platform par pahunch jaate hain (Groww, RBI Retail Direct, India Post, Income Tax e-Filing). App ka in platforms se koi commission/partnership nahi — sirf "kahan jaake invest karein" ka rasta dikhaya gaya hai. Invest se pehle khud bhi verify kar lein.

### Plus 👥 Multiple Users, Ek Hi Device — Data Kabhi Merge Nahi Hoga
Agar ghar mein 2-3 log isi phone/laptop par PaisaGuru use karte hain, unke liye alag-alag **profile** banayein (Settings → 👥 Users → "+ Naya User"). Har profile ka data bilkul **alag jagah** save hota hai — kabhi mix nahi hota. Jaise hi doosra profile ban jata hai, app agli baar (naye session/tab mein) khulte hi poochhegi **"Kaun Use Kar Raha Hai?"** — sahi profile choose karke hi kaam shuru hota hai, chahein to har profile par ek chhota PIN bhi laga sakte hain. Akele use karne walon ke liye kuch nahi badalta — bina kisi extra profile ke app pehle jaisi hi seedhe khul jaati hai.

### Plus ⚡ Slash Commands — Power-User Ke Liye
Kahin bhi **`/`** dabayein (ya `Ctrl+K`, ya topbar ka `/` button) — ek chhota command box khulega jisme type karke turant kaam ho jaata hai, bina menu mein ghume:
- `/add 500 khana lunch` — turant kharcha add (amount + category auto-detect Hindi/English keywords se — jaise "khana", "petrol", "bijli", "kiraya" waghera — + baaki text note ban jaata hai)
- `/home` `/expense` `/report` `/advice` `/settings` — kisi bhi screen par seedhe jump
- `/goal` `/wizard` `/theme` `/export` `/import` `/user` `/logout` `/privacy` — quick actions
- `/help` — saare commands ki list
Arrow keys se navigate karein, Enter se run karein, Esc se band karein. Ye palette login-gate/lock screen ke dauraan nahi khulta (safe by design).

### Plus 🔒 Privacy Policy Page
Ek dedicated **`privacy.html`** page hai (Settings → 🔒 Privacy, ya `/privacy` command se) jo saaf-saaf batata hai: default mein sab data sirf aapke browser mein (localStorage) rehta hai, koi tracking/ads nahi, aur optional cloud-backup/licensing features sirf tabhi internet use karte hain jab aap khud unhe on karein.

---

## ✨ Features

| Feature | Kya karta hai |
|---|---|
| 💵 Salary Setup Wizard | Salary daalte hi 3-step guided planning (Salary → Kharcha Plan → Investment Plan) |
| 🗺️ Smart Suggestions | Naye mahine ka plan pichle mahine ke kharche se auto-suggest |
| 🎤 Voice Input | Bol kar kharcha add — Hinglish/हिंदी/English number words + auto category detect |
| 🎯 Savings Goals | Goal banaiye, app batayega mahine kitna jodna hai; progress + complete celebration |
| 🧾 Expense Tracking | Category-wise kharcha, notes, budget alerts, delete |
| 📊 Monthly Report | Plan vs actual, MoM comparison, saving grade, 6-month trend |
| 🤖 Insights Engine | 10+ rules wala analysis — overspend, pace, wants vs needs, emergency fund, goals |
| 💡 Investment Salah | Emergency-fund-first allocation, SIP projections, quick-return options, 50-30-20 rule check, tax tips |
| 🛡️ Privacy-first | Sab data **aapke browser** (localStorage) mein — koi server nahi |
| 👥 Multi-User Profiles | Ghar ke sabhi log alag profile banayein — data kabhi merge nahi hota, optional PIN lock |
| 🔗 Verified Invest Links | Har suggestion ke saath direct link — Groww / RBI Retail Direct / India Post / Income Tax |
| 🎨 Fresh, Animated UI | Naya gradient theme, floating nav, smooth animations + 🌙 Dark Mode |
| ⚡ Slash Commands | `/` ya `Ctrl+K` dabakar quick actions — `/add`, `/report`, `/goal`, `/theme`, waghera |
| 🔒 Privacy Policy Page | Saaf-saaf bataata hai data kahan/kaise store hota hai — `privacy.html` |
| 📦 Backup | JSON export / import |
| 🎬 Demo Data | Ek click mein 3 mahine ka sample data + ek goal — app turant samajh aayegi |

## 🚀 Kaise Chalayein

**Tarika 1 (sabse aasan):** `index.html` par double-click karein — bas! Koi install nahi, koi internet nahi (offline bhi chalta hai).

**Tarika 2 (local server):**
```bash
python3 -m http.server 8000
# phir browser mein: http://localhost:8000
```

## 🛠️ Tech Stack

- **HTML + CSS + Vanilla JavaScript** — zero dependencies, zero build step, zero tracking
- Data: browser `localStorage`
- Charts: pure CSS (koi library nahi)
- Mobile-first responsive design — phone par bhi, desktop par bhi

## 📁 Structure

```
Monthly-Expense/
├── index.html   # App ka structure (views, wizard modal, navigation, command palette)
├── style.css    # Puri styling — mobile-first, modern
├── app.js       # Logic: state, wizard, insights engine, investment salah, slash commands
├── privacy.html # Standalone Privacy Policy page
└── README.md
```

## ⚠️ Disclaimer

Ye app **general financial education** ke liye hai — personalized investment advice nahi. **PaisaGuru SEBI-registered investment advisor NAHI hai.** Investment ke saare numbers web se verify karke, date-stamp ke saath dikhaye jaate hain (Salah tab → "Ye Adaad Kahan Se Aaye?" card mein sources ki poori table). Par rates badalte rehte hain aur **koi bhi return guaranteed nahi** — bada investment karne se pehle SEBI-registered advisor se salah lein.

## 📡 Auto-Update Pipeline — App Khud Updated Rehti Hai

User ko kuch nahi karna padta — internet on karo, bas:

```
                    ┌──────────────────────────────┐
                    │  har Somwar (GitHub Action)  │
                    │  CCIL site → T-bill yields   │
                    │  sanity-check → rates.json   │
                    └──────────────┬───────────────┘
                                   ↓ (git push)
   App load ──→ GitHub se rates.json fetch (live) ✅
        ├─ internet nahi? → localStorage cache (pichhli baar ka fresh data) ✅
        ├─ wo bhi nahi?   → app ke andar bundled data (offline guarantee) ✅
        └─ har haal mein: data ki date UI par dikhti hai + 45 din purana ho to WARNING
```

| Layer | Kya | Kab kaam aata hai |
|---|---|---|
| 1. Live fetch | App khulte hi GitHub raw se latest `rates.json` | Internet hai |
| 2. Offline cache | Last-fetched data localStorage mein | Internet gayab, par pehle kabhi online tha |
| 3. Bundled | App ke andar packed verified data (abhi: 25 Sep 2026) | Hamesha — app kabhi nahi rukti |

**Weekly bot** (`.github/workflows/update-rates.yml` + `scripts/update-rates.mjs`): har Somwar CCIL ki website se 91/182/364-din T-bill yields uthata hai aur `rates.json` commit karta hai.

**Safety rules (bot galat data kabhi nahi likhega):**
1. Parse fail / adhoora data → rates.json ko chhoota hi nahi (safe skip, agla Somwar phir try)
2. Sanity range — yield 0.5–15% ke bahar (jaise 55%) → reject
3. Curve check — 91D ≤ 182D ≤ 364D se bahut zyada ulta → junk reject
4. Har failure silent exit — workflow red nahi hota, achhe data ko koi khatra nahi

**Manual update** (FD/Nifty/tax jaise curated numbers): bas `rates.json` edit karke push kar do — saare users ko agli app-load par turant naya data mil jayega (code change ki zaroorat nahi).

> ⚠️ Note: GitHub ki security policy bot ko workflow files push karne nahi deti — isliye setup ke liye **`.github/WORKFLOW-SETUP.md`** kholen (2-minute ka copy-paste step, sirf ek baar karna hai). Uske baad har Somwar robot khud rates update karega.

## 📚 Data Verification (25 Sep 2026)

App ke saare investment numbers ek hi jagah (`FINANCE_DATA` in `app.js`) mein hain, web-verified:

| Baat | Value (Sep 2026) | Source |
|---|---|---|
| FD — bade banks | 6.25–7.1% (SBI ~6.45%, HDFC/ICICI ~7.1%) | Bank websites / BusinessToday |
| FD — small finance banks | 8–8.5% tak (DICGC ₹5L/bank ke andar) | Bank websites |
| T-Bill 91D / 182D / 364D | ≈5.4% / ≈5.8% / ≈6.1% | CCIL (24 Sep 2026) |
| Liquid funds | ≈6.4–6.6% (1-saal) | Groww / Scripbox |
| Nifty 50 TRI average | ≈12.4% (20 saal), ≈12.4% (1995 se) | NSE Factsheet / Whitepaper 2026 |
| SGB | **Naye investment ke liye band** (Feb 2024 se koi tranche nahi) — isliye app Gold ETF/Fund batati hai | RBI / Finance Ministry |
| Tax (FY 2026-27) | New regime default · 80C/NPS-₹50K sirf old regime · Equity LTCG 12.5% (₹1.25L/yr exempt), STCG 20% | Income Tax Act / TaxGuru |
| RBI Repo Rate | 5.25% | RBI MPC |

> **App ke design ke 4 safety principles:**
> 1. **Single source of truth** — saare rates ek `FINANCE_DATA` object mein, har jagah wahi se aate hain
> 2. **Date-stamped + sourced** — har number ke saath "verified when" + "source" UI mein dikhta hai
> 3. **Ranges, not promises** — SIP projection 8%/10%/12%/15% scenario table hai, ek number nahi; 12% clearly "assumption, guarantee nahi" labeled
> 4. **No guarantees, ever** — "guaranteed return" wali cheez SEBI rule ke khilaf hai, app isko har jagah clear karti hai

## 🔐 Licensing v2 (optional — default OFF)

App mein ek poora licensing system built-in hai, par **default par bilkul OFF**:
jab tak `rates.json` ka `apiBase` khali hai, app free chalti hai — koi trial, koi
login, koi lock nahi.

Owner jab `server/` ko deploy karke URL `rates.json` mein daal deta hai, tab ye
sab ON ho jata hai:

- **7-din free trial** — server-side, per-device; ek hi network (IP) par max 3 trials
- **Read-only lock** — trial khatam hone par sirf *editing* band hoti hai;
  user ka poora data surakshit rehta hai, dikhta rehta hai, kabhi delete nahi hota
- **Accounts (v2)** — mobile number + password se login (scrypt hashed passwords,
  hashed session tokens, 30-din session)
- **Personal Space portal** (`/portal`) — Hindi UI: login/register, apni key dekhna,
  UPI payment details, “Maine Payment Kar Diya” button, backup download
- **Telegram approve** — payment claim aate hi owner ke Telegram par
  **[✅ Approve - Key Do] / [❌ Reject]** buttons; approve karte hi user ko
  **per-user (account-bound) key** mil jati hai
- **Per-user keys** — account-bound key type karke chori nahi ki ja sakti
  (“Ye key ek account se judi hai — app mein login karein”)
- **Direct keys (v1 legacy)** — bina account ke keys, IP + device par bind,
  admin panel se generate / block / IP reset
- **Cloud sync** — har change par 3s debounce backup; login karte hi doosre
  phone par data wapas
- **Admin panel** (`/admin?key=ADMIN_SECRET`) — stats, keys, users, purchase
  requests, search (naam/phone/deviceId), block/unblock, Reset IP, DB export
  (passwords sirf hash form mein)

Poora setup (Render deploy, env vars, Telegram bot, roz-ka-kaam table):
👉 **[DEPLOYMENT.md](DEPLOYMENT.md)**

```bash
npm install
npm test        # app tests (jsdom) + server e2e tests
npm start       # licensing server local par
```

## 🗺️ Future Ideas

- [ ] Bank SMS se automatic expense import
- [ ] Shared household budget (family ke saath ek hi tracker)
- [ ] PWA — phone mein app jaisa install ho
- [ ] Advanced charts aur year-wise reports
- [ ] Debt/EMI manager — "pehle kaunsi EMI band karein" wali salah

---

*Banaya gaya ❤️ se — un logon ke liye jo salary aate hi paisa kharch kar dete hain, aur month end mein sochte hain "paise gaye kahan?" 😄*
