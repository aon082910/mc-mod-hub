const fetch = require('node-fetch');

const BASE = 'https://api.curseforge.com/v1';
// CurseForge's Minecraft game ID is a fixed constant on their public API.
const MINECRAFT_GAME_ID = 432;

// CurseForge doesn't publish fixed numeric classIds for Minecraft anywhere
// in its docs, so instead of hardcoding guessed numbers, this resolves class
// names ("Mods", "Modpacks", ...) to their real classId at runtime via the
// documented GET /v1/categories?gameId=432&classesOnly=true endpoint, and
// caches the result for the life of the process.
let classCache = null;
let classCacheKey = null;

async function getClassId(className, apiKey) {
  if (!classCache || classCacheKey !== apiKey) {
    const url = `${BASE}/categories?gameId=${MINECRAFT_GAME_ID}&classesOnly=true`;
    const res = await fetch(url, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`CurseForge categories lookup failed: ${res.status}`);
    const data = await res.json();
    classCache = new Map((data.data || []).map(c => [c.name.toLowerCase(), c.id]));
    classCacheKey = apiKey;
  }
  return classCache.get(className.toLowerCase()) || null;
}

function mapMod(mod) {
  const latestFile = (mod.latestFiles || [])[0];
  const gameVersions = [...new Set(
    (mod.latestFilesIndexes || []).map(idx => idx.gameVersion).filter(Boolean)
  )].slice(0, 3);

  return {
    source: 'curseforge',
    id: mod.id,
    slug: mod.slug,
    title: mod.name,
    description: mod.summary,
    author: (mod.authors && mod.authors[0] && mod.authors[0].name) || 'unknown',
    downloads: mod.downloadCount,
    icon: mod.logo && mod.logo.thumbnailUrl,
    pageUrl: mod.links && mod.links.websiteUrl,
    downloadUrl: latestFile ? latestFile.downloadUrl : null,
    downloadFilename: latestFile ? latestFile.fileName : null,
    categories: (mod.categories || []).map(c => c.name),
    updatedAt: mod.dateModified,
    // CurseForge only ever hosts Minecraft: Java Edition content.
    edition: 'java',
    gameVersions
  };
}

async function search(query, apiKey, limit = 20, classNameFilter = null) {
  if (!apiKey) throw new Error('CurseForge API key is not configured');
  let url = `${BASE}/mods/search?gameId=${MINECRAFT_GAME_ID}&pageSize=${limit}`;
  if (query) url += `&searchFilter=${encodeURIComponent(query)}`;
  if (classNameFilter) {
    const classId = await getClassId(classNameFilter, apiKey);
    if (classId) url += `&classId=${classId}`;
    else return []; // this class doesn't exist on CurseForge for Minecraft — skip rather than fabricate
  } else if (!query) {
    // Browsing everything with no filter at all isn't a useful default; the
    // routes always pass either a query or a category, so this is just a guard.
    return [];
  }
  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`CurseForge search failed: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(mapMod);
}

// sortField=11 corresponds to ReleasedDate in CurseForge's documented
// ModsSearchSortField enum. Wrapped defensively by callers since this
// endpoint's exact numeric mapping isn't independently testable here.
async function getNewest(apiKey, limit = 10) {
  if (!apiKey) throw new Error('CurseForge API key is not configured');
  const url = `${BASE}/mods/search?gameId=${MINECRAFT_GAME_ID}&pageSize=${limit}&sortField=11&sortOrder=desc`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CurseForge newest failed: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(mapMod);
}

async function getModById(modId, apiKey) {
  const res = await fetch(`${BASE}/mods/${modId}`, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CurseForge mod lookup failed: ${res.status}`);
  const data = await res.json();
  return data.data;
}

// Identifies installed .jar files by their murmur2 "fingerprint" — the same
// mechanism CurseForge's own app/launcher uses (POST /v1/mods/fingerprints,
// documented at docs.curseforge.com). Returns a map keyed by the fingerprint
// that was looked up, to whatever file matched it.
async function lookupByFingerprints(fingerprints, apiKey) {
  if (!apiKey) throw new Error('CurseForge API key is not configured');
  if (!fingerprints.length) return {};
  const res = await fetch(`${BASE}/mods/fingerprints`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprints })
  });
  if (!res.ok) throw new Error(`CurseForge fingerprint lookup failed: ${res.status}`);
  const data = await res.json();
  const matches = (data.data && data.data.exactMatches) || [];
  const byFingerprint = {};
  for (const m of matches) {
    const fp = m.file && m.file.fileFingerprint;
    if (fp !== undefined) byFingerprint[fp] = m;
  }
  return byFingerprint;
}

module.exports = { search, getNewest, getClassId, getModById, lookupByFingerprints };
