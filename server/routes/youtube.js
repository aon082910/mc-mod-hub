const express = require('express');
const router = express.Router();
const { getSetting } = require('../db');
const youtube = require('../services/youtube');

router.get('/youtube', async (req, res) => {
  const query = (req.query.mod || '').trim();
  if (!query) return res.json({ videos: [], errors: [] });
  if (getSetting('enable_youtube') !== '1') return res.json({ videos: [], errors: [], disabled: true });

  const apiKey = getSetting('youtube_api_key');
  try {
    const videos = await youtube.searchVideos(query, apiKey, 10);
    res.json({ videos, errors: [] });
  } catch (e) {
    res.json({ videos: [], errors: [{ source: 'youtube', message: e.message }] });
  }
});

module.exports = router;
