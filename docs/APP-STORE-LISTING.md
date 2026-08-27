# Clear AT — App Store listing (iOS + macOS, one app record)

| Field | Value |
|---|---|
| Name | Clear AT |
| Subtitle | All your @s in one badge |
| Category | Primary: Social Networking · Secondary: Utilities |
| Price | Free |
| Privacy Policy URL | https://clearat.app/privacy |
| Support URL | https://clearat.app/support/ |
| Marketing URL | https://clearat.app |
| Copyright | © 2026 Todd Lambert |
| App Privacy | Data Not Collected |
| Bundle ID | app.clearat.ClearAT |

## Promotional text (≤170 chars)

One glance tells you what's new across every Bluesky account you run — plus your RSS and YouTube feeds. No timelines, no doomscrolling: triage and get on with your day.

## Description

Clear AT puts a single badge in Safari that answers one question: is there anything new?

• Every Bluesky account you run — personal, brand, project — in one place
• Replies, mentions, quotes, likes, reposts, and follows, grouped for fast triage
• RSS and YouTube too: paste any blog or channel URL
• Open any item on the site it came from, mark it seen, move on

PRIVATE BY DESIGN
Your accounts and feeds are stored on your device. Clear AT talks only to the services you add — no analytics, no tracking, no middleman server.

GETTING STARTED
1. Turn on the Clear AT extension in Safari settings
2. Allow it for all websites so it can check your accounts and feeds
3. Add your Bluesky accounts (always use an app password) and any feeds
4. The badge shows your unread count; the popup shows the details

ON IPHONE AND IPAD
The app opens straight into your triage view — and you can use Clear AT in any browser at clearat.app/app, or add it to your Home Screen.

Clear AT is not affiliated with Bluesky.

## Keywords (91/100 chars)

bluesky,notifications,rss,youtube,badge,mentions,replies,feeds,social,triage,reader,atproto

## Review notes

Safari web extension with companion app. A demo account is provided in the
Sign-In Information section — the sign-in form is inside the extension
(popup → gear → Add account): enter the handle as the username and the app
password as the password. The account is pre-populated with notifications of
every type Clear AT displays (replies, mentions, quotes, likes, reposts,
follows).

Feeds need no login: Settings → Add feed, paste any public RSS/blog URL.
On macOS the extension needs "Always Allow on Every Website" in Safari
settings to poll.

## Trademark (guideline 4.1 — rejected once for this)

"Bluesky" must not appear in the app **name or subtitle** — Apple rejected
the iOS submission for exactly this. Factual interoperability wording in the
description/promo text ("works with your Bluesky accounts", plus the
not-affiliated line) is the accepted pattern, and `bluesky` may stay in the
hidden keywords. Keep any future subtitle brand-free.

## Spam (guideline 4.3(a) — rejected once for this)

The iOS submission was flagged as "similar binary, metadata, and/or concept
as apps submitted by other developers." Almost certainly a heuristic match:
every `safari-web-extension-converter` app shares Apple's template
scaffolding in the binary, and the metadata resembles other Bluesky apps'.

Do NOT rewrite the app concept. Reply in the Resolution Center with the
originality case: public source with dated history
(github.com/twilightscapes/clearat, first commit 2026-08-09), the same code
already approved and live on the Mac App Store (same app record, id
6800145444), no purchased template, only app on the account, brand
established at clearat.app + Chrome Web Store + Firefox Add-ons. Ask them to
name the app it supposedly duplicates.

If the reply is refused, escalate to the App Review Board:
https://developer.apple.com/contact/app-store/?topic=appeal

## Demo account (App Review requires one — guideline 2.1(a))

Apple must be able to sign in and see pre-populated content. One-time setup:

1. Create a dedicated Bluesky account (e.g. `cleardemo.bsky.social`) at
   bsky.app — don't hand Apple a personal account.
2. From your main account, interact with it until every notification type
   exists: follow it, like one of its posts, repost one, reply to one,
   quote-post one, and mention it in a post. (It needs a post or two of its
   own first.)
3. On the demo account: Settings → Privacy & Security → App Passwords →
   create one named `app-review`. Record it — it's shown once.
4. App Store Connect → the app → App Review Information → Sign-In
   Information: username = the handle, password = the app password.
5. Don't "mark all seen" from the demo account afterwards, or the
   pre-populated unread badge disappears. Top up with a fresh like/reply
   before any resubmission.

## Age rating

Answer the questionnaire honestly — the user-generated/social content question likely lands it at 12+ (normal for social clients).
