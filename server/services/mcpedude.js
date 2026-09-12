const cheerio = require('cheerio');
const { fetchHtml } = require('./scrapeUtils');

const BASE = 'https://mcpedude.com';

// mcpedude.com is a Bedrock-only mods/addons blog (WordPress, Astra theme).
// Its `?s=` search is real and server-rendered — verified directly: a
// nonsense query returns zero result cards while a real one returns
// several, with byte-for-byte different output (not the same "no-op"
// pattern seen on a few other sites in this app). robots.txt only blocks
// /wp-admin/, so the search path is fair game.
function parseCards($, root, limit) {
  const results = [];
  root.each((i, el) => {
    if (results.length >= limit) return;
    const $el = $(el);
    const titleLink = $el.find('.entry-title a').first();
    const title = titleLink.text().trim();
    const href = titleLink.attr('href');
    if (!title || !href) return;

    const description = $el.find('.ast-excerpt-container p').first().text().trim();
    const icon = $el.find('.post-thumb-img-content img').first().attr('src');
    const category = $el.find('.cat-links a').first().text().trim();
    const publishedText = $el.find('.entry-meta .published').first().text().trim();
    const createdAt = publishedText ? new Date(publishedText).toISOString() : null;

    results.push({
      source: 'mcpedude',
      id: href,
      slug: href,
      title,
      description: description || null,
      author: null,
      // A blog, like 9Minecraft/PlanetMinecraft/TLMods — no download counter
      // published on listing cards.
      downloads: null,
      icon: icon || null,
      pageUrl: href,
      categories: category ? [category] : [],
      createdAt,
      // WordPress doesn't expose a separate "last modified" date on listing
      // cards the way it does the publish date, so this is left null rather
      // than reusing the publish date as a stand-in for "updated."
      updatedAt: null,
      // This site is Bedrock-only end to end (title, tagline, every category).
      edition: 'bedrock',
      // Unlike 9Minecraft's "(1.20.1)" title convention, titles here don't
      // reliably carry a version number to parse out.
      gameVersions: []
    });
  });
  return results;
}

async function search(query, limit = 20) {
  const url = `${BASE}/?s=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  return parseCards($, $('article'), limit);
}

// The homepage feed, used for the "newly posted" notice board.
async function getLatest(limit = 10) {
  const html = await fetchHtml(BASE);
  const $ = cheerio.load(html);
  return parseCards($, $('article'), limit);
}

module.exports = { search, getLatest };
