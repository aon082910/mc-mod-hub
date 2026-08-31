const fetch = require('node-fetch');

// Reddit's public JSON search endpoint requires no API key and is used here
// as a stand-in "review/comment" source since Modrinth/CurseForge don't
// expose public review APIs. Results are opinions found in threads that
// mention the mod, not verified reviews.
const HEADERS = { 'User-Agent': 'mc-mod-hub/1.0 (self-hosted mod search; comment discovery)' };

async function findThreads(query, limit = 8) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query + ' minecraft mod')}&sort=relevance&limit=${limit}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Reddit search failed: ${res.status}`);
  const data = await res.json();
  return (data.data.children || []).map(c => ({
    id: c.data.id,
    title: c.data.title,
    permalink: `https://reddit.com${c.data.permalink}`,
    subreddit: c.data.subreddit_name_prefixed,
    score: c.data.score,
    numComments: c.data.num_comments,
    createdUtc: c.data.created_utc,
    author: c.data.author
  }));
}

async function getTopComments(permalink, limit = 15) {
  const url = `${permalink}.json?limit=${limit}&depth=1`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Reddit comments fetch failed: ${res.status}`);
  const data = await res.json();
  const listing = data[1];
  if (!listing) return [];
  return (listing.data.children || [])
    .filter(c => c.kind === 't1' && c.data.body)
    .map(c => ({
      author: c.data.author,
      body: c.data.body,
      score: c.data.score,
      createdUtc: c.data.created_utc
    }));
}

module.exports = { findThreads, getTopComments };
