// Storage layout
//   local (this machine only — holds credentials and caches):
//     accounts:   [{ did, handle, pds, accessJwt, refreshJwt, appPassword, authError }]
//     notifCache: { [did]: { notifications, fetchedAt, error? } }
//     feedCache:  { [url]: { title, items, fetchedAt, error? } }
//     postCache:  { [atUri]: text } — your posts' text for like/repost rows
//   sync (follows the Chrome profile across machines):
//     feeds:      [{ url, kind: 'rss'|'youtube', addedAt }]
//     dismissed:  { [notifUri]: true }            — local read-state overlay
//     feedRead:   { [url]: { clearedAt, readIds } }
//     filters:    { like, repost, follow, reply, mention, quote, other }

export const DEFAULT_FILTERS = {
  like: true,
  repost: true,
  follow: true,
  reply: true,
  mention: true,
  quote: true,
  other: true,
};

export async function loadState() {
  const [local, sync] = await Promise.all([
    chrome.storage.local.get({ accounts: [], notifCache: {}, feedCache: {}, postCache: {} }),
    chrome.storage.sync.get({ feeds: [], dismissed: {}, feedRead: {}, filters: {} }),
  ]);
  return { ...local, ...sync, filters: { ...DEFAULT_FILTERS, ...sync.filters } };
}

export function reasonKind(reason) {
  return Object.hasOwn(DEFAULT_FILTERS, reason) ? reason : 'other';
}

export function unreadNotifs(state, account) {
  const cache = state.notifCache[account.did];
  if (!cache?.notifications) return [];
  return cache.notifications.filter(
    n => !n.isRead && !state.dismissed[n.uri] && state.filters[reasonKind(n.reason)]
  );
}

export function unreadFeedItems(state, feed) {
  const cache = state.feedCache[feed.url];
  if (!cache?.items) return [];
  const read = state.feedRead[feed.url] || {};
  const clearedAt = read.clearedAt || feed.addedAt || 0;
  const readIds = new Set(read.readIds || []);
  return cache.items.filter(it => it.published > clearedAt && !readIds.has(it.id));
}

export function countUnread(state) {
  let total = 0;
  const perAccount = {};
  let youtube = 0;
  let rss = 0;
  for (const a of state.accounts) {
    const n = unreadNotifs(state, a).length;
    perAccount[a.did] = n;
    total += n;
  }
  for (const f of state.feeds) {
    const n = unreadFeedItems(state, f).length;
    if (f.kind === 'youtube') youtube += n;
    else rss += n;
    total += n;
  }
  return { total, perAccount, youtube, rss };
}

export async function saveAccount(account) {
  const { accounts } = await chrome.storage.local.get({ accounts: [] });
  const i = accounts.findIndex(a => a.did === account.did);
  if (i === -1) accounts.push(account);
  else accounts[i] = account;
  await chrome.storage.local.set({ accounts });
}

export async function removeAccount(did) {
  const { accounts, notifCache } = await chrome.storage.local.get({ accounts: [], notifCache: {} });
  delete notifCache[did];
  await chrome.storage.local.set({
    accounts: accounts.filter(a => a.did !== did),
    notifCache,
  });
}
