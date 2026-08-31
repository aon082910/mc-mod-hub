let currentResult = null;
let currentResults = [];
let categories = [];
let activeCategory = '';

// mc-addons.com and mcpedl.com aren't scraped into the unified results list
// (see admin config for why) — both are still one click away here.
const OTHER_SITES = [
  { name: 'MC-Addons.com', url: () => 'https://mc-addons.com/' },
  { name: 'MCPEDL', url: q => `https://mcpedl.com/?s=${encodeURIComponent(q)}` }
];

async function init() {
  await loadCategories();
  loadNotices();
  document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
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

async function loadNotices() {
  const el = document.getElementById('noticeBox');
  try {
    const res = await fetch('/api/notices');
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

function goHome() {
  document.getElementById('homeView').style.display = 'block';
  document.getElementById('resultsView').style.display = 'none';
  document.getElementById('q').value = '';
  document.getElementById('otherSites').innerHTML = '';
  document.querySelectorAll('.category-pill').forEach(p => p.classList.toggle('active', p.dataset.key === ''));
  activeCategory = '';
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
    countEl.textContent = `${currentResults.length} results`;

    if (!currentResults.length) {
      resultsEl.innerHTML = '<div class="empty">No results found.</div>';
      return;
    }

    resultsEl.innerHTML = `
      <table class="results-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Source</th>
            <th>Edition</th>
            <th>Game Version</th>
            <th>Downloads</th>
          </tr>
        </thead>
        <tbody>
          ${currentResults.map((r, i) => `
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
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    resultsEl.innerHTML = `<div class="error">Search failed: ${escapeHtml(e.message)}</div>`;
  }
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
  currentResult = currentResults[i];
  document.getElementById('detail').style.display = 'block';
  document.querySelector('.search-row').style.display = 'none';
  document.querySelector('.main-nav').style.display = 'none';
  document.querySelector('.layout').style.display = 'none';

  const r = currentResult;
  document.getElementById('detailHeader').innerHTML = `
    <img src="${r.icon || ''}" onerror="this.style.visibility='hidden'">
    <div>
      <h2>${escapeHtml(r.title)}</h2>
      <p style="margin:0;color:var(--muted)">${escapeHtml(r.description || '')}</p>
      <div class="badges">
        <span class="source-tag ${sourceCssClass(r.source)}">${escapeHtml(r.source)}</span>
        ${editionBadge(r.edition)}
        ${versionTags(r.gameVersions)}
        <span class="stat">${(r.downloads || 0).toLocaleString()} downloads</span>
      </div>
    </div>
  `;

  loadDownloads(r);
  switchTab('downloads');
  document.getElementById('tab-reviews').dataset.loaded = '';
  document.getElementById('tab-videos').dataset.loaded = '';
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

function loadDownloads(r) {
  const el = document.getElementById('tab-downloads');
  el.innerHTML = `
    <div class="panel">
      <p>Direct project page and latest file, sourced from ${escapeHtml(r.source)}.</p>
      <p class="hint">Required edition: <b>${r.edition === 'bedrock' ? 'Minecraft Bedrock Edition' : 'Minecraft Java Edition'}</b>${r.gameVersions && r.gameVersions.length ? ` · Game version: <b>${r.gameVersions.map(escapeHtml).join(', ')}</b>` : ''}</p>
      <a class="btn" href="${r.pageUrl}" target="_blank" rel="noopener">Open project page ↗</a>
      ${r.downloadUrl ? `<a class="btn secondary" href="${r.downloadUrl}" target="_blank" rel="noopener" style="margin-left:8px">Direct file download ↗</a>` : ''}
    </div>
  `;
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
