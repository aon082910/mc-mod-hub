const fetch = require('node-fetch');

const BASE = 'https://api.modrinth.com/v2';
const HEADERS = { 'User-Agent': 'mc-mod-hub/1.0 (self-hosted mod search)' };

function mapHit(hit) {
  // Modrinth's search hits already list every supported game version; show
  // the newest few rather than the full (sometimes 40+ entry) list.
  const versions = Array.isArray(hit.versions) ? hit.versions.slice(-3).reverse() : [];
  return {
    source: 'modrinth',
    id: hit.project_id,
    slug: hit.slug,
    title: hit.title,
    description: hit.description,
    author: hit.author,
    downloads: hit.downloads,
    icon: hit.icon_url,
    pageUrl: `https://modrinth.com/${hit.project_type || 'mod'}/${hit.slug}`,
    categories: hit.categories || [],
    updatedAt: hit.date_modified,
    // Modrinth only ever hosts Minecraft: Java Edition content.
    edition: 'java',
    gameVersions: versions
  };
}

async function search(query, limit = 20, projectType = null) {
  const facets = projectType ? `&facets=${encodeURIComponent(JSON.stringify([[`project_type:${projectType}`]]))}` : '';
  const url = `${BASE}/search?query=${encodeURIComponent(query)}&limit=${limit}${facets}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Modrinth search failed: ${res.status}`);
  const data = await res.json();
  return (data.hits || []).map(mapHit);
}

// Empty-query + index=newest is Modrinth's documented way to browse the most
// recently published projects, used for the "newest" notice feed.
async function getNewest(limit = 10, projectType = null) {
  const facets = projectType ? `&facets=${encodeURIComponent(JSON.stringify([[`project_type:${projectType}`]]))}` : '';
  const url = `${BASE}/search?query=&index=newest&limit=${limit}${facets}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Modrinth newest failed: ${res.status}`);
  const data = await res.json();
  return (data.hits || []).map(mapHit);
}

async function getVersionsDownloadLink(slug) {
  const url = `${BASE}/project/${slug}/version`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const versions = await res.json();
  const latest = versions[0];
  if (!latest || !latest.files || !latest.files.length) return null;
  const primary = latest.files.find(f => f.primary) || latest.files[0];
  return primary.url;
}

module.exports = { search, getNewest, getVersionsDownloadLink };
