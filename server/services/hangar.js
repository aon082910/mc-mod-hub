const fetch = require('node-fetch');

const BASE = 'https://hangar.papermc.io/api/v1';
const HEADERS = { 'User-Agent': 'mc-mod-hub/1.0 (self-hosted mod search)', Accept: 'application/json' };

// Hangar is PaperMC's official plugin repository (Paper/Waterfall/Velocity
// server plugins) — a real, documented public API, no key required.
function mapProject(p) {
  const versions = [...new Set(Object.values(p.supportedPlatforms || {}).flat())].slice(-3).reverse();
  return {
    source: 'hangar',
    id: p.id,
    slug: `${p.namespace.owner}/${p.namespace.slug}`,
    title: p.name,
    description: p.description,
    author: p.namespace.owner,
    downloads: p.stats && p.stats.downloads,
    icon: p.avatarUrl,
    pageUrl: `https://hangar.papermc.io/${p.namespace.owner}/${p.namespace.slug}`,
    categories: p.category ? [p.category] : [],
    updatedAt: p.lastUpdated,
    // Hangar only hosts Minecraft: Java Edition server plugins.
    edition: 'java',
    gameVersions: versions
  };
}

async function search(query, limit = 20) {
  const url = `${BASE}/projects?query=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Hangar search failed: ${res.status}`);
  const data = await res.json();
  return (data.result || []).map(mapProject);
}

// Used by the "Install to my server" flow: resolves the latest version's
// download URL for a given owner/slug. Hangar versions can publish per
// platform (PAPER/WATERFALL/VELOCITY); this picks whichever platform the
// version actually has a file for, preferring PAPER since that's the most
// common target.
async function getLatestDownload(owner, slug) {
  const res = await fetch(`${BASE}/projects/${owner}/${slug}/versions?limit=1`, { headers: HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  const latest = (data.result || [])[0];
  if (!latest || !latest.downloads) return null;
  const platform = latest.downloads.PAPER ? 'PAPER' : Object.keys(latest.downloads)[0];
  const download = latest.downloads[platform];
  if (!download || !download.downloadUrl || !download.fileInfo) return null;
  return { url: download.downloadUrl, filename: download.fileInfo.name };
}

module.exports = { search, getLatestDownload };
