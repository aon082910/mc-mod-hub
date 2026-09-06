let currentResult = null;
let currentResults = [];
// The table on screen at any moment — currentResults after the active
// filters and sort are applied. openDetail(i) indexes into this, not
// currentResults, so a click always opens the row the user is actually
// looking at regardless of sort/filter state.
let displayedResults = [];
let categories = [];
let activeCategory = '';
let modsStatus = { enabled: false, available: false };
let isAdmin = false;

let sortState = { column: 'downloads', dir: 'desc' };
let resultFilters = { name: '', source: 'all', edition: 'all', version: '', minDownloads: '', postedAfter: '', updatedAfter: '' };

// mc-addons.com and mcpedl.com aren't scraped into the unified results list
// (see admin config for why) — both are still one click away here.
const OTHER_SITES = [
  { name: 'MC-Addons.com', url: () => 'https://mc-addons.com/' },
  { name: 'MCPEDL', url: q => `https://mcpedl.com/?s=${encodeURIComponent(q)}` }
];

async function init() {
  await loadCategories();
  loadNotices();
  refreshModsStatus();
  document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

async function refreshModsStatus() {
  try {
    const [statusRes, sessionRes] = await Promise.all([
      fetch('/api/mods/status'),
      fetch('/api/admin/session')
    ]);
    modsStatus = await statusRes.json();
    isAdmin = (await sessionRes.json()).isAdmin;
  } catch (e) {
    modsStatus = { enabled: false, available: false };
    isAdmin = false;
  }
}

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    categories = data.categories || [];
  } catch (e) {
    categories = [];
  }

  const pillsHtml = ['<span class="category-pill active" data-key="" onclick="selectPill(this,\'\')">All</span>']
    .concat(categories.map(c => `<span class="category-pill" data-key="${c.key}" onclick="selectPill(this,'${c.key}')">${c.icon} ${escapeHtml(c.label)}</span>`))
    .join('');
  document.getElementById('categoryPills').innerHTML = pillsHtml;

  document.getElementById('categoryGrid').innerHTML = categories.map(c => `
    <a class="category-tile" href="#" onclick="browseCategory('${c.key}');return false;">
      <span class="icon">${c.icon}</span>
      <span class="label">${escapeHtml(c.label)}</span>
    </a>
  `).join('');

  document.getElementById('sidebarCategories').innerHTML = categories.map(c => `
    <li><a href="#" onclick="browseCategory('${c.key}');return false;">${c.icon} ${escapeHtml(c.label)}</a></li>
  `).join('');
}

function selectPill(el, key) {
  document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  activeCategory = key;
}

const NOTICE_LIMIT_DEFAULT = 8;
const NOTICE_LIMIT_EXPANDED = 25;
let noticeExpanded = false;

async function loadNotices(limit = NOTICE_LIMIT_DEFAULT) {
  const el = document.getElementById('noticeBox');
  try {
    const res = await fetch(`/api/notices?limit=${limit}`);
    const data = await res.json();
    if (!data.items || !data.items.length) {
      el.innerHTML = '<div class="empty">No recent posts found right now.</div>';
      return;
    }
    el.innerHTML = data.items.map(item => `
      <div class="notice-item">
        <span class="notice-new-tag">NEW</span>
        <a href="${item.pageUrl}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
        <span class="notice-source">· ${escapeHtml(item.source)}</span>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<div class="error">Failed to load notice board: ${escapeHtml(e.message)}</div>`;
  }
}

// "limit" is per-source (see notices.js) — expanding asks each source for
// more of its own newest items, not a page 2 of a shared feed.
function toggleNoticeExpand() {
  noticeExpanded = !noticeExpanded;
  document.getElementById('noticeBox').classList.toggle('expanded', noticeExpanded);
  document.getElementById('noticeExpandBtn').textContent = noticeExpanded ? 'Show less' : 'Show more';
  loadNotices(noticeExpanded ? NOTICE_LIMIT_EXPANDED : NOTICE_LIMIT_DEFAULT);
}

function goHome() {
  document.getElementById('homeView').style.display = 'block';
  document.getElementById('resultsView').style.display = 'none';
  document.getElementById('myModsView').style.display = 'none';
  document.getElementById('q').value = '';
  document.getElementById('otherSites').innerHTML = '';
  document.querySelectorAll('.category-pill').forEach(p => p.classList.toggle('active', p.dataset.key === ''));
  activeCategory = '';
}

async function openMyMods() {
  document.getElementById('homeView').style.display = 'none';
  document.getElementById('resultsView').style.display = 'none';
  document.getElementById('myModsView').style.display = 'block';
  document.getElementById('otherSites').innerHTML = '';
  await refreshModsStatus();
  loadMyMods();
}

async function loadMyMods() {
  const el = document.getElementById('myModsContent');

  if (!isAdmin) {
    el.innerHTML = `<div class="panel">Log in to <a href="admin.html">Admin Config</a> first — installing/updating mods on your server requires an admin session.</div>`;
    return;
  }
  if (!modsStatus.enabled) {
    el.innerHTML = `<div class="panel">Mods folder integration is off. Enable it in <a href="admin.html">Admin Config</a> → Server Integration.</div>`;
    return;
  }
  if (!modsStatus.available) {
    el.innerHTML = `<div class="panel">Mods folder (<code>${escapeHtml(modsStatus.dir)}</code>) isn't mounted or isn't writable. Mount your server's mods folder there (see the Path config in the Unraid template) and restart the container.</div>`;
    return;
  }

  el.innerHTML = '<div class="empty">Scanning installed mods and checking for updates…</div>';
  try {
    const res = await fetch('/api/mods/installed');
    const data = await res.json();
    if (data.error) {
      el.innerHTML = `<div class="error">${escapeHtml(data.error)}</div>`;
      return;
    }
    if (data.errors && data.errors.length) {
      el.innerHTML = data.errors.map(e => `<div class="error">⚠ ${e.source}: ${escapeHtml(e.message)}</div>`).join('');
    } else {
      el.innerHTML = '';
    }
    if (!data.items.length) {
      el.innerHTML += `<div class="empty">No .jar files found in ${escapeHtml(modsStatus.dir)}.</div>`;
      return;
    }
    el.innerHTML += `
      <table class="results-table">
        <thead>
          <tr><th>File</th><th>Matched</th><th>Installed</th><th>Latest</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          ${data.items.map((item, i) => `
            <tr>
              <td>
                <div class="name-cell">
                  ${item.icon ? `<img src="${item.icon}" onerror="this.style.visibility='hidden'">` : ''}
                  <div>
                    <div class="title">${item.title ? escapeHtml(item.title) : escapeHtml(item.filename)}</div>
                    <div class="desc">${escapeHtml(item.filename)}</div>
                  </div>
                </div>
              </td>
              <td>${item.matched ? `<span class="source-tag ${sourceCssClass(item.source)}">${escapeHtml(item.source)}</span>` : '<span class="hint">unmatched</span>'}</td>
              <td>${item.installedVersion ? escapeHtml(item.installedVersion) : '—'}</td>
              <td>${item.latestVersion ? escapeHtml(item.latestVersion) : '—'}</td>
              <td>${modStatusBadge(item)}</td>
              <td>${item.updateDownloadUrl ? `<button class="btn small" onclick='updateInstalledMod(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Update</button>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    el.innerHTML = `<div class="error">Scan failed: ${escapeHtml(e.message)}</div>`;
  }
}

function modStatusBadge(item) {
  if (!item.matched) return '<span class="hint">Not matched — can\'t be identified by content hash</span>';
  if (item.upToDate === true) return '<span class="edition-tag java">Up to date</span>';
  if (item.upToDate === false) return '<span class="edition-tag bedrock">Update available</span>';
  return '<span class="hint">Unknown</span>';
}

async function updateInstalledMod(item) {
  try {
    const res = await fetch('/api/mods/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldFilename: item.filename, downloadUrl: item.updateDownloadUrl, newFilename: item.updateFilename, newVersion: item.updateVersion })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    loadMyMods();
  } catch (e) {
    alert(`Update failed: ${e.message}`);
  }
}

function scrollToCategories() {
  goHome();
  document.getElementById('categorySection').scrollIntoView({ behavior: 'smooth' });
}

function scrollToNotices() {
  goHome();
  document.getElementById('noticeBoardSection').scrollIntoView({ behavior: 'smooth' });
}

function browseCategory(key) {
  activeCategory = key;
  document.querySelectorAll('.category-pill').forEach(p => p.classList.toggle('active', p.dataset.key === key));
  document.getElementById('q').value = '';
  runSearch('', key);
}

function doSearch() {
  const q = document.getElementById('q').value.trim();
  if (!q && !activeCategory) return;
  runSearch(q, activeCategory);
}

async function runSearch(q, categoryKey) {
  const resultsEl = document.getElementById('results');
  const errorsEl = document.getElementById('errors');
  const titleEl = document.getElementById('resultsTitle');
  const countEl = document.getElementById('resultsCount');

  document.getElementById('homeView').style.display = 'none';
  document.getElementById('myModsView').style.display = 'none';
  document.getElementById('resultsView').style.display = 'block';
  resultsEl.innerHTML = '<div class="empty">Searching…</div>';
  errorsEl.innerHTML = '';

  const cat = categories.find(c => c.key === categoryKey);
  titleEl.textContent = q ? `Results for "${q}"` : (cat ? `Browsing: ${cat.label}` : 'Results');
  renderOtherSites(q || (cat ? cat.label : ''));

  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (categoryKey) params.set('category', categoryKey);
    const res = await fetch(`/api/search?${params.toString()}`);
    const data = await res.json();

    if (data.errors && data.errors.length) {
      errorsEl.innerHTML = data.errors.map(e => `<div class="error">⚠ ${e.source}: ${escapeHtml(e.message)}</div>`).join('');
    }

    currentResults = data.results || [];

    if (!currentResults.length) {
      countEl.textContent = '0 results';
      document.getElementById('resultsFilters').innerHTML = '';
      resultsEl.innerHTML = '<div class="empty">No results found.</div>';
      return;
    }

    // A fresh search resets the version/downloads/date free-text filters
    // (their old values likely don't apply to a new result set at all) but
    // keeps sort column/direction and the source/edition dropdowns, since
    // "always show Bedrock first, sorted by newest" is a standing
    // preference someone would want to carry across searches.
    resultFilters.name = '';
    resultFilters.version = '';
    resultFilters.minDownloads = '';
    resultFilters.postedAfter = '';
    resultFilters.updatedAfter = '';

    renderResultsFilters();
    renderResultsTable();
  } catch (e) {
    resultsEl.innerHTML = `<div class="error">Search failed: ${escapeHtml(e.message)}</div>`;
  }
}

const RESULT_COLUMNS = [
  { key: 'title', label: 'Name' },
  { key: 'source', label: 'Source' },
  { key: 'edition', label: 'Edition' },
  { key: 'version', label: 'Game Version' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'createdAt', label: 'Posted' },
  { key: 'updatedAt', label: 'Updated' }
];

function renderResultsFilters() {
  const el = document.getElementById('resultsFilters');
  const sources = [...new Set(currentResults.map(r => r.source))].sort();
  el.innerHTML = `
    <div class="filters-bar">
      <input type="text" placeholder="Filter by name…" value="${escapeHtml(resultFilters.name)}" oninput="setFilter('name', this.value)">
      <select onchange="setFilter('source', this.value)">
        <option value="all">All sources</option>
        ${sources.map(s => `<option value="${escapeHtml(s)}" ${resultFilters.source === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
      </select>
      <select onchange="setFilter('edition', this.value)">
        <option value="all" ${resultFilters.edition === 'all' ? 'selected' : ''}>All editions</option>
        <option value="java" ${resultFilters.edition === 'java' ? 'selected' : ''}>Java</option>
        <option value="bedrock" ${resultFilters.edition === 'bedrock' ? 'selected' : ''}>Bedrock</option>
        <option value="unknown" ${resultFilters.edition === 'unknown' ? 'selected' : ''}>Unknown</option>
      </select>
      <input type="text" placeholder="Version contains…" value="${escapeHtml(resultFilters.version)}" oninput="setFilter('version', this.value)">
      <input type="number" min="0" placeholder="Min downloads" value="${escapeHtml(resultFilters.minDownloads)}" oninput="setFilter('minDownloads', this.value)">
      <label class="filter-date-label">Posted after <input type="date" value="${escapeHtml(resultFilters.postedAfter)}" onchange="setFilter('postedAfter', this.value)"></label>
      <label class="filter-date-label">Updated after <input type="date" value="${escapeHtml(resultFilters.updatedAfter)}" onchange="setFilter('updatedAfter', this.value)"></label>
      <button class="btn secondary small" onclick="resetResultFilters()">Reset</button>
    </div>
  `;
}

function setFilter(key, value) {
  resultFilters[key] = value;
  renderResultsTable();
}

function resetResultFilters() {
  resultFilters = { name: '', source: 'all', edition: 'all', version: '', minDownloads: '', postedAfter: '', updatedAfter: '' };
  renderResultsFilters();
  renderResultsTable();
}

function setSort(column) {
  if (sortState.column === column) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.column = column;
    // Text-ish columns read more naturally starting A→Z; numeric/date
    // columns read more naturally starting with the biggest/newest first.
    sortState.dir = (column === 'title' || column === 'source' || column === 'edition' || column === 'version') ? 'asc' : 'desc';
  }
  renderResultsTable();
}

function sortValue(r, column) {
  switch (column) {
    case 'title': return (r.title || '').toLowerCase();
    case 'source': return r.source || '';
    case 'edition': return r.edition || '';
    case 'version': return (r.gameVersions && r.gameVersions[0]) || '';
    case 'downloads': return r.downloads;
    case 'createdAt': return r.createdAt ? new Date(r.createdAt).getTime() : null;
    case 'updatedAt': return r.updatedAt ? new Date(r.updatedAt).getTime() : null;
    default: return null;
  }
}

function renderResultsTable() {
  const resultsEl = document.getElementById('results');
  const countEl = document.getElementById('resultsCount');

  const nameQuery = resultFilters.name.trim().toLowerCase();
  const versionQuery = resultFilters.version.trim().toLowerCase();
  const minDownloads = resultFilters.minDownloads !== '' ? Number(resultFilters.minDownloads) : null;
  const postedAfter = resultFilters.postedAfter ? new Date(resultFilters.postedAfter).getTime() : null;
  const updatedAfter = resultFilters.updatedAfter ? new Date(resultFilters.updatedAfter).getTime() : null;

  let filtered = currentResults.filter(r => {
    if (nameQuery && !(r.title || '').toLowerCase().includes(nameQuery)) return false;
    if (resultFilters.source !== 'all' && r.source !== resultFilters.source) return false;
    if (resultFilters.edition === 'unknown' ? !!r.edition : (resultFilters.edition !== 'all' && r.edition !== resultFilters.edition)) return false;
    if (versionQuery && !(r.gameVersions || []).some(v => v.toLowerCase().includes(versionQuery))) return false;
    if (minDownloads != null && !(r.downloads >= minDownloads)) return false;
    if (postedAfter != null && !(r.createdAt && new Date(r.createdAt).getTime() >= postedAfter)) return false;
    if (updatedAfter != null && !(r.updatedAt && new Date(r.updatedAt).getTime() >= updatedAfter)) return false;
    return true;
  });

  const { column, dir } = sortState;
  const mul = dir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    const va = sortValue(a, column);
    const vb = sortValue(b, column);
    // Missing values always sort to the bottom regardless of direction —
    // "unknown" isn't meaningfully "less than" or "greater than" anything.
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -1 * mul;
    if (va > vb) return 1 * mul;
    return 0;
  });

  displayedResults = filtered;
  countEl.textContent = `${filtered.length} of ${currentResults.length} results`;

  if (!filtered.length) {
    resultsEl.innerHTML = '<div class="empty">No results match the current filters.</div>';
    return;
  }

  const arrow = col => sortState.column === col ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';

  resultsEl.innerHTML = `
    <table class="results-table">
      <thead>
        <tr>
          ${RESULT_COLUMNS.map(c => `<th class="sortable" onclick="setSort('${c.key}')">${c.label}${arrow(c.key)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${filtered.map((r, i) => `
          <tr class="result-row" onclick="openDetail(${i})">
            <td>
              <div class="name-cell">
                <img src="${r.icon || ''}" onerror="this.style.visibility='hidden'">
                <div>
                  <div class="title">${escapeHtml(r.title)}</div>
                  <div class="desc">${escapeHtml(r.description || '')}</div>
                </div>
              </div>
            </td>
            <td><span class="source-tag ${sourceCssClass(r.source)}">${escapeHtml(r.source)}</span></td>
            <td>${editionBadge(r.edition)}</td>
            <td>${versionTags(r.gameVersions)}</td>
            <td>${r.downloads ? r.downloads.toLocaleString() : '—'}</td>
            <td>${formatDate(r.createdAt) || '<span class="hint">—</span>'}</td>
            <td>${formatDate(r.updatedAt) || '<span class="hint">—</span>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function editionBadge(edition) {
  if (!edition) return '<span class="hint">—</span>';
  const label = edition === 'bedrock' ? 'Bedrock' : 'Java';
  return `<span class="edition-tag ${edition}">${label}</span>`;
}

function versionTags(versions) {
  if (!versions || !versions.length) return '<span class="hint">—</span>';
  return versions.map(v => `<span class="version-tag">${escapeHtml(v)}</span>`).join('');
}

function renderOtherSites(q) {
  const el = document.getElementById('otherSites');
  if (!q) { el.innerHTML = ''; return; }
  el.innerHTML = '<span class="stat" style="align-self:center">Not aggregated (see admin config for why) — search directly:</span>' +
    OTHER_SITES.map(s => `<a href="${s.url(q)}" target="_blank" rel="noopener">${escapeHtml(s.name)} ↗</a>`).join('');
}

function openDetail(i) {
  currentResult = displayedResults[i];
  document.getElementById('detail').style.display = 'block';
  document.querySelector('.search-row').style.display = 'none';
  document.querySelector('.main-nav').style.display = 'none';
  document.querySelector('.layout').style.display = 'none';

  const r = currentResult;
  document.getElementById('detailHeader').innerHTML = `
    <img src="${r.icon || ''}" onerror="this.style.visibility='hidden'">
    <div>
      <h2>${escapeHtml(r.title)}</h2>
      <p style="margin:0;color:var(--muted)">${r.description ? escapeHtml(r.description) : `<span class="hint">No description provided by ${escapeHtml(r.source)}</span>`}</p>
      <div class="badges">
        <span class="source-tag ${sourceCssClass(r.source)}">${escapeHtml(r.source)}</span>
        ${editionBadge(r.edition)}
        ${versionTags(r.gameVersions)}
        ${r.downloads != null ? `<span class="stat">${r.downloads.toLocaleString()} downloads</span>` : ''}
      </div>
    </div>
  `;

  loadOverview(r);
  loadDownloads(r);
  switchTab('overview');
  document.getElementById('tab-reviews').dataset.loaded = '';
  document.getElementById('tab-videos').dataset.loaded = '';
}

// Formats an ISO timestamp (or unix-seconds number, which a couple of
// sources use) into a plain readable date, or null if it can't be parsed —
// callers fall back to an honest "not provided" line rather than showing
// "Invalid Date".
function formatDate(value) {
  if (!value) return null;
  const d = typeof value === 'number' ? new Date(value * (value < 1e12 ? 1000 : 1)) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// A row of metadata that's honest about missing data: sources genuinely
// differ in what they publish (an official API vs. a scraped listing page),
// so a field with nothing to show says so instead of rendering blank.
function metaRow(label, value) {
  return `<div class="meta-row"><span class="meta-label">${escapeHtml(label)}</span><span>${value || '<span class="hint">Not provided by this source</span>'}</span></div>`;
}

function loadOverview(r) {
  const el = document.getElementById('tab-overview');
  const tags = (r.categories || []).filter(Boolean);
  el.innerHTML = `
    <div class="panel">
      <h3 style="margin-top:0">About this ${escapeHtml(r.source)} listing</h3>
      <p>${r.description ? escapeHtml(r.description) : `<span class="hint">${escapeHtml(r.source)} doesn't provide a description for this result.</span>`}</p>
      <div class="meta-grid">
        ${metaRow('Author', r.author ? escapeHtml(r.author) : null)}
        ${metaRow('Edition', editionBadge(r.edition))}
        ${metaRow('Game version(s)', r.gameVersions && r.gameVersions.length ? versionTags(r.gameVersions) : null)}
        ${metaRow('Downloads', r.downloads != null ? r.downloads.toLocaleString() : null)}
        ${metaRow('First posted', formatDate(r.createdAt))}
        ${metaRow('Last updated', formatDate(r.updatedAt))}
        ${metaRow('Tags / categories', tags.length ? tags.map(t => `<span class="version-tag">${escapeHtml(t)}</span>`).join('') : null)}
        ${r.price != null ? metaRow('Price', r.price > 0 ? `$${r.price.toFixed(2)}` : 'Free') : ''}
        ${metaRow('Source', `<span class="source-tag ${sourceCssClass(r.source)}">${escapeHtml(r.source)}</span>`)}
      </div>
      <a class="btn secondary" style="margin-top:12px" href="${r.pageUrl}" target="_blank" rel="noopener">Open full project page ↗</a>
    </div>
  `;
}

function closeDetail() {
  document.getElementById('detail').style.display = 'none';
  document.querySelector('.search-row').style.display = 'block';
  document.querySelector('.main-nav').style.display = 'flex';
  document.querySelector('.layout').style.display = 'flex';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  const panel = document.getElementById(`tab-${name}`);
  panel.style.display = 'block';

  if (name === 'reviews' && !panel.dataset.loaded) {
    panel.dataset.loaded = '1';
    loadReviews(currentResult);
  }
  if (name === 'videos' && !panel.dataset.loaded) {
    panel.dataset.loaded = '1';
    loadVideos(currentResult);
  }
}

function canInstallToServer(r) {
  if (!isAdmin || !modsStatus.enabled || !modsStatus.available) return false;
  if (r.source === 'modrinth' || r.source === 'hangar') return true; // resolved server-side from slug
  if (r.source === 'github') return !!(r.slug && r.slug.includes('/')); // resolved server-side from owner/repo, but only if a release with a .jar asset actually exists — checked at install time
  if (r.source === 'curseforge' || r.source === 'spigot') return !!(r.downloadUrl && r.downloadFilename);
  return false; // scraped sources have no reliable single-file download URL to install
}

function loadDownloads(r) {
  const el = document.getElementById('tab-downloads');
  el.innerHTML = `
    <div class="panel">
      <p>Direct project page and latest file, sourced from ${escapeHtml(r.source)}.</p>
      <p class="hint">Required edition: <b>${r.edition === 'bedrock' ? 'Minecraft Bedrock Edition' : 'Minecraft Java Edition'}</b>${r.gameVersions && r.gameVersions.length ? ` · Game version: <b>${r.gameVersions.map(escapeHtml).join(', ')}</b>` : ''}</p>
      <a class="btn" href="${r.pageUrl}" target="_blank" rel="noopener">Open project page ↗</a>
      ${r.downloadUrl ? `<a class="btn secondary" href="${r.downloadUrl}" target="_blank" rel="noopener" style="margin-left:8px">Direct file download ↗</a>` : ''}
      ${canInstallToServer(r) ? `<button class="btn secondary" style="margin-left:8px" onclick="installToServer()">⬇ Install to my server</button>` : ''}
      <div id="installStatus" class="save-status"></div>
    </div>
  `;
}

async function installToServer() {
  const r = currentResult;
  const status = document.getElementById('installStatus');
  status.textContent = 'Installing…';
  status.style.color = '';
  try {
    const body = (r.source === 'modrinth' || r.source === 'hangar' || r.source === 'github')
      ? { source: r.source, slug: r.slug }
      : { source: r.source, downloadUrl: r.downloadUrl, filename: r.downloadFilename };
    const res = await fetch('/api/mods/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Install failed');
    status.textContent = `✓ Installed as ${data.filename}`;
    status.style.color = 'var(--accent)';
  } catch (e) {
    status.textContent = `Failed: ${e.message}`;
    status.style.color = 'var(--danger)';
  }
}

async function loadReviews(r) {
  const el = document.getElementById('tab-reviews');
  el.innerHTML = '<div class="empty">Searching Reddit threads that mention this mod...</div>';
  try {
    const res = await fetch(`/api/reviews?mod=${encodeURIComponent(r.title)}`);
    const data = await res.json();
    if (!data.threads || !data.threads.length) {
      el.innerHTML = '<div class="empty">No discussion threads found. Modrinth/CurseForge don\'t expose a public reviews API, so this searches Reddit for mentions instead.</div>';
      return;
    }
    el.innerHTML = `
      <div class="panel">
        <p class="hint">⚠ These are community discussion comments, not verified store reviews. Flags below are heuristic signals (duplicate text, generic praise, burst timing) — not proof of fakery.</p>
      </div>
      ` + data.threads.map(t => `
        <div class="panel">
          <p style="margin:0 0 8px"><a href="${t.permalink}" target="_blank" rel="noopener">${escapeHtml(t.title)}</a>
            <span class="stat">${t.subreddit} · ${t.numComments} comments</span></p>
          ${(t.comments || []).length ? t.comments.map(c => `
            <div style="border-top:1px solid var(--border);padding:8px 0">
              <div class="trust-${c.trust}"><b>${escapeHtml(c.author)}</b> — trust: ${c.trust} (score ${c.score})</div>
              <div style="color:var(--text);font-size:14px;margin:4px 0">${escapeHtml(truncate(c.body, 300))}</div>
              ${c.flags.map(f => `<span class="flag-chip">${escapeHtml(f)}</span>`).join('')}
            </div>
          `).join('') : '<div class="hint">No top-level comments found.</div>'}
        </div>
      `).join('');
  } catch (e) {
    el.innerHTML = `<div class="error">Failed to load reviews: ${escapeHtml(e.message)}</div>`;
  }
}

async function loadVideos(r) {
  const el = document.getElementById('tab-videos');
  el.innerHTML = '<div class="empty">Searching YouTube...</div>';
  try {
    const res = await fetch(`/api/youtube?mod=${encodeURIComponent(r.title)}`);
    const data = await res.json();
    if (data.disabled) {
      el.innerHTML = '<div class="empty">YouTube search is disabled in Admin config.</div>';
      return;
    }
    if (data.errors && data.errors.length) {
      el.innerHTML = `<div class="error">${escapeHtml(data.errors[0].message)}</div>`;
      return;
    }
    if (!data.videos.length) {
      el.innerHTML = '<div class="empty">No videos found.</div>';
      return;
    }
    el.innerHTML = data.videos.map(v => `
      <div class="video-card">
        <a href="${v.url}" target="_blank" rel="noopener"><img src="${v.thumbnail || ''}"></a>
        <div>
          <p style="margin:0 0 4px"><a href="${v.url}" target="_blank" rel="noopener" style="color:var(--text);text-decoration:none;font-weight:600">${escapeHtml(v.title)}</a></p>
          <p class="stat" style="margin:0 0 6px">${escapeHtml(v.channel)} · ${(v.viewCount || 0).toLocaleString()} views</p>
          <div>
            ${v.links.length
              ? v.links.map(l => `<a class="link-chip ${l.knownModHost ? 'known' : ''}" href="${l.url}" target="_blank" rel="noopener">${l.knownModHost ? '✓ ' : ''}${escapeHtml(l.host || l.url)}</a>`).join('')
              : '<span class="hint">No links found in description</span>'}
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<div class="error">Failed to load videos: ${escapeHtml(e.message)}</div>`;
  }
}

function sourceCssClass(source) {
  // CSS class selectors can't start with a digit, so "9minecraft" needs a safe alias.
  return source === '9minecraft' ? 'ninemc' : source;
}

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : (s || ''); }
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

init();
