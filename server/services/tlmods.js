const cheerio = require('cheerio');
const { fetchHtml, parseAbbreviatedNumber } = require('./scrapeUtils');

const BASE = 'https://tlmods.org';

// TLauncher's own mod mirror (tlmods.org). It's a single template reused
// across five content types, each under its own path segment; "mods" itself
// lives at the site root rather than a "/mods" path. A category maps to a
// path segment via categories.js's `tlmodsPath` field (empty string for
// mods, null for types TLMods doesn't carry — data packs, Bedrock add-ons,
// server plugins, skins).
const TYPE_LABELS = {
  '': 'mod',
  modpacks: 'modpack',
  resourcepacks: 'resourcepack',
  maps: 'map',
  shaderpacks: 'shader'
};

function parseCards($, limit) {
  const results = [];
  $('.main__card').each((i, el) => {
    if (results.length >= limit) return;
    const $el = $(el);
    const titleLink = $el.find('.card__header').first();
    const title = titleLink.text().trim();
    const href = titleLink.attr('href');
    if (!title || !href) return;

    const description = $el.find('.card__info').first().text().trim();
    const icon = $el.find('.card__img').first().attr('src');
    const viewsText = $el.find('.icon-views').parent().text().replace(/\s+/g, '');
    const pageUrl = href.startsWith('http') ? href : `${BASE}${href}`;

    results.push({
      source: 'tlmods',
      id: href,
      slug: href,
      title,
      description: description || null,
      author: null,
      downloads: parseAbbreviatedNumber(viewsText),
      icon: icon || null,
      pageUrl,
      categories: [],
      createdAt: null,
      updatedAt: null,
      // TLauncher is a Java Edition alternative launcher; it doesn't carry
      // Bedrock content at all.
      edition: 'java',
      // Per-file supported versions live on the detail page only (a long
      // comma-separated list), not on listing cards — left empty here
      // rather than firing a detail-page request per search result.
      gameVersions: []
    });
  });
  return results;
}

// pathSegment: '' (mods, the site root), 'modpacks', 'resourcepacks', 'maps',
// or 'shaderpacks'. Their client-side search box actually calls this same
// server-rendered ?search= URL under the hood (confirmed by watching the
// real network request), it just also happens to work directly over plain
// HTTP with no JS required.
async function search(query, limit = 20, pathSegment = '') {
  if (!(pathSegment in TYPE_LABELS)) return [];
  const path = pathSegment ? `${pathSegment}/` : '';
  const url = `${BASE}/en/${path}?search=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  return parseCards($, limit);
}

module.exports = { search };
