# ⚙️ Weekly Rates Workflow — 2 Minute Mein Setup Karein

GitHub ki security policy ki wajah se **bot/agent workflow files (`.github/workflows/*.yml`) push nahi kar sakta** — ye sirf repo owner (aap) kar sakte hain. Isliye ye file ready-made banayi gayi hai — bas copy-paste karein:

## 📋 Steps (GitHub web se, bina kuch install kiye)

1. GitHub par repo kholen → **Add file → Create new file**
2. File ka naam exactly yehi likhein (aage slash `/` aayega to folder khud ban jayega):
   ```
   .github/workflows/update-rates.yml
   ```
3. Neeche diya gaya **poora YAML** paste karein
4. **Commit changes** (green button) — bas, ho gaya!

Uske baad har **Somwar 11:30 AM (IST)** par ye robot khud CCIL site se T-bill ke fresh yields uthakar `rates.json` update karega — aur app wale users ko agli load par latest rates milengi.

> Manual run karke test karna ho: repo ke **Actions** tab → "Update investment rates (auto)" → **Run workflow**

## 📄 Poora YAML (yehi copy-paste karein)

```yaml
name: Update investment rates (auto)

# PaisaGuru ka weekly rate-bot:
# Har Somwar CCIL (Clearing Corporation of India) ki website se
# T-bill indicative yields uthata hai, sanity-check karta hai, aur
# rates.json update kar deta hai. App har load par ye file fetch
# karti hai — isliye users ko hamesha fresh T-bill rates miltein
# hain, bina app update kiye.
#
# Note: GitHub ka schedule sirf DEFAULT branch (main) par chalta
# hai — ye file main mein merge hone ke baad active ho jayegi.
# Manual run: Actions tab -> "Update investment rates (auto)" -> Run workflow

on:
  schedule:
    - cron: '0 6 * * 1' # har Somwar 06:00 UTC (IST 11:30 AM)
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  update-rates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Fetch CCIL T-bill yields aur rates.json update karo
        run: node scripts/update-rates.mjs

      - name: Commit (sirf tab jab kuch badla ho)
        run: |
          git config user.name "paisaguru-rates-bot"
          git config user.email "actions@github.com"
          git add rates.json
          if git diff --cached --quiet; then
            echo "Koi change nahi — commit skip."
          else
            git commit -m "chore(rates): weekly auto-update — T-bill yields (CCIL) [skip ci]"
            git push
          fi
```

## 🤔 Ye Zaroori Kyun Hai?

`scripts/update-rates.mjs` (jo already repo mein hai) asli kaam karta hai — ye workflow sirf usse **har hafte schedule** par chalata hai. Bina iske, T-bill rates sirf tab update hongi jab aap khud script chalaoge.

**Safety guarantee** (script mein built-in): CCIL page na khule ya galat data dikhe to script `rates.json` ko chhoo bhi nahi karti — galat rates kabhi publish nahi honge.
