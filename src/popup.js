import { installDemoShimIfNeeded } from './demo.js';
import { installWebShimIfNeeded } from './web.js';
import { login, updateSeen, atUriToWebUrl } from './api.js';
import { resolveFeedUrl, isYouTube } from './feeds.js';
import {
  loadState,
  unreadNotifs,
  unreadFeedItems,
  countUnread,
  saveAccount,
  removeAccount,
  reasonKind,
} from './store.js';
import { icon, REASON_ICON } from './icons.js';
import { ACCOUNT_NUDGE_THRESHOLD, DONATE_URL, isSupporter, markSupporter } from './license.js';

// Outside the extension: ?demo=1 loads sample data, otherwise the web-app
// shell (localStorage + in-page polling) takes over. Inside the extension
// both are inert.
const DEMO = new URLSearchParams(location.search).has('demo') && installDemoShimIfNeeded();
const WEB = !DEMO && installWebShimIfNeeded();

const $app = document.getElementById('app');
let state = null;
let view = 'main';
let needsHosts = false;
let supporter = false;
const expanded = new Set();
const groupReg = new Map();

const KIND_META = {
  youtube: { label: 'YouTube channels', icon: 'youtube', cls: 'yt' },
  rss: { label: 'RSS feeds', icon: 'rss', cls: 'rss' },
};

window.addEventListener('clearat:polled', () => reload());

init();

async function init() {
  needsHosts = await missingHostAccess();
  state = await loadState();
  supporter = await isSupporter();
  render();
  // Kick a poll so an opened popup shows fresh data, then re-render.
  try {
    await chrome.runtime.sendMessage({ type: 'poll' });
    state = await loadState();
    render();
  } catch {
    /* background worker unavailable (e.g. demo mode) */
  }
}

async function reload() {
  state = await loadState();
  supporter = await isSupporter();
  render();
}

// Chrome grants host_permissions at install; Firefox MV3 treats them as
// opt-in, so we ask with a one-click banner (never shown in Chrome).
async function missingHostAccess() {
  if (!chrome.permissions?.contains) return false;
  try {
    return !(await chrome.permissions.contains({ origins: ['https://*/*', 'http://*/*'] }));
  } catch {
    return false;
  }
}

function pokeBadge() {
  chrome.runtime.sendMessage({ type: 'badge' }).catch(() => {});
}

/* ---------- rendering ---------- */

function render() {
  groupReg.clear();
  $app.innerHTML = view === 'settings' ? settingsHtml() : mainHtml();
}

function mainHtml() {
  const { total } = countUnread(state);
  let html = `
    <div class="header">
      <span class="title">${total ? `${total} unread` : 'All clear'}</span>
      <button class="iconbtn" data-act="refresh" title="Check now">${icon('refresh', 16)}</button>
      <button class="iconbtn" data-act="open-settings" title="Settings">${icon('gear', 16)}</button>
    </div>`;

  if (needsHosts) {
    html += `
      <div class="banner">
        <span>To poll your accounts and feeds, site access is needed.</span>
        <button class="primary" data-act="grant-hosts">Grant site access</button>
      </div>`;
  }

  if (!state.accounts.length && !state.feeds.length) {
    return html + `
      <div class="empty">
        <div class="big">Nothing to watch yet</div>
        <div style="margin-bottom:12px">Add a Bluesky account or a feed to start triaging.</div>
        <button class="primary" data-act="open-settings">Open settings</button>
      </div>`;
  }

  html += state.accounts.map(accountRow).join('');

  const subs = ['youtube', 'rss'].map(subRow).join('');
  if (subs) html += `<div class="section-label">Subscriptions</div>${subs}`;

  const footNote = DEMO
    ? 'Demo mode — sample data'
    : WEB
      ? 'Web app — checks every 3 minutes while open'
      : 'Checks every 3 minutes';
  html += `<div class="foot">${footNote}</div>`;
  return html;
}

function accountRow(account) {
  const unread = unreadNotifs(state, account);
  const isOpen = expanded.has(account.did);
  const status = account.authError
    ? `<span class="warn-ic" title="Session expired">${icon('warn', 15)}</span>`
    : unread.length
      ? `<span class="count">${unread.length}</span>`
      : `<span class="clear-label">clear</span>`;

  let html = `
    <div class="row ${isOpen ? 'open' : ''}" data-act="toggle" data-key="${esc(account.did)}">
      ${accountAvatar(account)}
      <span class="name">@${esc(account.handle)}</span>
      ${status}
      <span class="chev">${icon('chevron', 14)}</span>
    </div>`;

  if (isOpen) html += `<div class="panel">${accountPanel(account, unread)}</div>`;
  return html;
}

function accountPanel(account, unread) {
  if (account.authError) {
    return `<div class="note error-note">Session expired — remove and re-add this account in settings.</div>`;
  }
  const cache = state.notifCache[account.did];
  if (cache?.error && !cache?.notifications) {
    return `<div class="note error-note">${esc(cache.error)}</div>`;
  }
  if (!unread.length) return `<div class="note">All caught up.</div>`;

  const rows = groupNotifs(unread).map(g => {
    const gid = `g${groupReg.size}`;
    groupReg.set(gid, { group: g, account });
    return `
      <div class="notif" data-act="open-group" data-gid="${gid}" title="Open on bsky.app">
        <span class="r-ic ${g.kind}">${icon(REASON_ICON[g.kind], 15)}</span>
        ${groupAvatars(g)}
        <span class="body">${groupText(g)}</span>
        <span class="when">${timeAgo(g.latest)}</span>
        <button class="dismiss" data-act="dismiss-group" data-gid="${gid}" title="Dismiss">${icon('x', 13)}</button>
      </div>`;
  }).join('');

  return rows + `
    <div class="panel-foot">
      <button class="link" data-act="seen" data-did="${esc(account.did)}">Mark all seen</button>
    </div>`;
}

function subRow(kind) {
  const feeds = state.feeds.filter(f => f.kind === kind);
  if (!feeds.length) return '';
  const meta = KIND_META[kind];
  const items = feedItemsFor(kind);
  const isOpen = expanded.has(kind);

  let html = `
    <div class="row ${isOpen ? 'open' : ''}" data-act="toggle" data-key="${kind}">
      <span class="kind-ic ${meta.cls}">${icon(meta.icon, 18)}</span>
      <span class="name">${meta.label}</span>
      ${items.length ? `<span class="count">${items.length}</span>` : `<span class="clear-label">clear</span>`}
      <span class="chev">${icon('chevron', 14)}</span>
    </div>`;

  if (isOpen) {
    const rows = items.map(({ feed, item }) => `
      <div class="notif" data-act="open-item" data-url="${esc(feed.url)}" data-iid="${esc(item.id)}" data-link="${esc(item.link)}">
        <span class="r-ic">${icon(meta.icon, 15)}</span>
        <span class="body"><b>${esc(item.title)}</b> <span class="dim">· ${esc(feedTitle(feed))}</span></span>
        <span class="when">${timeAgo(item.published)}</span>
        <button class="dismiss" data-act="read-item" data-url="${esc(feed.url)}" data-iid="${esc(item.id)}" title="Mark read">${icon('x', 13)}</button>
      </div>`).join('');

    const body = items.length
      ? rows + `<div class="panel-foot"><button class="link" data-act="read-kind" data-kind="${kind}">Mark all read</button></div>`
      : `<div class="note">All caught up.</div>`;
    html += `<div class="panel">${body}</div>`;
  }
  return html;
}

function settingsHtml() {
  return `
    <div class="header">
      <button class="iconbtn" data-act="back" title="Back">${icon('back', 16)}</button>
      <span class="title">Settings</span>
    </div>

    <div class="settings-section">
      <div class="section-label">Bluesky accounts</div>
      ${state.accounts.map(a => `
        <div class="settings-row">
          ${accountAvatar(a)}
          <span class="grow">@${esc(a.handle)}${a.authError ? ' <span class="sub">(session expired)</span>' : ''}</span>
          <button class="iconbtn" data-act="rm-account" data-did="${esc(a.did)}" title="Remove">${icon('trash', 15)}</button>
        </div>`).join('')}
      ${accountFormHtml()}
    </div>

    <div class="settings-section">
      <div class="section-label">Show notifications for</div>
      <div class="filters">
        ${['reply', 'mention', 'quote', 'like', 'repost', 'follow'].map(k => `
          <label><input type="checkbox" data-filter="${k}" ${state.filters[k] ? 'checked' : ''}> ${k}</label>`).join('')}
      </div>
    </div>

    <div class="settings-section">
      <div class="section-label">Feeds</div>
      ${state.feeds.map(f => `
        <div class="settings-row">
          <span class="kind-ic ${KIND_META[f.kind].cls}">${icon(KIND_META[f.kind].icon, 16)}</span>
          <span class="grow">${esc(feedTitle(f))}<br><span class="sub">${esc(f.url)}</span></span>
          <button class="iconbtn" data-act="rm-feed" data-url="${esc(f.url)}" title="Remove">${icon('trash', 15)}</button>
        </div>`).join('')}
      <div class="form">
        <input type="url" id="feed-url" placeholder="https://example.com/feed.xml" autocomplete="off" spellcheck="false">
        <div class="hint">Any RSS/Atom URL. For YouTube, paste a channel page URL — it resolves to the upload feed.</div>
        ${WEB ? '<div class="hint">Heads up: many feeds block fetching from web pages (CORS) — the browser extension fetches them all.</div>' : ''}
        <div class="err" id="feed-err"></div>
        <button class="primary" data-act="add-feed">Add feed</button>
      </div>
    </div>

    <div class="foot">Clear AT 0.1.0 — clear your @s${supporter ? ' · ♥' : ''}</div>`;
}

// No gate — Clear AT is free. Past the nudge threshold, a gentle donation
// note appears under the form; "I chipped in" hides it forever.
function accountFormHtml() {
  let html = `
      <div class="form">
        <input type="text" id="acc-handle" placeholder="handle.bsky.social" autocomplete="off" spellcheck="false">
        <input type="password" id="acc-pass" placeholder="app password (xxxx-xxxx-xxxx-xxxx)">
        <div class="hint">Use an <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer">app password</a>, never your real password. Stored on this machine only.</div>
        <div class="err" id="acc-err"></div>
        <button class="primary" data-act="add-account">Add account</button>
      </div>`;
  if (state.accounts.length > ACCOUNT_NUDGE_THRESHOLD && !supporter) {
    html += `
      <div class="upsell">
        <div class="upsell-copy">Running more than ${ACCOUNT_NUDGE_THRESHOLD} accounts? Clear AT is free —
          but if it saves you a scroll every day, perhaps think of donating to the developer.
          Whatever feels right.</div>
        <button class="primary" data-act="open-donate">Chip in</button>
        <button class="link-btn" data-act="mark-supporter">I chipped in — hide this forever</button>
      </div>`;
  }
  return html;
}

/* ---------- grouping ---------- */

function groupNotifs(list) {
  const groups = new Map();
  for (const n of list) {
    const kind = reasonKind(n.reason);
    const key = kind === 'follow' ? 'follow' : `${n.reason}:${n.reasonSubject || n.uri}`;
    if (!groups.has(key)) groups.set(key, { kind, reason: n.reason, notifs: [] });
    groups.get(key).notifs.push(n);
  }
  return [...groups.values()]
    .map(g => {
      g.notifs.sort((a, b) => Date.parse(b.indexedAt) - Date.parse(a.indexedAt));
      g.latest = Date.parse(g.notifs[0].indexedAt) || 0;
      return g;
    })
    .sort((a, b) => b.latest - a.latest);
}

function groupText(g) {
  const first = g.notifs[0];
  const name = esc(first.author.displayName || `@${first.author.handle}`);
  const n = g.notifs.length;
  const others = n > 1 ? ` + ${n - 1} other${n > 2 ? 's' : ''}` : '';
  const snip = t => (t ? `: “${esc(t.length > 46 ? t.slice(0, 46) + '…' : t)}”` : '');
  const subject = uri => {
    const text = state.postCache[uri];
    return text ? snip(text) : ' your post';
  };
  switch (g.kind) {
    case 'like': return `<b>${name}</b>${others} <span class="dim">liked${subject(first.reasonSubject)}</span>`;
    case 'repost': return `<b>${name}</b>${others} <span class="dim">reposted${subject(first.reasonSubject)}</span>`;
    case 'follow': return `<b>${name}</b>${others} <span class="dim">followed you</span>`;
    case 'reply': return `<b>${name}</b> <span class="dim">replied${snip(first.record?.text)}</span>`;
    case 'mention': return `<b>${name}</b> <span class="dim">mentioned you${snip(first.record?.text)}</span>`;
    case 'quote': return `<b>${name}</b> <span class="dim">quoted you${snip(first.record?.text)}</span>`;
    default: return `<b>${name}</b> <span class="dim">${esc(g.reason)}</span>`;
  }
}

function groupLink(g) {
  const n = g.notifs[0];
  switch (g.kind) {
    case 'like':
    case 'repost':
      return atUriToWebUrl(n.reasonSubject);
    case 'reply':
    case 'mention':
    case 'quote':
      return atUriToWebUrl(n.uri);
    default:
      return `https://bsky.app/profile/${n.author.handle}`;
  }
}

function feedItemsFor(kind) {
  const out = [];
  for (const feed of state.feeds.filter(f => f.kind === kind)) {
    for (const item of unreadFeedItems(state, feed)) out.push({ feed, item });
  }
  return out.sort((a, b) => b.item.published - a.item.published);
}

function feedTitle(feed) {
  return state.feedCache[feed.url]?.title || feed.url;
}

/* ---------- actions ---------- */

$app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  handle(el).catch(err => console.error(err));
});

$app.addEventListener('change', e => {
  const cb = e.target.closest('input[data-filter]');
  if (!cb) return;
  setFilter(cb.dataset.filter, cb.checked);
});

async function handle(el) {
  switch (el.dataset.act) {
    case 'toggle': {
      const key = el.dataset.key;
      expanded.has(key) ? expanded.delete(key) : expanded.add(key);
      render();
      break;
    }
    case 'open-settings': view = 'settings'; render(); break;
    case 'back': view = 'main'; render(); break;
    case 'refresh': {
      el.classList.add('spin');
      try { await chrome.runtime.sendMessage({ type: 'poll' }); } catch { /* demo */ }
      await reload();
      break;
    }
    case 'open-group': {
      const { group } = groupReg.get(el.dataset.gid) || {};
      if (!group) break;
      const url = groupLink(group);
      if (url) chrome.tabs.create({ url });
      await dismissUris(group.notifs.map(n => n.uri));
      break;
    }
    case 'dismiss-group': {
      const { group } = groupReg.get(el.dataset.gid) || {};
      if (group) await dismissUris(group.notifs.map(n => n.uri));
      break;
    }
    case 'seen': {
      const account = state.accounts.find(a => a.did === el.dataset.did);
      if (!account) break;
      try { await updateSeen(account, saveAccount, new Date().toISOString()); } catch { /* offline/demo */ }
      await dismissUris(unreadNotifs(state, account).map(n => n.uri));
      break;
    }
    case 'open-item': {
      chrome.tabs.create({ url: el.dataset.link });
      await markItemRead(el.dataset.url, el.dataset.iid);
      break;
    }
    case 'read-item': await markItemRead(el.dataset.url, el.dataset.iid); break;
    case 'read-kind': await markKindRead(el.dataset.kind); break;
    case 'grant-hosts': {
      const granted = await chrome.permissions.request({ origins: ['https://*/*', 'http://*/*'] });
      if (granted) {
        needsHosts = false;
        try { await chrome.runtime.sendMessage({ type: 'poll' }); } catch { /* demo */ }
        await reload();
      }
      break;
    }
    case 'open-donate': chrome.tabs.create({ url: DONATE_URL }); break;
    case 'mark-supporter': {
      await markSupporter();
      await reload();
      break;
    }
    case 'add-account': await addAccount(el); break;
    case 'rm-account': {
      await removeAccount(el.dataset.did);
      pokeBadge();
      await reload();
      break;
    }
    case 'add-feed': await addFeed(el); break;
    case 'rm-feed': {
      const feeds = state.feeds.filter(f => f.url !== el.dataset.url);
      await chrome.storage.sync.set({ feeds });
      pokeBadge();
      await reload();
      break;
    }
  }
}

async function dismissUris(uris) {
  const { dismissed } = await chrome.storage.sync.get({ dismissed: {} });
  for (const uri of uris) dismissed[uri] = true;
  await chrome.storage.sync.set({ dismissed });
  pokeBadge();
  await reload();
}

async function markItemRead(feedUrl, itemId) {
  const { feedRead } = await chrome.storage.sync.get({ feedRead: {} });
  const read = feedRead[feedUrl] || { clearedAt: 0, readIds: [] };
  if (!read.readIds.includes(itemId)) read.readIds.push(itemId);
  feedRead[feedUrl] = read;
  await chrome.storage.sync.set({ feedRead });
  pokeBadge();
  await reload();
}

async function markKindRead(kind) {
  const { feedRead } = await chrome.storage.sync.get({ feedRead: {} });
  for (const feed of state.feeds.filter(f => f.kind === kind)) {
    feedRead[feed.url] = { clearedAt: Date.now(), readIds: [] };
  }
  await chrome.storage.sync.set({ feedRead });
  pokeBadge();
  await reload();
}

async function setFilter(key, value) {
  const filters = { ...state.filters, [key]: value };
  await chrome.storage.sync.set({ filters });
  pokeBadge();
  await reload();
}

async function addAccount(btn) {
  const handleEl = document.getElementById('acc-handle');
  const passEl = document.getElementById('acc-pass');
  const errEl = document.getElementById('acc-err');
  errEl.textContent = '';
  if (!handleEl.value.trim() || !passEl.value.trim()) {
    errEl.textContent = 'Enter a handle and an app password.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const account = await login(handleEl.value, passEl.value.trim());
    account.appPassword = passEl.value.trim();
    await saveAccount(account);
    expanded.add(account.did);
    try { await chrome.runtime.sendMessage({ type: 'poll' }); } catch { /* demo */ }
    await reload();
  } catch (e) {
    errEl.textContent = e.status === 401
      ? 'Sign-in failed — check the handle and app password.'
      : `Sign-in failed: ${e.message || e}`;
    btn.disabled = false;
    btn.textContent = 'Add account';
  }
}

async function addFeed(btn) {
  const urlEl = document.getElementById('feed-url');
  const errEl = document.getElementById('feed-err');
  errEl.textContent = '';
  if (!urlEl.value.trim()) {
    errEl.textContent = 'Enter a feed or channel URL.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    const url = await resolveFeedUrl(urlEl.value);
    if (state.feeds.some(f => f.url === url)) throw new Error('Already added');
    const feeds = [...state.feeds, {
      url,
      kind: isYouTube(url) ? 'youtube' : 'rss',
      addedAt: Date.now(),
    }];
    await chrome.storage.sync.set({ feeds });
    try { await chrome.runtime.sendMessage({ type: 'poll' }); } catch { /* demo */ }
    await reload();
  } catch (e) {
    errEl.textContent = `Couldn't add feed: ${e.message || e}`;
    btn.disabled = false;
    btn.textContent = 'Add feed';
  }
}

/* ---------- helpers ---------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const COLORS = ['#3b6fd4', '#c26b1f', '#2f9e6e', '#8250c4', '#c2417c', '#2a9bb5'];

function colorFor(did) {
  let h = 0;
  for (const c of did) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function accountAvatar(account) {
  if (account.avatarUrl) {
    return `<img class="avatar-img" src="${esc(account.avatarUrl)}" width="28" height="28" alt="">`;
  }
  return `<span class="avatar" style="background:${colorFor(account.did)}">${esc(initials(account))}</span>`;
}

function authorAvatar(author) {
  if (author.avatar) return `<img class="pfp" src="${esc(author.avatar)}" alt="">`;
  const letter = ((author.displayName || author.handle || '?').trim()[0] || '?').toUpperCase();
  return `<span class="pfp pfp-fallback" style="background:${colorFor(author.did || author.handle || '')}">${esc(letter)}</span>`;
}

// Up to three distinct authors, overlapping — newest first (notifs are sorted).
function groupAvatars(g) {
  const seen = new Map();
  for (const n of g.notifs) {
    if (!seen.has(n.author.did)) seen.set(n.author.did, n.author);
  }
  return `<span class="pfps">${[...seen.values()].slice(0, 3).map(authorAvatar).join('')}</span>`;
}

function initials(account) {
  const host = account.handle.replace(/^@/, '');
  const parts = host.split(/[.\-_]/).filter(Boolean);
  const two = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  return (two || host.slice(0, 2)).toUpperCase();
}
