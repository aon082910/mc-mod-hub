const fetch = require('node-fetch');

const BASE = 'https://api.polymart.org/v1';
const HEADERS = { 'User-Agent': 'mc-mod-hub/1.0 (self-hosted mod search)', Accept: 'application/json' };

// Polymart (the marketplace itself now trades as voxel.shop, but the public
// API is still hosted at api.polymart.org) is a real Spigot/Paper/Purpur
// plugin marketplace with free and paid listings. There's no published
// action-name list for the free/unauthenticated tier — "search" was found
// by testing candidate action names against the live API (getResources,
// searchResources, etc. all 404 with a clear "class not found" error;
// "search" is the one that actually works) since polymart.org's own API
// docs page is behind the same Cloudflare challenge that blocks the rest of
// the site. No API key is required for this endpoint.
function mapResult(r) {
  const versions = String(r.supportedMinecraftVersions || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return {
    source: 'polymart',
    id: r.id,
    slug: String(r.id),
    title: r.title,
    description: r.subtitle || null,
    author: (r.owner && r.owner.name) || null,
    // Search results don't include a download counter — only a per-resource
    // getResourceInfo call does, which isn't worth firing once per result.
    downloads: null,
    icon: r.thumbnailURL || null,
    pageUrl: r.url,
    categories: [],
    updatedAt: null,
    // Polymart only serves the Spigot/Paper/Bukkit plugin ecosystem — Java
    // Edition server software, no Bedrock content.
    edition: 'java',
    gameVersions: versions.slice(-3).reverse(),
    // Free listings are directly downloadable through the site; paid ones
    // aren't — same "link out, no install button" treatment as SpigotMC's
    // premium resources.
    price: parseFloat(r.price) || 0
  };
}

async function search(query, limit = 20) {
  const url = `${BASE}/search?query=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Polymart search failed: ${res.status}`);
  const data = await res.json();
  if (!data.response || !data.response.success) throw new Error('Polymart search returned an error response');
  return (data.response.result || []).map(mapResult);
}

module.exports = { search };
