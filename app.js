'use strict';

/* ============================================================
   PaisaGuru — Monthly Expense Tracker & Smart Saving Advisor
   ------------------------------------------------------------
   Flow (jaise user ne socha hai):
   1. Salary received → amount daalein
   2. App khud poochhe: "Is month paisa kaha-kaha kharch hoga?"
   3. Jo bacha → app bataye kahan invest karein (emergency fund,
      SIP, FD, gold...) + "kam waqt mein profit" ke sahi options
   4. Har month ka analysis → pichle month se compare karke
      bataye is baar kahan paise save ho sakte hain
   ------------------------------------------------------------
   Pure vanilla JS. Data browser ke localStorage mein save hota
   hai — koi server, koi login, koi tracking nahi.
   ============================================================ */

/* ---------------- Safe storage (sandboxed iframes ke liye) ---------------- */
const store = (() => {
  try {
    const t = '__pg_test__';
    localStorage.setItem(t, t);
    localStorage.removeItem(t);
    return localStorage;
  } catch (e) {
    const m = {};
    return {
      getItem: k => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: k => { delete m[k]; }
    };
  }
})();

const STORAGE_KEY = 'paisaguru_v1';

/* ---------------- Categories ---------------- */
const CATEGORIES = [
  { id: 'rent',          name: 'Kiraya / Rent',        icon: '🏠', type: 'need' },
  { id: 'grocery',       name: 'Grocery / Rasoi',      icon: '🛒', type: 'need' },
  { id: 'bills',         name: 'Bijli / Paani / Bill', icon: '💡', type: 'need' },
  { id: 'medical',       name: 'Medical / Sehat',      icon: '💊', type: 'need' },
  { id: 'transport',     name: 'Transport / Petrol',   icon: '🚗', type: 'need' },
  { id: 'recharge',      name: 'Recharge / Internet',  icon: '📱', type: 'need' },
  { id: 'education',     name: 'Education / Fees',     icon: '🎓', type: 'need' },
  { id: 'emi',           name: 'EMI / Loan',           icon: '🏦', type: 'need' },
  { id: 'shopping',      name: 'Shopping',             icon: '🛍️', type: 'want' },
  { id: 'eatingout',     name: 'Bahar Khana / Cafe',   icon: '🍔', type: 'want' },
  { id: 'entertainment', name: 'Entertainment / Ghumna', icon: '🎬', type: 'want' },
  { id: 'others',        name: 'Others',               icon: '🎁', type: 'want' },
];
const catById = id => CATEGORIES.find(c => c.id === id) || { id, name: id, icon: '❓', type: 'want' };

/* ---------------- State ---------------- */
function defaultState() {
  return { months: {}, goals: [], settings: { name: '', emergencyDone: false, emergencySaved: 0 } };
}
function loadState() {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      months: parsed && parsed.months ? parsed.months : {},
      goals: parsed && Array.isArray(parsed.goals) ? parsed.goals : [],
      settings: Object.assign(base.settings, (parsed && parsed.settings) || {})
    };
  } catch (e) { return defaultState(); }
}
function saveState() { store.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadState();
let selectedMonth = monthKey(new Date());
let currentView = 'home';
let wiz = null;          // wizard ka temporary state
let confirmCb = null;    // confirm dialog callback

/* ---------------- Date & money utils ---------------- */
function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function parseMonthKey(key) { const p = key.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, 1); }
function monthLabel(key) { return parseMonthKey(key).toLocaleString('en-IN', { month: 'long', year: 'numeric' }); }
function addMonths(key, delta) { const d = parseMonthKey(key); d.setMonth(d.getMonth() + delta); return monthKey(d); }
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function daysInMonth(key) { const d = parseMonthKey(key); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

function fmt(n) { return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'); }
function pct(n) { return Math.round(n) + '%'; }
function esc(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
const sum = arr => arr.reduce((a, b) => a + b, 0);

function dateLabel(iso) {
  const today = todayISO();
  if (iso === today) return 'Aaj';
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yIso = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  if (iso === yIso) return 'Kal';
  const p = iso.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleString('en-IN', { day: 'numeric', month: 'short' });
}

/* ---------------- Month aggregates ---------------- */
function monthData(key) { return state.months[key] || null; }
function spentByCategory(md) {
  const m = {};
  (md.expenses || []).forEach(e => { m[e.category] = (m[e.category] || 0) + Number(e.amount || 0); });
  return m;
}
function plannedTotal(md) { return sum(Object.values(md.planned || {})); }
function spentTotal(md) { return sum(Object.values(spentByCategory(md))); }
function needsWants(md) {
  const byCat = spentByCategory(md);
  const needsSpent = sum(CATEGORIES.filter(c => c.type === 'need').map(c => byCat[c.id] || 0));
  const wantsSpent = sum(CATEGORIES.filter(c => c.type === 'want').map(c => byCat[c.id] || 0));
  const needsPlan = sum(CATEGORIES.filter(c => c.type === 'need').map(c => (md.planned || {})[c.id] || 0));
  const wantsPlan = sum(CATEGORIES.filter(c => c.type === 'want').map(c => (md.planned || {})[c.id] || 0));
  return { needsSpent, wantsSpent, needsPlan, wantsPlan };
}
function emergencyTarget(key) {
  const md = monthData(key);
  if (!md) return 0;
  const nw = needsWants(md);
  const base = Math.max(nw.needsSpent, nw.needsPlan);
  return Math.ceil(base * 3 / 1000) * 1000;
}

/* ============================================================
   VOICE INPUT — bolo, app samjhega 🎤
   "aaj paanch sau ki sabzi" → 🛒 Grocery ₹500
   Hinglish (Latin), Devanagari aur English numbers support
   ============================================================ */
const NUM_WORDS = {
  /* --- Hinglish (Latin) --- */
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'chaar': 4, 'panch': 5, 'paanch': 5, 'chah': 6, 'chhe': 6, 'chhah': 6,
  'saat': 7, 'aath': 8, 'nau': 9, 'das': 10, 'gyarah': 11, 'barah': 12, 'baraah': 12, 'terah': 13, 'chaudah': 14,
  'pandrah': 15, 'pandra': 15, 'solah': 16, 'satrah': 17, 'atharah': 18, 'unnees': 19, 'bees': 20, 'bis': 20,
  'ikkees': 21, 'baees': 22, 'teis': 23, 'chaubees': 24, 'chubees': 24, 'chhabbees': 26, 'sattaees': 27, 'atthaees': 28, 'untiis': 29,
  'tees': 30, 'iktees': 31, 'battees': 32, 'taintees': 33, 'chauntees': 34, 'paintees': 35, 'chhattees': 36, 'saintees': 37, 'aintees': 38, 'untalees': 39,
  'chaalees': 40, 'iktalees': 41, 'bytalees': 42, 'paintalees': 43, 'chautalees': 44, 'paintaalees': 45, 'chhiyaalees': 46, 'saintaalees': 47, 'antaalees': 48, 'unchaalees': 49,
  'pachaas': 50, 'pachas': 50, 'ikyaavan': 51, 'baavan': 52, 'tirpan': 53, 'chauvan': 54, 'pachpan': 55, 'chhappan': 56, 'sattaavan': 57, 'atthaavan': 58, 'unsath': 59,
  'saath': 60, 'iksaath': 61, 'baaath': 62, 'tirsath': 63, 'chausaath': 64, 'paisath': 65, 'chiyaasath': 66, 'sarsath': 67, 'aasath': 68, 'unhattar': 69,
  'sattar': 70, 'ikhattar': 71, 'bahattar': 72, 'tihattar': 73, 'chauhattar': 74, 'pachhattar': 75, 'chhihattar': 76, 'sathattar': 77, 'athhattar': 78, 'unaasi': 79,
  'assi': 80, 'ikyaasi': 81, 'bayaasi': 82, 'tirasi': 83, 'chaursaasi': 84, 'pachaasi': 85, 'chiyaasi': 86, 'sataasi': 87, 'athaasi': 88, 'navaasi': 89,
  'nabbe': 90, 'ikyaanve': 91, 'baanve': 92, 'tiraanve': 93, 'chauraanve': 94, 'pachaanve': 95, 'pachanve': 95, 'chhiyaanve': 96, 'sataanve': 97, 'athaanve': 98, 'ninyaanve': 99,
  'sau': 100, 'hazaar': 1000, 'hazar': 1000, 'hajar': 1000,
  /* --- special (aadhe) --- */
  'dedh': 1.5, 'dhai': 2.5,
  /* --- Devanagari --- */
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19, 'बीस': 20,
  'इक्कीस': 21, 'बाईस': 22, 'तेइस': 23, 'चौबीस': 24, 'पच्चीस': 25, 'छब्बीस': 26, 'सत्ताईस': 27, 'अट्ठाईस': 28, 'उनतीस': 29,
  'तीस': 30, 'इकतीस': 31, 'बत्तीस': 32, 'तैंतीस': 33, 'चौंतीस': 34, 'पैंतीस': 35, 'छत्तीस': 36, 'सैंतीस': 37, 'अड़तीस': 38, 'उनतालीस': 39,
  'चालीस': 40, 'इकतालीस': 41, 'बयालीस': 42, 'पैंतालीस': 43, 'चौवालीस': 44, 'पैंतालीस': 45, 'छियालीस': 46, 'सैंतालीस': 47, 'अड़तालीस': 48, 'उनचालीस': 49,
  'पचास': 50, 'इक्यावन': 51, 'बावन': 52, 'तिरपन': 53, 'चौवन': 54, 'पचपन': 55, 'छप्पन': 56, 'सत्तावन': 57, 'अट्ठावन': 58, 'उनसठ': 59,
  'साठ': 60, 'इकसठ': 61, 'बासठ': 62, 'तिरसठ': 63, 'चौंसठ': 64, 'पैंसठ': 65, 'छियासठ': 66, 'सड़सठ': 67, 'अड़सठ': 68, 'उनहत्तर': 69,
  'सत्तर': 70, 'इकहत्तर': 71, 'बहत्तर': 72, 'तिहत्तर': 73, 'चौहत्तर': 74, 'पचहत्तर': 75, 'छिहत्तर': 76, 'सतहत्तर': 77, 'अठहत्तर': 78, 'उन्यासी': 79,
  'अस्सी': 80, 'इक्यासी': 81, 'बयासी': 82, 'तिरासी': 83, 'चौरासी': 84, 'पचासी': 85, 'छियासी': 86, 'सतासी': 87, 'अठासी': 88, 'नवासी': 89,
  'नब्बे': 90, 'इक्यानवे': 91, 'बानवे': 92, 'तिरानवे': 93, 'चौरानवे': 94, 'पचानवे': 95, 'छियानवे': 96, 'सतानवे': 97, 'अठानवे': 98, 'निन्यानवे': 99,
  'सौ': 100, 'हज़ार': 1000, 'हजार': 1000, 'लाख': 100000, 'करोड़': 10000000,
  'डेढ़': 1.5, 'ढाई': 2.5,
  /* --- English --- */
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'crore': 10000000,
};

/* Digit ke aage-lage multiplier: "2 hazaar", "1.5 lakh", "700 hundred"? nahi — "3 sau" */
const VOICE_MULT = {
  'sau': 100, 'सौ': 100, 'hazaar': 1000, 'hazar': 1000, 'hajar': 1000, 'thousand': 1000,
  'हज़ार': 1000, 'हजार': 1000, 'lakh': 100000, 'लाख': 100000, 'crore': 10000000, 'करोड़': 10000000, 'hundred': 100,
};

/* Category keywords (order matter karta hai — pehla match jeetega) */
const CAT_KEYWORDS = [
  ['recharge', ['recharge', 'रिचार्ज', 'internet', 'इंटरनेट', 'wifi', 'वाईफ़ाई', 'वाईफाई', 'data pack']],
  ['rent', ['kiraya', 'किराया', 'rent', 'रेंट']],
  ['emi', ['emi', 'ईएमआई', 'loan', 'लोन', 'kist', 'किस्त', 'installment']],
  ['medical', ['dawa', 'दवा', 'dawai', 'दवाई', 'medicine', 'medical', 'doctor', 'डॉक्टर', 'hospital', 'अस्पताल', 'checkup', 'चेकअप']],
  ['education', ['fees', 'फीस', 'school', 'स्कूल', 'college', 'कॉलेज', 'tuition', 'ट्यूशन', 'padhai', 'पढ़ाई', 'exam', 'परीक्षा']],
  ['bills', ['bijli', 'बिजली', 'bill', 'बिल', 'paani', 'पानी', 'electricity']],
  ['transport', ['petrol', 'पेट्रोल', 'diesel', 'डीज़ल', 'डीजल', 'cab', 'taxi', 'टैक्सी', 'auto', 'रिक्शा', 'rickshaw', 'bus', 'बस', 'metro', 'मेट्रो', 'uber', 'ola', 'train', 'ट्रेन', 'flight', 'फ्लाइट']],
  ['grocery', ['sabzi', 'सब्ज़ी', 'सब्जी', 'sabjee', 'rashan', 'राशन', 'grocery', 'vegetable', 'doodh', 'दूध', 'atta', 'आटा', 'chawal', 'चावल', 'kirana', 'किराना', 'masala', 'मसाला', 'bazaar', 'बाजार']],
  ['eatingout', ['zomato', 'swiggy', 'khana', 'खाना', 'खाया', 'restaurant', 'रेस्टोरेंट', 'cafe', 'कैफे', 'chai', 'चाय', 'nashta', 'नाश्ता', 'dinner', 'डिनर', 'lunch', 'लंच', 'pizza', 'burger', 'momos', 'मोमो', 'coffee', 'कॉफी']],
  ['shopping', ['shopping', 'शॉपिंग', 'amazon', 'flipkart', 'myntra', 'shoes', 'जूते', 'shoe', 'shirt', 'कमीज़', 'kapde', 'कपड़े', 'clothes', 'sale', 'सेल', 'phone', 'फोन', 'laptop', 'लैपटॉप', 'headphone', 'bag', 'बैग', 'watch', 'घड़ी', 'gold', 'सोना']],
  ['entertainment', ['movie', 'मूवी', 'फिल्म', 'cinema', 'सिनेमा', 'picture', 'पिक्चर', 'netflix', 'ghumna', 'घूमना', 'trip', 'ट्रिप', 'vacation', 'ghoomne']],
];

function extractAmount(text) {
  if (!text) return null;
  const devMap = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
  const t = String(text).toLowerCase()
    .replace(/[०-९]/g, d => devMap[d])
    .replace(/₹/g, ' ')
    .replace(/,/g, '');
  const tokens = t.split(/\s+/).filter(Boolean).map(w => w.replace(/[^a-z0-9.\u0900-\u097F]/g, ''));

  /* 1) Digits (+ multiplier): "₹2,000", "2 hazaar", "1.5 lakh" */
  const candidates = [];
  for (let i = 0; i < tokens.length; i++) {
    const m = tokens[i].match(/^(\d+(?:\.\d+)?)[a-z]*$/);
    if (!m) continue;
    let v = Number(m[1]);
    const next = tokens[i + 1] || '';
    if (VOICE_MULT[next]) { v *= VOICE_MULT[next]; i++; }
    if (v > 0) candidates.push(v);
  }
  if (candidates.length) return Math.round(Math.max(...candidates));

  /* 2) Number words: "do hazaar panch sau", "पंद्रह हज़ार", "five hundred" */
  let total = 0, current = 0, found = false;
  tokens.forEach(w => {
    const v = NUM_WORDS[w];
    if (v === undefined) return;
    found = true;
    if (v >= 100) { total += (current || 1) * v; current = 0; } /* sau/hazaar/lakh — flush */
    else current += v;
  });
  total += current;
  if (!found || total <= 0) return null;
  if (total < 100 && !Number.isInteger(total)) total *= 1000; /* "dedh" = 1500 */
  return Math.round(total);
}

function detectCategory(text) {
  const t = String(text || '').toLowerCase();
  for (const pair of CAT_KEYWORDS) {
    for (const kw of pair[1]) if (t.includes(kw)) return pair[0];
  }
  return 'others';
}

function parseVoiceInput(text) {
  const raw = String(text || '').trim();
  return { amount: extractAmount(raw), category: detectCategory(raw), note: raw.length > 60 ? raw.slice(0, 60) : raw, raw };
}

/* --- Mic wiring (Web Speech API — Chrome/Edge) --- */
let recog = null;
let voiceLang = 'hi-IN';

function voiceSupported() {
  return typeof window.SpeechRecognition === 'function' || typeof window.webkitSpeechRecognition === 'function';
}

function startVoice() {
  if (!voiceSupported()) { toast('Ye browser voice input support nahi karta — Chrome/Edge mein try karein', 'warn'); return; }
  if (recog) { try { recog.stop(); } catch (e) {} recog = null; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recog = new SR();
  recog.lang = voiceLang;
  recog.interimResults = true;
  recog.maxAlternatives = 1;
  const btn = document.getElementById('micBtn');
  const status = document.getElementById('voiceStatus');
  const preview = document.getElementById('voicePreview');
  if (btn) { btn.classList.add('listening'); btn.textContent = '⏹️'; }
  if (status) status.textContent = '🎙️ Sun raha hoon... boliye! (e.g. "aaj paanch sau ki sabzi")';
  if (preview) preview.classList.add('hidden');
  recog.onresult = ev => {
    let finalTxt = '', interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalTxt += r[0].transcript; else interim += r[0].transcript;
    }
    if (status && interim) status.textContent = '🗣️ ' + interim;
    if (finalTxt) applyVoiceResult(finalTxt);
  };
  recog.onerror = ev => {
    const msgs = {
      'not-allowed': 'Mic ki permission nahi mili — browser settings mein allow karein',
      'no-speech': 'Kuch sunayi nahi diya — dobara dabakar boliye',
      'audio-capture': 'Mic nahi mila — check karein mic laga hai?',
      'network': 'Network issue — internet check karein'
    };
    toast(msgs[ev.error] || 'Voice error: ' + ev.error, 'error');
  };
  recog.onend = () => {
    if (btn) { btn.classList.remove('listening'); btn.textContent = '🎤'; }
    if (status && status.textContent.indexOf('🎙️') === 0) status.innerHTML = 'Dabayein aur boliye — <i>"aaj paanch sau ki sabzi"</i>';
    recog = null;
  };
  try { recog.start(); } catch (e) { toast('Voice start nahi ho paya', 'error'); }
}

function applyVoiceResult(text) {
  const res = parseVoiceInput(text);
  const amt = document.getElementById('expAmount');
  const cat = document.getElementById('expCat');
  const note = document.getElementById('expNote');
  const status = document.getElementById('voiceStatus');
  const preview = document.getElementById('voicePreview');
  if (res.amount) {
    if (amt) amt.value = res.amount;
    if (cat) cat.value = res.category;
    if (note) note.value = res.note;
    const c = catById(res.category);
    if (status) status.textContent = '✅ Samajh aa gaya — form bhar diya, neeche check karke Add dabayein';
    if (preview) {
      preview.innerHTML = `<span>Samjha: ${c.icon} <b>${c.name}</b> · <b>${fmt(res.amount)}</b></span>
        <button class="btn primary sm" data-action="voice-apply">✔ Add Karein</button>`;
      preview.classList.remove('hidden');
    }
  } else {
    if (status) status.textContent = '🤔 Amount samajh nahi aaya — "paanch sau ki sabzi" jaise boliye';
    if (preview) preview.classList.add('hidden');
  }
}

/* ============================================================
   GOALS — sapne, pakke kadam 🎯
   ============================================================ */
const GOAL_ICONS = ['📱', '💻', '🚗', '🏍️', '🏠', '✈️', '💍', '🎓', '🎁', '💵', '👶', '🙏'];

function activeGoals() { return (state.goals || []).filter(g => (g.saved || 0) < g.target); }

function goalMonthly(goal) {
  const remaining = Math.max(0, goal.target - (goal.saved || 0));
  if (remaining <= 0) return 0;
  let months = 6; /* deadline nahi to 6 mahine ka default */
  if (goal.deadline) {
    const p = String(goal.deadline).split('-').map(Number);
    const end = new Date(p[0], p[1] - 1, p[2]);
    const days = Math.ceil((end - new Date()) / 86400000);
    months = Math.max(1, Math.ceil(Math.max(days, 1) / 30.44));
  }
  return Math.ceil(remaining / months);
}

function goalDeadlineLabel(goal) {
  if (!goal.deadline) return '6 mahine (default)';
  const p = String(goal.deadline).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

function goalsCardHtml() {
  const goals = state.goals || [];
  const rows = goals.map(g => {
    const p = Math.min(100, (g.saved || 0) / g.target * 100);
    const done = (g.saved || 0) >= g.target;
    return `
    <div class="goal-row">
      <div class="row between">
        <div class="row gap" style="min-width:0">
          <span class="goal-ico">${g.icon || '🎯'}</span>
          <div style="min-width:0">
            <div class="goal-name">${esc(g.name)}</div>
            <div class="small muted">${fmt(g.saved || 0)} / ${fmt(g.target)} · ${goalDeadlineLabel(g)}</div>
          </div>
        </div>
        ${done ? '<span class="chip good">🏆 Poora!</span>' : `<span class="chip info">${fmt(goalMonthly(g))}/mo chahiye</span>`}
      </div>
      <div class="progress"><div class="progress-fill ${done ? '' : 'warn'}" style="width:${p}%"></div></div>
      ${done ? '' : `<div class="row gap" style="justify-content:flex-end">
        <button class="btn ghost sm" data-action="goal-contrib" data-id="${g.id}">➕ Paisa Jodo</button>
        <button class="delbtn" data-action="goal-del" data-id="${g.id}" title="Goal delete">🗑️</button>
      </div>`}
    </div>`;
  }).join('');
  return `
  <div class="card">
    <div class="card-title">🎯 Aapke Goals <span class="chip plain">${goals.length} goal${goals.length === 1 ? '' : 's'}</span></div>
    ${rows || '<div class="empty">Koi goal nahi. "Naya Goal" banayein — jaise 📱 phone, 🚗 gaadi, ✈️ trip — app khud batayega mahine kitna jodna hai!</div>'}
    <button class="btn gold block mt8" data-action="goal-new">➕ Naya Goal Banayein</button>
  </div>`;
}

function goalsPlanCardHtml(leftover) {
  const goals = state.goals || [];
  if (!goals.length) return '';
  const rows = goals.map(g => {
    const done = (g.saved || 0) >= g.target;
    const need = goalMonthly(g);
    const p = Math.min(100, (g.saved || 0) / g.target * 100);
    return `
    <div class="goal-row">
      <div class="row between">
        <div class="row gap" style="min-width:0">
          <span class="goal-ico">${g.icon || '🎯'}</span>
          <div style="min-width:0">
            <div class="goal-name">${esc(g.name)}</div>
            <div class="small muted">${done ? '🏆 Poora ho gaya — badhai ho!' : 'Is month ' + fmt(need) + ' jodo · target ' + goalDeadlineLabel(g)}</div>
          </div>
        </div>
        <span class="chip ${done ? 'good' : 'info'}">${pct(p)}</span>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${p}%"></div></div>
    </div>`;
  }).join('');
  const need = sum(activeGoals().map(goalMonthly));
  let verdict;
  if (leftover <= 0) {
    verdict = `<div class="tip tip-warn mt8"><span class="tip-ico">⚠️</span><div class="tip-text">Goals ke liye ${fmt(need)}/mahina chahiye, par plan mein kuch bacha hi nahi. Kharche kaat kar goal fund nikaalein!</div></div>`;
  } else if (need <= leftover) {
    verdict = `<div class="tip tip-good mt8"><span class="tip-ico">✅</span><div class="tip-text">Badhiya! Bacha hua ${fmt(leftover)} mein se ${fmt(need)} goals ke liye — uske baad bhi ${fmt(leftover - need)} invest ke liye bachega.</div></div>`;
  } else {
    verdict = `<div class="tip tip-warn mt8"><span class="tip-ico">🎯</span><div class="tip-text">Goals ke liye ${fmt(need)}/mahina chahiye, par bacha sirf ${fmt(leftover)} hai. Deadline badhaiye ya target thoda chhota karein — warna goal adhoora rahega.</div></div>`;
  }
  return `
  <div class="card">
    <div class="card-title">🎯 Goals Ka Plan</div>
    ${rows}
    ${verdict}
  </div>`;
}

function openGoalModal() {
  const m = document.getElementById('goalModal');
  m.innerHTML = `
  <div class="wiz-head">
    <div class="wiz-step">🎯 NAYA GOAL</div>
    <h2>Sapna Pakka Karein!</h2>
    <p class="muted">Kya chahiye — phone, gaadi, trip? App khud calculate karega ki mahine kitna jodna hai.</p>
  </div>
  <form id="goalForm">
    <div class="field">
      <label>Icon chunein</label>
      <div class="emoji-row">${GOAL_ICONS.map((ic, i) => `<label class="emoji-chip"><input type="radio" name="gicon" value="${ic}" ${i === 0 ? 'checked' : ''}><span>${ic}</span></label>`).join('')}</div>
    </div>
    <div class="field">
      <label>Goal ka naam</label>
      <input type="text" id="goalName" maxlength="30" required placeholder="e.g. Naya Phone">
    </div>
    <div class="grid2">
      <div class="field">
        <label>Kitna paisa chahiye? (₹)</label>
        <input type="number" id="goalTarget" min="100" step="500" inputmode="numeric" required placeholder="e.g. 40000">
      </div>
      <div class="field">
        <label>Kab tak? (optional)</label>
        <input type="date" id="goalDeadline">
      </div>
    </div>
    <div class="field">
      <label>Ab tak kitna jama hai? (₹, optional)</label>
      <input type="number" id="goalSaved" min="0" step="500" inputmode="numeric" value="0">
    </div>
    <button class="btn primary block" type="submit">🎯 Goal Banayein</button>
    <button class="btn ghost sm block mt8" type="button" data-action="close-goal">Cancel</button>
  </form>`;
  document.getElementById('goalOverlay').classList.remove('hidden');
}

function saveGoalForm(form) {
  const icon = (form.querySelector('input[name="gicon"]:checked') || {}).value || '🎯';
  const name = form.querySelector('#goalName').value.trim();
  const target = Number(form.querySelector('#goalTarget').value);
  const dl = form.querySelector('#goalDeadline').value;
  const saved = Number(form.querySelector('#goalSaved').value) || 0;
  if (!name) { toast('Goal ka naam likhein', 'error'); return; }
  if (!target || target < 100) { toast('Target kam se kam ₹100 hona chahiye', 'error'); return; }
  state.goals = state.goals || [];
  const goal = { id: 'g' + Date.now() + Math.floor(Math.random() * 999), icon, name, target, saved: Math.max(0, Math.min(saved, target)), deadline: dl || '' };
  state.goals.push(goal);
  saveState();
  closeGoalModal();
  renderAll();
  toast('🎯 Goal ban gaya: ' + name + ' — har mahine ' + fmt(goalMonthly(goal)) + ' jodna hai!', 'success');
}

function openContribModal(id) {
  const g = (state.goals || []).find(x => x.id === id);
  if (!g) return;
  const m = document.getElementById('goalModal');
  m.innerHTML = `
  <div class="wiz-head">
    <div class="wiz-step">➕ PAISA JODO</div>
    <h2>${g.icon} ${esc(g.name)}</h2>
    <p class="muted">Ab tak ${fmt(g.saved || 0)} / ${fmt(g.target)} jama hai. ${g.saved >= g.target ? 'Ye goal already poora hai! 🏆' : 'Is month kitna joda?'}</p>
  </div>
  <form id="contribForm" data-id="${g.id}">
    <div class="field">
      <label>Kitna paisa joda? (₹)</label>
      <input type="number" id="contribAmt" min="1" step="100" inputmode="numeric" required placeholder="e.g. 2000" autofocus>
    </div>
    <button class="btn primary block" type="submit">➕ Jodo</button>
    <button class="btn ghost sm block mt8" type="button" data-action="close-goal">Cancel</button>
  </form>`;
  document.getElementById('goalOverlay').classList.remove('hidden');
}

function addContribution(form) {
  const id = form.getAttribute('data-id');
  const g = (state.goals || []).find(x => x.id === id);
  if (!g) return;
  const amt = Number(form.querySelector('#contribAmt').value);
  if (!amt || amt <= 0) { toast('Sahi amount daalein', 'error'); return; }
  const before = g.saved || 0;
  g.saved = before + amt;
  saveState();
  closeGoalModal();
  renderAll();
  if (before < g.target && g.saved >= g.target) toast('🏆 GOAL COMPLETE: ' + g.name + '! Badhai ho — agla goal banayein! 🎉', 'success');
  else toast('✔ ' + fmt(amt) + ' jama ho gaya — ab ' + fmt(Math.max(0, g.target - g.saved)) + ' baaki', 'success');
}

function deleteGoal(id) {
  const g = (state.goals || []).find(x => x.id === id);
  showConfirm('Goal "' + (g ? g.name : '') + '" delete kar dein?', () => {
    state.goals = (state.goals || []).filter(x => x.id !== id);
    saveState();
    renderAll();
    toast('Goal delete ho gaya', 'success');
  });
}

function closeGoalModal() { document.getElementById('goalOverlay').classList.add('hidden'); }

/* ============================================================
   RENDERING
   ============================================================ */
function renderAll() {
  const hasData = !!monthData(selectedMonth);
  const label = document.getElementById('monthLabel');
  label.textContent = monthLabel(selectedMonth) + (hasData ? '  ●' : '');
  label.title = hasData ? 'Is month ka data saved hai' : 'Is month ka data nahi hai';

  const map = { home: renderHome, expense: renderExpense, report: renderReport, advice: renderAdvice, settings: renderSettings };
  map[currentView]();
}

function switchView(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-' + v).classList.remove('hidden');
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  closeWizard();
  hideConfirm();
  closeGoalModal();
  renderAll();
  window.scrollTo({ top: 0 });
}

function shiftMonth(delta) {
  const nk = addMonths(selectedMonth, delta);
  const now = monthKey(new Date());
  const min = addMonths(now, -60), max = addMonths(now, 12);
  if (nk < min || nk > max) { toast('Bas, itna door nahi 😅', 'warn'); return; }
  selectedMonth = nk;
  renderAll();
}

/* ---------------- Shared partials ---------------- */
function noDataCard() {
  const isFuture = selectedMonth > monthKey(new Date());
  return `
  <div class="card hero">
    <div class="hero-emoji">💵</div>
    <div class="hero-title">${isFuture ? monthLabel(selectedMonth) + ' ki planning pehle se kar lein!' : 'Kya is mahine salary aa gayi? 🤔'}</div>
    <div class="hero-text">
      ${isFuture
        ? 'Aage ka soch ke aap winner hain! Salary ka andaza lagakar plan bana lijiye — kharche control mein rahenge.'
        : 'Salary ka amount daaliye, app khud poochhega ki paisa kaha-kaha kharch hoga — aur jo bacha, use invest karne ki sahi salah dega.'}
    </div>
    <div class="hero-actions">
      <button class="btn primary" data-action="open-wizard">💵 Salary Received — Shuru Karein</button>
      ${Object.keys(state.months).length === 0 ? '<button class="btn ghost" data-action="load-demo">🎬 Demo Data Dekhein (Sample)</button>' : ''}
      <button class="btn gold" data-action="goal-new">🎯 Naya Goal Banayein (Phone, Gaadi, Trip...)</button>
    </div>
  </div>`;
}

function topCTA(text) {
  return `<button class="btn primary block" data-action="open-wizard">${text}</button>`;
}

/* ---------------- HOME ---------------- */
function renderHome() {
  const el = document.getElementById('view-home');
  const md = monthData(selectedMonth);
  if (!md) { el.innerHTML = noDataCard(); return; }

  const salary = md.salary;
  const byCat = spentByCategory(md);
  const sTotal = spentTotal(md);
  const pTotal = plannedTotal(md);
  const leftover = salary - pTotal;
  const rate = salary > 0 ? (leftover / salary) * 100 : 0;
  const spentPct = salary > 0 ? (sTotal / salary) * 100 : 0;
  const planMarkPct = salary > 0 ? Math.min(100, (pTotal / salary) * 100) : 0;

  const insights = generateInsights(selectedMonth);
  const day = new Date().getDate();
  const tipOfDay = insights.length ? insights[day % insights.length] : null;

  const catRows = CATEGORIES
    .filter(c => (md.planned[c.id] || 0) > 0 || (byCat[c.id] || 0) > 0)
    .map(c => {
      const planned = md.planned[c.id] || 0;
      const spent = byCat[c.id] || 0;
      const used = planned > 0 ? (spent / planned) * 100 : (spent > 0 ? 100 : 0);
      let fillCls = '', chip = '';
      if (planned > 0 && spent > planned) { fillCls = 'over'; chip = `<span class="chip bad">${fmt(spent - planned)} zyada</span>`; }
      else if (planned > 0 && used >= 90) { fillCls = 'warn'; chip = `<span class="chip warn">${pct(used)} used</span>`; }
      else if (spent > 0) { chip = `<span class="chip good">Bachat mein ✔</span>`; }
      return `
      <div class="catrow">
        <div class="catrow-head">
          <span class="cat-ico">${c.icon}</span>
          <div class="cat-body">
            <div class="cat-name">${c.name}</div>
            <div class="cat-meta">${planned > 0 ? 'Plan ' + fmt(planned) + ' · ' : ''}Hua ${fmt(spent)}</div>
          </div>
          ${chip}
        </div>
        <div class="progress"><div class="progress-fill ${fillCls}" style="width:${Math.min(100, used)}%"></div></div>
      </div>`;
    }).join('');

  const recent = (md.expenses || [])
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5)
    .map(tx => {
      const c = catById(tx.category);
      return `
      <div class="tx">
        <span class="tx-ico">${c.icon}</span>
        <div class="tx-body">
          <div class="tx-title">${c.name}</div>
          <div class="tx-sub">${tx.note ? esc(tx.note) + ' · ' : ''}${dateLabel(tx.date)}</div>
        </div>
        <div class="tx-amt neg">− ${fmt(tx.amount)}</div>
      </div>`;
    }).join('');

  const name = state.settings.name ? ', ' + esc(state.settings.name) : '';
  const overspendAlert = sTotal > salary * 0.9
    ? `<div class="tip tip-bad"><span class="tip-ico">🚨</span><div><div class="tip-title">Salary ka ${pct(spentPct)} kharch ho chuka!</div><div class="tip-text">Mahina abhi baaki hai — ab bilkul sirf zaroori kharche karein.</div></div></div>`
    : '';

  el.innerHTML = `
  <div class="card">
    <div class="row between">
      <div>
        <div class="small muted" style="font-weight:700">Namaste${name}! 👋</div>
        <div style="font-size:20px;font-weight:800">${monthLabel(selectedMonth)}</div>
      </div>
      <button class="btn ghost sm" data-action="open-wizard">✏️ Plan Edit</button>
    </div>
  </div>

  ${overspendAlert}

  <div class="statgrid">
    <div class="stat"><div class="stat-ico">💼</div><div class="stat-label">Salary</div><div class="stat-value">${fmt(salary)}</div></div>
    <div class="stat"><div class="stat-ico">🗺️</div><div class="stat-label">Planned Kharcha</div><div class="stat-value">${fmt(pTotal)}</div></div>
    <div class="stat"><div class="stat-ico">🧾</div><div class="stat-label">Ab Tak Kharcha</div><div class="stat-value neg">${fmt(sTotal)}</div></div>
    <div class="stat"><div class="stat-ico">💰</div><div class="stat-label">Bacha (Plan)</div><div class="stat-value ${leftover >= 0 ? 'pos' : 'neg'}">${fmt(leftover)}</div><div class="stat-sub">${pct(rate)} saving rate</div></div>
  </div>

  <div class="card">
    <div class="card-title">📉 Salary Kahan Gayi? <span class="chip ${spentPct > 90 ? 'bad' : spentPct > 70 ? 'warn' : 'good'}">${pct(spentPct)} used</span></div>
    <div class="progress" style="height:14px">
      <div class="progress-fill ${spentPct > 90 ? 'over' : ''}" style="width:${Math.min(100, spentPct)}%"></div>
      <div class="progress-mark" style="left:${planMarkPct}%" title="Total planned: ${fmt(pTotal)}"></div>
    </div>
    <div class="small muted mt8">Kali line = aapka total plan (${fmt(pTotal)}). Isse aage mat jaana! 😄</div>
  </div>

  <div class="card">
    <div class="card-title">🎯 Category Budgets</div>
    ${catRows || '<div class="empty">Koi category plan nahi hai — "Plan Edit" se add karein.</div>'}
  </div>

  ${goalsCardHtml()}

  ${tipOfDay ? `
  <div class="card">
    <div class="card-title">💡 Aaj Ki Salah</div>
    <div class="tips">
      <div class="tip tip-${tipOfDay.tone}"><span class="tip-ico">${tipOfDay.icon}</span>
        <div><div class="tip-title">${tipOfDay.title}</div><div class="tip-text">${tipOfDay.text}</div></div>
      </div>
    </div>
    <button class="btn ghost sm block mt8" data-action="goto-view" data-view="report">📊 Poori Report Dekhein</button>
  </div>` : ''}

  <div class="card">
    <div class="card-title">🧾 Recent Kharche</div>
    ${recent || '<div class="empty">Abhi koi kharcha add nahi hua.</div>'}
    <button class="btn ghost sm block mt8" data-action="goto-view" data-view="expense">➕ Kharcha Add Karein / Pura List</button>
  </div>

  <button class="btn gold block" data-action="goto-view" data-view="advice">💡 Aapke bacha hue ${fmt(leftover)} ko Invest kaise karein? — Salah Dekhein</button>
  `;
}

/* ---------------- EXPENSE ---------------- */
function renderExpense() {
  const el = document.getElementById('view-expense');
  const md = monthData(selectedMonth);
  if (!md) { el.innerHTML = noDataCard(); return; }

  const byCat = spentByCategory(md);
  const sTotal = spentTotal(md);

  const options = CATEGORIES.map(c =>
    `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

  const defaultDate = selectedMonth === monthKey(new Date())
    ? todayISO()
    : selectedMonth + '-01';

  const sorted = (md.expenses || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const groups = {};
  sorted.forEach(tx => { (groups[tx.date] = groups[tx.date] || []).push(tx); });
  const listHtml = Object.keys(groups).sort().reverse().map(d => `
    <div class="day-h">📅 ${dateLabel(d)}</div>
    ${groups[d].map(tx => {
      const c = catById(tx.category);
      return `
      <div class="tx">
        <span class="tx-ico">${c.icon}</span>
        <div class="tx-body">
          <div class="tx-title">${c.name}</div>
          ${tx.note ? `<div class="tx-sub">${esc(tx.note)}</div>` : ''}
        </div>
        <div class="tx-right">
          <div class="tx-amt neg">− ${fmt(tx.amount)}</div>
          <button class="delbtn" data-action="del-expense" data-id="${tx.id}" title="Delete">🗑️</button>
        </div>
      </div>`;
    }).join('')}`).join('');

  const summary = CATEGORIES
    .filter(c => (byCat[c.id] || 0) > 0)
    .sort((a, b) => (byCat[b.id] || 0) - (byCat[a.id] || 0))
    .map(c => `<span class="chip plain">${c.icon} ${c.name}: ${fmt(byCat[c.id])}</span>`)
    .join(' ');

  el.innerHTML = `
  <div class="card">
    <div class="card-title">🎤 Bolkar Kharcha Add Karein
      <button class="chip plain voice-lang" data-action="voice-lang" title="Voice ki bhasha badlein">${voiceLang === 'hi-IN' ? '🇮🇳 हिंदी' : '🇬🇧 English'}</button>
    </div>
    ${voiceSupported() ? `
    <div class="voice-box">
      <button class="mic-btn" id="micBtn" data-action="voice-toggle" title="Dabayein aur boliye">🎤</button>
      <div class="voice-status" id="voiceStatus">Dabayein aur boliye — <i>"aaj paanch sau ki sabzi"</i></div>
    </div>
    <div class="voice-preview hidden" id="voicePreview"></div>
    <div class="small muted mt8">Examples: "do hazaar petrol" · "zomato pe char sau" · "mahine ka kiraya das hazaar" · "dawai ke pachaanve"</div>
    ` : `<div class="small muted">Ye browser voice input support nahi karta (Chrome/Edge mein chalega) — koi baat nahi, neeche typing wala form hai. 📝</div>`}
  </div>

  <div class="card">
    <div class="card-title">➕ Kharcha Add Karein <span class="chip info">${monthLabel(selectedMonth)}</span></div>
    <form id="expForm">
      <div class="field">
        <label>Kitne paise kharch hue? (₹)</label>
        <input type="number" id="expAmount" min="1" step="10" inputmode="numeric" required placeholder="e.g. 250" autofocus>
      </div>
      <div class="grid2">
        <div class="field">
          <label>Category</label>
          <select id="expCat">${options}</select>
        </div>
        <div class="field">
          <label>Date</label>
          <input type="date" id="expDate" required value="${defaultDate}">
        </div>
      </div>
      <div class="field">
        <label>Note (optional)</label>
        <input type="text" id="expNote" maxlength="60" placeholder="e.g. Big Bazaar, Zomato...">
      </div>
      <button class="btn primary block" type="submit">➕ Add Karein</button>
    </form>
  </div>

  <div class="card">
    <div class="card-title">🧾 Is Mahine Ka Kharcha <span class="chip bad">Total: ${fmt(sTotal)}</span></div>
    ${summary ? `<div class="stack" style="flex-direction:row;flex-wrap:wrap;gap:6px;margin-bottom:12px">${summary}</div>` : ''}
    ${listHtml || '<div class="empty">Abhi koi kharcha add nahi hua. Upar se pehla kharcha daaliye! 👆</div>'}
  </div>`;
}

function handleExpenseSubmit(form) {
  const md = monthData(selectedMonth);
  if (!md) return;
  const amount = Number(form.querySelector('#expAmount').value);
  const category = form.querySelector('#expCat').value;
  const date = form.querySelector('#expDate').value;
  const note = form.querySelector('#expNote').value.trim();

  if (!amount || amount <= 0) { toast('Sahi amount daalein', 'error'); return; }
  if (!date.startsWith(selectedMonth)) { toast('Date ' + monthLabel(selectedMonth) + ' ke andar honi chahiye', 'error'); return; }

  md.expenses = md.expenses || [];
  md.expenses.push({ id: 'e' + Date.now() + Math.floor(Math.random() * 999), date, category, amount, note });
  saveState();

  const planned = (md.planned || {})[category] || 0;
  const spentNow = (spentByCategory(md)[category] || 0);
  const c = catById(category);
  if (planned > 0 && spentNow > planned) {
    toast(`⚠️ ${c.name} budget cross! Plan ${fmt(planned)} tha, ab ${fmt(spentNow)} ho gaya`, 'warn');
  } else {
    toast(`✔ ${c.name}: ${fmt(amount)} add ho gaya`, 'success');
  }
  renderAll();
  const amt = document.getElementById('expAmount');
  if (amt) { amt.value = ''; amt.focus(); }
}

function deleteExpense(id) {
  const md = monthData(selectedMonth);
  if (!md || !md.expenses) return;
  md.expenses = md.expenses.filter(e => e.id !== id);
  saveState();
  toast('Kharcha delete ho gaya', 'success');
  renderAll();
}

/* ---------------- REPORT ---------------- */
function renderReport() {
  const el = document.getElementById('view-report');
  const md = monthData(selectedMonth);
  if (!md) { el.innerHTML = noDataCard(); return; }

  const byCat = spentByCategory(md);
  const sTotal = spentTotal(md);
  const pTotal = plannedTotal(md);
  const salary = md.salary;
  const actualSaved = salary - sTotal;
  const actualRate = salary > 0 ? (actualSaved / salary) * 100 : 0;
  const planRate = salary > 0 ? ((salary - pTotal) / salary) * 100 : 0;

  /* --- Score card --- */
  let grade, gEmoji, gHead, tone;
  if (actualRate >= 30) { grade = 'A+'; gEmoji = '🏆'; gHead = 'Champion Saver! Salary ka ' + pct(actualRate) + ' bacha rahe hain.'; }
  else if (actualRate >= 20) { grade = 'A'; gEmoji = '🎉'; gHead = 'Achha Saver! ' + pct(actualRate) + ' saving — aise hi rakhein.'; }
  else if (actualRate >= 10) { grade = 'B'; gEmoji = '🙂'; gHead = 'Theek-Thaak. ' + pct(actualRate) + ' bacha — thoda aur kassein.'; }
  else if (actualRate >= 0) { grade = 'C'; gEmoji = '⚠️'; gHead = 'Sirf ' + pct(actualRate) + ' bacha. Kharche kaatne honge.'; }
  else { grade = 'D'; gEmoji = '🚨'; gHead = 'Salary se ZYADA kharch! Ghabraiye mat, plan karein.'; }

  /* --- Planned vs Actual rows --- */
  const paRows = CATEGORIES
    .filter(c => (md.planned[c.id] || 0) > 0 || (byCat[c.id] || 0) > 0)
    .map(c => {
      const planned = md.planned[c.id] || 0;
      const spent = byCat[c.id] || 0;
      const used = planned > 0 ? (spent / planned) * 100 : 100;
      let chip;
      if (planned > 0 && spent > planned) chip = `<span class="chip bad">${fmt(spent - planned)} zyada</span>`;
      else if (planned > 0 && used >= 90) chip = `<span class="chip warn">${pct(used)} used</span>`;
      else if (planned > 0) chip = `<span class="chip good">${pct(used)} used ✔</span>`;
      else chip = `<span class="chip warn">Plan hi nahi</span>`;
      return `
      <div class="catrow">
        <div class="catrow-head">
          <span class="cat-ico">${c.icon}</span>
          <div class="cat-body">
            <div class="cat-name">${c.name}</div>
            <div class="cat-meta">Plan ${fmt(planned)} · Hua ${fmt(spent)}</div>
          </div>
          ${chip}
        </div>
        <div class="progress"><div class="progress-fill ${spent > planned ? 'over' : used >= 90 ? 'warn' : ''}" style="width:${Math.min(100, used)}%"></div></div>
      </div>`;
    }).join('');

  /* --- Last month comparison --- */
  const lmKey = addMonths(selectedMonth, -1);
  const lm = monthData(lmKey);
  let compareHtml = '';
  if (lm) {
    const lmByCat = spentByCategory(lm);
    const lmTotal = spentTotal(lm);
    const rows = CATEGORIES
      .filter(c => (lmByCat[c.id] || 0) > 0 || (byCat[c.id] || 0) > 0)
      .map(c => {
        const prev = lmByCat[c.id] || 0, cur = byCat[c.id] || 0;
        const diff = cur - prev;
        const cls = diff > 0 ? 'neg' : diff < 0 ? 'pos' : 'muted';
        const sign = diff > 0 ? '+' : '';
        return `<tr>
          <td>${c.icon} ${c.name}</td>
          <td class="td-r">${fmt(prev)}</td>
          <td class="td-r">${fmt(cur)}</td>
          <td class="td-r ${cls}">${sign}${fmt(diff)}</td>
        </tr>`;
      }).join('');
    const totalDiff = sTotal - lmTotal;
    compareHtml = `
    <div class="card">
      <div class="card-title">🔄 ${monthLabel(lmKey)} vs ${monthLabel(selectedMonth)}</div>
      <div class="tip ${totalDiff <= 0 ? 'tip-good' : 'tip-bad'}" style="margin-bottom:12px">
        <span class="tip-ico">${totalDiff <= 0 ? '🎉' : '😟'}</span>
        <div><div class="tip-title">${totalDiff <= 0 ? 'Kharcha ' + fmt(Math.abs(totalDiff)) + ' KAM hai pichle mahine se!' : 'Kharcha ' + fmt(totalDiff) + ' ZYADA hai pichle mahine se'}</div>
        <div class="tip-text">Pichle mahine: ${fmt(lmTotal)} · Is mahine ab tak: ${fmt(sTotal)}${lmTotal > 0 ? ' (' + (totalDiff <= 0 ? '−' : '+') + Math.abs(Math.round(totalDiff / lmTotal * 100)) + '%)' : ''}</div></div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Category</th><th class="td-r">Pichle Mahine</th><th class="td-r">Is Mahine</th><th class="td-r">Farak</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty">Data nahi</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  } else {
    compareHtml = `
    <div class="card">
      <div class="card-title">🔄 Pichle Mahine Se Comparison</div>
      <div class="empty">Pichle mahine (${monthLabel(lmKey)}) ka data nahi hai. Agla mahina aane par yahan category-wise comparison dikhega — "is baar yahan save karein" wali salah ke saath. 📈</div>
    </div>`;
  }

  /* --- 6-month trend chart --- */
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const k = addMonths(selectedMonth, -i);
    const m = monthData(k);
    if (!m) continue;
    trend.push({ label: parseMonthKey(k).toLocaleString('en-IN', { month: 'short' }), salary: m.salary, spent: spentTotal(m), saved: m.salary - spentTotal(m) });
  }
  const maxSal = Math.max(1, ...trend.map(t => t.salary));
  const chartHtml = trend.length >= 2 ? `
  <div class="card">
    <div class="card-title">📈 6 Mahine Ka Trend</div>
    <div class="chart">
      ${trend.map(t => `
      <div class="chart-col">
        <div class="chart-bars">
          <div class="chart-bar spend" style="height:${Math.max(2, t.spent / maxSal * 100)}%" title="Kharcha: ${fmt(t.spent)}"></div>
          <div class="chart-bar save" style="height:${Math.max(2, Math.max(0, t.saved) / maxSal * 100)}%" title="Bacha: ${fmt(t.saved)}"></div>
        </div>
        <div class="chart-lab">${t.label}</div>
      </div>`).join('')}
    </div>
    <div class="legend"><span><span class="dot spend"></span>Kharcha</span><span><span class="dot save"></span>Bacha</span></div>
  </div>` : '';

  /* --- Insights --- */
  const insights = generateInsights(selectedMonth);
  const focus = insights.filter(t => t.tone === 'bad' || t.tone === 'warn').slice(0, 3);
  const insightsHtml = `
  <div class="card">
    <div class="card-title">🤖 PaisaGuru Ka Vishleshan</div>
    <div class="tips">
      ${insights.length ? insights.map(t => `
      <div class="tip tip-${t.tone}"><span class="tip-ico">${t.icon}</span>
        <div><div class="tip-title">${t.title}</div><div class="tip-text">${t.text}</div></div>
      </div>`).join('') : '<div class="empty">Abhi kuch khaas salah nahi — data badhte hi yahan analysis aayegi. 😊</div>'}
    </div>
  </div>`;

  el.innerHTML = `
  <div class="card score">
    <div class="score-badge">${gEmoji}</div>
    <div>
      <div class="score-title">Grade ${grade} — ${gHead}</div>
      <div class="small">Salary ${fmt(salary)} · Kharcha ${fmt(sTotal)} · Bacha ${fmt(actualSaved)} (${pct(actualRate)})<br>Plan ke hisaab se saving rate: ${pct(planRate)}</div>
    </div>
  </div>

  ${focus.length ? `
  <div class="card">
    <div class="card-title">🎯 Is Baar Yahan Paise Save Karein</div>
    <div class="tips">
      ${focus.map(t => `<div class="tip tip-${t.tone}"><span class="tip-ico">${t.icon}</span>
        <div><div class="tip-title">${t.title}</div><div class="tip-text">${t.text}</div></div></div>`).join('')}
    </div>
  </div>` : ''}

  <div class="card">
    <div class="card-title">📋 Plan vs Asli Kharcha</div>
    ${paRows || '<div class="empty">Koi plan ya kharcha nahi.</div>'}
  </div>

  ${compareHtml}
  ${chartHtml}
  ${insightsHtml}
  `;
}

/* ============================================================
   SALAH (ADVICE / INVESTMENT) VIEW
   ============================================================ */
const QUICK_OPTIONS = [
  { icon: '🏦', name: 'Fixed Deposit (FD)', time: '7 din – 5 saal', ret: '6.5 – 7.5% / saal', risk: 'Bahut kam', note: 'Bank ka guarantee, DICGC insurance ₹5L tak' },
  { icon: '💧', name: 'Liquid Mutual Fund', time: '1 – 3 din mein nikaal sakte hain', ret: '6 – 7% / saal', risk: 'Bahut kam', note: 'Savings account se better return, almost turant access' },
  { icon: '📜', name: 'Treasury Bill (T-Bill)', time: '91 / 182 / 364 din', ret: '~6.5 – 7% / saal', risk: 'Sarkar of India ka guarantee', note: 'RBI Retail Direct app se khareed sakte hain' },
  { icon: '🔁', name: 'Recurring Deposit (RD)', time: '6 mahine – 2 saal', ret: '6.5 – 7.5% / saal', risk: 'Bahut kam', note: 'Har mahine fixed amount auto-debit — paisa bachta hi jayega' },
  { icon: '⚖️', name: 'Arbitrage Fund', time: '3+ mahine', ret: '~7% / saal', risk: 'Kam', note: 'FD jaisa, par tax kaam lagta hai' },
];

function buildAllocation(leftover) {
  if (leftover <= 0) return [];
  const efDone = !!state.settings.emergencyDone;
  const base = efDone ? [
    { icon: '📈', name: 'Index Fund SIP (Nifty 50)', pct: 50, tag: 'Long Term', why: '5+ saal mein average ~12% return. Compounding ka asli jaadu — har mahine automatic invest hota rahega.' },
    { icon: '🏦', name: 'FD / T-Bill / Debt Fund', pct: 25, tag: 'Short Term', why: 'Safe 6-7%. 1-3 saal ke goals (phone, vacation) ke liye.' },
    { icon: '🥇', name: 'Gold (Sovereign Gold Bond)', pct: 15, tag: 'Hedge', why: 'Inflation se ladne wala asset — portfolio ko stable rakhta hai.' },
    { icon: '🧾', name: 'ELSS / PPF (Tax Saving)', pct: 10, tag: 'Tax Bachat', why: 'Section 80C mein ₹1.5L tak — sarkar ko kam, apne ghar ko zyada.' },
  ] : [
    { icon: '🛡️', name: 'Emergency Fund (Liquid Fund/Savings)', pct: 40, tag: 'Sabse Pehle', why: '3-6 mahine ka kharcha pehle jama karein. Bimari, job jaana, koi bhi emergency — yahi aapko bachayega.' },
    { icon: '📈', name: 'Index Fund SIP (Nifty 50)', pct: 35, tag: 'Long Term', why: 'Bacha hua paisa har mahine automatic invest — long term ~12% average return.' },
    { icon: '🏦', name: 'FD / T-Bill (Short Term)', pct: 15, tag: 'Short Term', why: '6-7% safe return, zarurat pade to turant nikaal sakte hain.' },
    { icon: '🥇', name: 'Gold (SGB / Gold ETF)', pct: 10, tag: 'Hedge', why: 'Thoda gold har portfolio mein hona hi chahiye.' },
  ];
  const cards = base.map(a => Object.assign({}, a, { amount: Math.floor(leftover * a.pct / 100) }));
  /* Rounding ka bacha hua paisa pehli (sabse badi) card ko — total EXACT leftover */
  const diff = leftover - sum(cards.map(c => c.amount));
  if (diff > 0 && cards.length) cards[0].amount += diff;
  return cards;
}

function sipFV(monthly, years, annualRate) {
  const i = annualRate / 12 / 100;
  const n = years * 12;
  if (i <= 0) return monthly * n;
  return monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
}

function renderAdvice() {
  const el = document.getElementById('view-advice');
  const md = monthData(selectedMonth);
  if (!md) { el.innerHTML = noDataCard(); return; }

  const salary = md.salary;
  const pTotal = plannedTotal(md);
  const leftover = salary - pTotal;
  const rate = salary > 0 ? (leftover / salary) * 100 : 0;
  const nw = needsWants(md);
  const target = emergencyTarget(selectedMonth);
  const saved = Number(state.settings.emergencySaved) || 0;
  const efPct = target > 0 ? Math.min(100, saved / target * 100) : 0;

  /* --- Emergency fund card --- */
  const efCard = `
  <div class="card">
    <div class="card-title">🛡️ Emergency Fund — Sabse Pehla Kadam <span class="chip ${state.settings.emergencyDone ? 'good' : 'warn'}">${state.settings.emergencyDone ? 'Done ✔' : 'Pending'}</span></div>
    <div class="muted small" style="margin-bottom:6px">Target: aapke 3 mahine ke zaroori kharche = <b>${fmt(target)}</b> (liquid fund ya savings account mein)</div>
    <div class="progress"><div class="progress-fill ${efPct >= 100 ? '' : 'warn'}" style="width:${efPct}%"></div></div>
    <div class="small muted mt8">Ab tak jama: <b>${fmt(saved)}</b> ${target > saved ? '· aur ' + fmt(target - saved) + ' chahiye' : '· 🎉 poora hai!'}</div>
    <button class="btn ghost sm block mt8" data-action="goto-view" data-view="settings">${state.settings.emergencyDone ? '↩️ Status badalna hai? Settings kholen' : '✅ Agar poora ho gaya hai to yahan se batayein'}</button>
  </div>`;

  if (leftover <= 0) {
    el.innerHTML = `
    <div class="card" style="border-left:4px solid var(--bad)">
      <div class="big-emoji">😨</div>
      <div class="hero-title">Invest karne ke liye kuch nahi bacha!</div>
      <div class="hero-text">Aapki salary ${fmt(salary)} hai aur planned kharcha ${fmt(pTotal)} — matlab plan hi itna bada hai ki bachat zero/negative hai. Pehle kharche kam karein, phir yahan wapas aayein. Neeche ki education phir bhi padh sakte hain. 🙂</div>
      <button class="btn primary block" data-action="goto-view" data-view="report">📊 Report Dekhein — Kahan Se Kaatein</button>
    </div>
    ${efCard}
    ${educationCards()}
    ${disclaimerHtml()}`;
    return;
  }

  const alloc = buildAllocation(leftover);

  /* --- SIP projection table --- */
  const projRows = [5, 10, 20].map(y => {
    const fv = sipFV(leftover, y, 12);
    const invested = leftover * 12 * y;
    return `<tr>
      <td><b>${y} saal</b></td>
      <td class="td-r">${fmt(invested)}</td>
      <td class="td-r pos"><b>${fmt(fv)}</b></td>
      <td class="td-r pos">+${fmt(fv - invested)}</td>
    </tr>`;
  }).join('');
  const fdOneYear = leftover * 12 * 1.07;

  /* --- 50-30-20 rule --- */
  const needsPct = salary > 0 ? nw.needsPlan / salary * 100 : 0;
  const wantsPct = salary > 0 ? nw.wantsPlan / salary * 100 : 0;
  const savePct = rate;
  const ruleRow = (label, val, ideal, ico) => `
  <div class="catrow">
    <div class="catrow-head">
      <span class="cat-ico">${ico}</span>
      <div class="cat-body"><div class="cat-name">${label}</div><div class="cat-meta">Ideal: ~${ideal}%</div></div>
      <span class="chip ${Math.abs(val - ideal) <= 7 ? 'good' : val > ideal ? 'warn' : 'info'}">Aapka: ${pct(val)}%</span>
    </div>
    <div class="progress"><div class="progress-fill ${val > ideal + 7 ? 'over' : val > ideal ? 'warn' : ''}" style="width:${Math.min(100, val)}%"></div><div class="progress-mark" style="left:${ideal}%"></div></div>
  </div>`;

  const ruleVerdict = needsPct > 60
    ? 'Zaroori kharche salary ke ' + pct(needsPct) + ' hain — thoda bhaari hai. Kiraya/EMI dekh kar samadhan nikalein.'
    : wantsPct > 35
      ? 'Shauq ke kharche ' + pct(wantsPct) + ' hain — yahi se sabse aasan bachat milegi! 🎯'
      : savePct >= 20
        ? 'Badhiya balance! Aap 50-30-20 rule ke kaafi kareeb hain. 🎉'
        : 'Bachat 20% se kam hai — kharchon mein se kuch kaat kar yahan laayein.';

  el.innerHTML = `
  <div class="card" style="background:linear-gradient(135deg,#0b6b5a,#149d7e);color:#fff">
    <div class="small" style="font-weight:700;opacity:.85">INVEST KARNE KE LIYE BACHA HUA (${monthLabel(selectedMonth)})</div>
    <div class="result-num">${fmt(leftover)}<span style="font-size:16px;font-weight:600;opacity:.85"> / mahina</span></div>
    <div class="small" style="opacity:.9">Salary ka ${pct(rate)} — ${rate >= 30 ? 'shaandaar! 🏆' : rate >= 20 ? 'accha hai 👍' : 'chalo, shuruaat to hui 🌱'}</div>
    <div class="small" style="opacity:.75;margin-top:6px">Neeche is paisa ka poora plan diya hai — category-wise. 📋</div>
  </div>

  ${efCard}

  <div class="card">
    <div class="card-title">🗺️ Aapke ${fmt(leftover)} Ka Smart Plan</div>
    <div class="alloc-grid">
      ${alloc.map(a => `
      <div class="alloc-card">
        <div class="alloc-head">
          <div style="display:flex;gap:10px;align-items:center">
            <span class="alloc-ico">${a.icon}</span>
            <div class="alloc-name">${a.name}</div>
          </div>
          <span class="tag">${a.tag}</span>
        </div>
        <div class="alloc-amt">${fmt(a.amount)} <span class="small muted" style="font-weight:600">(${a.pct}%)</span></div>
        <div class="alloc-why">${a.why}</div>
      </div>`).join('')}
    </div>
    <div class="small muted mt8">💡 Har mahine yahi routine: salary aaye → bacha hua auto-transfer invest ho jaye. "Pehle invest, phir kharch" — ulti aadat hi garibi ki jad hai!</div>
  </div>

  ${goalsPlanCardHtml(leftover)}

  <div class="card">
    <div class="card-title">⚡ Kam Waqt Mein Profit — Sahi Options</div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Option</th><th>Time</th><th>Return</th><th>Risk</th></tr></thead>
        <tbody>
          ${QUICK_OPTIONS.map(o => `<tr>
            <td><b>${o.icon} ${o.name}</b><br><span class="small muted">${o.note}</span></td>
            <td>${o.time}</td>
            <td><b>${o.ret}</b></td>
            <td class="small">${o.risk}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="honesty mt8">
      <b>⚠️ Sachai ye hai:</b> "1 mahine mein paisa double" — aisa koi jaadu nahi hota. Jo bhi aisa bole (crypto tips, day-trading group, "assured 50% return"), wo <b>99% scam hai</b>. Short-term mein market juwa hai. Asli ameer banna 5-20 saal ke SIP aur compounding se hota hai — neeche dekh kaise. 👇
    </div>
  </div>

  <div class="card">
    <div class="card-title">🔮 Agar Har Mahine ${fmt(leftover)} SIP Karhein (12% avg)</div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Period</th><th class="td-r">Aapne Lagaya</th><th class="td-r">Bana (12% avg)</th><th class="td-r">Munafa</th></tr></thead>
        <tbody>${projRows}</tbody>
      </table>
    </div>
    <div class="small muted mt8">📊 Compare: utna hi FD mein daalne par 1 saal mein ≈ ${fmt(fdOneYear)} (7% par). Equity ka fayda lambe samay mein hai — short mein market upar-neeche ho sakta hai.</div>
    <div class="scam mt8"><b>🚨 Yaad Rakhein:</b> SIP bhi market risk hai — 12% "average" hai, guarantee nahi. Jo "guaranteed 20-30%" bole, wo jhooth hai. Long term (5+ saal) mein hi equity ka asli fayda dikhta hai.</div>
  </div>

  <div class="card">
    <div class="card-title">⚖️ 50-30-20 Rule Se Aapka Check</div>
    ${ruleRow('🔴 Zaroori Kharche (Needs)', needsPct, 50, '🏠')}
    ${ruleRow('🟣 Shauq Ke Kharche (Wants)', wantsPct, 30, '🛍️')}
    ${ruleRow('💰 Bachat / Investment', savePct, 20, '💰')}
    <div class="tip tip-info mt8"><span class="tip-ico">🧠</span><div class="tip-text">${ruleVerdict}</div></div>
  </div>

  <div class="card">
    <div class="card-title">🧾 Tax Bachat Ki Salhein</div>
    <div class="tips">
      <div class="tip tip-info"><span class="tip-ico">🧾</span><div><div class="tip-title">Section 80C — ₹1.5L tak</div><div class="tip-text">ELSS mutual fund, PPF, LIC, EPF — in sab pe ₹1.5L tak invest karke taxable income kam karein. ELSS mein sirf 3 saal lock-in hai.</div></div></div>
      <div class="tip tip-info"><span class="tip-ico">👴</span><div><div class="tip-title">NPS — extra ₹50,000</div><div class="tip-text">80C ke alawa NPS mein ₹50K tak aur tax bachta hai (old regime mein). Retirement ki taiyari bhi ho jayegi.</div></div></div>
      <div class="tip tip-info"><span class="tip-ico">📊</span><div><div class="tip-title">Slab Check</div><div class="tip-text">Old vs new regime — apne investments dekh kar CA/online calculator se compare karein. Kabhi kabhi 20-30k ka farak padta hai.</div></div></div>
    </div>
  </div>

  ${disclaimerHtml()}`;
}

function educationCards() {
  return `
  <div class="card">
    <div class="card-title">⚡ Kam Waqt Mein Profit — Sahi Options</div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Option</th><th>Time</th><th>Return</th><th>Risk</th></tr></thead>
        <tbody>
          ${QUICK_OPTIONS.map(o => `<tr><td><b>${o.icon} ${o.name}</b><br><span class="small muted">${o.note}</span></td><td>${o.time}</td><td><b>${o.ret}</b></td><td class="small">${o.risk}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="honesty mt8"><b>⚠️ Sachai:</b> "1 mahine mein paisa double" nahi hota. Jo bole, wo scam hai. Asli wealth 5-20 saal ke SIP se banti hai.</div>
  </div>`;
}

function disclaimerHtml() {
  return `<div class="disclaimer">ℹ️ Ye salah general financial education hai, personalized investment advice nahi. Invest karne se pehle apni sthiti ke hisaab se SEBI-registered advisor se salah lein. App ka data sirf aapke browser mein save hota hai.</div>`;
}

/* ============================================================
   INSIGHTS ENGINE — app ka dimaag 🧠
   ============================================================ */
function generateInsights(key) {
  const md = monthData(key);
  const tips = [];
  if (!md) return tips;

  const salary = md.salary;
  const byCat = spentByCategory(md);
  const sTotal = spentTotal(md);
  const pTotal = plannedTotal(md);
  const leftover = salary - pTotal;
  const rate = salary > 0 ? (leftover / salary) * 100 : 0;

  /* 1. Saving rate verdict */
  if (rate >= 30) tips.push({ tone: 'good', icon: '🏆', title: 'Saving Rate ' + pct(rate) + ' — Champion level!', text: 'Salary ka 30%+ bacha rahe hain. Aise hi rakhein — 10 saal mein aap khud hairan ho jayenge compounding dekh kar.' });
  else if (rate >= 20) tips.push({ tone: 'good', icon: '👍', title: 'Saving Rate ' + pct(rate) + ' — Achha hai!', text: '20-30% saving bahut log nahi kar paate. Thoda aur kassein to 30% club join ho jayenge.' });
  else if (rate >= 10) tips.push({ tone: 'warn', icon: '🙂', title: 'Saving Rate ' + pct(rate) + ' — Chal sakta hai behtar', text: 'Har 10% saving aapke future ka insurance hai. Kharchon mein se 1-2 category kassiye.' });
  else tips.push({ tone: 'bad', icon: '🚨', title: 'Saving Rate sirf ' + pct(rate) + '!', text: 'Plan hi itna bada hai ki kuch nahi bach raha. Zaroori kharche rakhein, shauq wale kam karein — warna salary khatam, savings zero.' });

  /* 2. Category over-budget warnings */
  CATEGORIES.forEach(c => {
    const planned = (md.planned || {})[c.id] || 0;
    const spent = byCat[c.id] || 0;
    if (planned > 0 && spent > planned * 1.1 && spent - planned >= 200) {
      tips.push({ tone: 'bad', icon: c.icon, title: c.name + ' budget se bahar!', text: 'Plan ' + fmt(planned) + ' tha, ab tak ' + fmt(spent) + ' ho gaya (' + fmt(spent - planned) + ' zyada). Is month aage is category mein ruk jayein.' });
    } else if (planned > 0 && spent > planned * 0.9 && spent <= planned) {
      tips.push({ tone: 'warn', icon: c.icon, title: c.name + ' budget ke kinare par', text: pct(spent / planned * 100) + ' budget use ho chuka hai. Ab dhyan se kharch karein.' });
    }
  });

  /* 3. Rent ratio */
  const rent = byCat.rent || (md.planned || {}).rent || 0;
  if (rent > salary * 0.3) {
    tips.push({ tone: 'warn', icon: '🏠', title: 'Kiraya salary ka ' + pct(rent / salary * 100) + ' hai', text: 'Ideal: 30% se kam. Agar possible ho to chhota/ehta ghar lein — yahi sabse badi bachat ban sakti hai.' });
  }

  /* 4. Wants share */
  const nw = needsWants(md);
  if (nw.wantsPlan > salary * 0.3) {
    tips.push({ tone: 'warn', icon: '🛍️', title: 'Shauq ke kharche ' + pct(nw.wantsPlan / salary * 100) + ' hain', text: 'Rule of thumb: shauq (shopping, bahar khana, entertainment) 30% se kam. Yahi categories sabse aasan bachat hai.' });
  }

  /* 5. Spending pace (sirf current month) */
  if (key === monthKey(new Date())) {
    const now = new Date();
    const dayFrac = now.getDate() / daysInMonth(key);
    const spentFrac = salary > 0 ? sTotal / salary : 0;
    if (spentFrac > dayFrac * 1.15 && sTotal > 1000) {
      tips.push({ tone: 'warn', icon: '🏃', title: 'Kharcha tez chal raha hai!', text: 'Mahine ka sirf ' + pct(dayFrac * 100) + ' beetā hai, par kharcha ' + pct(spentFrac * 100) + ' ho chuka. Pace dheemi karein warna mahina lamba laguega.' });
    }
  }

  /* 6. Month-over-month comparison */
  const lmKey = addMonths(key, -1);
  const lm = monthData(lmKey);
  if (lm) {
    const lmByCat = spentByCategory(lm);
    const lmTotal = spentTotal(lm);
    if (lmTotal > 0 && sTotal > 0) {
      const diff = sTotal - lmTotal;
      if (diff < -1000) tips.push({ tone: 'good', icon: '🎉', title: 'Pichle mahine se ' + fmt(-diff) + ' kam kharch!', text: monthLabel(lmKey) + ' mein ' + fmt(lmTotal) + ' gaya tha, is baar ab tak ' + fmt(sTotal) + '. Yahi rhythm rakhein!' });
      else if (diff > lmTotal * 0.15 && diff > 1000) tips.push({ tone: 'warn', icon: '📈', title: 'Kharcha badh raha hai', text: 'Pichle mahine se ' + fmt(diff) + ' (' + pct(diff / lmTotal * 100) + ') zyada kharch ho chuka hai. Kya badla hai? Report mein category-wise dekhein.' });
    }
    CATEGORIES.forEach(c => {
      const prev = lmByCat[c.id] || 0;
      const cur = byCat[c.id] || 0;
      if (prev >= 1000 && cur > prev * 1.25) {
        tips.push({ tone: 'warn', icon: c.icon, title: c.name + ' pichle mahine se zyada', text: monthLabel(lmKey) + ' mein ' + fmt(prev) + ' tha, is baar ' + fmt(cur) + ' (' + pct((cur - prev) / prev * 100) + ' zyada). Yahi category kassein — yahin se ' + fmt(cur - prev) + ' bachega.' });
      } else if (prev >= 1000 && cur > 0 && cur < prev * 0.75) {
        tips.push({ tone: 'good', icon: c.icon, title: c.name + ' mein ' + fmt(prev - cur) + ' ki bachat!', text: 'Pichle mahine ' + fmt(prev) + ' tha, ab tak ' + fmt(cur) + '. Aise hi control mein rakhein. 👏' });
      }
    });
  }

  /* 7. Emergency fund */
  if (!state.settings.emergencyDone) {
    const target = emergencyTarget(key);
    if (target > 0) {
      tips.push({ tone: 'info', icon: '🛡️', title: 'Emergency fund abhi adhoora hai', text: 'Aapke 3 mahine ke zaroori kharche ≈ ' + fmt(target) + '. Pehle itna liquid fund/savings mein jama karein, uske baad hi investment par dhyan dein — warna emergency mein invested paisa hi kaatna padega.' });
    }
  }

  /* 8. Overspend vs salary */
  if (sTotal > salary) {
    tips.push({ tone: 'bad', icon: '🚨', title: 'Salary se zyada kharch ho gaya!', text: 'Ab tak ' + fmt(sTotal) + ' kharch hai, salary ' + fmt(salary) + '. Agla mahina plan ke saath shuru karein — warna credit card/loan ka jaal shuru ho jayega.' });
  }

  /* 9. Goals */
  const goals = state.goals || [];
  const act = goals.filter(g => (g.saved || 0) < g.target);
  if (act.length) {
    const g0 = act[0];
    tips.push({
      tone: 'info', icon: '🎯',
      title: 'Goal: ' + g0.name + ' — ' + fmt(goalMonthly(g0)) + '/mahina',
      text: 'Target ' + fmt(g0.target) + ', ab tak ' + fmt(g0.saved || 0) + ' jama. Har mahine itna is goal ke liye ALAG rakhein' + (act.length > 1 ? ' (aur ' + (act.length - 1) + ' goal baaki hain)' : '') + '.'
    });
    const need = sum(act.map(goalMonthly));
    if (need > leftover && leftover > 0) {
      tips.push({ tone: 'warn', icon: '🎯', title: 'Goals vs Bachat ka hisaab', text: 'Sab goals ke liye ' + fmt(need) + '/mahina chahiye, par plan ke hisaab se sirf ' + fmt(leftover) + ' bach raha hai. Deadline badhaiye ya targets chhote karein.' });
    }
  }

  return tips;
}

/* ============================================================
   SALARY → PLAN WIZARD
   ============================================================ */
function openWizard() {
  const md = monthData(selectedMonth);
  wiz = {
    step: 1,
    salary: md ? md.salary : '',
    salaryDate: md && md.salaryDate ? md.salaryDate
      : (selectedMonth === monthKey(new Date()) ? todayISO() : selectedMonth + '-01'),
    planned: md ? Object.assign({}, md.planned) : {}
  };
  document.getElementById('wizardOverlay').classList.remove('hidden');
  renderWizard();
}

function closeWizard() {
  document.getElementById('wizardOverlay').classList.add('hidden');
  wiz = null;
}

function planSuggestion(catId) {
  const lm = monthData(addMonths(selectedMonth, -1));
  if (!lm) return null;
  const spent = (spentByCategory(lm)[catId] || 0);
  if (spent <= 0) return null;
  return Math.ceil(spent / 100) * 100;
}

function renderWizard() {
  const modal = document.getElementById('wizardModal');
  if (!wiz) return;
  if (wiz.step === 1) modal.innerHTML = wizardStep1();
  else if (wiz.step === 2) { modal.innerHTML = wizardStep2(); updateWizardSummary(); }
  else modal.innerHTML = wizardStep3();
}

function wizardStep1() {
  return `
  <div class="wiz-head">
    <div class="wiz-step">STEP 1 / 3</div>
    <h2>💵 Salary Received!</h2>
    <p class="muted">${monthLabel(selectedMonth)} ki salary aa gayi? Badhiya! Pehle batayein kitni aayi — phir saath milkar poora plan banayenge. 🤝</p>
  </div>
  <form id="wizSalaryForm">
    <div class="field">
      <label>Salary / Amdani (₹)</label>
      <input type="number" id="wizSalary" min="1" step="500" inputmode="numeric" required placeholder="e.g. 50000" value="${wiz.salary || ''}" autofocus>
    </div>
    <div class="field">
      <label>Salary Aane Ki Date</label>
      <input type="date" id="wizSalaryDate" required value="${wiz.salaryDate}">
    </div>
    <button class="btn primary block" type="submit">Agla Step ➡️ Kharcha Ka Plan</button>
    <button class="btn ghost sm block mt8" type="button" data-action="close-wizard">Cancel</button>
  </form>`;
}

function wizardStep2() {
  const lmKey = addMonths(selectedMonth, -1);
  const hasLast = !!monthData(lmKey);
  const rowsFor = type => CATEGORIES.filter(c => c.type === type).map(c => {
    const sug = planSuggestion(c.id);
    const v = wiz.planned[c.id];
    return `
    <div class="plan-row">
      <label for="pl-${c.id}"><span class="plan-ico">${c.icon}</span><span class="plan-nm">${c.name}</span></label>
      <input type="number" class="plan-in" id="pl-${c.id}" data-cat="${c.id}" min="0" step="100" inputmode="numeric" placeholder="${sug ? 'Sug: ' + fmt(sug) : '0'}" value="${v ? v : ''}">
    </div>`;
  }).join('');

  return `
  <div class="wiz-head">
    <div class="wiz-step">STEP 2 / 3</div>
    <h2>🗺️ Is Mahine Paisa Kaha-Kaha Kharch Hoga?</h2>
    <p class="muted">Har category ka andaza likhiye — jitna sahi likhenge, utni hi sahi salah milegi. ${hasLast ? 'Maine <b>' + monthLabel(lmKey) + '</b> ke kharche se suggestion bhar diye hain, aap badal sakte hain.' : 'Jo categories is mahine relevant nahi hain, khaali chhod dijiye.'}</p>
  </div>
  <div class="plan-sec-title red">🔴 Zaroori Kharche (Needs)</div>
  ${rowsFor('need')}
  <div class="plan-sec-title purple">🟣 Shauq Ke Kharche (Wants)</div>
  ${rowsFor('want')}
  <div class="wiz-summary">
    <div class="sumline"><span>💼 Salary</span><b id="sumSalary"></b></div>
    <div class="sumline"><span>🗺️ Total Plan</span><b id="sumPlan"></b></div>
    <div class="sumline big"><span>💰 Bacha Hua</span><b id="sumLeft"></b></div>
    <button class="btn primary block" data-action="wiz-complete">✅ Planning Complete Karein</button>
    <button class="btn ghost sm block" data-action="wiz-back">⬅️ Wapas</button>
  </div>`;
}

function updateWizardSummary() {
  if (!wiz) return;
  const pTotal = sum(Object.values(wiz.planned));
  const left = wiz.salary - pTotal;
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('sumSalary', fmt(wiz.salary));
  set('sumPlan', fmt(pTotal));
  const el = document.getElementById('sumLeft');
  if (el) {
    el.textContent = fmt(left) + (wiz.salary > 0 ? ' (' + pct(left / wiz.salary * 100) + ')' : '');
    el.className = left >= 0 ? 'pos' : 'neg';
  }
}

function wizardStep3() {
  const pTotal = sum(Object.values(wiz.planned));
  const leftover = wiz.salary - pTotal;
  const rate = wiz.salary > 0 ? (leftover / wiz.salary) * 100 : 0;

  let verdict;
  if (rate >= 30) verdict = '🏆 Champion plan! Salary ka ' + pct(rate) + ' bacha rahe hain — compounding aapko ameer banayegi.';
  else if (rate >= 20) verdict = '👍 Solid plan — ' + pct(rate) + ' saving. Aise hi chalta raho to 10 saal mein game badal jayega.';
  else if (rate >= 10) verdict = '🙂 Theek hai — ' + pct(rate) + ' saving. Kuch categories kassen to 20%+ ho jayega.';
  else verdict = '🚨 Ye plan bahut tight hai — sirf ' + pct(rate) + ' bach raha hai. Kuch shauq wale kharche kaatne padenge.';

  const lmKey = addMonths(selectedMonth, -1);
  const lm = monthData(lmKey);
  let recap = '';
  if (lm) {
    const lmByCat = spentByCategory(lm);
    const lmTotal = spentTotal(lm);
    const topCat = CATEGORIES.filter(c => (lmByCat[c.id] || 0) > 0).sort((a, b) => (lmByCat[b.id] || 0) - (lmByCat[a.id] || 0))[0];
    if (topCat) {
      recap = `
      <div class="tip tip-info" style="margin-bottom:14px">
        <span class="tip-ico">📋</span>
        <div><div class="tip-title">Pichle Mahine (${monthLabel(lmKey)}) Ki Report</div>
        <div class="tip-text">Total ${fmt(lmTotal)} kharch hua tha. Sabse zyada ${topCat.icon} ${topCat.name} (${fmt(lmByCat[topCat.id])}). <b>Is baar yahi category thoda kassein — wahin se sabse zyada bachat hogi!</b></div></div>
      </div>`;
    }
  }

  const alloc = buildAllocation(leftover);
  const goalsLine = activeGoals().length ? `
  <div class="tip tip-info" style="margin-bottom:14px">
    <span class="tip-ico">🎯</span>
    <div><div class="tip-title">Goals yaad hain?</div>
    <div class="tip-text">${activeGoals().map(g => esc(g.name) + ' (' + fmt(goalMonthly(g)) + '/mo)').join(' · ')} — inke liye bhi bachat mein se alag paisa rakhein.</div></div>
  </div>` : '';

  return `
  <div class="wiz-head">
    <div class="wiz-step">STEP 3 / 3</div>
    <h2>✅ Plan Ready!</h2>
  </div>
  ${leftover > 0 ? `
  <div class="center">
    <div class="small muted" style="font-weight:700">INVEST KARNE KE LIYE BACHA HUA</div>
    <div class="result-num pos">${fmt(leftover)}</div>
    <div class="small muted">${pct(rate)} saving rate</div>
  </div>
  <div class="verdict center muted">${verdict}</div>
  ${recap}
  ${goalsLine}
  <div class="alloc-grid">
    ${alloc.map(a => `
    <div class="alloc-card">
      <div class="alloc-head">
        <div style="display:flex;gap:10px;align-items:center"><span class="alloc-ico">${a.icon}</span><div class="alloc-name">${a.name}</div></div>
        <span class="tag">${a.tag}</span>
      </div>
      <div class="alloc-amt">${fmt(a.amount)} <span class="small muted" style="font-weight:600">(${a.pct}%)</span></div>
    </div>`).join('')}
  </div>
  <div class="stack mt8">
    <button class="btn gold block" data-action="goto-view" data-view="advice">💡 Poori Investment Salah Dekhein</button>
    <button class="btn primary block" data-action="close-wizard">✅ Done — Ghar Chalein</button>
  </div>` : `
  <div class="big-emoji">😅</div>
  <div class="hero-title center">Bachat: ${fmt(leftover)}</div>
  <div class="verdict center muted">${verdict}</div>
  ${recap}
  <div class="stack">
    <button class="btn ghost block" data-action="wiz-back">⬅️ Plan Thoda Kaam Karein</button>
    <button class="btn primary block" data-action="close-wizard">Theek hai, aise hi save karein</button>
  </div>`}`;
}

function wizardNext() {
  if (!wiz || wiz.step !== 1) return;
  const sal = Number(document.getElementById('wizSalary').value);
  const dt = document.getElementById('wizSalaryDate').value;
  if (!sal || sal <= 0) { toast('Pehle sahi salary amount daalein 🙂', 'error'); return; }
  if (!dt || !dt.startsWith(selectedMonth)) { toast('Date ' + monthLabel(selectedMonth) + ' ke andar honi chahiye', 'error'); return; }
  wiz.salary = sal;
  wiz.salaryDate = dt;
  wiz.step = 2;
  renderWizard();
}

function wizardBack() {
  if (!wiz || wiz.step !== 2) return;
  wiz.step = 1;
  renderWizard();
}

function wizardComplete() {
  if (!wiz || wiz.step !== 2) return;
  const pTotal = sum(Object.values(wiz.planned));
  if (pTotal <= 0) { toast('Kam se kam ek category mein amount daalein', 'error'); return; }
  if (pTotal > wiz.salary) toast('⚠️ Plan salary se bada hai — bachat negative mein hai!', 'warn');

  const existing = monthData(selectedMonth);
  state.months[selectedMonth] = {
    salary: wiz.salary,
    salaryDate: wiz.salaryDate,
    planned: Object.assign({}, wiz.planned),
    expenses: existing ? (existing.expenses || []) : []
  };
  saveState();
  wiz.step = 3;
  renderWizard();
  renderAll();
}

/* ============================================================
   SETTINGS
   ============================================================ */
function renderSettings() {
  const el = document.getElementById('view-settings');
  const s = state.settings;
  const monthCount = Object.keys(state.months).length;

  el.innerHTML = `
  <div class="card">
    <div class="card-title">👤 Aapki Jankari</div>
    <form id="settingsForm">
      <div class="field">
        <label>Naam (app isi se greet karegi)</label>
        <input type="text" id="setName" maxlength="30" placeholder="e.g. Ritesh" value="${esc(s.name)}">
      </div>
      <div class="field">
        <label>Emergency fund mein ab tak kitna jama hai? (₹)</label>
        <input type="number" id="setEmergency" min="0" step="500" inputmode="numeric" value="${Number(s.emergencySaved) || 0}">
      </div>
      <button class="btn primary block" type="submit">💾 Save Karein</button>
    </form>
    <div class="divider"></div>
    <button class="btn ${s.emergencyDone ? 'ghost' : 'primary'} block" data-action="toggle-emergency">
      ${s.emergencyDone ? '↩️ Emergency fund abhi ban raha hai (status wapas kholen)' : '✅ Emergency fund poora ban gaya hai (3-6 mahine ka)'}
    </button>
    ${s.emergencyDone ? '<div class="small muted mt8 center">Done hone par investment plan emergency fund ko chhod kar banega.</div>' : ''}
  </div>

  <div class="card">
    <div class="card-title">💾 Data — ${monthCount} mahine · ${(state.goals || []).length} goals</div>
    <div class="stack">
      <div class="small muted">Sab data sirf aapke browser (localStorage) mein hai — koi server nahi, koi tracking nahi. Backup ke liye export kar lein.</div>
      <div class="row gap" style="flex-wrap:wrap">
        <button class="btn ghost sm" data-action="export-data">⬇️ Backup Export (JSON)</button>
        <button class="btn ghost sm" data-action="click-import">⬆️ Backup Import</button>
        <button class="btn ghost sm" data-action="load-demo">🎬 Demo Data</button>
        <button class="btn danger sm" data-action="clear-data">🗑️ Sab Delete</button>
      </div>
      <input type="file" id="importFile" accept="application/json" class="hidden">
    </div>
  </div>

  <div class="card">
    <div class="card-title">ℹ️ PaisaGuru Ke Baare Mein</div>
    <div class="small muted stack">
      <div>💰 <b>PaisaGuru</b> — Monthly Expense Tracker & Smart Saving Advisor</div>
      <div>Salary aaye → plan banaye → jo bache use invest kare → har mahine analysis se better kare. Ye poori app offline chalti hai, data aapke paas rehta hai.</div>
      <div>🎤 Voice input (Chrome/Edge) · 🎯 Savings Goals · 📊 Monthly analysis · 💡 Investment salah</div>
      <div>Version 1.1 · Banaya gaya ❤️ se — aam logon ke liye, jo salary aate hi paisa kharch kar dete hain.</div>
    </div>
  </div>
  ${disclaimerHtml()}`;
}

function saveSettingsForm() {
  state.settings.name = (document.getElementById('setName').value || '').trim();
  state.settings.emergencySaved = Number(document.getElementById('setEmergency').value) || 0;
  saveState();
  toast('Settings save ho gayi ✔', 'success');
  renderAll();
}

function toggleEmergency() {
  state.settings.emergencyDone = !state.settings.emergencyDone;
  saveState();
  toast(state.settings.emergencyDone
    ? '🛡️ Badhiya! Ab investment plan emergency fund ko chhod kar banega'
    : 'Theek hai — emergency fund phir priority list mein aa gaya', 'success');
  renderAll();
}

function exportData() {
  try {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'paisaguru-backup-' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast('Backup file download ho rahi hai 📥', 'success');
  } catch (e) { toast('Export nahi ho paya: ' + e.message, 'error'); }
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object' || !parsed.months) throw new Error('Is file mein PaisaGuru ka data nahi hai');
      state = { months: parsed.months, goals: Array.isArray(parsed.goals) ? parsed.goals : [], settings: Object.assign(defaultState().settings, parsed.settings || {}) };
      saveState();
      selectedMonth = monthKey(new Date());
      renderAll();
      toast('Backup import ho gaya ✔', 'success');
    } catch (e) {
      toast('Import fail: ' + e.message, 'error');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  state = defaultState();
  saveState();
  selectedMonth = monthKey(new Date());
  renderAll();
  toast('Saara data delete ho gaya — fresh start! 🌱', 'success');
}

/* ============================================================
   DEMO DATA — current + pichle 2 mahine ka realistic sample
   (Dynamic: hamesha aaj ke mahine ke hisaab se banta hai)
   ============================================================ */
function loadDemoData() {
  let idc = 1;
  const iso = (key, day) => key + '-' + String(Math.min(day, daysInMonth(key))).padStart(2, '0');
  const E = (key, day, cat, amount, note) => ({ id: 'demo' + (idc++), date: iso(key, day), category: cat, amount, note });

  const cur = monthKey(new Date());
  const m1 = addMonths(cur, -1);
  const m2 = addMonths(cur, -2);
  const todayD = new Date().getDate();

  /* Current month ke expenses sirf aaj tak (realistic pace) */
  const onlyTillToday = arr => arr.filter(e => Number(e.date.slice(8, 10)) <= todayD);

  const state2 = { months: {}, goals: [{ id: 'demogoal1', icon: '📱', name: 'Naya Phone', target: 40000, saved: 12000, deadline: addMonths(cur, 4) + '-28' }], settings: { name: '', emergencyDone: false, emergencySaved: 5000 } };

  /* ---- Mahina -2: normal month ---- */
  state2.months[m2] = {
    salary: 50000, salaryDate: iso(m2, 1),
    planned: { rent: 10000, grocery: 9000, bills: 2500, medical: 1500, transport: 3000, recharge: 500, shopping: 6000, eatingout: 4000, entertainment: 2000, others: 1000 },
    expenses: [
      E(m2, 1, 'rent', 10000, 'Ghar ka kiraya'),
      E(m2, 3, 'grocery', 4300, 'Big Bazaar'),
      E(m2, 5, 'bills', 2400, 'Bijli ka bill'),
      E(m2, 6, 'shopping', 5200, 'Nayi shirt aur shoes'),
      E(m2, 9, 'eatingout', 1800, 'Zomato'),
      E(m2, 12, 'transport', 1500, 'Petrol'),
      E(m2, 15, 'grocery', 3200, 'Sabzi + rashan'),
      E(m2, 16, 'entertainment', 1200, 'Movie'),
      E(m2, 19, 'eatingout', 1600, 'Family dinner'),
      E(m2, 21, 'shopping', 4300, 'Sale ki shopping'),
      E(m2, 24, 'transport', 1800, 'Petrol + auto'),
      E(m2, 26, 'medical', 500, 'Dawa'),
      E(m2, 27, 'recharge', 500, 'Mobile recharge'),
      E(m2, 28, 'eatingout', 1800, 'Cafe'),
      E(m2, 29, 'grocery', 2300, 'Mahine ka rashan'),
      E(m2, 30, 'others', 1800, 'Ghar ka saman'),
    ]
  };

  /* ---- Pichla mahina: shopping phat gayi ---- */
  state2.months[m1] = {
    salary: 50000, salaryDate: iso(m1, 1),
    planned: { rent: 10000, grocery: 9000, bills: 2500, medical: 1500, transport: 3000, recharge: 500, shopping: 7000, eatingout: 4000, entertainment: 2000, others: 1000 },
    expenses: [
      E(m1, 1, 'rent', 10000, 'Ghar ka kiraya'),
      E(m1, 3, 'grocery', 3600, 'Rashan'),
      E(m1, 5, 'bills', 2600, 'Bijli + paani'),
      E(m1, 7, 'shopping', 6300, 'Amazon sale'),
      E(m1, 9, 'eatingout', 1500, 'Swiggy'),
      E(m1, 10, 'transport', 1600, 'Petrol'),
      E(m1, 14, 'grocery', 3400, 'Sabzi + rashan'),
      E(m1, 15, 'entertainment', 1400, 'Movie + popcorn'),
      E(m1, 17, 'eatingout', 1700, 'Weekend dinner'),
      E(m1, 19, 'medical', 1100, 'Checkup'),
      E(m1, 21, 'shopping', 6300, 'Clothes sale'),
      E(m1, 23, 'transport', 1700, 'Petrol + cab'),
      E(m1, 25, 'eatingout', 1400, 'Cafe'),
      E(m1, 27, 'recharge', 500, 'Mobile recharge'),
      E(m1, 28, 'grocery', 3100, 'Mahine ka rashan'),
      E(m1, 29, 'others', 900, 'Misc'),
    ]
  };

  /* ---- Current mahina: salary badhi, sambhal ke chala ---- */
  state2.months[cur] = {
    salary: 52000, salaryDate: iso(cur, 1),
    planned: { rent: 10000, grocery: 9000, bills: 2500, medical: 1500, transport: 3000, recharge: 1000, shopping: 5000, eatingout: 3000, entertainment: 2000, others: 1000 },
    expenses: onlyTillToday([
      E(cur, 1, 'rent', 10000, 'Ghar ka kiraya'),
      E(cur, 2, 'grocery', 3800, 'Big Bazaar'),
      E(cur, 4, 'bills', 2600, 'Bijli ka bill'),
      E(cur, 8, 'shopping', 3100, 'Amazon order'),
      E(cur, 10, 'eatingout', 1300, 'Swiggy'),
      E(cur, 11, 'transport', 1300, 'Petrol'),
      E(cur, 13, 'grocery', 2900, 'Rashan'),
      E(cur, 16, 'medical', 900, 'Dawa'),
      E(cur, 18, 'recharge', 1000, 'Recharge + WiFi'),
      E(cur, 20, 'eatingout', 1500, 'Dinner'),
      E(cur, 21, 'entertainment', 1200, 'Movie'),
      E(cur, 22, 'transport', 1300, 'Petrol'),
      E(cur, 24, 'grocery', 2000, 'Sabzi'),
    ])
  };

  state = state2;
  selectedMonth = monthKey(new Date());
  saveState();
  renderAll();
  toast('Demo data load ho gaya! 🎬 Report aur Salah tab zaroor dekhein', 'success');
}

/* ============================================================
   TOAST & CONFIRM
   ============================================================ */
function toast(msg, type) {
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2700);
  setTimeout(() => t.remove(), 3100);
}

function showConfirm(msg, cb) {
  document.getElementById('confirmMsg').textContent = msg;
  confirmCb = cb;
  document.getElementById('confirmOverlay').classList.remove('hidden');
}
function hideConfirm() {
  document.getElementById('confirmOverlay').classList.add('hidden');
  confirmCb = null;
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  switch (a) {
    case 'goto-view': switchView(t.dataset.view); break;
    case 'prev-month': shiftMonth(-1); break;
    case 'next-month': shiftMonth(1); break;
    case 'open-wizard': openWizard(); break;
    case 'close-wizard': closeWizard(); break;
    case 'wiz-next': wizardNext(); break;
    case 'wiz-back': wizardBack(); break;
    case 'wiz-complete': wizardComplete(); break;
    case 'del-expense': deleteExpense(t.dataset.id); break;
    case 'voice-toggle':
      if (recog) { try { recog.stop(); } catch (err) {} }
      else startVoice();
      break;
    case 'voice-lang':
      voiceLang = voiceLang === 'hi-IN' ? 'en-IN' : 'hi-IN';
      renderAll();
      toast('Voice language: ' + (voiceLang === 'hi-IN' ? 'हिंदी 🇮🇳' : 'English 🇬🇧'), 'success');
      break;
    case 'voice-apply': handleExpenseSubmit(document.getElementById('expForm')); break;
    case 'goal-new': openGoalModal(); break;
    case 'goal-contrib': openContribModal(t.dataset.id); break;
    case 'goal-del': deleteGoal(t.dataset.id); break;
    case 'close-goal': closeGoalModal(); break;
    case 'toggle-emergency': toggleEmergency(); break;
    case 'export-data': exportData(); break;
    case 'click-import': {
      const f = document.getElementById('importFile');
      if (f) f.click();
      break;
    }
    case 'load-demo':
      showConfirm('Demo data load karne se aapka current data REPLACE ho jayega. Continue?', loadDemoData);
      break;
    case 'clear-data':
      showConfirm('SAARA data permanently delete ho jayega. Pakka?', clearAllData);
      break;
    case 'confirm-yes': {
      const cb = confirmCb;
      hideConfirm();
      if (cb) cb();
      break;
    }
    case 'confirm-no': hideConfirm(); break;
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'expForm') handleExpenseSubmit(e.target);
  else if (e.target.id === 'wizSalaryForm') wizardNext();
  else if (e.target.id === 'settingsForm') saveSettingsForm();
  else if (e.target.id === 'goalForm') saveGoalForm(e.target);
  else if (e.target.id === 'contribForm') addContribution(e.target);
});

document.addEventListener('input', e => {
  if (e.target.classList && e.target.classList.contains('plan-in') && wiz) {
    const cat = e.target.dataset.cat;
    const v = Number(e.target.value) || 0;
    if (v > 0) wiz.planned[cat] = v;
    else delete wiz.planned[cat];
    updateWizardSummary();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'importFile' && e.target.files && e.target.files[0]) {
    importData(e.target.files[0]);
    e.target.value = '';
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeWizard(); hideConfirm(); closeGoalModal(); }
});

document.getElementById('wizardOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeWizard();
});
document.getElementById('confirmOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) hideConfirm();
});
document.getElementById('goalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeGoalModal();
});

/* ---------------- Init ---------------- */
renderAll();
