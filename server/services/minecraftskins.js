const cheerio = require('cheerio');
const { fetchHtml } = require('./scrapeUtils');

const BASE = 'https://www.minecraftskins.net';

// Honesty check: this site's `?s=` query parameter is server-accepted but
// silently ignored — a nonsense query returns the exact same result set as
// no query at all (verified directly), and robots.txt separately disallows
// crawling /search/ anyway. So there is no real keyword search here, only
// browsing. `search()` below maps a query onto one of the site's own fixed
// categories when it recognizes it, and otherwise just returns the latest
// catalog page — never a fabricated "match".
const CATEGORY_SLUGS = ['movies', 'tv', 'games', 'people', 'fantasy', 'mobs', 'other'];

function parseCards($, limit) {
  const results = [];
  $('.card').each((i, el) => {
    if (results.length >= limit) return;
    const $el = $(el);
    // The homepage feed and the /category/* pages use different markup for
    // the same card (a plain <a> wrapping .card-image on the homepage, vs. a
    // dedicated .panel-link overlay anchor on category pages) — match any
    // link that points at a skin page rather than one specific class.
    const href = $el.find('a[href]').filter((j, a) => {
      const h = $(a).attr('href') || '';
      return h.startsWith('/') && !h.startsWith('/category') && !h.startsWith('/static');
    }).first().attr('href');
    const title = $el.find('.card-title').first().text().trim();
    if (!title || !href) return;

    const icon = $el.find('.skin-image').first().attr('src');
    const slug = href.replace(/^\//, '');

    results.push({
      source: 'minecraftskins',
      id: slug,
      slug,
      title,
      description: null,
      author: null,
      downloads: null,
      icon: icon ? `${BASE}${icon}` : null,
      pageUrl: `${BASE}${href}`,
      categories: [],
      updatedAt: null,
      // Skins aren't Java/Bedrock-locked content the way mods are.
      edition: null,
      gameVersions: []
    });
  });
  return results;
}

async function search(query, limit = 20) {
  const normalized = (query || '').trim().toLowerCase();
  const path = CATEGORY_SLUGS.includes(normalized) ? `/category/${normalized}` : '/';
  const html = await fetchHtml(`${BASE}${path}`);
  const $ = cheerio.load(html);
  return parseCards($, limit);
}

module.exports = { search };
