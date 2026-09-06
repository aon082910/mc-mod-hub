const fetch = require('node-fetch');

const BASE = 'https://api.spiget.org/v2';
const HEADERS = { 'User-Agent': 'mc-mod-hub/1.0 (self-hosted mod search)', Accept: 'application/json' };

// SpigotMC itself has no public API and is fronted by anti-bot protection
// that blocks direct scraping (confirmed: a direct download link 403s).
// Spiget (spiget.org) is a long-running, widely-used third-party API that
// mirrors free SpigotMC resources on its own CDN, which sidesteps that
// block entirely — verified end-to-end: its /download endpoint redirects
// to a real, directly-fetchable .jar on cdn.spiget.org.
function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'resource';
}

function mapResource(r) {
  const filename = `${slugify(r.name)}-${r.id}.jar`;
  return {
    source: 'spigot',
    id: r.id,
    slug: String(r.id),
    title: r.name,
    description: r.tag,
    author: null, // search hits only carry an author id, not a display name
    downloads: r.downloads,
    icon: `https://api.spiget.org/v2/resources/${r.id}/icon`,
    pageUrl: `https://www.spigotmc.org/resources/${r.id}/`,
    // Premium (paid) resources aren't downloadable through Spiget's mirror —
    // link to the page instead of a download that would just 402/403.
    downloadUrl: r.premium ? null : `${BASE}/resources/${r.id}/download`,
    downloadFilename: r.premium ? null : filename,
    categories: [],
    createdAt: r.releaseDate ? new Date(r.releaseDate * 1000).toISOString() : null,
    updatedAt: r.updateDate ? new Date(r.updateDate * 1000).toISOString() : null,
    // SpigotMC only hosts Minecraft: Java Edition server plugins.
    edition: 'java',
    gameVersions: (r.testedVersions || []).slice(-3).reverse()
  };
}

async function search(query, limit = 20) {
  // "icon" is deliberately left out of fields: Spiget always embeds a large
  // base64 copy of the image alongside its URL, which would bloat every
  // search response for no reason since the icon is built from the
  // resource id via a separate, dedicated endpoint anyway (see mapResource).
  const url = `${BASE}/search/resources/${encodeURIComponent(query)}?size=${limit}&fields=name,tag,downloads,premium,testedVersions,updateDate,releaseDate`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Spigot (Spiget) search failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return []; // Spiget returns {} instead of [] for zero results on some queries
  return data.map(mapResource);
}

// Used by the update tracker: Spiget's own resource metadata doesn't carry
// a proper Minecraft-style version string, but its `/versions/latest`
// endpoint returns a stable id + display name for whatever the current
// download actually is. Spiget has no hash-lookup API, so comparing this id
// against what was recorded at install time is the only update check
// available for anything installed from here.
async function getLatestVersion(resourceId) {
  const res = await fetch(`${BASE}/resources/${resourceId}/versions/latest`, { headers: HEADERS });
  if (!res.ok) return null;
  const v = await res.json();
  if (!v || v.id === undefined) return null;
  return { id: v.id, name: v.name || String(v.id) };
}

// Used by the update tracker to re-fetch title/icon for a Spigot install
// that wasn't matched by hash — search results aren't persisted anywhere,
// so this is the only way back to a display name for a bare resource id.
async function getResourceInfo(resourceId) {
  const res = await fetch(`${BASE}/resources/${resourceId}?fields=name`, { headers: HEADERS });
  if (!res.ok) return null;
  return res.json();
}

module.exports = { search, getLatestVersion, getResourceInfo };
