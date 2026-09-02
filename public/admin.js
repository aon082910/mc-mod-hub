async function checkSession() {
  const res = await fetch('/api/admin/session');
  const data = await res.json();
  if (data.isAdmin) {
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadSettings();
  } else {
    document.getElementById('loginPanel').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
  }
}

async function login() {
  const password = document.getElementById('loginPassword').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (res.ok) {
    checkSession();
  } else {
    document.getElementById('loginError').textContent = data.error || 'Login failed';
  }
}

async function logout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  checkSession();
}

async function loadSettings() {
  const res = await fetch('/api/admin/settings');
  if (!res.ok) return checkSession();
  const s = await res.json();
  document.getElementById('curseforge_api_key').value = s.curseforge_api_key || '';
  document.getElementById('youtube_api_key').value = s.youtube_api_key || '';
  document.getElementById('enable_modrinth').checked = s.enable_modrinth === '1';
  document.getElementById('enable_curseforge').checked = s.enable_curseforge === '1';
  document.getElementById('enable_planetminecraft').checked = s.enable_planetminecraft === '1';
  document.getElementById('enable_9minecraft').checked = s.enable_9minecraft === '1';
  document.getElementById('enable_betterbedrock').checked = s.enable_betterbedrock === '1';
  document.getElementById('enable_youtube').checked = s.enable_youtube === '1';
  document.getElementById('enable_reddit').checked = s.enable_reddit === '1';
  document.getElementById('results_per_source').value = s.results_per_source || 20;
  document.getElementById('cache_ttl_seconds').value = s.cache_ttl_seconds || 900;
  document.getElementById('enable_mods_folder').checked = s.enable_mods_folder === '1';
  refreshModsFolderStatus();
}

async function refreshModsFolderStatus() {
  const el = document.getElementById('modsFolderStatus');
  try {
    const res = await fetch('/api/mods/status');
    const s = await res.json();
    if (!s.enabled) {
      el.textContent = '';
      return;
    }
    el.textContent = s.available
      ? `✓ Mounted and writable at ${s.dir}`
      : `⚠ Not mounted or not writable at ${s.dir} — mount a volume there for this feature to work`;
    el.style.color = s.available ? 'var(--accent)' : 'var(--warn)';
  } catch (e) {
    el.textContent = '';
  }
}

async function saveSettings() {
  const body = {
    curseforge_api_key: document.getElementById('curseforge_api_key').value,
    youtube_api_key: document.getElementById('youtube_api_key').value,
    enable_modrinth: document.getElementById('enable_modrinth').checked ? '1' : '0',
    enable_curseforge: document.getElementById('enable_curseforge').checked ? '1' : '0',
    enable_planetminecraft: document.getElementById('enable_planetminecraft').checked ? '1' : '0',
    enable_9minecraft: document.getElementById('enable_9minecraft').checked ? '1' : '0',
    enable_betterbedrock: document.getElementById('enable_betterbedrock').checked ? '1' : '0',
    enable_youtube: document.getElementById('enable_youtube').checked ? '1' : '0',
    enable_reddit: document.getElementById('enable_reddit').checked ? '1' : '0',
    results_per_source: document.getElementById('results_per_source').value,
    cache_ttl_seconds: document.getElementById('cache_ttl_seconds').value,
    enable_mods_folder: document.getElementById('enable_mods_folder').checked ? '1' : '0'
  };
  const res = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const status = document.getElementById('saveStatus');
  if (res.ok) {
    status.textContent = '✓ Saved';
    status.style.color = 'var(--accent)';
    loadSettings();
  } else {
    status.textContent = 'Failed to save';
    status.style.color = 'var(--danger)';
  }
  setTimeout(() => status.textContent = '', 3000);
}

async function changePassword() {
  const newPassword = document.getElementById('newPassword').value;
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword })
  });
  const data = await res.json();
  const status = document.getElementById('pwStatus');
  if (res.ok) {
    status.textContent = '✓ Password updated';
    status.style.color = 'var(--accent)';
    document.getElementById('newPassword').value = '';
  } else {
    status.textContent = data.error || 'Failed';
    status.style.color = 'var(--danger)';
  }
  setTimeout(() => status.textContent = '', 3000);
}

document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
checkSession();
