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
| 🛡️ Privacy-first | Sab data **aapke browser** (localStorage) mein — koi server nahi, koi login nahi |
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
├── index.html   # App ka structure (views, wizard modal, navigation)
├── style.css    # Puri styling — mobile-first, modern
├── app.js       # Logic: state, wizard, insights engine, investment salah
└── README.md
```

## ⚠️ Disclaimer

Ye app **general financial education** ke liye hai — personalized investment advice nahi. **PaisaGuru SEBI-registered investment advisor NAHI hai.** Investment ke saare numbers web se verify karke, date-stamp ke saath dikhaye jaate hain (Salah tab → "Ye Adaad Kahan Se Aaye?" card mein sources ki poori table). Par rates badalte rehte hain aur **koi bhi return guaranteed nahi** — bada investment karne se pehle SEBI-registered advisor se salah lein.

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

## 🗺️ Future Ideas

- [ ] Bank SMS se automatic expense import
- [ ] Shared household budget (family ke saath ek hi tracker)
- [ ] PWA — phone mein app jaisa install ho
- [ ] Advanced charts aur year-wise reports
- [ ] Debt/EMI manager — "pehle kaunsi EMI band karein" wali salah

---

*Banaya gaya ❤️ se — un logon ke liye jo salary aate hi paisa kharch kar dete hain, aur month end mein sochte hain "paise gaye kahan?" 😄*
