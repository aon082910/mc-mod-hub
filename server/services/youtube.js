const fetch = require('node-fetch');

const BASE = 'https://www.googleapis.com/youtube/v3';

// Matches links to the known mod-hosting sites so we can pull the actual
// download link back out of a video description, plus generic http(s) URLs
// as a fallback for sites not on the known list.
const KNOWN_MOD_HOSTS = [
  'modrinth.com', 'curseforge.com', 'www.curseforge.com', 'legacy.curseforge.com',
  'github.com', 'spigotmc.org', 'planetminecraft.com', 'mcmodsworld.com',
  '9minecraft.net', 'mcmod.cn'
];

function extractLinks(text) {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s)\]]+)/g;
  const found = text.match(urlRegex) || [];
  const cleaned = found.map(u => u.replace(/[.,;)\]]+$/, ''));
  const unique = [...new Set(cleaned)];
  return unique.map(url => {
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* skip malformed */ }
    return { url, host, knownModHost: KNOWN_MOD_HOSTS.some(h => host.endsWith(h.replace(/^www\./, ''))) };
  });
}

async function searchVideos(query, apiKey, limit = 10) {
  if (!apiKey) throw new Error('YouTube API key is not configured');
  const url = `${BASE}/search?part=snippet&type=video&maxResults=${limit}&q=${encodeURIComponent(query + ' minecraft mod')}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = await res.json();
  const ids = (data.items || []).map(i => i.id.videoId).filter(Boolean);
  if (!ids.length) return [];
  return getVideoDetails(ids, apiKey);
}

async function getVideoDetails(videoIds, apiKey) {
  const url = `${BASE}/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube video details failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map(v => ({
    id: v.id,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    thumbnail: v.snippet.thumbnails && (v.snippet.thumbnails.medium || v.snippet.thumbnails.default).url,
    description: v.snippet.description,
    viewCount: v.statistics && v.statistics.viewCount,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    links: extractLinks(v.snippet.description)
  }));
}

module.exports = { searchVideos, getVideoDetails, extractLinks };
