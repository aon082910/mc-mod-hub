const express = require('express');
const router = express.Router();
const { getSetting } = require('../db');
const { requireAuth } = require('./admin');
const modsFolder = require('../services/modsFolder');
const modrinth = require('../services/modrinth');
const curseforge = require('../services/curseforge');
const hangar = require('../services/hangar');
const { sha1Hex, curseforgeFingerprint } = require('../services/hashing');

function featureEnabled() {
  return getSetting('enable_mods_folder') === '1';
}

// Public capability check so the search page knows whether to show
// "Install to my server" buttons at all — no filesystem or auth info leaks
// through this, just two booleans.
router.get('/mods/status', async (req, res) => {
  const enabled = featureEnabled();
  const available = enabled ? await modsFolder.isAvailable() : false;
  res.json({ enabled, available, dir: modsFolder.MODS_DIR });
});

// Scans every .jar in the mounted mods folder, identifies it by exact
// content hash against Modrinth (SHA1) and CurseForge (murmur2 fingerprint),
// and reports whether a newer version is available for anything matched.
// Unmatched files are still listed (so the folder's contents are visible)
// but with no update information — there's nothing to compare against.
router.get('/mods/installed', requireAuth, async (req, res) => {
  if (!featureEnabled()) return res.status(400).json({ error: 'Mods folder feature is disabled in admin config' });
  if (!(await modsFolder.isAvailable())) {
    return res.status(400).json({ error: `Mods folder (${modsFolder.MODS_DIR}) is not mounted or not writable` });
  }

  const filenames = await modsFolder.listJarFiles();
  const fileBuffers = {};
  const sha1ByFile = {};
  const fingerprintByFile = {};

  for (const name of filenames) {
    try {
      const buf = await modsFolder.readFile(name);
      fileBuffers[name] = buf;
      sha1ByFile[name] = sha1Hex(buf);
      fingerprintByFile[name] = curseforgeFingerprint(buf);
    } catch (e) {
      // Unreadable file (permissions, mid-write, etc.) — skip it rather than fail the whole scan.
    }
  }

  const errors = [];
  let modrinthMatches = {};
  let cfMatches = {};

  if (getSetting('enable_modrinth') === '1') {
    try {
      modrinthMatches = await modrinth.lookupByHashes(Object.values(sha1ByFile));
    } catch (e) {
      errors.push({ source: 'modrinth', message: e.message });
    }
  }
  if (getSetting('enable_curseforge') === '1' && getSetting('curseforge_api_key')) {
    try {
      cfMatches = await curseforge.lookupByFingerprints(Object.values(fingerprintByFile), getSetting('curseforge_api_key'));
    } catch (e) {
      errors.push({ source: 'curseforge', message: e.message });
    }
  }

  // Batch-fetch Modrinth project metadata (title/icon) for every match in one call.
  const modrinthProjectIds = [...new Set(
    Object.values(modrinthMatches).map(m => m.project_id).filter(Boolean)
  )];
  let modrinthProjects = {};
  if (modrinthProjectIds.length) {
    try {
      const projects = await modrinth.getProjectsByIds(modrinthProjectIds);
      modrinthProjects = Object.fromEntries(projects.map(p => [p.id, p]));
    } catch (e) {
      errors.push({ source: 'modrinth', message: `Project lookup: ${e.message}` });
    }
  }

  const items = [];
  for (const name of filenames) {
    const sha1 = sha1ByFile[name];
    const fingerprint = fingerprintByFile[name];
    const mrMatch = sha1 ? modrinthMatches[sha1] : undefined;
    const cfMatch = fingerprint !== undefined ? cfMatches[fingerprint] : undefined;

    if (mrMatch) {
      const project = modrinthProjects[mrMatch.project_id];
      let latest = null;
      try {
        latest = await modrinth.getLatestVersion(mrMatch.project_id);
      } catch (e) { /* leave latest null — still show the match, just without an update verdict */ }
      const primaryFile = mrMatch.files.find(f => f.primary) || mrMatch.files[0];
      const latestFile = latest && (latest.files.find(f => f.primary) || latest.files[0]);
      items.push({
        filename: name,
        matched: true,
        source: 'modrinth',
        title: (project && project.title) || mrMatch.name,
        icon: project && project.icon_url,
        pageUrl: project ? `https://modrinth.com/${project.project_type || 'mod'}/${project.slug}` : null,
        installedVersion: mrMatch.version_number,
        latestVersion: latest ? latest.version_number : null,
        upToDate: latest ? latest.id === mrMatch.id : null,
        updateDownloadUrl: latest && latest.id !== mrMatch.id ? (latestFile && latestFile.url) : null,
        updateFilename: latest && latestFile ? latestFile.filename : null
      });
    } else if (cfMatch) {
      const mod = cfMatch.mod;
      const latestFile = (cfMatch.latestFiles || [])[0];
      const installedFile = cfMatch.file;
      items.push({
        filename: name,
        matched: true,
        source: 'curseforge',
        title: mod && mod.name,
        icon: mod && mod.logo && mod.logo.thumbnailUrl,
        pageUrl: mod && mod.links && mod.links.websiteUrl,
        installedVersion: installedFile && (installedFile.displayName || installedFile.fileName),
        latestVersion: latestFile ? (latestFile.displayName || latestFile.fileName) : null,
        upToDate: latestFile && installedFile ? latestFile.id === installedFile.id : null,
        updateDownloadUrl: latestFile && installedFile && latestFile.id !== installedFile.id ? latestFile.downloadUrl : null,
        updateFilename: latestFile ? latestFile.fileName : null
      });
    } else {
      items.push({
        filename: name,
        matched: false,
        source: null,
        title: null,
        installedVersion: null,
        latestVersion: null,
        upToDate: null
      });
    }
  }

  res.json({ items, errors });
});

// Modrinth and Hangar search results don't carry a direct file URL (their
// search APIs don't expose one), so for those sources this resolves the
// latest file itself from the project slug rather than requiring the
// frontend to know each site's download URL scheme. CurseForge and Spigot
// results already carry downloadUrl/downloadFilename directly from search,
// so those are used as-is.
router.post('/mods/install', requireAuth, async (req, res) => {
  if (!featureEnabled()) return res.status(400).json({ error: 'Mods folder feature is disabled in admin config' });
  if (!(await modsFolder.isAvailable())) {
    return res.status(400).json({ error: `Mods folder (${modsFolder.MODS_DIR}) is not mounted or not writable` });
  }
  const { source, slug, downloadUrl, filename } = req.body || {};

  try {
    let url = downloadUrl;
    let name = filename;
    if (source === 'modrinth') {
      if (!slug) return res.status(400).json({ error: 'slug is required for Modrinth installs' });
      const file = await modrinth.getVersionsDownloadLink(slug);
      if (!file) return res.status(404).json({ error: 'No downloadable file found for this project' });
      url = file.url;
      name = file.filename;
    } else if (source === 'hangar') {
      if (!slug || !slug.includes('/')) return res.status(400).json({ error: 'slug (owner/slug) is required for Hangar installs' });
      const [owner, projectSlug] = slug.split('/');
      const file = await hangar.getLatestDownload(owner, projectSlug);
      if (!file) return res.status(404).json({ error: 'No downloadable file found for this project' });
      url = file.url;
      name = file.filename;
    }
    if (!url || !name) return res.status(400).json({ error: 'downloadUrl and filename are required' });
    const saved = await modsFolder.downloadTo(name, url);
    res.json({ ok: true, filename: saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Replaces an installed file with a newer version. If the new file has a
// different filename than the old one (common — CurseForge/Modrinth file
// names usually embed the version), the old file is removed so you don't
// end up with both versions sitting in the mods folder at once.
router.post('/mods/update', requireAuth, async (req, res) => {
  if (!featureEnabled()) return res.status(400).json({ error: 'Mods folder feature is disabled in admin config' });
  if (!(await modsFolder.isAvailable())) {
    return res.status(400).json({ error: `Mods folder (${modsFolder.MODS_DIR}) is not mounted or not writable` });
  }
  const { oldFilename, downloadUrl, newFilename } = req.body || {};
  if (!oldFilename || !downloadUrl || !newFilename) {
    return res.status(400).json({ error: 'oldFilename, downloadUrl, and newFilename are required' });
  }
  try {
    const saved = await modsFolder.downloadTo(newFilename, downloadUrl);
    if (saved !== oldFilename) await modsFolder.deleteFile(oldFilename);
    res.json({ ok: true, filename: saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
