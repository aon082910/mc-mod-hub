const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const db = new Database(path.join(DATA_DIR, 'modhub.sqlite'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const DEFAULTS = {
  curseforge_api_key: '',
  youtube_api_key: '',
  admin_password_hash: '',
  enable_modrinth: '1',
  enable_curseforge: '1',
  enable_youtube: '1',
  enable_reddit: '1',
  enable_planetminecraft: '1',
  enable_9minecraft: '1',
  enable_betterbedrock: '1',
  results_per_source: '20'
};

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function init() {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULTS)) {
    insert.run(k, v);
  }
  // If no admin password has ever been set, seed one from env or a default,
  // so the admin portal is reachable on first boot.
  const current = getSetting('admin_password_hash');
  if (!current) {
    const initialPw = process.env.ADMIN_PASSWORD || 'admin';
    setSetting('admin_password_hash', hashPassword(initialPw));
  }

  // SESSION_SECRET is optional: if it's not supplied via env, generate one
  // once and persist it here so cookie sessions survive container restarts
  // instead of invalidating every time on a freshly-random secret.
  if (!getSetting('session_secret')) {
    setSetting('session_secret', crypto.randomBytes(32).toString('hex'));
  }
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : undefined;
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

init();

module.exports = { db, getSetting, getAllSettings, setSetting, hashPassword };
