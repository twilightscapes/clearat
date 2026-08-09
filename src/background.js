import { listNotifications, getPostTexts, getProfiles } from './api.js';
import { fetchFeed } from './feeds.js';
import { loadState, countUnread, saveAccount } from './store.js';

const POLL_MINUTES = 3;

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'poll') poll();
});
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'poll') {
    poll().then(() => sendResponse({ ok: true }), e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === 'badge') {
    refreshBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function schedule() {
  await chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES });
  poll();
}

async function poll() {
  const state = await loadState();

  const notifCache = { ...state.notifCache };
  for (const account of state.accounts) {
    try {
      const res = await listNotifications(account, saveAccount);
      notifCache[account.did] = {
        notifications: res.notifications || [],
        fetchedAt: Date.now(),
      };
      if (account.authError) {
        account.authError = false;
        await saveAccount(account);
      }
    } catch (e) {
      notifCache[account.did] = {
        ...(notifCache[account.did] || {}),
        error: String(e.message || e),
        fetchedAt: Date.now(),
      };
      if (e.status === 400 || e.status === 401) {
        account.authError = true;
        await saveAccount(account);
      }
    }
  }
  for (const did of Object.keys(notifCache)) {
    if (!state.accounts.some(a => a.did === did)) delete notifCache[did];
  }

  const feedCache = { ...state.feedCache };
  for (const feed of state.feeds) {
    try {
      feedCache[feed.url] = { ...(await fetchFeed(feed.url)), fetchedAt: Date.now() };
    } catch (e) {
      feedCache[feed.url] = {
        ...(feedCache[feed.url] || {}),
        error: String(e.message || e),
        fetchedAt: Date.now(),
      };
    }
  }
  for (const url of Object.keys(feedCache)) {
    if (!state.feeds.some(f => f.url === url)) delete feedCache[url];
  }

  if (state.accounts.length) {
    try {
      const profiles = await getProfiles(state.accounts.map(a => a.did));
      for (const account of state.accounts) {
        const p = profiles[account.did];
        if (!p) continue;
        if (p.avatar !== account.avatarUrl || (p.displayName || '') !== (account.displayName || '')) {
          account.avatarUrl = p.avatar;
          account.displayName = p.displayName || '';
          await saveAccount(account);
        }
      }
    } catch {
      /* cosmetic — retry next poll */
    }
  }

  const postCache = await refreshPostCache(state.postCache, notifCache);

  await chrome.storage.local.set({ notifCache, feedCache, postCache });
  await pruneReadState(notifCache, feedCache);
  await refreshBadge();
}

// Like/repost notifications only carry the at-uri of your post; fetch its text
// once (posts aren't editable) so triage rows can show what was liked.
async function refreshPostCache(prev, notifCache) {
  const wanted = new Set();
  for (const c of Object.values(notifCache)) {
    for (const n of c.notifications || []) {
      if ((n.reason === 'like' || n.reason === 'repost') && n.reasonSubject) {
        wanted.add(n.reasonSubject);
      }
    }
  }
  const postCache = {};
  for (const uri of wanted) {
    if (prev[uri] !== undefined) postCache[uri] = prev[uri];
  }
  const missing = [...wanted].filter(uri => postCache[uri] === undefined);
  if (missing.length) {
    try {
      Object.assign(postCache, await getPostTexts(missing));
    } catch {
      /* AppView hiccup — retry next poll */
    }
  }
  return postCache;
}

// Dismissals only matter while the notification is still unread server-side;
// feed readIds only matter while the item is still in the feed window. Pruning
// keeps chrome.storage.sync far away from its quotas.
async function pruneReadState(notifCache, feedCache) {
  const { dismissed, feedRead } = await chrome.storage.sync.get({ dismissed: {}, feedRead: {} });

  const liveUris = new Set();
  for (const c of Object.values(notifCache)) {
    for (const n of c.notifications || []) if (!n.isRead) liveUris.add(n.uri);
  }
  const prunedDismissed = {};
  for (const uri of Object.keys(dismissed)) {
    if (liveUris.has(uri)) prunedDismissed[uri] = true;
  }

  const prunedFeedRead = {};
  for (const [url, read] of Object.entries(feedRead)) {
    const liveIds = new Set((feedCache[url]?.items || []).map(it => it.id));
    prunedFeedRead[url] = {
      clearedAt: read.clearedAt || 0,
      readIds: (read.readIds || []).filter(id => liveIds.has(id)),
    };
  }

  await chrome.storage.sync.set({ dismissed: prunedDismissed, feedRead: prunedFeedRead });
}

async function refreshBadge() {
  const state = await loadState();
  const { total } = countUnread(state);
  await chrome.action.setBadgeBackgroundColor({ color: '#d43a3a' });
  // Firefox-only API; Chrome picks white automatically.
  if (chrome.action.setBadgeTextColor) {
    try { await chrome.action.setBadgeTextColor({ color: '#ffffff' }); } catch { /* ignore */ }
  }
  await chrome.action.setBadgeText({ text: total ? (total > 99 ? '99+' : String(total)) : '' });
}
