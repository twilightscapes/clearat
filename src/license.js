// Support seam. The browser extension is free — no gates, no locked features.
// When someone runs more than ACCOUNT_NUDGE_THRESHOLD accounts, settings
// shows a gentle donation nudge; "I chipped in" hides it forever (synced
// across machines). The iOS/macOS Safari app is a one-time App Store
// purchase instead — Apple handles payment there, so none of this applies.

export const ACCOUNT_NUDGE_THRESHOLD = 3;

// Indirection on purpose: the extension links to clearat.app forever and the
// site redirects to whatever donation processor is current.
export const DONATE_URL = 'https://clearat.app/donate';

export async function isSupporter() {
  const { supporter } = await chrome.storage.sync.get({ supporter: null });
  return !!supporter;
}

export async function markSupporter() {
  await chrome.storage.sync.set({ supporter: { at: Date.now() } });
}
