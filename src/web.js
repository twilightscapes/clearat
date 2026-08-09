// Web-app shell: lets popup.html run as a plain web page / installed PWA at
// clearat.app/app. Provides a chrome.* polyfill backed by localStorage and
// runs the shared poll engine in-page (no background worker on the web).
// Bluesky's APIs are CORS-open so accounts fully work; some feeds won't fetch
// cross-origin — the extension remains the full experience.

import { pollAll } from './poll.js';

function area(storageKey) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  };
  return {
    async get(defaults) {
      const data = read();
      const out = {};
      for (const k of Object.keys(defaults)) {
        out[k] = data[k] !== undefined ? data[k] : defaults[k];
      }
      return structuredClone(out);
    },
    async set(obj) {
      localStorage.setItem(storageKey, JSON.stringify({ ...read(), ...obj }));
    },
  };
}

export function installWebShimIfNeeded() {
  if (globalThis.chrome?.storage?.local) return false;
  globalThis.chrome = {
    storage: { local: area('clearat_local'), sync: area('clearat_sync') },
    runtime: {
      sendMessage: async msg => {
        if (msg?.type === 'poll') await pollAll();
        return { ok: true };
      },
    },
    tabs: { create: async ({ url }) => window.open(url, '_blank') },
  };
  document.body.classList.add('web');
  setInterval(async () => {
    try {
      await pollAll();
      window.dispatchEvent(new Event('clearat:polled'));
    } catch {
      /* offline — next tick */
    }
  }, 3 * 60_000);
  return true;
}
