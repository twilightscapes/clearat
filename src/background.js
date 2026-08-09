import { pollAll } from './poll.js';
import { loadState, countUnread } from './store.js';

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
  await pollAll();
  await refreshBadge();
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
