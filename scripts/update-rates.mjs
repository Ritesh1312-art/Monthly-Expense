#!/usr/bin/env node
/* ============================================================
   PaisaGuru weekly rate-bot
   ------------------------------------------------------------
   CCIL (Clearing Corporation of India Ltd) ki public page se
   T-bill indicative yields parse karta hai aur rates.json mein
   "auto" section update karta hai.

   SAFETY RULES (ye bot galat data kabhi nahi likhega):
   1. Parse fail / adhoora data -> rates.json ko chhoo nahi sakta
   2. Sanity range: yield 0.5% se 15% ke beech honi chahiye
   3. Curve check: 91D <= 182D+0.5 aur 182D <= 364D+0.5 (junk reject)
   4. Har exit code 0 par — workflow kabhi red nahi hota, bas
      silently skip kar deta hai (agla Somwar phir try hoga)
   ============================================================ */
import { readFileSync, writeFileSync } from 'fs';

const RATES_FILE = 'rates.json';
const CCIL_URL = 'https://www.ccilindia.com/tenorwise-indicative-yields';

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) PaisaGuru-Rates-Bot/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

/* Tenor token (jaise '91D') ke baad pehla valid decimal number —
   saare occurrences try karta hai (dropdown + table dono ho sakte hain) */
function parseTenor(html, tenor) {
  const marker = '>' + tenor + '<';
  let from = 0;
  while (true) {
    const idx = html.indexOf(marker, from);
    if (idx === -1) return null;
    const after = html.slice(idx + marker.length, idx + marker.length + 500);
    const matches = after.match(/\d{1,2}\.\d{1,4}/g);
    if (matches) {
      for (const m of matches) {
        const v = parseFloat(m);
        if (v >= 0.5 && v <= 15) return v; /* pehla sane number = YTM */
      }
    }
    from = idx + marker.length; /* is occurrence mein number nahi mila — agla */
  }
}

async function main() {
  const rates = JSON.parse(readFileSync(RATES_FILE, 'utf8'));

  let html;
  try {
    html = await fetchHtml(CCIL_URL);
  } catch (e) {
    console.log('CCIL fetch fail: ' + e.message + ' — rates.json unchanged (safe skip).');
    return;
  }

  const d91 = parseTenor(html, '91D');
  const d182 = parseTenor(html, '182D');
  const d364 = parseTenor(html, '364D');

  if (d91 == null || d182 == null || d364 == null) {
    console.log('Parse fail/adhoora (91D:' + d91 + ', 182D:' + d182 + ', 364D:' + d364 + ') — rates.json unchanged (safe skip).');
    return;
  }

  /* Curve sanity — yields aksar badhti hain tenor ke saath; ulta/paglat data = junk */
  if (!(d91 <= d182 + 0.5 && d182 <= d364 + 0.5)) {
    console.log('Curve sanity fail (' + d91 + '/' + d182 + '/' + d364 + ') — rates.json unchanged (safe skip).');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const prev = rates.auto && rates.auto.tbill ? rates.auto.tbill : null;
  rates.auto = {
    tbill: { d91, d182, d364 },
    asOfISO: today,
    source: 'CCIL tenor-wise indicative yields (auto-fetched)',
  };

  writeFileSync(RATES_FILE, JSON.stringify(rates, null, 2) + '\n');
  console.log('rates.json UPDATED: T-bill 91D=' + d91 + '% 182D=' + d182 + '% 364D=' + d364 + '% (as of ' + today + ')');
  if (prev) console.log('Pichle auto values:', JSON.stringify(prev));
}

main().catch(e => {
  /* Kabhi fail mat ho — galat data likhne se better hai kuch na likhna */
  console.log('Safe skip: ' + (e && e.message ? e.message : e));
  process.exit(0);
});
