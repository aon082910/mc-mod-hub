const cheerio = require('cheerio');
const { fetchHtml } = require('./scrapeUtils');

const BASE = 'https://mcreator.net';
const CATALOG_URL = `${BASE}/modifications`;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = { items: [], fetchedAt: 0 };

// mcreator.net (a mod database for user-made mods built with the MCreator
// tool) has a `keys=` field on its /modifications view, but it's a no-op:
// a real keyword and a nonsense one return byte-identical result sets
// (verified directly) — the same non-functional-search pattern as
// BetterBedrock's `?s=`. So this fetches the catalog's first page (its own
// "Load More" pagination is a separate AJAX call this doesn't follow) and
// filters by keyword locally, same approach as betterbedrock.js.
async function fetchCatalog() {
  const now = Date.now();
  if (cache.items.length && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.items;
  }

  const html = await fetchHtml(CATALOG_URL);
  const $ = cheerio.load(html);
  const items = [];

  $('.modicon').each((i, el) => {
    const $el = $(el);
    const link = $el.find('a[href^="/modification/"]').first().attr('href');
    const title = $el.find('.caption').first().text().trim();
    if (!title || !link) return;

    const icon = $el.find('img').first().attr('src');
    // .fmv can list several comma-separated versions ("26.2, 26.1.2").
    const gameVersions = $el.find('.fmv').first().text().split(',').map(s => s.trim()).filter(Boolean);
    // The download count is a bare text node right after the .dlcount icon
    // span, as a sibling inside the same parent div as .fmv — reading the
    // whole parent's text (as opposed to just this one sibling node) would
    // concatenate the version number's digits into the download count.
    const dlIcon = $el.find('.dlcount').first().get(0);
    const downloadsText = dlIcon && dlIcon.next && dlIcon.next.data ? dlIcon.next.data.replace(/[^\d]/g, '') : '';

    items.push({
      source: 'mcreator',
      id: link,
      slug: link,
      title,
      description: null,
      author: null,
      downloads: downloadsText ? parseInt(downloadsText, 10) : null,
      icon: icon ? (icon.startsWith('http') ? icon : `https:${icon}`) : null,
      pageUrl: `${BASE}${link}`,
      categories: [],
      createdAt: null,
      updatedAt: null,
      // MCreator only targets Minecraft: Java Edition.
      edition: 'java',
      gameVersions
    });
  });

  cache = { items, fetchedAt: now };
  return items;
}

async function search(query, limit = 20) {
  const items = await fetchCatalog();
  const q = (query || '').toLowerCase();
  if (!q) return items.slice(0, limit);
  return items.filter(item => item.title.toLowerCase().includes(q)).slice(0, limit);
}

module.exports = { search };
