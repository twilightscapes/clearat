// The poll engine, shared by the extension's background worker and the web
// app shell (web.js). Fetches notifications for every account, refreshes
// feeds, enriches with post text + profile avatars, prunes read-state.

import { listNotifications, getPostTexts, getProfiles } from './api.js';
import { fetchFeed } from './feeds.js';
import { loadState, saveAccount } from './store.js';

export async function pollAll() {
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
