const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');

const searchRoutes = require('./routes/search');
const reviewRoutes = require('./routes/reviews');
const youtubeRoutes = require('./routes/youtube');
const categoriesRoutes = require('./routes/categories');
const noticesRoutes = require('./routes/notices');
const modsRoutes = require('./routes/mods');
const { router: adminRoutes } = require('./routes/admin');
const { getSetting } = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
// SESSION_SECRET is optional — if not set, db.js generates and persists a
// random one on first boot so it stays stable across restarts.
const SESSION_SECRET = process.env.SESSION_SECRET || getSetting('session_secret');

app.use(express.json());
app.use(cookieSession({
  name: 'mcmodhub_session',
  secret: SESSION_SECRET,
  maxAge: 12 * 60 * 60 * 1000
}));

app.use('/api', searchRoutes);
app.use('/api', reviewRoutes);
app.use('/api', youtubeRoutes);
app.use('/api', categoriesRoutes);
app.use('/api', noticesRoutes);
app.use('/api', modsRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`mc-mod-hub listening on port ${PORT}`);
});
