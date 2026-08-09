// Minimal atproto client: handle resolution, app-password sessions, notifications.

const PUBLIC_API = 'https://public.api.bsky.app';

export async function xrpc(base, method, nsid, { params, body, token } = {}) {
  const url = new URL(`${base}/xrpc/${nsid}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, item);
    else url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`${nsid}: HTTP ${res.status}`);
    err.status = res.status;
    try { err.detail = await res.json(); } catch { /* not json */ }
    throw err;
  }
  const type = res.headers.get('content-type') || '';
  return type.includes('json') ? res.json() : null;
}

export async function resolveDid(handle) {
  const data = await xrpc(PUBLIC_API, 'GET', 'com.atproto.identity.resolveHandle', {
    params: { handle },
  });
  return data.did;
}

// The PDS endpoint lives in the DID document, not on any fixed host.
export async function getPds(did) {
  let doc;
  if (did.startsWith('did:plc:')) {
    doc = await (await fetch(`https://plc.directory/${did}`)).json();
  } else if (did.startsWith('did:web:')) {
    const host = did.slice('did:web:'.length).replaceAll('%3A', ':');
    doc = await (await fetch(`https://${host}/.well-known/did.json`)).json();
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }
  const svc = (doc.service || []).find(
    s => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
  );
  if (!svc) throw new Error('No PDS endpoint in DID document');
  return svc.serviceEndpoint;
}

export async function login(handle, appPassword) {
  const did = await resolveDid(handle.replace(/^@/, '').trim());
  const pds = await getPds(did);
  const s = await xrpc(pds, 'POST', 'com.atproto.server.createSession', {
    body: { identifier: did, password: appPassword },
  });
  return { did: s.did, handle: s.handle, pds, accessJwt: s.accessJwt, refreshJwt: s.refreshJwt };
}

export async function refreshSession(account) {
  const s = await xrpc(account.pds, 'POST', 'com.atproto.server.refreshSession', {
    token: account.refreshJwt,
  });
  return { accessJwt: s.accessJwt, refreshJwt: s.refreshJwt };
}

// Run an authed call; on token expiry try refresh, then a fresh login with the
// stored app password. Mutates `account` and persists it via saveAccount.
async function authedCall(account, saveAccount, fn) {
  try {
    return await fn(account.accessJwt);
  } catch (e) {
    if (e.status !== 400 && e.status !== 401) throw e;
  }
  try {
    Object.assign(account, await refreshSession(account));
    await saveAccount(account);
    return await fn(account.accessJwt);
  } catch (e) {
    if (!account.appPassword) throw e;
    Object.assign(account, await login(account.handle, account.appPassword));
    await saveAccount(account);
    return await fn(account.accessJwt);
  }
}

export function listNotifications(account, saveAccount, limit = 50) {
  return authedCall(account, saveAccount, token =>
    xrpc(account.pds, 'GET', 'app.bsky.notification.listNotifications', {
      params: { limit },
      token,
    })
  );
}

// Marks everything up to seenAt as read, server-side — clears the badge in the
// official app too. atproto has no per-notification read state.
export function updateSeen(account, saveAccount, seenAt) {
  return authedCall(account, saveAccount, token =>
    xrpc(account.pds, 'POST', 'app.bsky.notification.updateSeen', {
      body: { seenAt },
      token,
    })
  );
}

// Public AppView lookup — no auth. Used to show the text of *your* post on
// like/repost rows. Deleted or blocked-off posts are simply absent.
export async function getPostTexts(uris) {
  const out = {};
  for (let i = 0; i < uris.length; i += 25) {
    const data = await xrpc(PUBLIC_API, 'GET', 'app.bsky.feed.getPosts', {
      params: { uris: uris.slice(i, i + 25) },
    });
    for (const post of data.posts || []) out[post.uri] = post.record?.text ?? '';
  }
  return out;
}

// Public profile lookup — used for the accounts' own avatars/display names.
export async function getProfiles(dids) {
  const out = {};
  for (let i = 0; i < dids.length; i += 25) {
    const data = await xrpc(PUBLIC_API, 'GET', 'app.bsky.actor.getProfiles', {
      params: { actors: dids.slice(i, i + 25) },
    });
    for (const p of data.profiles || []) out[p.did] = p;
  }
  return out;
}

export function atUriToWebUrl(atUri) {
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(atUri || '');
  if (!m) return null;
  const [, authority, collection, rkey] = m;
  if (collection === 'app.bsky.feed.post') return `https://bsky.app/profile/${authority}/post/${rkey}`;
  if (collection === 'app.bsky.feed.generator') return `https://bsky.app/profile/${authority}/feed/${rkey}`;
  return `https://bsky.app/profile/${authority}`;
}
