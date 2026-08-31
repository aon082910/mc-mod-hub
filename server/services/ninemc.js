const cheerio = require('cheerio');
const { fetchHtml } = require('./scrapeUtils');

const BASE = 'https://www.9minecraft.net';

// 9minecraft titles read like "Sodium Mod (26.2, 1.20.1) – Get Higher FPS
// Instantly" — the parenthesized group holds every supported game version.
// The site is almost entirely Java Edition; its small Bedrock/PE section is
// tagged with a "pe" category/tag class on the card, which is checked below.
function parseVersionAndEdition(title, cardClass) {
  const match = title.match(/\(([^)]+)\)/);
  const gameVersions = match
    ? match[1].split(',').map(s => s.trim()).filter(s => /^\d+\.\d+/.test(s))
    : [];
  const edition = /\b(pe|pocket|bedrock)\b/i.test(cardClass || '') ? 'bedrock' : 'java';
  return { gameVersions, edition };
}

function parseCards($, root, limit) {
  const results = [];
  root.each((i, el) => {
    if (results.length >= limit) return;
    const $el = $(el);
    const titleLink = $el.find('.card-title a').first();
    const title = titleLink.text().trim();
    const href = titleLink.attr('href');
    if (!title || !href) return;

    const description = $el.find('.excerpt').first().text().trim();
    const icon = $el.find('.card-thumbnail img').first().attr('src');
    const cardClass = $el.attr('class') || '';
    const isMod = cardClass.includes('category-minecraft-mods');
    const { gameVersions, edition } = parseVersionAndEdition(title, cardClass);

    results.push({
      source: '9minecraft',
      id: href,
      slug: href,
      title,
      description: description || null,
      author: null,
      downloads: null, // 9minecraft is a blog; it doesn't publish download counters on listing pages
      icon: icon || null,
      pageUrl: href,
      categories: isMod ? ['mod'] : [],
      updatedAt: null,
      edition,
      gameVersions
    });
  });
  return results;
}

// 9minecraft.net's robots.txt allows all crawling (Allow: /), and it runs a
// standard WordPress search (?s=) that returns full server-rendered results.
async function search(query, limit = 20) {
  const url = `${BASE}/?s=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  return parseCards($, $('.result-card'), limit);
}

// The homepage with no query is just their latest-posts blog feed, used for
// the "newly posted" notice board.
async function getLatest(limit = 10) {
  const html = await fetchHtml(BASE);
  const $ = cheerio.load(html);
  return parseCards($, $('.result-card'), limit);
}

module.exports = { search, getLatest };
