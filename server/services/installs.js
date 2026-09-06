const { db } = require('../db');

// Tracks what this app itself installed into the mods folder, so the update
// checker can follow up on sources with no public hash-lookup API (Hangar,
// SpigotMC, GitHub) — Modrinth/CurseForge don't need this table at all,
// since exact content hashing already identifies those regardless of how
// or when the file got there. This table only ever knows about installs
// made through this app's own "Install to my server" button; a file for
// one of these sources dropped into the folder by hand is still — honestly
// — unmatched, the same as it always was, since there's nothing recorded
// to look it up by.
db.exec(`
  CREATE TABLE IF NOT EXISTS installs (
    filename TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    slug TEXT NOT NULL,
    installed_version TEXT,
    installed_at INTEGER NOT NULL
  );
`);

function record(filename, source, slug, installedVersion) {
  db.prepare(`
    INSERT INTO installs (filename, source, slug, installed_version, installed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(filename) DO UPDATE SET
      source = excluded.source, slug = excluded.slug,
      installed_version = excluded.installed_version, installed_at = excluded.installed_at
  `).run(filename, source, slug, installedVersion || null, Date.now());
}

function get(filename) {
  return db.prepare('SELECT * FROM installs WHERE filename = ?').get(filename);
}

// Used when /mods/update replaces a file under a new filename (CurseForge/
// Modrinth-style version-in-filename updates) — moves the provenance record
// across so the next scan still recognizes it.
function rename(oldFilename, newFilename, source, slug, installedVersion) {
  db.prepare('DELETE FROM installs WHERE filename = ?').run(oldFilename);
  record(newFilename, source, slug, installedVersion);
}

function remove(filename) {
  db.prepare('DELETE FROM installs WHERE filename = ?').run(filename);
}

module.exports = { record, get, rename, remove };
