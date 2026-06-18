# Toolkit — Telegram Mini App

A single Telegram Mini App bundling five pure-logic utilities: OTP authenticator codes, a unit/currency converter, a group expense splitter, a personal debt tracker, and a QR code generator.

**Architecture: zero backend, zero build step, zero ongoing maintenance.**

- Static HTML/CSS/JS only — no server, no database, no API keys (except one optional free FX endpoint, see below).
- All data is stored on-device via Telegram `CloudStorage` (syncs across the user's own devices) with a `localStorage` fallback so it also works in a plain browser tab.
- The only network call the app ever makes is to `api.frankfurter.dev` for live currency rates, and it caches results for 12 hours with an offline-safe fallback to the last known rates. Everything else (OTP/TOTP math, unit conversion, splitting, debt tracking, QR rendering) runs 100% client-side with no external dependency.
- Nothing to patch, nothing to scale, nothing to monitor. Once deployed to static hosting, it keeps working indefinitely.

## Project structure

```
telegram-toolkit-miniapp/
├── index.html              # app shell, tab navigation, loads everything
├── css/style.css            # all styling, theme-adaptive via Telegram CSS vars
├── js/
│   ├── telegram-integration.js   # Telegram WebApp SDK wrapper (storage, haptics, theme)
│   ├── otp.js                    # TOTP/RFC 6238 authenticator codes
│   ├── converter.js              # unit converter + currency converter
│   ├── splitter.js                # group expense splitter (Splitwise-style)
│   ├── debts.js                   # personal IOU tracker
│   ├── qrcode-tool.js             # QR code generator (canvas + PNG export)
│   └── app.js                     # boots everything, tab switching
└── vendor/
    ├── qrcode.min.js          # vendored, locally-bundled QR library (MIT)
    └── qrcode.LICENSE.txt
```

## 0. Push this project to GitHub

Run these from a terminal **on your own computer**, in this folder (`C:\Users\ravis\Desktop\telegram-toolkit-miniapp`) — not from inside Claude, since pushing requires your own GitHub login:

```bash
cd C:\Users\ravis\Desktop\telegram-toolkit-miniapp
git init
git add -A
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/RaviSharma7877/tel-bot-1.git
git push -u origin main
```

Notes:
- Create the empty repo `tel-bot-1` on GitHub first (github.com → New repository → don't initialize with a README) if you haven't already.
- The first `git push` will prompt you to sign in to GitHub (a browser window opens if you have Git for Windows / Git Credential Manager installed, which is the default). You authenticate once and it's remembered for next time.
- A `.gitignore` is already included so any local build clutter (`node_modules/`, log files) never gets committed.

## 1. Test locally (no Telegram needed)

Because it's static files, any local web server works. From inside the project folder:

```bash
# Option A: Python (almost always preinstalled)
python3 -m http.server 8080

# Option B: Node
npx serve .
```

Then open `http://localhost:8080` in a browser. The app detects it's not running inside Telegram and falls back to `localStorage` automatically — every tool is fully testable outside Telegram.

## 2. Deploy to free static hosting

Pick one — all are free and require no server maintenance:

**GitHub Pages (recommended, since the project is already going to GitHub):**
1. Push the repo to GitHub (see Git section below).
2. On GitHub: repo → **Settings** → **Pages** → under "Build and deployment", set Source to **Deploy from a branch**, branch `main`, folder `/ (root)` → Save.
3. GitHub gives you a URL like `https://RaviSharma7877.github.io/tel-bot-1/`. That's your Mini App URL — it auto-redeploys every time you push to `main`.

**Cloudflare Pages / Netlify (alternative, slightly faster global CDN):**
1. Sign in with GitHub, "Import" the repo.
2. Build command: none. Output directory: `/` (root).
3. Deploy — you get a `*.pages.dev` or `*.netlify.app` URL.

Any of these URLs **must be HTTPS** — Telegram requires it for Mini Apps. All three give you HTTPS by default.

## 3. Register the bot + Mini App with BotFather

1. Open Telegram, search for **@BotFather**, start a chat.
2. Send `/newbot`, follow the prompts (choose a name and a unique username ending in `bot`). BotFather gives you a bot token — keep it, though this app never needs it (no backend).
3. Send `/newapp`, choose your bot, then fill in: title, short description, a 640×360 photo, and finally the **Web App URL** — paste the HTTPS URL from step 2 (e.g. the GitHub Pages link).
4. BotFather gives you a direct link like `https://t.me/yourbotname/yourappname` — share that link, or open the bot and use its menu button to launch the Mini App.
5. Optional: send `/setmenubutton` to your bot to make the Mini App launch directly from the chat's menu button instead of a separate command.

That's the entire setup — there's no server to point BotFather at, just the static URL.

## 4. Updating later

Any time you want to change something: edit the files, commit, push. Static hosting redeploys automatically. There is no backend to restart, no database migration, no dependency updates required (the only third-party code, the QR library, is vendored locally so it never silently breaks from an upstream change).

## Notes on the currency converter

The unit converter, OTP, splitter, and debt tracker have **zero** external dependencies. The currency converter is the one deliberate exception — live FX rates can't be computed locally, so it calls the free, keyless `api.frankfurter.dev` API (backed by European Central Bank reference rates) and caches the result. If that API ever goes down or the user is offline, the app keeps using the last cached rates instead of breaking.

> Note: the older `api.frankfurter.app` domain now redirects to `api.frankfurter.dev`, and some browsers block that cross-origin redirect as a CORS error. The app calls the new domain directly to avoid this.
