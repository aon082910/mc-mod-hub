const express = require('express');
const router = express.Router();
const { getSetting } = require('../db');
const modrinth = require('../services/modrinth');
const ninemc = require('../services/ninemc');
const curseforge = require('../services/curseforge');
const { getCached, setCached } = require('../services/cache');

const SOURCE_KEYS = ['enable_modrinth', 'enable_9minecraft', 'enable_curseforge'];

// The "newest" notice board merges freshly-published items across sources.
// CurseForge's contribution is best-effort (see curseforge.js getNewest) and
// is simply dropped from the feed rather than failing the whole board if its
// sort parameter turns out to be wrong.
// `limit` is per-source (not total) and clamped to a sane range — the
// "Show more" button on the notice board just re-requests with a higher
// limit rather than paginating, since these are "newest" feeds, not a
// stable list with pages.
router.get('/notices', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 30);
  const sourceState = SOURCE_KEYS.map(k => getSetting(k)).join('');
  const cacheKey = `notices:${sourceState}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  const tasks = [];
  const errors = [];

  if (getSetting('enable_modrinth') === '1') {
    tasks.push(
      modrinth.getNewest(limit)
        .catch(e => { errors.push({ source: 'modrinth', message: e.message }); return []; })
    );
  }
  if (getSetting('enable_9minecraft') === '1') {
    tasks.push(
      ninemc.getLatest(limit)
        .catch(e => { errors.push({ source: '9minecraft', message: e.message }); return []; })
    );
  }
  if (getSetting('enable_curseforge') === '1') {
    const cfKey = getSetting('curseforge_api_key');
    tasks.push(
      curseforge.getNewest(cfKey, limit)
        .catch(e => { errors.push({ source: 'curseforge', message: e.message }); return []; })
    );
  }

  const resultSets = await Promise.all(tasks);
  const seen = new Set();
  const items = resultSets.flat().filter(item => {
    if (seen.has(item.pageUrl)) return false;
    seen.add(item.pageUrl);
    return true;
  });

  const payload = { items, errors };
  if (items.length) setCached(cacheKey, payload);
  res.json(payload);
});

module.exports = router;
