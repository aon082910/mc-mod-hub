const express = require('express');
const router = express.Router();
const { getAllSettings, setSetting, getSetting, hashPassword } = require('../db');

const PUBLIC_SETTINGS_ONLY_ON_LOGIN = ['admin_password_hash'];

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password required' });
  const hash = hashPassword(password);
  if (hash === getSetting('admin_password_hash')) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Incorrect password' });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

router.get('/settings', requireAuth, (req, res) => {
  const settings = getAllSettings();
  // Never send the password hash back to the client.
  const safe = { ...settings };
  delete safe.admin_password_hash;
  delete safe.session_secret;
  // Mask secret keys but tell the frontend whether one is set.
  safe.curseforge_api_key_set = !!settings.curseforge_api_key;
  safe.youtube_api_key_set = !!settings.youtube_api_key;
  safe.curseforge_api_key = settings.curseforge_api_key ? '••••••••' : '';
  safe.youtube_api_key = settings.youtube_api_key ? '••••••••' : '';
  res.json(safe);
});

const EDITABLE_KEYS = [
  'curseforge_api_key', 'youtube_api_key',
  'enable_modrinth', 'enable_curseforge', 'enable_youtube', 'enable_reddit',
  'enable_planetminecraft', 'enable_9minecraft', 'enable_betterbedrock',
  'results_per_source', 'cache_ttl_seconds', 'enable_mods_folder'
];

router.post('/settings', requireAuth, (req, res) => {
  const body = req.body || {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] === undefined) continue;
    // Skip masked placeholder values so saving the form without touching
    // the key field doesn't wipe out an already-configured API key.
    if ((key === 'curseforge_api_key' || key === 'youtube_api_key') && body[key] === '••••••••') continue;
    setSetting(key, body[key]);
  }
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  setSetting('admin_password_hash', hashPassword(newPassword));
  res.json({ ok: true });
});

module.exports = { router, requireAuth };
