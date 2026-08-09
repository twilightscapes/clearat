// Inline SVG icons (Tabler-style outlines). No webfonts — extension popups
// should work offline and keep CSP tight.

const PATHS = {
  heart: ['M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572'],
  reply: ['M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1'],
  repost: ['M4 12v-3a3 3 0 0 1 3 -3h13', 'M17 3l3 3l-3 3', 'M20 12v3a3 3 0 0 1 -3 3h-13', 'M7 21l-3 -3l3 -3'],
  follow: ['M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4', 'M16 19h6', 'M19 16v6'],
  mention: ['M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M16 12v1.5a2.5 2.5 0 0 0 5 0v-1.5a9 9 0 1 0 -5.5 8.28'],
  bell: ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
  x: ['M18 6l-12 12', 'M6 6l12 12'],
  chevron: ['M9 6l6 6l-6 6'],
  back: ['M15 6l-6 6l6 6'],
  refresh: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  gear: ['M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0', 'M12 3v2.5', 'M12 18.5v2.5', 'M3 12h2.5', 'M18.5 12h2.5', 'M5.4 5.4l1.8 1.8', 'M16.8 16.8l1.8 1.8', 'M18.6 5.4l-1.8 1.8', 'M7.2 16.8l-1.8 1.8'],
  rss: ['M4 11a9 9 0 0 1 9 9', 'M4 4a16 16 0 0 1 16 16', 'M5 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12', 'M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3'],
  warn: ['M12 9v4', 'M12 17h.01', 'M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0z'],
};

export function icon(name, size = 16, cls = '') {
  const open = `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
  if (name === 'youtube') {
    return `${open}<rect x="3" y="6" width="18" height="12" rx="3"></rect><path d="M10 9.5l5 2.5l-5 2.5z" fill="currentColor" stroke="none"></path></svg>`;
  }
  const paths = (PATHS[name] || PATHS.bell).map(d => `<path d="${d}"></path>`).join('');
  return `${open}${paths}</svg>`;
}

export const REASON_ICON = {
  like: 'heart',
  repost: 'repost',
  follow: 'follow',
  reply: 'reply',
  mention: 'mention',
  quote: 'reply',
  other: 'bell',
};
