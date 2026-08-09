// RSS/Atom fetching + parsing. Regex-based because MV3 service workers have no
// DOMParser; good enough for well-formed feeds, which is what triage needs.

export async function fetchFeed(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text(), url);
}

export function parseFeed(xml, url) {
  const isAtom = /<entry[\s>]/.test(xml) && !/<item[\s>]/.test(xml);
  const itemRe = isAtom ? /<entry[\s>][\s\S]*?<\/entry>/g : /<item[\s>][\s\S]*?<\/item>/g;
  const firstItem = xml.search(isAtom ? /<entry[\s>]/ : /<item[\s>]/);
  const head = firstItem === -1 ? xml : xml.slice(0, firstItem);
  const title = textOf(head, 'title') || url;

  const items = [];
  for (const block of xml.match(itemRe) || []) {
    const itemTitle = textOf(block, 'title') || '(untitled)';
    let link, id, date;
    if (isAtom) {
      link =
        attrOf(block, /<link[^>]*rel="alternate"[^>]*>/, 'href') ||
        attrOf(block, /<link[^>]*>/, 'href');
      id = textOf(block, 'id');
      date = textOf(block, 'published') || textOf(block, 'updated');
    } else {
      link = textOf(block, 'link');
      id = textOf(block, 'guid');
      date = textOf(block, 'pubDate') || textOf(block, 'dc:date');
    }
    items.push({
      id: id || link || `${itemTitle}|${date}`,
      title: itemTitle,
      link: link || url,
      published: Date.parse(date) || 0,
    });
  }
  items.sort((a, b) => b.published - a.published);
  return { title, items: items.slice(0, 25) };
}

function textOf(block, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  if (!m) return '';
  let text = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(text);
  if (cdata) text = cdata[1];
  return decodeEntities(text.replace(/<[^>]+>/g, '')).trim();
}

function attrOf(block, tagRe, attr) {
  const tag = tagRe.exec(block);
  if (!tag) return '';
  const m = new RegExp(`${attr}="([^"]*)"`).exec(tag[0]);
  return m ? decodeEntities(m[1]) : '';
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&amp;/g, '&');
}

export function isYouTube(url) {
  try {
    return /(^|\.)youtube\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Accepts a feed URL, a YouTube channel URL, or a YouTube @handle page URL and
// returns a pollable feed URL. Channel pages get scraped for their channelId.
export async function resolveFeedUrl(input) {
  const url = input.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('Enter a full URL (https://…)');
  if (!isYouTube(url)) return url;
  const u = new URL(url);
  if (u.pathname.startsWith('/feeds/')) return url;
  const inPath = /\/channel\/(UC[\w-]+)/.exec(u.pathname);
  if (inPath) return `https://www.youtube.com/feeds/videos.xml?channel_id=${inPath[1]}`;
  const page = await (await fetch(url)).text();
  const m = /"channelId":"(UC[\w-]+)"/.exec(page) || /channel_id=(UC[\w-]+)/.exec(page);
  if (!m) throw new Error("Couldn't find a channel id on that page");
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${m[1]}`;
}
