const cheerio = require('cheerio');
const { fetchHtml } = require('./scrapeUtils');

const BASE = 'https://betterbedrock.com';
const CATALOG_URL = `${BASE}/downloads/bedrock/mods`;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = { items: [], fetchedAt: 0 };

// betterbedrock.com has no server-side search (its ?s= query param is
// ignored — verified by fetching it and finding no query-dependent output).
// Its /downloads/bedrock/mods page is a server-rendered catalog instead, so
// this fetches that catalog and filters by keyword locally, refreshing the
// catalog at most once per CACHE_TTL_MS. Class names are Next.js CSS-module
// hashes that change per deploy, so selectors match on the stable substring
// (e.g. "titleText") rather than the full hashed class name.
async function fetchCatalog() {
  const now = Date.now();
  if (cache.items.length && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.items;
  }

  const html = await fetchHtml(CATALOG_URL);
  const $ = cheerio.load(html);
  const items = [];

  $('[class*="grid-download-card"][class*="__container"]').each((i, el) => {
    const $el = $(el);
    const title = $el.find('[class*="titleText"]').first().text().trim();
    const link = $el.find('a[href^="/project/"]').first().attr('href');
    if (!title || !link) return;

    const author = $el.find('[class*="__author"]').first().text().trim();
    const img = $el.find('img[class*="thumbnail"]').first();
    let icon = img.attr('src') || null;
    // Next.js image proxy URLs wrap the real image URL — unwrap it if present.
    if (icon && icon.includes('/_next/image?url=')) {
      try {
        const inner = new URL(icon, BASE).searchParams.get('url');
        if (inner) icon = inner;
      } catch (e) { /* keep the proxy URL as-is */ }
    }
    const tags = $el.find('[class*="__tags"]').text().trim();

    items.push({
      source: 'betterbedrock',
      id: link,
      slug: link,
      title,
      description: tags || null,
      author: author || 'unknown',
      downloads: null,
      icon,
      pageUrl: link.startsWith('http') ? link : `${BASE}${link}`,
      categories: [],
      updatedAt: null,
      // BetterBedrock only ever hosts Minecraft: Bedrock Edition content; the
      // catalog page doesn't list a specific required game version per item.
      edition: 'bedrock',
      gameVersions: []
    });
  });

  cache = { items, fetchedAt: now };
  return items;
}

async function search(query, limit = 20) {
  const items = await fetchCatalog();
  const q = query.toLowerCase();
  return items
    .filter(item => item.title.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q))
    .slice(0, limit);
}

module.exports = { search };
