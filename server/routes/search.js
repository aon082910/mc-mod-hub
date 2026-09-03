const express = require('express');
const router = express.Router();
const { getSetting } = require('../db');
const modrinth = require('../services/modrinth');
const curseforge = require('../services/curseforge');
const planetminecraft = require('../services/planetminecraft');
const ninemc = require('../services/ninemc');
const betterbedrock = require('../services/betterbedrock');
const hangar = require('../services/hangar');
const spigot = require('../services/spigot');
const { getCategory } = require('../services/categories');
const { getCached, setCached } = require('../services/cache');

const SOURCE_KEYS = [
  'enable_modrinth', 'enable_curseforge', 'enable_planetminecraft', 'enable_9minecraft',
  'enable_betterbedrock', 'enable_hangar', 'enable_spigot'
];

router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  const categoryKey = (req.query.category || '').trim();
  const category = categoryKey ? getCategory(categoryKey) : null;

  if (!query && !category) return res.json({ results: [], errors: [] });

  const limit = parseInt(getSetting('results_per_source') || '20', 10);

  // Cache key covers everything that changes the outcome: the query itself,
  // the result size, and which sources are currently toggled on (a source
  // flip should be reflected immediately, not wait out a stale cache entry).
  const sourceState = SOURCE_KEYS.map(k => getSetting(k)).join('');
  const cacheKey = `search:${query}|${categoryKey}|${limit}|${sourceState}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  const tasks = [];
  const errors = [];

  // Java-only sources (Modrinth, CurseForge) don't apply to the Bedrock
  // Add-Ons category — Minecraft Java and Bedrock content aren't interchangeable.
  const includeJavaSources = !(category && category.javaSourcesExcluded);

  if (includeJavaSources && getSetting('enable_modrinth') === '1') {
    tasks.push(
      modrinth.search(query, limit, category ? category.modrinthProjectType : null)
        .catch(e => { errors.push({ source: 'modrinth', message: e.message }); return []; })
    );
  }
  if (includeJavaSources && getSetting('enable_curseforge') === '1') {
    const cfKey = getSetting('curseforge_api_key');
    tasks.push(
      curseforge.search(query, cfKey, limit, category ? category.curseforgeClassName : null)
        .catch(e => { errors.push({ source: 'curseforge', message: e.message }); return []; })
    );
  }

  // Scraped sites have no real category-browse endpoint, so browsing a
  // category with no typed query falls back to searching that category's
  // representative keyword (e.g. "Shaders" -> "shader").
  const scrapeQuery = query || (category ? category.scrapeKeyword : '');

  // PlanetMinecraft/9Minecraft are client-mod/blog sites that don't
  // meaningfully index server plugins — the Plugins category skips them
  // rather than return noise.
  const includePlanetAndNineMc = !(category && category.excludePlanetAndNineMc);

  if (includePlanetAndNineMc && scrapeQuery && getSetting('enable_planetminecraft') === '1') {
    tasks.push(
      planetminecraft.search(scrapeQuery, limit)
        .catch(e => { errors.push({ source: 'planetminecraft', message: e.message }); return []; })
    );
  }
  if (includePlanetAndNineMc && scrapeQuery && getSetting('enable_9minecraft') === '1') {
    tasks.push(
      ninemc.search(scrapeQuery, limit)
        .catch(e => { errors.push({ source: '9minecraft', message: e.message }); return []; })
    );
  }
  if (getSetting('enable_betterbedrock') === '1' && (!category || category.includeBetterBedrock)) {
    tasks.push(
      betterbedrock.search(scrapeQuery || 'mod', limit)
        .catch(e => { errors.push({ source: 'betterbedrock', message: e.message }); return []; })
    );
  }
  if (scrapeQuery && getSetting('enable_hangar') === '1' && (!category || category.includeHangar)) {
    tasks.push(
      hangar.search(scrapeQuery, limit)
        .catch(e => { errors.push({ source: 'hangar', message: e.message }); return []; })
    );
  }
  if (scrapeQuery && getSetting('enable_spigot') === '1' && (!category || category.includeSpigot)) {
    tasks.push(
      spigot.search(scrapeQuery, limit)
        .catch(e => { errors.push({ source: 'spigot', message: e.message }); return []; })
    );
  }

  const resultSets = await Promise.all(tasks);
  const results = resultSets.flat().sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  const payload = { results, errors };
  if (results.length) setCached(cacheKey, payload);
  res.json(payload);
});

module.exports = router;
