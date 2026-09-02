const { db, getSetting } = require('../db');

const getStmt = db.prepare('SELECT value, expires_at FROM search_cache WHERE cache_key = ?');
const setStmt = db.prepare(`
  INSERT INTO search_cache (cache_key, value, expires_at) VALUES (?, ?, ?)
  ON CONFLICT(cache_key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
`);
const purgeStmt = db.prepare('DELETE FROM search_cache WHERE expires_at < ?');

// Applies to search results and the notice board — both hit live APIs/scrapers
// on every request otherwise, which is slow to repeat and puts unnecessary
// load (and Cloudflare-challenge risk) on the scraped sites in particular.
function getCached(key) {
  const row = getStmt.get(key);
  if (!row) return undefined;
  if (row.expires_at < Date.now()) return undefined;
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return undefined;
  }
}

function setCached(key, value) {
  const ttlSeconds = parseInt(getSetting('cache_ttl_seconds') || '900', 10);
  if (ttlSeconds <= 0) return; // caching disabled
  const expiresAt = Date.now() + ttlSeconds * 1000;
  setStmt.run(key, JSON.stringify(value), expiresAt);
  // Opportunistic cleanup so the table doesn't grow unbounded from one-off queries.
  purgeStmt.run(Date.now());
}

module.exports = { getCached, setCached };
