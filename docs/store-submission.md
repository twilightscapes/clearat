# Store submission crib sheet

The package for both stores: `dist/clearat-0.1.0.zip` (rebuild with the
commands at the bottom after any change — and bump `version` in
manifest.json first).

## Listing copy (both stores)

**Name:** Clear AT

**Summary** (≤132 chars):
> One badge for all your notifications — every Bluesky account, plus RSS
> and YouTube. Triage at a glance, clear your @s.

**Description:**
> Checking notifications across several Bluesky accounts means logging in
> and out, or keeping a pile of tabs. Clear AT rolls them into a single
> toolbar badge — every account you run, plus your RSS feeds and YouTube
> subscriptions.
>
> • Accounts in a list, red badge for unread, expand for the details
> • Replies, mentions, and quotes shown with the text; likes and reposts
>   grouped ("Dame + 3 others liked…") with the post they're about
> • One click opens anything on the site it came from
> • "Mark all seen" syncs with the official Bluesky apps
> • Filter notification types you don't care about
> • Paste a YouTube channel URL — it resolves to the upload feed
>
> No server, no account, no tracking. Your app passwords stay in your
> browser and talk only to your own accounts' servers. Free — every
> account, every feed.

**Category:** Productivity / Social & Communication
**Privacy policy URL:** https://clearat.app/privacy

## Chrome Web Store (chrome.google.com/webstore/devconsole)

- One-time $5 developer registration if you've never published.
- Upload the zip. Fill listing + privacy tab.
- **Single purpose:** "Monitor and triage notifications across the user's
  Bluesky accounts and self-chosen RSS/YouTube feeds."
- **Permission justifications:**
  - `storage` — persist the user's account sessions, feed list, and
    read/unread state.
  - `alarms` — check for new notifications every 3 minutes in the
    background.
  - Host permissions (`https://*/*`, `http://*/*`) — the extension talks
    only to servers the user explicitly adds: their own Bluesky/AT
    Protocol PDS (which can be on any domain — self-hosted PDSes exist)
    and arbitrary RSS/YouTube feed URLs of their choosing. No fixed list
    can cover user-chosen feeds.
- **Data disclosure:** collects nothing, transmits nothing to the
  developer. Broad host access usually adds a few days of review.
- Screenshots: 1280×800 or 640×400 PNG, at least one.

## Firefox Add-ons (addons.mozilla.org/developers)

- Free account. Submit the same zip ("On this site" = listed).
- No build step, so no source-code upload needed.
- The manifest already carries `browser_specific_settings.gecko.id`
  (`extension@clearat.app`) — do not change it after first submission.
- Same permission notes as Chrome if the reviewer asks.

## Safari (later — safari/ project)

- `safari/Clear AT/Clear AT.xcodeproj` — iOS + macOS targets, generated
  by `safari-web-extension-converter`.
- Known port task #1: Safari doesn't support `background.type: "module"`
  — the background script's ES imports need bundling into one classic
  script for Safari.
- Ships as a one-time $4.99 paid app; Apple handles payment. Strip the
  donation nudge from the Safari build.

## Rebuild the package

```bash
cd ~/Sites/clearat && rm -rf dist && mkdir -p dist/extension && \
cp manifest.json dist/extension/ && cp -R src dist/extension/src && \
mkdir dist/extension/icons && \
cp icons/icon{16,32,48,128}.png dist/extension/icons/ && \
cd dist/extension && zip -qr ../clearat-$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])").zip .
```
