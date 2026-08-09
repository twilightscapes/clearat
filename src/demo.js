// Demo shim: lets popup.html run in a plain browser tab (no chrome.* APIs)
// with sample data, for UI work without loading the extension. Inert when the
// real extension APIs are present.

export function installDemoShimIfNeeded() {
  if (globalThis.chrome?.storage?.local) return false;

  const iso = n => new Date(Date.now() - n * 3600_000).toISOString();
  const AV_COLORS = ['#3b6fd4', '#c26b1f', '#2f9e6e', '#8250c4', '#c2417c', '#2a9bb5'];
  const av = name => {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="24" fill="${AV_COLORS[h % AV_COLORS.length]}"/><text x="24" y="31" font-family="sans-serif" font-size="20" font-weight="700" fill="#fff" text-anchor="middle">${name[0].toUpperCase()}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };
  const notif = (reason, handle, name, hoursAgo, extra = {}) => ({
    uri: `at://did:plc:demo/${reason}/${handle}-${hoursAgo}`,
    author: {
      did: `did:plc:${handle}`,
      handle,
      displayName: name,
      avatar: handle === 'newfollower.bsky.social' ? undefined : av(name),
    },
    reason,
    isRead: false,
    indexedAt: iso(hoursAgo),
    ...extra,
  });

  const store = {
    local: {
      accounts: [
        { did: 'did:plc:a1', handle: 'toddlambert.bsky.social', pds: '', accessJwt: '', refreshJwt: '', avatarUrl: av('Todd') },
        { did: 'did:plc:a2', handle: 'twilightscapes.bsky.social', pds: '', accessJwt: '', refreshJwt: '', avatarUrl: av('Twilightscapes') },
        { did: 'did:plc:a3', handle: 'alter.bsky.social', pds: '', accessJwt: '', refreshJwt: '' },
      ],
      notifCache: {
        'did:plc:a1': {
          fetchedAt: Date.now(),
          notifications: [
            notif('reply', 'mackuba.eu', 'Kuba', 2, {
              record: { text: 'Have you tried Jetstream for this? Way lighter than the raw firehose.' },
            }),
            notif('like', 'dame.bsky.social', 'Dame', 5, { reasonSubject: 'at://did:plc:a1/app.bsky.feed.post/3kdemo1' }),
            notif('like', 'pfrazee.com', 'Paul Frazee', 6, { reasonSubject: 'at://did:plc:a1/app.bsky.feed.post/3kdemo1' }),
            notif('like', 'why.bsky.team', 'Why', 7, { reasonSubject: 'at://did:plc:a1/app.bsky.feed.post/3kdemo1' }),
            notif('follow', 'newfollower.bsky.social', 'New Follower', 26),
            notif('mention', 'jay.bsky.team', 'Jay', 30, { record: { text: '@toddlambert.bsky.social this is great work' } }),
          ],
        },
        'did:plc:a2': {
          fetchedAt: Date.now(),
          notifications: [
            notif('repost', 'skygaze.io', 'Skygaze', 3, { reasonSubject: 'at://did:plc:a2/app.bsky.feed.post/3kdemo2' }),
            notif('reply', 'stargazer.bsky.social', 'Stargazer', 9, { record: { text: 'Where was this shot?' } }),
            notif('follow', 'astro.bsky.social', 'Astro', 12),
          ],
        },
        'did:plc:a3': { fetchedAt: Date.now(), notifications: [] },
      },
      feedCache: {
        'https://www.youtube.com/feeds/videos.xml?channel_id=UCdemo': {
          title: 'Marques Brownlee',
          fetchedAt: Date.now(),
          items: [
            { id: 'yt1', title: 'The Best Camera Phone of 2026', link: 'https://youtube.com/watch?v=demo1', published: Date.now() - 4 * 3600_000 },
            { id: 'yt2', title: 'This Laptop Is a Problem', link: 'https://youtube.com/watch?v=demo2', published: Date.now() - 30 * 3600_000 },
          ],
        },
        'https://daringfireball.net/feeds/main': {
          title: 'Daring Fireball',
          fetchedAt: Date.now(),
          items: [
            { id: 'df1', title: 'On the New iPad Pro', link: 'https://daringfireball.net/demo', published: Date.now() - 8 * 3600_000 },
          ],
        },
      },
      postCache: {
        'at://did:plc:a1/app.bsky.feed.post/3kdemo1': 'ALTer 0.9.17 beta: punch zooms, and tickers you can finally grab',
        'at://did:plc:a2/app.bsky.feed.post/3kdemo2': 'Milky Way over the Badlands, 3am — worth every mosquito',
      },
    },
    sync: {
      feeds: [
        { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCdemo', kind: 'youtube', addedAt: Date.now() - 90 * 3600_000 },
        { url: 'https://daringfireball.net/feeds/main', kind: 'rss', addedAt: Date.now() - 90 * 3600_000 },
      ],
      dismissed: {},
      feedRead: {},
      filters: {},
    },
  };

  const area = name => ({
    async get(defaults) {
      const out = {};
      for (const k of Object.keys(defaults)) {
        out[k] = store[name][k] !== undefined ? store[name][k] : defaults[k];
      }
      return structuredClone(out);
    },
    async set(obj) {
      Object.assign(store[name], structuredClone(obj));
    },
  });

  globalThis.chrome = {
    storage: { local: area('local'), sync: area('sync') },
    runtime: { sendMessage: async () => ({ ok: true }) },
    tabs: { create: async ({ url }) => window.open(url, '_blank') },
  };
  return true;
}
