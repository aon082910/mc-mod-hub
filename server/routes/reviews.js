const express = require('express');
const router = express.Router();
const { getSetting } = require('../db');
const reddit = require('../services/reddit');
const { scoreComments } = require('../services/fakeSignal');

router.get('/reviews', async (req, res) => {
  const modName = (req.query.mod || '').trim();
  if (!modName) return res.json({ threads: [], errors: [] });
  if (getSetting('enable_reddit') !== '1') return res.json({ threads: [], errors: [] });

  const errors = [];
  try {
    const threads = await reddit.findThreads(modName, 6);
    const withComments = await Promise.all(threads.map(async t => {
      try {
        const comments = await reddit.getTopComments(t.permalink, 15);
        return { ...t, comments: scoreComments(comments) };
      } catch (e) {
        errors.push({ thread: t.title, message: e.message });
        return { ...t, comments: [] };
      }
    }));
    res.json({ threads: withComments, errors });
  } catch (e) {
    res.json({ threads: [], errors: [{ source: 'reddit', message: e.message }] });
  }
});

module.exports = router;
