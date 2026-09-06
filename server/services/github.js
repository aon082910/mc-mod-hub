const fetch = require('node-fetch');

const BASE = 'https://api.github.com';

// A lot of smaller mods/plugins — including ones that publish their listing
// on Hangar or Modrinth but link out to GitHub for the actual file (Hangar's
// own EssentialsX listing is one, per the "unmatched" case handled in
// hangar.js) — have no listing anywhere else at all. GitHub's search API is
// official, public, and needs no key, but its unauthenticated rate limit is
// only 10 requests/minute for search specifically (vs. 5000/hour for the
// REST API generally) — an optional personal access token raises that same
// way CurseForge's key is optional-but-recommended elsewhere in this app.
// `topic:minecraft` is required on every query to keep results on-topic;
// without it, a plain keyword search returns a lot of unrelated repos that
// merely mention Minecraft somewhere in their README.
function headers(token) {
  const h = { 'User-Agent': 'mc-mod-hub/1.0 (self-hosted mod search)', Accept: 'application/vnd.github+json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function mapRepo(r) {
  return {
    source: 'github',
    id: r.id,
    slug: r.full_name,
    title: r.name,
    description: r.description ? `${r.description} (★ ${r.stargazers_count})` : `★ ${r.stargazers_count} on GitHub`,
    author: r.owner ? r.owner.login : null,
    // GitHub doesn't publish a download counter on the repo itself (only
    // per-release-asset, which would need one extra request per result) —
    // star count is folded into the description above instead of masquerading
    // as a download count here, so sorting-by-downloads still means what it says.
    downloads: null,
    icon: r.owner ? r.owner.avatar_url : null,
    pageUrl: r.html_url,
    categories: r.topics || [],
    updatedAt: r.pushed_at,
    // GitHub hosts every kind of Minecraft project under the sun; there's no
    // structured edition/version field on a repo the way there is on
    // Modrinth/CurseForge/Hangar, so this is deliberately left unknown
    // rather than guessed from the repo name or topics.
    edition: null,
    gameVersions: []
  };
}

async function search(query, limit = 20, token = null) {
  const url = `${BASE}/search/repositories?q=${encodeURIComponent(query)}+topic:minecraft&sort=stars&order=desc&per_page=${limit}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    if (res.status === 403) throw new Error('GitHub search rate limit reached (10/min unauthenticated) — add a token in admin config to raise it');
    throw new Error(`GitHub search failed: ${res.status}`);
  }
  const data = await res.json();
  return (data.items || []).map(mapRepo);
}

// Used by the "Install to my server" flow: finds the newest release's first
// .jar asset for a given owner/repo. Returns null (not an error) when the
// repo has no releases, or has releases with no .jar attached (e.g. source-
// only tags, or a release that just links elsewhere) — same honest-null
// pattern as Hangar's getLatestDownload for externally-hosted files.
async function getLatestJarAsset(owner, repo, token = null) {
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/releases/latest`, { headers: headers(token) });
  if (!res.ok) return null;
  const release = await res.json();
  const asset = (release.assets || []).find(a => a.name.toLowerCase().endsWith('.jar'));
  if (!asset) return null;
  // tag_name rides along for the update tracker — GitHub has no hash-lookup
  // API, so "does the latest release still have this same tag" is the only
  // update check available for anything installed from here.
  return { url: asset.browser_download_url, filename: asset.name, version: release.tag_name };
}

module.exports = { search, getLatestJarAsset };
