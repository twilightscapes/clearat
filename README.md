# Clear AT

**clearat.app** — clear your @s.

One badge for everything. A browser extension that watches your Bluesky
accounts' notifications, your RSS feeds, and your YouTube subscriptions, and
rolls them into a single toolbar badge. Click the badge to triage: accounts in
a list, red counts for unread, one click to open anything on the site it came
from. A lookout, not a client.

## Why

Checking notifications across several Bluesky accounts means logging in and
out, or keeping a pile of tabs. Clear AT polls each account with an app
password every 3 minutes, in the extension's background worker — no server, no
database, nothing hosted. Feed reading (RSS + YouTube uploads) rides along in
a Subscriptions section so "anything new, anywhere?" is one glance at the
toolbar.

## Install (unpacked, for now)

**Chrome:**

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → pick this directory.
3. Click the toolbar icon → gear → add an account
   (use an [app password](https://bsky.app/settings/app-passwords)) and some feeds.

**Firefox** (121+, same directory — the manifest carries keys for both):

1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
   pick `manifest.json`.
2. Firefox treats host permissions as opt-in: the popup shows a one-time
   **Grant site access** button — click it, then add accounts/feeds as above.

Temporary add-ons unload when Firefox quits; for a persistent install the
extension needs signing (AMO unlisted / self-distributed) — later step.

## How it works

- `src/background.js` — MV3 service worker. A `chrome.alarms` tick every 3
  minutes polls each account's PDS (`listNotifications`) and each feed, caches
  results in `chrome.storage.local`, and sets the badge to the total unread.
- `src/api.js` — minimal atproto client. Resolves handle → DID → PDS from the
  DID document, creates/refreshes app-password sessions, falls back to
  re-login when a refresh token dies.
- `src/feeds.js` — regex-based RSS/Atom parser (MV3 workers have no
  DOMParser). Pasting a YouTube channel URL resolves it to the channel's
  upload feed.
- `src/popup.js` / `popup.css` — the triage UI.
- `src/demo.js` — open `src/popup.html` in a normal tab (over http) and it
  runs on sample data, for UI work without reloading the extension.

## Read-state model

atproto has no per-notification read flag — only `updateSeen`, a per-account
"seen up to now" timestamp. So:

- **Dismiss one** (the × on a row, or opening it) is a local overlay, synced
  via `chrome.storage.sync`.
- **Mark all seen** calls `updateSeen` — which also clears the badge in the
  official Bluesky apps.

Feed read-state is local: a `clearedAt` timestamp plus per-item read ids,
pruned automatically to stay far under sync quotas.

## Privacy

Credentials (app passwords + session tokens) live in `chrome.storage.local`
on this machine only — they are never synced or sent anywhere except your own
PDS. Feed list, filters, and read-state sync with your browser profile.

## Roadmap

- PWA shell sharing this UI (needs a small CORS proxy for feeds)
- Safari port via the existing web-extension pipeline
- Mastodon adapter (same inbox model, nearly identical API shape)

## Pricing model

The browser extension is free — no gates, no locked features. If someone runs
more than 3 accounts, settings shows a gentle "perhaps think of donating to
the developer" note with a chip-in button; "I chipped in" hides it forever
(synced via `chrome.storage.sync`). The donate button points at
https://clearat.app/donate so the processor can change without shipping an
update. The iOS/macOS Safari app will be a one-time $4.99 App Store purchase
— Apple handles payment there, so no license code exists anywhere.
