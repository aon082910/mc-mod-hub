const express = require('express');
const router = express.Router();
const { CATEGORIES } = require('../services/categories');

router.get('/categories', (req, res) => {
  res.json({
    categories: CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: c.icon }))
  });
});

module.exports = router;
