const cheerio = require('cheerio');
const { fetchHtml, parseAbbreviatedNumber } = require('./scrapeUtils');

const BASE = 'https://www.planetminecraft.com';

// PlanetMinecraft's card subtitle reads like "Minecraft 1.21.5 Functional Mod"
// (Java) or occasionally references Bedrock/PE content. There's no separate
// structured field for either, so both are parsed out of that text.
function parseVersionAndEdition(subtitle, title) {
  const text = `${subtitle || ''} ${title || ''}`;
  const versionMatch = text.match(/\b\d+\.\d+(?:\.\d+)?\b/);
  const gameVersions = versionMatch ? [versionMatch[0]] : [];
  const edition = /\b(bedrock|mcpe|pocket edition|\bpe\b)\b/i.test(text) ? 'bedrock' : 'java';
  return { gameVersions, edition };
}

// planetminecraft.com's robots.txt allows crawling /mods/ search results as
// long as no advanced-filter/time-machine query params are used, which this
// avoids — see project README for the robots.txt check behind this.
async function search(query, limit = 20) {
  const url = `${BASE}/mods/?keywords=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const results = [];

  $('li.resource.r-data').each((i, el) => {
    if (results.length >= limit) return;
    const $el = $(el);
    const titleLink = $el.find('a.r-title').first();
    const title = titleLink.text().trim();
    const href = titleLink.attr('href');
    if (!title || !href) return;

    const downloadsText = $el.find('.r-stats .get_app').next('span').text();
    const author = $el.find('.contributed .activity_name').first().text().trim();
    const icon = $el.find('.r-preview img').first().attr('src');
    const subtitle = $el.find('.r-subject').first().text().trim();
    const { gameVersions, edition } = parseVersionAndEdition(subtitle, title);

    results.push({
      source: 'planetminecraft',
      id: $el.attr('data-id') || href,
      slug: href,
      title,
      description: subtitle || null,
      author: author || 'unknown',
      downloads: parseAbbreviatedNumber(downloadsText),
      icon: icon ? (icon.startsWith('http') ? icon : `${BASE}${icon}`) : null,
      pageUrl: href.startsWith('http') ? href : `${BASE}${href}`,
      categories: [],
      updatedAt: null,
      edition,
      gameVersions
    });
  });

  return results;
}

module.exports = { search };
