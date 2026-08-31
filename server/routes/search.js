const express = require('express');
const router = express.Router();
const { getSetting } = require('../db');
const modrinth = require('../services/modrinth');
const curseforge = require('../services/curseforge');
const planetminecraft = require('../services/planetminecraft');
const ninemc = require('../services/ninemc');
const betterbedrock = require('../services/betterbedrock');
const { getCategory } = require('../services/categories');

router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  const categoryKey = (req.query.category || '').trim();
  const category = categoryKey ? getCategory(categoryKey) : null;

  if (!query && !category) return res.json({ results: [], errors: [] });

  const limit = parseInt(getSetting('results_per_source') || '20', 10);
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

  if (scrapeQuery && getSetting('enable_planetminecraft') === '1') {
    tasks.push(
      planetminecraft.search(scrapeQuery, limit)
        .catch(e => { errors.push({ source: 'planetminecraft', message: e.message }); return []; })
    );
  }
  if (scrapeQuery && getSetting('enable_9minecraft') === '1') {
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

  const resultSets = await Promise.all(tasks);
  const results = resultSets.flat().sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  res.json({ results, errors });
});

module.exports = router;
