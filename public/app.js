/* ── Auth ──────────────────────────────────────────────────────────── */
const TOKEN_KEY = 'ceo_auth_token';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

/* ── API helper ────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) { clearToken(); showLoginPage(); throw new Error('Session expired'); }

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Router ────────────────────────────────────────────────────────── */
function navigate(path) {
  history.pushState({}, '', path);
  router();
}

function router() {
  if (!getToken()) { showLoginPage(); return; }
  const path = location.pathname;
  const clientMatch = path.match(/^\/client\/(.+)$/);
  if (clientMatch) {
    renderClientPage(clientMatch[1]);
  } else {
    renderDashboard();
  }
}

window.addEventListener('popstate', router);
window.addEventListener('DOMContentLoaded', router);

/* ── Login page ────────────────────────────────────────────────────── */
function showLoginPage() {
  const ha = document.getElementById('header-actions');
  if (ha) ha.innerHTML = '';

  const app = document.getElementById('app');
  app.style.padding = '0';
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <span class="login-logo-icon">✦</span>
          <span class="login-logo-text">Cold Email OS</span>
        </div>
        <div class="login-heading">Welcome <span>back.</span></div>
        <div class="login-sub">Sign in to access the Gamic Media fulfillment dashboard.</div>
        <div id="login-error"></div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input id="login-password" class="form-input" type="password"
            placeholder="Enter your password" autocomplete="current-password" />
        </div>
        <button class="btn btn-primary btn-lg" style="width:100%" onclick="submitLogin()">
          Sign In →
        </button>
        <div class="login-footer">Internal use only — Gamic Media</div>
      </div>
    </div>
  `;
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitLogin();
  });
  setTimeout(() => document.getElementById('login-password')?.focus(), 50);
}

async function submitLogin() {
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  if (!password) { errEl.innerHTML = '<div class="alert alert-error">Password is required.</div>'; return; }

  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.token) {
    errEl.innerHTML = '<div class="alert alert-error">Incorrect password. Try again.</div>';
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
    return;
  }

  setToken(data.token);
  document.getElementById('app').style.padding = '';
  navigate('/');
}

/* ── Status helpers ────────────────────────────────────────────────── */
function statusBadge(status) {
  const map = {
    ONBOARDED:         ['badge-onboarded', 'Onboarded'],
    RESEARCH_READY:    ['badge-research',  'Research Ready'],
    READY_TO_GENERATE: ['badge-ready',     'Ready'],
    LIVE:              ['badge-live',       'Live'],
  };
  const [cls, label] = map[status] || ['badge-onboarded', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Modal ─────────────────────────────────────────────────────────── */
let modalEl = null;

function openModal(html) {
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.className = 'modal-overlay';
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(); });
  }
  modalEl.innerHTML = `<div class="modal">${html}</div>`;
  requestAnimationFrame(() => modalEl.classList.add('open'));
}

function closeModal() {
  if (modalEl) {
    modalEl.classList.remove('open');
    setTimeout(() => { if (modalEl) modalEl.innerHTML = ''; }, 200);
  }
}

/* ── Dashboard ─────────────────────────────────────────────────────── */
async function renderDashboard() {
  document.getElementById('header-actions').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
      <button class="btn btn-primary" onclick="showNewClientModal()">+ New Client</button>
      <button class="btn btn-ghost btn-sm" onclick="logout()" title="Sign out">↩ Sign out</button>
    </div>
  `;

  const app = document.getElementById('app');
  app.innerHTML = `<div style="color:var(--text-muted);padding:60px 0;text-align:center">Loading…</div>`;

  let tenants = [];
  try { tenants = await api('GET', '/tenants'); } catch { return; }

  const live  = tenants.filter(t => t.status === 'LIVE').length;
  const ready = tenants.filter(t => ['RESEARCH_READY','READY_TO_GENERATE'].includes(t.status)).length;

  app.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Client <span>Dashboard</span></div>
        <div class="page-subtitle">Manage onboarding, research &amp; campaign generation</div>
      </div>
      <button class="btn btn-primary btn-lg" onclick="showNewClientModal()">+ New Client</button>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">${tenants.length}</div>
        <div class="stat-label">Total Clients</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--blue)">${ready}</div>
        <div class="stat-label">Research Ready</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--green)">${live}</div>
        <div class="stat-label">Live</div>
      </div>
    </div>

    <div class="clients-grid">
      ${tenants.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">✦</div>
          <div class="empty-state-title">No clients yet</div>
          <p style="margin-bottom:24px">Create your first client to get started</p>
          <button class="btn btn-primary btn-lg" onclick="showNewClientModal()">+ New Client</button>
        </div>
      ` : tenants.map(t => `
        <div class="client-card" onclick="navigate('/client/${t.id}')">
          <div class="client-card-name">${esc(t.name)}</div>
          ${statusBadge(t.status)}
          <div class="client-card-meta">
            <span class="client-card-date">${fmtDate(t.created_at)}</span>
            <button class="btn btn-secondary btn-sm">Open →</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function logout() {
  clearToken();
  navigate('/');
}

function confirmDeleteClient(id, name) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Delete Client</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="alert alert-error" style="margin-bottom:16px">
        This will permanently delete <strong>${esc(name)}</strong> and all associated research, campaigns, and data. This cannot be undone.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="deleteClient('${id}')">Delete Permanently</button>
    </div>
  `);
}

async function deleteClient(id) {
  try {
    const res = await fetch(`/tenants/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });
    if (!res.ok && res.status !== 204) throw new Error('Delete failed');
    closeModal();
    navigate('/');
  } catch (e) {
    openModal(`
      <div class="modal-header">
        <div class="modal-title">Error</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-error">${esc(e.message)}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      </div>
    `);
  }
}

function showNewClientModal() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">New Client</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="modal-error"></div>
      <div class="form-group">
        <label class="form-label">Client Name</label>
        <input id="new-client-name" class="form-input" placeholder="e.g. Acme Inc." autofocus />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createClient()">Create Client</button>
    </div>
  `);
  document.getElementById('new-client-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') createClient();
  });
}

async function createClient() {
  const name = document.getElementById('new-client-name').value.trim();
  if (!name) {
    document.getElementById('modal-error').innerHTML = '<div class="alert alert-error">Name is required.</div>';
    return;
  }
  try {
    const tenant = await api('POST', '/tenants', { name });
    closeModal();
    navigate(`/client/${tenant.id}`);
  } catch (e) {
    document.getElementById('modal-error').innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

/* ── Client page ───────────────────────────────────────────────────── */
let pollTimer = null;

async function renderClientPage(id) {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  document.getElementById('header-actions').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="logout()">↩ Sign out</button>
  `;

  const app = document.getElementById('app');
  app.innerHTML = `<div style="color:var(--text-muted);padding:60px 0;text-align:center">Loading…</div>`;

  let tenant;
  try { tenant = await api('GET', `/tenants/${id}`); }
  catch (e) { app.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`; return; }

  renderClientView(tenant);
}

function renderClientView(tenant) {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  // Update header to include delete button now that we have tenant data
  document.getElementById('header-actions').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteClient('${tenant.id}','${esc(tenant.name)}')">🗑 Delete</button>
      <button class="btn btn-ghost btn-sm" onclick="logout()">↩ Sign out</button>
    </div>
  `;

  const app = document.getElementById('app');
  app.innerHTML = `
    <button class="back-btn" onclick="navigate('/')">← Back to Dashboard</button>

    <div class="client-header">
      <div class="client-name">${esc(tenant.name)}</div>
      ${statusBadge(tenant.status)}
    </div>

    <div class="tabs">
      <button class="tab active" onclick="switchTab(this,'research')">Research</button>
      <button class="tab" onclick="switchTab(this,'generate')">Generate Campaigns</button>
    </div>

    <div id="tab-research" class="tab-panel active">
      ${renderResearchTab(tenant)}
    </div>
    <div id="tab-generate" class="tab-panel">
      ${renderGenerateTab(tenant)}
    </div>
  `;

  loadResearchReport(tenant);
  loadGenerations(tenant);
}

function switchTab(btn, name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`tab-${name}`).classList.add('active');
}

/* ── Research tab ──────────────────────────────────────────────────── */
function renderResearchTab(tenant) {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Onboarding Research</span>
        ${tenant.status !== 'ONBOARDED'
          ? `<button class="btn btn-secondary btn-sm" onclick="showRerunModal('${tenant.id}')">Re-run Research</button>`
          : ''}
      </div>
      <div class="card-body">
        <div id="research-content">
          ${tenant.status === 'ONBOARDED'
            ? renderTranscriptForm(tenant.id)
            : '<div style="color:var(--text-muted);font-size:13px">Loading report…</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderTranscriptForm(tenantId) {
  return `
    <div class="transcript-section">
      <div class="form-group">
        <label class="form-label">Onboarding Call Transcript</label>
        <textarea id="transcript-input" class="form-textarea" style="min-height:220px"
          placeholder="Paste the full onboarding call transcript here…"></textarea>
        <div class="form-hint">Minimum 50 characters. Claude will extract keywords, ICP, and research targets automatically.</div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Client Website URL <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>
        <input id="website-url-input" class="form-input" type="url"
          placeholder="https://clientwebsite.com — Jina will scrape it for richer research context" />
      </div>
      <div id="research-error"></div>
      <div class="transcript-actions">
        <button class="btn btn-primary btn-lg" onclick="runResearch('${tenantId}')">✦ Run Research</button>
        <span style="font-size:13px;color:var(--text-dim)">Takes 2–5 minutes</span>
      </div>
    </div>
  `;
}

async function runResearch(tenantId) {
  const transcript = document.getElementById('transcript-input')?.value.trim();
  let websiteUrl = document.getElementById('website-url-input')?.value.trim() || undefined;
  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) websiteUrl = 'https://' + websiteUrl;
  const errEl = document.getElementById('research-error');
  if (!transcript || transcript.length < 50) {
    errEl.innerHTML = '<div class="alert alert-error">Transcript must be at least 50 characters.</div>';
    return;
  }
  errEl.innerHTML = '';
  try {
    const payload = { transcript_text: transcript };
    if (websiteUrl) payload.website_url = websiteUrl;
    await api('POST', `/tenants/${tenantId}/research/run`, payload);
    document.getElementById('research-content').innerHTML = `
      <div class="research-status">
        <div class="spinner"></div>
        Research pipeline running — parsing transcript, scraping YouTube, Reddit &amp; competitors…
      </div>
      <div style="margin-top:18px;font-size:13px;color:var(--text-dim)">
        This usually takes 2–5 minutes. The page will update automatically when done.
      </div>
    `;
    startPolling(tenantId);
  } catch (e) {
    errEl.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

function startPolling(tenantId) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const t = await api('GET', `/tenants/${tenantId}`);
      if (t.status !== 'ONBOARDED') {
        clearInterval(pollTimer); pollTimer = null;
        renderClientView(t);
      }
    } catch (_) {}
  }, 4000);
}

async function loadResearchReport(tenant) {
  if (tenant.status === 'ONBOARDED') return;
  const el = document.getElementById('research-content');
  if (!el) return;
  try {
    const report = await api('GET', `/tenants/${tenant.id}/research/report`);
    window.__currentReport = report;
    el.innerHTML = renderReport(report, tenant.name);
    populateGenerateDefaults(report.report_json);
  } catch (e) {
    if (e.message.includes('No active report')) el.innerHTML = renderTranscriptForm(tenant.id);
  }
}

// Auto-fill Generate tab from research data
function populateGenerateDefaults(rj) {
  if (!rj) return;

  // Persona: first ICP segment name from Reddit research
  const segments = rj.reddit_segments?.segments || [];
  const personaEl = document.getElementById('gen-persona');
  if (personaEl && segments.length > 0) {
    personaEl.value = segments[0].name;
  }

  // Verticals: extract from ICP summary + search keywords
  const verticals = extractVerticalsFromResearch(rj);
  const datalist  = document.getElementById('vertical-options');
  const verticalEl = document.getElementById('gen-vertical');
  if (datalist && verticals.length > 0) {
    datalist.innerHTML = verticals.map(v => `<option value="${esc(v)}">`).join('');
    if (verticalEl) verticalEl.value = verticals[0];
  }
}

function extractVerticalsFromResearch(rj) {
  const icp  = (rj.icp_summary  || '').toLowerCase();
  const keys = (rj.search_keywords || []).join(' ').toLowerCase();
  const all  = icp + ' ' + keys;

  const industryMap = [
    { terms: ['ad agency','advertising agency','media buying','ad platform','ad tech','interactive ad','video ad'],  label: 'Advertising / Ad Tech' },
    { terms: ['ecommerce','e-commerce','shopify','retail','dtc','direct-to-consumer'],                               label: 'E-commerce' },
    { terms: ['saas','software as a service','tech startup','b2b software'],                                         label: 'SaaS / B2B Software' },
    { terms: ['cpg','consumer packaged','consumer goods','fmcg','consumer products','brand owner'],                  label: 'CPG / Consumer Brands' },
    { terms: ['automotive','auto dealer','car dealer','vehicle'],                                                     label: 'Automotive' },
    { terms: ['entertainment','media company','streaming','content creator'],                                        label: 'Entertainment / Media' },
    { terms: ['restaurant','food service','hospitality','qsr','food & beverage'],                                    label: 'Restaurant / Hospitality' },
    { terms: ['real estate','mortgage','property management','realtor'],                                             label: 'Real Estate' },
    { terms: ['finance','financial advisor','wealth management','fintech','investment'],                              label: 'Finance / Fintech' },
    { terms: ['healthcare','medical','health tech','pharma','medtech'],                                              label: 'Healthcare' },
    { terms: ['recruit','staffing','talent acquisition','hiring','hr tech'],                                         label: 'Recruiting / Staffing' },
    { terms: ['marketing agency','digital marketing','growth agency','performance marketing'],                        label: 'Marketing Agency' },
    { terms: ['coaching','consultant','consulting','advisory'],                                                       label: 'Coaching / Consulting' },
    { terms: ['video production','media production','video agency'],                                                 label: 'Video Production' },
    { terms: ['legal','law firm','attorney','legal tech'],                                                           label: 'Legal Services' },
  ];

  const matches = [];
  for (const { terms, label } of industryMap) {
    if (terms.some(t => all.includes(t))) matches.push(label);
  }

  // Fallback generics appended at end
  const generics = ['SaaS / B2B Software', 'E-commerce', 'Coaching / Consulting', 'B2B Services'];
  for (const g of generics) {
    if (!matches.includes(g)) matches.push(g);
  }

  return matches.slice(0, 10);
}

/* ── Report renderer — matches actual report_json shape ────────────── */
function hasRealData(arr, placeholder) {
  if (!arr?.length) return false;
  return arr.some(v => (typeof v === 'string' ? v !== placeholder : v?.name !== placeholder));
}

/* Render a YouTube/insight item — handles old string[] and new object[] */
function renderInsightItem(item) {
  if (typeof item === 'string') {
    return `<div class="bullet-item">${esc(item)}</div>`;
  }
  return `
    <div class="insight-item">
      <div class="insight-name">${esc(item.name||'')}</div>
      <div class="insight-desc">${esc(item.description||'')}</div>
      ${(item.sub_points||[]).length ? `
        <div class="insight-subs">
          ${item.sub_points.map(s=>`<div class="insight-sub">${esc(s)}</div>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/* Render a named-point item (motivation / tradeoff) — handles old string and new {name,points} */
function renderNamedPoint(item) {
  if (typeof item === 'string') {
    return `<div class="bullet-item">${esc(item)}</div>`;
  }
  return `
    <div class="named-point">
      <div class="named-point-name">${esc(item.name||'')}</div>
      ${(item.points||[]).map(p=>`<div class="named-point-item">${esc(p)}</div>`).join('')}
    </div>
  `;
}

function renderReport(report, clientName) {
  const rj          = report.report_json || {};
  const youtube     = rj.youtube_insights || {};
  const reddit      = rj.reddit_segments  || {};
  const competitors = rj.competitor_analysis || {};

  const youtubeHasData    = hasRealData(youtube.problems, 'No data');
  const redditHasData     = reddit.overarching_dream && reddit.overarching_dream !== 'No Reddit data available';
  const competitorHasData = competitors.competitors?.length > 0;

  return `
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-secondary btn-sm" onclick="copyReportToClipboard()">⎘ Copy Report</button>
      <button class="btn btn-secondary btn-sm" onclick="downloadReport()" title="Opens in browser — press Cmd+P to save as PDF, or import into Google Docs">↓ Download Report</button>
    </div>
    <div class="report-sections">
    ${reportSection('🎯', 'ICP & Overview', `
      <div class="info-grid">
        ${rj.client_name  ? `<div><div class="info-item-label">Client</div><div class="info-item-value">${esc(rj.client_name)}</div></div>` : ''}
        ${rj.client_offer ? `<div><div class="info-item-label">Offer</div><div class="info-item-value">${esc(rj.client_offer)}</div></div>` : ''}
      </div>
      ${rj.icp_summary ? `<div style="margin-bottom:18px"><div class="info-item-label">ICP Summary</div><div class="info-item-value" style="margin-top:5px;line-height:1.7">${esc(rj.icp_summary)}</div></div>` : ''}
      ${rj.search_keywords?.length ? `
        <div class="info-item-label" style="margin-bottom:8px">Research Keywords</div>
        <div class="tag-list">${rj.search_keywords.map(k => `<span class="tag">${esc(k)}</span>`).join('')}</div>
      ` : ''}
    `, true)}

    ${youtubeHasData ? reportSection('▶', 'YouTube — Pain Points & Desires', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:28px">
        <div>
          <div class="info-item-label" style="margin-bottom:12px">💢 Problems</div>
          <div class="insight-list">${(youtube.problems||[]).filter(p=>typeof p==='string'?p!=='No data':p?.name!=='No data').map(renderInsightItem).join('')}</div>
        </div>
        <div>
          <div class="info-item-label" style="margin-bottom:12px">🌟 Desires</div>
          <div class="insight-list">${(youtube.desires||[]).filter(d=>typeof d==='string'?d!=='No data':d?.name!=='No data').map(renderInsightItem).join('')}</div>
        </div>
      </div>
      ${youtube.video_summaries?.length ? `
        <div class="info-item-label" style="margin-bottom:14px">📋 Video Summaries</div>
        ${youtube.video_summaries.map(v=>`
          <div class="video-card">
            <div class="video-title">${esc(v.title||'')}</div>
            ${v.url ? `<a href="${esc(v.url)}" target="_blank" class="video-url">${esc(v.url)}</a>` : ''}
            ${v.summary ? `<div class="video-summary">${esc(v.summary)}</div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px">
              ${v.pain_points?.length ? `
                <div>
                  <div class="info-item-label" style="margin-bottom:8px">Pain Points Highlighted</div>
                  ${v.pain_points.map(p => typeof p==='string'
                    ? `<div class="bullet-item">${esc(p)}</div>`
                    : `<div class="video-insight"><span class="video-insight-name">${esc(p.name)}</span><span class="video-insight-desc">${esc(p.description)}</span></div>`
                  ).join('')}
                </div>
              ` : ''}
              ${v.desires?.length ? `
                <div>
                  <div class="info-item-label" style="margin-bottom:8px">Desires Addressed</div>
                  ${v.desires.map(d => typeof d==='string'
                    ? `<div class="bullet-item">${esc(d)}</div>`
                    : `<div class="video-insight"><span class="video-insight-name">${esc(d.name)}</span><span class="video-insight-desc">${esc(d.description)}</span></div>`
                  ).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      ` : ''}
    `) : reportSection('▶', 'YouTube — Pain Points & Desires', `
      <div class="no-data-msg">YouTube research returned no results for this client's keywords. Re-run research or check Apify credits.</div>
    `)}

    ${redditHasData ? reportSection('💬', 'Reddit — Customer Segments', `
      <div class="overarching-dream">
        <div class="info-item-label" style="margin-bottom:5px">Overarching Dream</div>
        <div style="font-size:14px;color:var(--text);line-height:1.6">${esc(reddit.overarching_dream)}</div>
      </div>
      ${(reddit.segments||[]).map(seg=>`
        <div class="segment-card">
          <div class="segment-name">👤 ICP Segment — ${esc(seg.name||'')}</div>

          ${seg.core_driver ? `
            <div class="core-driver-block">
              <div class="info-item-label" style="margin-bottom:6px">🚗 Core Driver</div>
              <div style="font-size:13px;color:var(--text);line-height:1.7">${esc(seg.core_driver)}</div>
            </div>
          ` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
            ${seg.problems?.filter(p=>p!=='N/A').length ? `
              <div>
                <div class="info-item-label" style="margin-bottom:10px">Problems</div>
                <div class="bullet-list">${seg.problems.filter(p=>p!=='N/A').map(p=>`<div class="bullet-item">${esc(p)}</div>`).join('')}</div>
              </div>
            ` : ''}
            ${seg.desires?.filter(d=>d!=='N/A').length ? `
              <div>
                <div class="info-item-label" style="margin-bottom:10px">Desires</div>
                <div class="bullet-list">${seg.desires.filter(d=>d!=='N/A').map(d=>`<div class="bullet-item">${esc(d)}</div>`).join('')}</div>
              </div>
            ` : ''}
          </div>

          ${seg.motivations?.length ? `
            <div style="margin-bottom:20px">
              <div class="info-item-label" style="margin-bottom:12px">Motivations</div>
              <div class="named-points-grid">
                ${seg.motivations.map(renderNamedPoint).join('')}
              </div>
            </div>
          ` : ''}

          ${seg.tradeoffs?.length ? `
            <div style="margin-bottom:16px">
              <div class="info-item-label" style="margin-bottom:12px">Tradeoffs / Challenges</div>
              <div class="named-points-grid">
                ${seg.tradeoffs.map(renderNamedPoint).join('')}
              </div>
            </div>
          ` : ''}

          ${seg.citations?.length ? `
            <div>
              <div class="info-item-label" style="margin-bottom:8px">🔗 Citations</div>
              <div class="citations-list">${seg.citations.map(c=>`<div class="citation-item">${esc(c)}</div>`).join('')}</div>
            </div>
          ` : ''}
        </div>
      `).join('')}
    `) : reportSection('💬', 'Reddit — Customer Segments', `
      <div class="no-data-msg">Reddit research returned no results. Re-run research or check Apify credits.</div>
    `)}

    ${competitorHasData ? reportSection('🔍', 'Competitor Analysis', `
      ${competitors.competitors.map(c=>`
        <div class="segment-card">
          <div class="segment-name">
            🔗 ${esc(c.name||'')}
            ${c.url ? `<span style="font-weight:400;color:var(--text-muted);font-size:12px"> — <a href="${esc(c.url)}" target="_blank" style="color:var(--violet);text-decoration:none">${esc(c.url)}</a></span>` : ''}
          </div>
          <div style="margin-bottom:14px">
            <div class="info-item-label" style="margin-bottom:8px">📢 Marketing Positioning</div>
            ${(c.marketing_quotes||[]).map(q=>`<div class="quote-block">"${esc(q)}"</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            ${c.positioning_strength ? `
              <div class="comp-strength-block">
                <div class="info-item-label" style="margin-bottom:6px;color:var(--green)">✅ Strength</div>
                <div style="font-size:13px;color:var(--text);line-height:1.6">${esc(c.positioning_strength)}</div>
              </div>
            ` : ''}
            ${c.strategic_gap ? `
              <div class="comp-gap-block">
                <div class="info-item-label" style="margin-bottom:6px;color:var(--amber)">⚠️ Gap</div>
                <div style="font-size:13px;color:var(--text);line-height:1.6">${esc(c.strategic_gap)}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    `) : ''}

    ${rj.customer_dna ? reportSection('🧬', 'CustomerDNA — Psychographic Intelligence', renderCustomerDna(rj.customer_dna)) : ''}
  </div>`;
}

/* ── CustomerDNA renderer ──────────────────────────────────────────── */
function renderCustomerDna(dna) {
  if (!dna) return '<div class="no-data-msg">CustomerDNA analysis not available.</div>';

  const dnaBlock = (label, content) => `
    <div class="dna-block">
      <div class="dna-block-label">${label}</div>
      <div class="dna-block-content">${esc(content)}</div>
    </div>`;

  const dnaSubHead = label => `<div class="info-item-label" style="margin:18px 0 8px;font-size:11px;letter-spacing:.06em">${label}</div>`;

  // Section 6 — Headlines
  const headlinesHtml = (dna.headlines||[]).map(h => `
    <div class="dna-headline-card">
      <div class="dna-headline-text">"${esc(h.headline)}"</div>
      <div class="dna-headline-annotation">${esc(h.annotation)}</div>
    </div>`).join('');

  // Section 6 — Hooks
  const hooks = dna.hooks || {};
  const hooksHtml = ['loss','aspiration','pattern_interrupt','identity'].map(key => {
    const labels = { loss:'Loss Hook', aspiration:'Aspiration Hook', pattern_interrupt:'Pattern-Interrupt Hook', identity:'Identity Hook' };
    const h = hooks[key];
    if (!h) return '';
    return `
      <div class="dna-hook-card">
        <div class="dna-hook-type">${labels[key]}</div>
        <div class="dna-hook-text">${esc(h.hook)}</div>
        <div class="dna-headline-annotation">${esc(h.annotation)}</div>
      </div>`;
  }).join('');

  // Section 6 — Objections
  const objectionsHtml = (dna.objections||[]).map(o => `
    <div class="dna-objection-card">
      <div class="dna-objection-q">"${esc(o.objection)}"</div>
      <div class="dna-objection-a">→ ${esc(o.rebuttal)}</div>
    </div>`).join('');

  // Section 6 — Language Toolkit
  const toolkitHtml = (dna.language_toolkit||[]).map(t => `
    <div class="dna-toolkit-item">
      <span class="dna-toolkit-term">${esc(t.term)}</span>
      <span class="dna-toolkit-why">${esc(t.why)}</span>
      ${t.quotes ? `<span class="dna-toolkit-quotes">Quotes: ${esc(t.quotes)}</span>` : ''}
    </div>`).join('');

  // Section 7 — Raw Quotes
  const quotesHtml = (dna.quotes||[]).map(q => `
    <div class="dna-quote-card">
      <div class="dna-quote-num">#${q.number}</div>
      <div class="dna-quote-text">"${esc(q.quote)}"</div>
      <div class="dna-quote-meta">
        <span class="dna-meta-tag">${esc(q.platform)}</span>
        <span class="dna-meta-tag emotion-tag">${esc(q.primary_emotion)}</span>
        ${q.source ? `<span class="dna-meta-source">${esc(q.source)}</span>` : ''}
      </div>
      ${q.belief_signal ? `<div class="dna-quote-belief">Belief: ${esc(q.belief_signal)}</div>` : ''}
      ${q.decision_implication ? `<div class="dna-quote-decision">Decision: ${esc(q.decision_implication)}</div>` : ''}
    </div>`).join('');

  // Section 9 — Action Summary
  const as = dna.action_summary || {};
  function actionList(items) {
    return (items||[]).map(x=>`<div class="bullet-item">${esc(x)}</div>`).join('');
  }

  return `
    <!-- Meta -->
    <div class="dna-meta-bar">
      <span>Platforms: <strong>${esc(dna.platforms_searched||'')}</strong></span>
      <span>Quotes: <strong>${esc(dna.quote_yield||'')}</strong></span>
    </div>

    <!-- Sections 1–5: narrative -->
    <div class="dna-narratives">
      ${dnaBlock('Section 1 — Daily Reality Profile', dna.daily_reality||'')}
      ${dnaBlock('Section 2 — Internal Narrative', dna.internal_narrative||'')}
      ${dnaBlock('Section 3 — Solution Archaeology', dna.solution_archaeology||'')}
      ${dnaBlock('Section 4 — Belief System Architecture', dna.belief_system||'')}
      ${dnaBlock('Section 5 — Market Intelligence', dna.market_intelligence||'')}
    </div>

    <!-- Section 6: Conversion Assets -->
    <div style="margin-top:28px">
      ${dnaSubHead('SECTION 6 — CONVERSION MESSAGING')}

      <div style="margin-bottom:20px">
        <div class="info-item-label" style="margin-bottom:10px">Headlines</div>
        ${headlinesHtml}
      </div>

      <div style="margin-bottom:20px">
        <div class="info-item-label" style="margin-bottom:10px">Opening Hooks</div>
        ${hooksHtml}
      </div>

      <div style="margin-bottom:20px">
        <div class="info-item-label" style="margin-bottom:10px">Objections &amp; Rebuttals</div>
        ${objectionsHtml}
      </div>

      ${dna.positioning_angle ? `
        <div style="margin-bottom:20px">
          <div class="info-item-label" style="margin-bottom:8px">Positioning Angle</div>
          <div class="dna-positioning">${esc(dna.positioning_angle)}</div>
        </div>
      ` : ''}

      <div style="margin-bottom:20px">
        <div class="info-item-label" style="margin-bottom:10px">Emotional Language Toolkit</div>
        <div class="dna-toolkit-list">${toolkitHtml}</div>
      </div>
    </div>

    <!-- Section 7: Raw Quotes -->
    <div style="margin-top:28px">
      ${dnaSubHead('SECTION 7 — 25 RAW QUOTES (EVIDENCE BASE)')}
      <div class="dna-quotes-grid">${quotesHtml}</div>
    </div>

    <!-- Section 8: Pattern Summary -->
    ${dna.pattern_summary ? `
    <div style="margin-top:28px">
      ${dnaSubHead('SECTION 8 — PATTERN SUMMARY')}
      <div class="dna-pattern-grid">
        <div class="dna-pattern-item"><span class="dna-pattern-label">Most Common Emotion</span><span>${esc(dna.pattern_summary.most_common_emotion)}</span></div>
        <div class="dna-pattern-item"><span class="dna-pattern-label">Recurring Language</span><span>${esc(dna.pattern_summary.recurring_language)}</span></div>
        <div class="dna-pattern-item"><span class="dna-pattern-label">Dominant Belief</span><span>${esc(dna.pattern_summary.dominant_belief)}</span></div>
        <div class="dna-pattern-item dna-pattern-full"><span class="dna-pattern-label">Key Pattern</span><span>${esc(dna.pattern_summary.key_pattern)}</span></div>
      </div>
      ${dna.pattern_summary.suggested_queries?.length ? `
        <div style="margin-top:12px">
          <div class="info-item-label" style="margin-bottom:8px">Suggested Search Queries</div>
          <div class="tag-list">${dna.pattern_summary.suggested_queries.map(q=>`<span class="tag">${esc(q)}</span>`).join('')}</div>
        </div>` : ''}
    </div>` : ''}

    <!-- Section 9: Action Summary -->
    ${as ? `
    <div style="margin-top:28px">
      ${dnaSubHead('SECTION 9 — FOUNDER\'S ACTION SUMMARY')}
      ${as.biggest_opportunity ? `
        <div class="dna-big-callout opportunity">
          <div class="dna-callout-label">Biggest Opportunity</div>
          <div>${esc(as.biggest_opportunity)}</div>
        </div>` : ''}
      ${as.biggest_risk ? `
        <div class="dna-big-callout risk">
          <div class="dna-callout-label">Biggest Risk</div>
          <div>${esc(as.biggest_risk)}</div>
        </div>` : ''}
      <div class="dna-action-grid">
        ${as.product_implications?.length ? `
          <div><div class="info-item-label" style="margin-bottom:8px">Product</div>${actionList(as.product_implications)}</div>` : ''}
        ${as.positioning_implications?.length ? `
          <div><div class="info-item-label" style="margin-bottom:8px">Positioning &amp; Messaging</div>${actionList(as.positioning_implications)}</div>` : ''}
        ${as.gtm_implications?.length ? `
          <div><div class="info-item-label" style="margin-bottom:8px">Go-To-Market</div>${actionList(as.gtm_implications)}</div>` : ''}
        ${as.pricing_implications?.length ? `
          <div><div class="info-item-label" style="margin-bottom:8px">Pricing &amp; Packaging</div>${actionList(as.pricing_implications)}</div>` : ''}
        ${as.content_implications?.length ? `
          <div><div class="info-item-label" style="margin-bottom:8px">Content &amp; Education</div>${actionList(as.content_implications)}</div>` : ''}
      </div>
    </div>` : ''}
  `;
}

/* ── Download helpers ──────────────────────────────────────────────── */
function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildReportText() {
  const report = window.__currentReport;
  if (!report) return '';
  const rj = report.report_json || {};
  const yt = rj.youtube_insights || {};
  const rd = rj.reddit_segments  || {};
  const co = rj.competitor_analysis || {};
  const lines = [];

  lines.push(`# Research Report — ${rj.client_name || 'Unknown Client'}`);
  lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}`);
  lines.push('');

  lines.push('## ICP & Overview');
  if (rj.client_name)  lines.push(`**Client:** ${rj.client_name}`);
  if (rj.client_offer) lines.push(`**Offer:** ${rj.client_offer}`);
  if (rj.icp_summary)  { lines.push(''); lines.push(`**ICP Summary:**\n${rj.icp_summary}`); }
  if (rj.search_keywords?.length) {
    lines.push('');
    lines.push(`**Research Keywords:** ${rj.search_keywords.join(', ')}`);
  }
  lines.push('');

  // YouTube — handle both old string[] and new object[] formats
  function insightText(item) {
    if (typeof item === 'string') return `- ${item}`;
    return `- **${item.name}**\n  ${item.description}${(item.sub_points||[]).map(s=>'\n  * '+s).join('')}`;
  }
  const ytProblems = (yt.problems||[]).filter(p=>typeof p==='string'?p!=='No data':p?.name!=='No data');
  const ytDesires  = (yt.desires||[]).filter(d=>typeof d==='string'?d!=='No data':d?.name!=='No data');
  if (ytProblems.length || ytDesires.length) {
    lines.push('## YouTube — Pain Points & Desires');
    if (ytProblems.length) { lines.push('\n### 💢 Problems'); ytProblems.forEach(p => lines.push(insightText(p))); }
    if (ytDesires.length)  { lines.push('\n### 🌟 Desires');  ytDesires.forEach(d => lines.push(insightText(d))); }
    if (yt.video_summaries?.length) {
      lines.push('\n### 📋 Video Summaries');
      yt.video_summaries.forEach(v => {
        lines.push(`\n#### ${v.title}`);
        if (v.url) lines.push(v.url);
        if (v.summary) lines.push(v.summary);
        if (v.pain_points?.length) {
          lines.push('**Pain Points Highlighted:**');
          v.pain_points.forEach(p => lines.push(typeof p==='string' ? `- ${p}` : `- **${p.name}:** ${p.description}`));
        }
        if (v.desires?.length) {
          lines.push('**Desires Addressed:**');
          v.desires.forEach(d => lines.push(typeof d==='string' ? `- ${d}` : `- **${d.name}:** ${d.description}`));
        }
      });
    }
    lines.push('');
  }

  if (rd.overarching_dream && rd.overarching_dream !== 'No Reddit data available') {
    lines.push('## Reddit — Customer Segments');
    lines.push(`**Overarching Dream:** ${rd.overarching_dream}`);
    (rd.segments||[]).forEach(seg => {
      lines.push(`\n### 👤 ICP Segment — ${seg.name}`);
      if (seg.core_driver) { lines.push(''); lines.push(`**🚗 Core Driver:** ${seg.core_driver}`); }
      const p = (seg.problems||[]).filter(x=>x!=='N/A');
      const d = (seg.desires||[]).filter(x=>x!=='N/A');
      if (p.length) { lines.push('\n**Problems:**'); p.forEach(x=>lines.push(`- ${x}`)); }
      if (d.length) { lines.push('\n**Desires:**');  d.forEach(x=>lines.push(`- ${x}`)); }
      if (seg.motivations?.length) {
        lines.push('\n**Motivations:**');
        seg.motivations.forEach(m => {
          if (typeof m === 'string') { lines.push(`- ${m}`); return; }
          lines.push(`- **${m.name}**`);
          (m.points||[]).forEach(pt => lines.push(`  * ${pt}`));
        });
      }
      if (seg.tradeoffs?.length) {
        lines.push('\n**Tradeoffs / Challenges:**');
        seg.tradeoffs.forEach(t => {
          if (typeof t === 'string') { lines.push(`- ${t}`); return; }
          lines.push(`- **${t.name}**`);
          (t.points||[]).forEach(pt => lines.push(`  * ${pt}`));
        });
      }
      if (seg.citations?.length) {
        lines.push('\n**🔗 Citations:**');
        seg.citations.forEach(c => lines.push(`- ${c}`));
      }
    });
    lines.push('');
  }

  if (co.competitors?.length) {
    lines.push('## Competitor Analysis');
    co.competitors.forEach(c => {
      lines.push(`\n### 🔗 ${c.name}${c.url ? ' — ' + c.url : ''}`);
      lines.push('**📢 Marketing Positioning:**');
      (c.marketing_quotes||[]).forEach(q => lines.push(`> "${q}"`));
      if (c.positioning_strength) lines.push(`\n**✅ Strength:** ${c.positioning_strength}`);
      if (c.strategic_gap)        lines.push(`\n**⚠️ Gap:** ${c.strategic_gap}`);
    });
  }

  const dna = rj.customer_dna;
  if (dna) {
    lines.push('\n## 🧬 CustomerDNA — Psychographic Intelligence');
    lines.push(`Platforms: ${dna.platforms_searched || ''} | Quotes: ${dna.quote_yield || ''}`);
    lines.push('');

    if (dna.daily_reality)       { lines.push('### Section 1 — Daily Reality Profile');        lines.push(dna.daily_reality);       lines.push(''); }
    if (dna.internal_narrative)  { lines.push('### Section 2 — Internal Narrative');            lines.push(dna.internal_narrative);  lines.push(''); }
    if (dna.solution_archaeology){ lines.push('### Section 3 — Solution Archaeology');          lines.push(dna.solution_archaeology);lines.push(''); }
    if (dna.belief_system)       { lines.push('### Section 4 — Belief System Architecture');    lines.push(dna.belief_system);       lines.push(''); }
    if (dna.market_intelligence) { lines.push('### Section 5 — Market Intelligence');           lines.push(dna.market_intelligence); lines.push(''); }

    if (dna.headlines?.length) {
      lines.push('### Section 6 — Headlines');
      dna.headlines.forEach((h,i) => { lines.push(`${i+1}. "${h.headline}"`); lines.push(`   [${h.annotation}]`); });
      lines.push('');
    }
    if (dna.hooks) {
      lines.push('### Opening Hooks');
      const hl = { loss:'LOSS', aspiration:'ASPIRATION', pattern_interrupt:'PATTERN-INTERRUPT', identity:'IDENTITY' };
      for (const [k, label] of Object.entries(hl)) {
        const h = dna.hooks[k];
        if (h) { lines.push(`**${label}:** ${h.hook}`); lines.push(`[${h.annotation}]`); lines.push(''); }
      }
    }
    if (dna.objections?.length) {
      lines.push('### Objections & Rebuttals');
      dna.objections.forEach((o,i) => lines.push(`${i+1}. "${o.objection}" → ${o.rebuttal}`));
      lines.push('');
    }
    if (dna.positioning_angle) {
      lines.push('### Positioning Angle');
      lines.push(dna.positioning_angle);
      lines.push('');
    }
    if (dna.language_toolkit?.length) {
      lines.push('### Emotional Language Toolkit');
      dna.language_toolkit.forEach(t => lines.push(`- **${t.term}**: ${t.why}${t.quotes ? ' [' + t.quotes + ']' : ''}`));
      lines.push('');
    }

    if (dna.quotes?.length) {
      lines.push('### Section 7 — Raw Quotes');
      dna.quotes.forEach(q => {
        lines.push(`\n#${q.number} [${q.platform}] [${q.primary_emotion}]`);
        lines.push(`"${q.quote}"`);
        lines.push(`Source: ${q.source}`);
        if (q.belief_signal) lines.push(`Belief: ${q.belief_signal}`);
      });
      lines.push('');
    }

    if (dna.pattern_summary) {
      lines.push('### Section 8 — Pattern Summary');
      lines.push(`Most Common Emotion: ${dna.pattern_summary.most_common_emotion}`);
      lines.push(`Recurring Language: "${dna.pattern_summary.recurring_language}"`);
      lines.push(`Dominant Belief: ${dna.pattern_summary.dominant_belief}`);
      lines.push(`Key Pattern: ${dna.pattern_summary.key_pattern}`);
      lines.push('');
    }

    if (dna.action_summary) {
      const as = dna.action_summary;
      lines.push('### Section 9 — Action Summary');
      if (as.biggest_opportunity) lines.push(`**Biggest Opportunity:** ${as.biggest_opportunity}`);
      if (as.biggest_risk)        lines.push(`**Biggest Risk:** ${as.biggest_risk}`);
      if (as.product_implications?.length)     { lines.push('\n**Product:** ');      as.product_implications.forEach(x=>lines.push(`- ${x}`)); }
      if (as.positioning_implications?.length) { lines.push('\n**Positioning:** ');  as.positioning_implications.forEach(x=>lines.push(`- ${x}`)); }
      if (as.gtm_implications?.length)         { lines.push('\n**GTM:** ');          as.gtm_implications.forEach(x=>lines.push(`- ${x}`)); }
      if (as.pricing_implications?.length)     { lines.push('\n**Pricing:** ');      as.pricing_implications.forEach(x=>lines.push(`- ${x}`)); }
      if (as.content_implications?.length)     { lines.push('\n**Content:** ');      as.content_implications.forEach(x=>lines.push(`- ${x}`)); }
    }
  }

  return lines.join('\n');
}

/* ── HTML report builder (for Google Docs import) ─────────────────── */
function buildReportHtml() {
  const report = window.__currentReport;
  if (!report) return '';
  const rj = report.report_json || {};
  const yt = rj.youtube_insights || {};
  const rd = rj.reddit_segments  || {};
  const co = rj.competitor_analysis || {};
  const date = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

  // Mini helpers — all output goes into body string
  const e    = str => str == null ? '' : String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const tag  = (t, c) => `<${t}>${c}</${t}>`;
  const b    = c => `<strong>${c}</strong>`;
  let body   = '';

  // Title
  body += tag('h1', `Research Report — ${e(rj.client_name || 'Unknown Client')}`);
  body += tag('p', `<em>Generated: ${date}</em>`);
  body += '<hr>';

  // ICP
  body += tag('h2', 'ICP &amp; Overview');
  if (rj.client_name)  body += tag('p', `${b('Client:')} ${e(rj.client_name)}`);
  if (rj.client_offer) body += tag('p', `${b('Offer:')} ${e(rj.client_offer)}`);
  if (rj.icp_summary)  body += tag('p', `${b('ICP Summary:')} ${e(rj.icp_summary)}`);
  if (rj.search_keywords?.length) {
    body += tag('p', `${b('Research Keywords:')} ${rj.search_keywords.map(e).join(', ')}`);
  }

  // YouTube
  function insightLi(item) {
    if (typeof item === 'string') return tag('li', e(item));
    let s = `${b(e(item.name))} — ${e(item.description)}`;
    if (item.sub_points?.length) s += tag('ul', item.sub_points.map(sp => tag('li', e(sp))).join(''));
    return tag('li', s);
  }
  const ytProblems = (yt.problems||[]).filter(p => typeof p==='string'?p!=='No data':p?.name!=='No data');
  const ytDesires  = (yt.desires||[]).filter(d => typeof d==='string'?d!=='No data':d?.name!=='No data');

  if (ytProblems.length || ytDesires.length) {
    body += tag('h2', 'YouTube — Pain Points &amp; Desires');
    if (ytProblems.length) {
      body += tag('h3', '💢 Problems');
      body += tag('ul', ytProblems.map(insightLi).join(''));
    }
    if (ytDesires.length) {
      body += tag('h3', '🌟 Desires');
      body += tag('ul', ytDesires.map(insightLi).join(''));
    }
    if (yt.video_summaries?.length) {
      body += tag('h3', '📋 Top Video Summaries');
      yt.video_summaries.forEach(v => {
        body += tag('h4', e(v.title || ''));
        if (v.url) body += tag('p', `<a href="${e(v.url)}">${e(v.url)}</a>`);
        if (v.summary) body += tag('p', e(v.summary));
        if (v.pain_points?.length) {
          body += tag('p', b('Pain Points Highlighted:'));
          body += tag('ul', v.pain_points.map(pt => tag('li', typeof pt==='string' ? e(pt) : `${b(e(pt.name))} — ${e(pt.description)}`)).join(''));
        }
        if (v.desires?.length) {
          body += tag('p', b('Desires Addressed:'));
          body += tag('ul', v.desires.map(d => tag('li', typeof d==='string' ? e(d) : `${b(e(d.name))} — ${e(d.description)}`)).join(''));
        }
      });
    }
  }

  // Reddit
  if (rd.overarching_dream && rd.overarching_dream !== 'No Reddit data available') {
    body += tag('h2', 'Reddit — Customer Segments');
    body += tag('p', `${b('Overarching Dream:')} ${e(rd.overarching_dream)}`);
    (rd.segments||[]).forEach(seg => {
      body += tag('h3', `👤 ICP Segment — ${e(seg.name)}`);
      if (seg.core_driver) body += tag('p', `${b('🚗 Core Driver:')} ${e(seg.core_driver)}`);
      const probs = (seg.problems||[]).filter(x=>x!=='N/A');
      const desir = (seg.desires||[]).filter(x=>x!=='N/A');
      if (probs.length) { body += tag('p', b('Problems:')); body += tag('ul', probs.map(x=>tag('li',e(x))).join('')); }
      if (desir.length) { body += tag('p', b('Desires:'));  body += tag('ul', desir.map(x=>tag('li',e(x))).join('')); }
      if (seg.motivations?.length) {
        body += tag('p', b('Motivations:'));
        seg.motivations.forEach(m => {
          if (typeof m === 'string') { body += tag('ul', tag('li', e(m))); return; }
          body += tag('p', b(e(m.name)));
          body += tag('ul', (m.points||[]).map(pt=>tag('li',e(pt))).join(''));
        });
      }
      if (seg.tradeoffs?.length) {
        body += tag('p', b('Tradeoffs / Challenges:'));
        seg.tradeoffs.forEach(t => {
          if (typeof t === 'string') { body += tag('ul', tag('li', e(t))); return; }
          body += tag('p', b(e(t.name)));
          body += tag('ul', (t.points||[]).map(pt=>tag('li',e(pt))).join(''));
        });
      }
      if (seg.citations?.length) {
        body += tag('p', b('🔗 Citations:'));
        body += tag('ul', seg.citations.map(c=>tag('li',e(c))).join(''));
      }
    });
  }

  // Competitors
  if (co.competitors?.length) {
    body += tag('h2', 'Competitor Analysis');
    co.competitors.forEach(c => {
      const title = c.url ? `🔗 ${e(c.name)} — <a href="${e(c.url)}">${e(c.url)}</a>` : `🔗 ${e(c.name)}`;
      body += `<h3>${title}</h3>`;
      body += tag('p', b('📢 Marketing Positioning:'));
      (c.marketing_quotes||[]).forEach(q => body += `<blockquote><p>"${e(q)}"</p></blockquote>`);
      if (c.positioning_strength) body += tag('p', `${b('✅ Strength:')} ${e(c.positioning_strength)}`);
      if (c.strategic_gap)        body += tag('p', `${b('⚠️ Gap:')} ${e(c.strategic_gap)}`);
    });
  }

  // CustomerDNA
  const dna = rj.customer_dna;
  if (dna) {
    body += tag('h2', '🧬 CustomerDNA — Psychographic Intelligence');
    body += tag('p', `${b('Platforms:')} ${e(dna.platforms_searched||'')} &nbsp;|&nbsp; ${b('Quotes:')} ${e(dna.quote_yield||'')}`);

    if (dna.daily_reality)       { body += tag('h3','Section 1 — Daily Reality Profile');       body += tag('p', e(dna.daily_reality)); }
    if (dna.internal_narrative)  { body += tag('h3','Section 2 — Internal Narrative');           body += tag('p', e(dna.internal_narrative)); }
    if (dna.solution_archaeology){ body += tag('h3','Section 3 — Solution Archaeology');         body += tag('p', e(dna.solution_archaeology)); }
    if (dna.belief_system)       { body += tag('h3','Section 4 — Belief System Architecture');   body += tag('p', e(dna.belief_system)); }
    if (dna.market_intelligence) { body += tag('h3','Section 5 — Market Intelligence &amp; Gaps'); body += tag('p', e(dna.market_intelligence)); }

    if (dna.headlines?.length) {
      body += tag('h3', 'Section 6 — Headlines');
      body += tag('ol', dna.headlines.map(h => tag('li', `${b('"' + e(h.headline) + '"')} — ${e(h.annotation)}`)).join(''));
    }
    if (dna.hooks) {
      body += tag('h3', 'Opening Hooks');
      const hookLabels = [['loss','Loss Hook'],['aspiration','Aspiration Hook'],['pattern_interrupt','Pattern-Interrupt Hook'],['identity','Identity Hook']];
      hookLabels.forEach(([k, label]) => {
        const h = dna.hooks[k];
        if (!h) return;
        body += tag('p', `${b(label + ':')} ${e(h.hook)}`);
        body += tag('p', `<em>${e(h.annotation)}</em>`);
      });
    }
    if (dna.objections?.length) {
      body += tag('h3', 'Objections &amp; Rebuttals');
      body += tag('ol', dna.objections.map(o => tag('li', `${b('"' + e(o.objection) + '"')} → ${e(o.rebuttal)}`)).join(''));
    }
    if (dna.positioning_angle) {
      body += tag('h3', 'Positioning Angle');
      body += tag('p', e(dna.positioning_angle));
    }
    if (dna.language_toolkit?.length) {
      body += tag('h3', 'Emotional Language Toolkit');
      body += tag('ul', dna.language_toolkit.map(t => tag('li', `${b(e(t.term))}: ${e(t.why)}${t.quotes ? ' [' + e(t.quotes) + ']' : ''}`)).join(''));
    }

    if (dna.quotes?.length) {
      body += tag('h3', 'Section 7 — 25 Raw Quotes (Evidence Base)');
      dna.quotes.forEach(q => {
        body += tag('p', `${b('#' + q.number)} <em>[${e(q.platform)}] [${e(q.primary_emotion)}]</em>`);
        body += `<blockquote><p>"${e(q.quote)}"</p><p><em>Source: ${e(q.source)}</em></p>${q.belief_signal ? `<p>Belief: ${e(q.belief_signal)}</p>` : ''}</blockquote>`;
      });
    }

    if (dna.pattern_summary) {
      body += tag('h3', 'Section 8 — Pattern Summary');
      body += tag('p', `${b('Most Common Emotion:')} ${e(dna.pattern_summary.most_common_emotion)}`);
      body += tag('p', `${b('Recurring Language:')} "${e(dna.pattern_summary.recurring_language)}"`);
      body += tag('p', `${b('Dominant Belief:')} ${e(dna.pattern_summary.dominant_belief)}`);
      body += tag('p', `${b('Key Pattern:')} ${e(dna.pattern_summary.key_pattern)}`);
    }

    if (dna.action_summary) {
      const as = dna.action_summary;
      body += tag('h3', 'Section 9 — Action Summary');
      if (as.biggest_opportunity) body += tag('p', `${b('Biggest Opportunity:')} ${e(as.biggest_opportunity)}`);
      if (as.biggest_risk)        body += tag('p', `${b('Biggest Risk:')} ${e(as.biggest_risk)}`);
      const impGroups = [
        ['Product Implications',      as.product_implications],
        ['Positioning & Messaging',    as.positioning_implications],
        ['Go-To-Market',               as.gtm_implications],
        ['Pricing & Packaging',        as.pricing_implications],
        ['Content & Education',        as.content_implications],
      ];
      impGroups.forEach(([label, items]) => {
        if (items?.length) {
          body += tag('p', b(label + ':'));
          body += tag('ul', items.map(x => tag('li', e(x))).join(''));
        }
      });
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Research Report — ${e(rj.client_name || 'Unknown')}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.65;max-width:820px;margin:40px auto;color:#111;padding:0 20px}
  h1{font-size:20pt;margin-bottom:4px}
  h2{font-size:14pt;margin-top:32px;margin-bottom:8px;border-bottom:2px solid #ddd;padding-bottom:4px}
  h3{font-size:12pt;margin-top:22px;margin-bottom:6px;color:#222}
  h4{font-size:11pt;margin-top:16px;margin-bottom:4px;font-style:italic}
  p{margin:6px 0}
  ul{margin:6px 0;padding-left:22px}
  li{margin:4px 0}
  blockquote{border-left:3px solid #999;margin:8px 0 8px 18px;padding:4px 14px;color:#444;font-style:italic}
  hr{border:none;border-top:1px solid #ddd;margin:18px 0}
  a{color:#1a0dab}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/* buildDocxHtml — simple flat HTML that html-docx-js can actually render
   (no divs, no CSS classes — just h1/h2/h3/p/ul/li/blockquote/strong) */
function buildDocxHtml() {
  const report = window.__currentReport;
  if (!report) return '';
  const rj   = report.report_json || {};
  const yt   = rj.youtube_insights || {};
  const rd   = rj.reddit_segments  || {};
  const co   = rj.competitor_analysis || {};
  const dna  = rj.customer_dna || null;
  const date = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const e    = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  let b = '';
  b += `<h1>Research Report — ${e(rj.client_name||'Unknown Client')}</h1>`;
  b += `<p><em>Generated: ${date}</em></p><hr>`;

  b += `<h2>ICP &amp; Overview</h2>`;
  if (rj.client_name)  b += `<p><strong>Client:</strong> ${e(rj.client_name)}</p>`;
  if (rj.client_offer) b += `<p><strong>Offer:</strong> ${e(rj.client_offer)}</p>`;
  if (rj.icp_summary)  b += `<p><strong>ICP Summary:</strong> ${e(rj.icp_summary)}</p>`;
  if (rj.painful_problem) b += `<p><strong>#1 Painful Problem:</strong> ${e(rj.painful_problem)}</p>`;
  if (rj.search_keywords?.length) b += `<p><strong>Research Keywords:</strong> ${rj.search_keywords.map(e).join(', ')}</p>`;

  // YouTube
  const ytP = (yt.problems||[]).filter(p=>typeof p==='string'?p!=='No data':p?.name!=='No data');
  const ytD = (yt.desires||[]).filter(d=>typeof d==='string'?d!=='No data':d?.name!=='No data');
  if (ytP.length||ytD.length) {
    b += `<h2>YouTube — Pain Points &amp; Desires</h2>`;
    if (ytP.length) {
      b += `<h3>Problems</h3><ul>`;
      ytP.forEach(p=>{
        if (typeof p==='string') { b+=`<li>${e(p)}</li>`; return; }
        b+=`<li><strong>${e(p.name)}</strong> — ${e(p.description)}`;
        if (p.sub_points?.length) { b+='<ul>'; p.sub_points.forEach(s=>b+=`<li>${e(s)}</li>`); b+='</ul>'; }
        b+='</li>';
      });
      b+='</ul>';
    }
    if (ytD.length) {
      b += `<h3>Desires</h3><ul>`;
      ytD.forEach(d=>{
        if (typeof d==='string') { b+=`<li>${e(d)}</li>`; return; }
        b+=`<li><strong>${e(d.name)}</strong> — ${e(d.description)}`;
        if (d.sub_points?.length) { b+='<ul>'; d.sub_points.forEach(s=>b+=`<li>${e(s)}</li>`); b+='</ul>'; }
        b+='</li>';
      });
      b+='</ul>';
    }
    if (yt.video_summaries?.length) {
      b += `<h3>Top Video Summaries</h3>`;
      yt.video_summaries.forEach(v=>{
        b+=`<h4>${e(v.title)}</h4>`;
        if(v.url) b+=`<p>${e(v.url)}</p>`;
        if(v.summary) b+=`<p>${e(v.summary)}</p>`;
      });
    }
  }

  // Reddit
  if (rd.overarching_dream && rd.overarching_dream!=='No Reddit data available') {
    b += `<h2>Reddit — Customer Segments</h2>`;
    b += `<p><strong>Overarching Dream:</strong> ${e(rd.overarching_dream)}</p>`;
    (rd.segments||[]).forEach(seg=>{
      b += `<h3>Segment: ${e(seg.name)}</h3>`;
      if(seg.core_driver) b+=`<p><strong>Core Driver:</strong> ${e(seg.core_driver)}</p>`;
      const probs=(seg.problems||[]).filter(x=>x!=='N/A');
      const desir=(seg.desires||[]).filter(x=>x!=='N/A');
      if(probs.length){b+=`<p><strong>Problems:</strong></p><ul>`;probs.forEach(x=>b+=`<li>${e(x)}</li>`);b+='</ul>';}
      if(desir.length){b+=`<p><strong>Desires:</strong></p><ul>`;desir.forEach(x=>b+=`<li>${e(x)}</li>`);b+='</ul>';}
      if(seg.motivations?.length){
        b+=`<p><strong>Motivations:</strong></p>`;
        seg.motivations.forEach(m=>{
          if(typeof m==='string'){b+=`<ul><li>${e(m)}</li></ul>`;return;}
          b+=`<p><strong>${e(m.name)}</strong></p><ul>`;
          (m.points||[]).forEach(pt=>b+=`<li>${e(pt)}</li>`);
          b+='</ul>';
        });
      }
      if(seg.citations?.length){b+=`<p><strong>Citations:</strong></p><ul>`;seg.citations.forEach(c=>b+=`<li>${e(c)}</li>`);b+='</ul>';}
    });
  }

  // Competitors
  if (co.competitors?.length) {
    b += `<h2>Competitor Analysis</h2>`;
    co.competitors.forEach(c=>{
      b+=`<h3>${e(c.name)}${c.url?' — '+e(c.url):''}</h3>`;
      if(c.marketing_quotes?.length){b+=`<p><strong>Marketing Positioning:</strong></p>`;c.marketing_quotes.forEach(q=>b+=`<blockquote><p>"${e(q)}"</p></blockquote>`);}
      if(c.positioning_strength) b+=`<p><strong>Strength:</strong> ${e(c.positioning_strength)}</p>`;
      if(c.strategic_gap)        b+=`<p><strong>Gap:</strong> ${e(c.strategic_gap)}</p>`;
    });
  }

  // CustomerDNA
  if (dna) {
    b += `<h2>CustomerDNA — Psychographic Intelligence</h2>`;
    b += `<p><strong>Platforms:</strong> ${e(dna.platforms_searched)} | <strong>Quotes:</strong> ${e(dna.quote_yield)}</p>`;
    if(dna.daily_reality)        {b+=`<h3>Section 1 — Daily Reality</h3><p>${e(dna.daily_reality)}</p>`;}
    if(dna.internal_narrative)   {b+=`<h3>Section 2 — Internal Narrative</h3><p>${e(dna.internal_narrative)}</p>`;}
    if(dna.solution_archaeology) {b+=`<h3>Section 3 — Solution Archaeology</h3><p>${e(dna.solution_archaeology)}</p>`;}
    if(dna.belief_system)        {b+=`<h3>Section 4 — Belief System</h3><p>${e(dna.belief_system)}</p>`;}
    if(dna.market_intelligence)  {b+=`<h3>Section 5 — Market Intelligence</h3><p>${e(dna.market_intelligence)}</p>`;}
    if(dna.headlines?.length){
      b+=`<h3>Headlines</h3><ol>`;
      dna.headlines.forEach(h=>b+=`<li><strong>${e(h.headline)}</strong> — ${e(h.annotation)}</li>`);
      b+='</ol>';
    }
    if(dna.objections?.length){
      b+=`<h3>Objections &amp; Rebuttals</h3><ol>`;
      dna.objections.forEach(o=>b+=`<li><strong>"${e(o.objection)}"</strong> → ${e(o.rebuttal)}</li>`);
      b+='</ol>';
    }
    if(dna.positioning_angle){b+=`<h3>Positioning Angle</h3><p>${e(dna.positioning_angle)}</p>`;}
    if(dna.quotes?.length){
      b+=`<h3>25 Raw Quotes</h3>`;
      dna.quotes.forEach(q=>{
        b+=`<p><strong>#${q.number} [${e(q.platform)}] [${e(q.primary_emotion)}]</strong></p>`;
        b+=`<blockquote><p>"${e(q.quote)}"</p><p><em>Source: ${e(q.source)}</em></p></blockquote>`;
      });
    }
    if(dna.action_summary){
      const as=dna.action_summary;
      b+=`<h3>Action Summary</h3>`;
      if(as.biggest_opportunity) b+=`<p><strong>Biggest Opportunity:</strong> ${e(as.biggest_opportunity)}</p>`;
      if(as.biggest_risk)        b+=`<p><strong>Biggest Risk:</strong> ${e(as.biggest_risk)}</p>`;
      const grps=[['Product',as.product_implications],['Positioning',as.positioning_implications],['GTM',as.gtm_implications],['Pricing',as.pricing_implications],['Content',as.content_implications]];
      grps.forEach(([lbl,items])=>{if(items?.length){b+=`<p><strong>${lbl}:</strong></p><ul>`;items.forEach(x=>b+=`<li>${e(x)}</li>`);b+='</ul>';}});
    }
  }

  return buildDocumentHtml(b, 'Research Report');
}

/* Shared document wrapper — clean Google Docs-style HTML that opens in any browser,
   can be printed to PDF with Cmd+P, and imported into Google Docs via File > Open. */
function buildDocumentHtml(bodyContent, docType) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${docType}</title>
<style>
  /* ── Page chrome ── */
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f0f0f0;font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#202124;line-height:1.65}

  /* ── Tip banner (hidden when printing) ── */
  .print-tip{background:#1a73e8;color:#fff;text-align:center;padding:10px 20px;font-size:12px;letter-spacing:.3px}
  .print-tip kbd{background:rgba(255,255,255,.25);border-radius:3px;padding:1px 5px;font-family:inherit}

  /* ── Document page ── */
  .page{max-width:816px;margin:24px auto;background:#fff;padding:72px 80px;
        box-shadow:0 1px 3px rgba(0,0,0,.2);min-height:1056px}

  /* ── Typography ── */
  h1{font-size:22pt;font-weight:700;color:#1a1a1a;margin-bottom:6px;line-height:1.3}
  h2{font-size:14pt;font-weight:600;color:#1a1a1a;margin-top:32px;margin-bottom:10px;
     padding-bottom:5px;border-bottom:2px solid #e8e8e8}
  h3{font-size:12pt;font-weight:600;color:#333;margin-top:22px;margin-bottom:8px}
  h4{font-size:11pt;font-weight:600;font-style:italic;color:#555;margin-top:16px;margin-bottom:6px}
  p{margin-bottom:10px}
  ul,ol{margin-bottom:10px;padding-left:22px}
  li{margin-bottom:4px}
  blockquote{border-left:3px solid #bbb;margin:12px 0 12px 8px;padding:6px 14px;
             color:#555;font-style:italic;background:#fafafa;border-radius:0 4px 4px 0}
  strong{font-weight:600;color:#1a1a1a}
  .doc-meta{font-size:10pt;color:#888;margin-bottom:28px;margin-top:4px}
  hr{border:none;border-top:2px solid #e8e8e8;margin:28px 0}

  /* ── Print: remove chrome, use full page ── */
  @media print{
    .print-tip{display:none}
    body{background:#fff}
    .page{max-width:100%;margin:0;padding:1in 1in;box-shadow:none;min-height:auto}
    h2{page-break-after:avoid}
    h3{page-break-after:avoid}
  }
</style>
</head>
<body>
<div class="print-tip">
  💡 To save as PDF: press <kbd>Ctrl+P</kbd> (Windows) or <kbd>⌘P</kbd> (Mac) → choose <strong>Save as PDF</strong>.
  &nbsp;&nbsp;|&nbsp;&nbsp; To import into Google Docs: File → Open → Upload this file.
</div>
<div class="page">
${bodyContent}
</div>
</body>
</html>`;
}

function downloadReport() {
  const html = buildDocxHtml();
  if (!html) { alert('No report loaded — run research first.'); return; }
  const rj   = (window.__currentReport?.report_json) || {};
  const slug = (rj.client_name || 'report').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  triggerDownload(`${slug}-research-report.html`, html);
}

function copyReportToClipboard() {
  const text = buildReportText();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('[onclick="copyReportToClipboard()"]');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

function downloadCampaigns(gen) {
  if (!gen) return;
  const angles = gen.output_json?.angles || [];
  const date   = new Date(gen.created_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
  const rj     = (window.__currentReport?.report_json) || {};
  const e      = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  let b = '';
  b += `<h1>Campaign Sequences</h1>`;
  b += `<p class="doc-meta">Client: <strong>${e(rj.client_name||'—')}</strong> &nbsp;|&nbsp; Generated: ${date}</p><hr>`;

  angles.forEach((angle, ai) => {
    b += `<h2>Angle ${ai+1}: ${e(angle.angle_name)}</h2>`;
    if (angle.angle_summary) b += `<p style="background:#f8f8f8;border-left:3px solid #aaa;padding:10px 14px;border-radius:0 4px 4px 0;color:#444"><em>${e(angle.angle_summary)}</em></p>`;

    (angle.sequence||[]).forEach(email => {
      b += `<h3 style="margin-top:24px">Email ${email.step}</h3>`;
      b += `<table style="border-collapse:collapse;width:100%;margin-bottom:12px">`;
      b += `<tr><td style="width:80px;padding:8px 12px;background:#f3f3f3;font-weight:600;font-size:10pt;color:#555;border:1px solid #e0e0e0;vertical-align:top">Subject</td>`;
      b += `<td style="padding:8px 12px;border:1px solid #e0e0e0;font-weight:700;font-size:11pt">${e(email.subject)}</td></tr>`;
      b += `</table>`;

      // Email body: preserve newlines as paragraphs
      const paras = (email.body||'').split(/\n\n+/).filter(p=>p.trim());
      b += `<div style="border:1px solid #e0e0e0;border-radius:4px;padding:20px 24px;background:#fafafa;margin-bottom:24px">`;
      if (paras.length > 0) {
        paras.forEach(para => {
          // single-newline breaks within a para → <br>
          b += `<p style="margin-bottom:10px">${e(para).replace(/\n/g,'<br>')}</p>`;
        });
      } else {
        b += `<p>${e(email.body||'').replace(/\n/g,'<br>')}</p>`;
      }
      b += `</div>`;
    });
  });

  const html = buildDocumentHtml(b, 'Campaign Sequences');
  const slug = (rj.client_name||'campaigns').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  triggerDownload(`${slug}-campaigns.html`, html);
}

function reportSection(icon, title, body, open = false) {
  return `
    <div class="report-section ${open?'open':''}" onclick="this.classList.toggle('open')">
      <div class="report-section-header">
        <span><span class="report-section-icon">${icon}</span>${title}</span>
        <span class="report-section-chevron">▾</span>
      </div>
      <div class="report-section-body" onclick="event.stopPropagation()">${body}</div>
    </div>
  `;
}

function showRerunModal(tenantId) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Re-run Research</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="alert alert-info" style="margin-bottom:16px">This will replace the existing research report with fresh data.</div>
      <div id="modal-error"></div>
      <div class="form-group">
        <label class="form-label">Updated Transcript</label>
        <textarea id="rerun-transcript" class="form-textarea" style="min-height:180px"
          placeholder="Paste updated transcript here…"></textarea>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Client Website URL <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>
        <input id="rerun-website-url" class="form-input" type="url"
          placeholder="https://clientwebsite.com" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="rerunResearch('${tenantId}')">Run Research</button>
    </div>
  `);
}

async function rerunResearch(tenantId) {
  const transcript = document.getElementById('rerun-transcript').value.trim();
  let websiteUrl = document.getElementById('rerun-website-url')?.value.trim() || undefined;
  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) websiteUrl = 'https://' + websiteUrl;
  if (transcript.length < 50) {
    document.getElementById('modal-error').innerHTML = '<div class="alert alert-error">Transcript must be at least 50 characters.</div>';
    return;
  }
  try {
    const payload = { transcript_text: transcript };
    if (websiteUrl) payload.website_url = websiteUrl;
    await api('POST', `/tenants/${tenantId}/research/run`, payload);
    closeModal();
    const el = document.getElementById('research-content');
    if (el) el.innerHTML = `
      <div class="research-status">
        <div class="spinner"></div>
        Research pipeline running — this will take 2–5 minutes…
      </div>
    `;
    startPolling(tenantId);
  } catch (e) {
    document.getElementById('modal-error').innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

/* ── Generate tab ──────────────────────────────────────────────────── */
function renderGenerateTab(tenant) {
  if (tenant.status === 'ONBOARDED') {
    return `
      <div class="card">
        <div class="card-body" style="text-align:center;padding:72px 20px;color:var(--text-muted)">
          <div style="font-size:44px;margin-bottom:18px;opacity:0.3">🔒</div>
          <div style="font-family:'Syne',sans-serif;font-size:20px;color:var(--text);margin-bottom:10px">Research Required First</div>
          <div style="font-size:14px">Run the research pipeline, then come back here to generate campaigns.</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="card" style="margin-bottom:28px">
      <div class="card-header">
        <span class="card-title">Generate Campaigns</span>
      </div>
      <div class="card-body">
        <div id="generate-error"></div>
        <div class="generate-form">
          <div class="generate-form-row">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Target Persona</label>
              <input id="gen-persona" class="form-input" placeholder="e.g. VP of Marketing at ad agency" value="" />
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Vertical</label>
              <input id="gen-vertical" class="form-input" list="vertical-options" placeholder="Loaded from research…" value="" />
              <datalist id="vertical-options">
                <option value="SaaS / B2B Software">
                <option value="E-commerce">
                <option value="Advertising / Ad Tech">
                <option value="Coaching / Consulting">
                <option value="B2B Services">
              </datalist>
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Emails per Sequence</label>
              <select id="gen-length" class="form-select">
                <option value="2">2 emails</option>
                <option value="3" selected>3 emails</option>
                <option value="4">4 emails</option>
                <option value="5">5 emails</option>
              </select>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:18px">
            <button class="btn btn-primary btn-lg" id="gen-btn" onclick="generateCampaigns('${tenant.id}')">
              ✦ Generate Campaigns
            </button>
            <span style="font-size:13px;color:var(--text-dim)">~30 seconds</span>
          </div>
          <div id="generate-loading" style="display:none">
            <div class="generate-loading">
              <div class="spinner-violet"></div>
              Claude is writing your campaigns — retrieving KB context and generating angles…
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="generations-section"></div>
  `;
}

async function generateCampaigns(tenantId) {
  const persona  = document.getElementById('gen-persona').value.trim();
  const vertical = document.getElementById('gen-vertical').value;
  const seqLen   = parseInt(document.getElementById('gen-length').value, 10);
  const errEl    = document.getElementById('generate-error');
  const loadEl   = document.getElementById('generate-loading');
  const btn      = document.getElementById('gen-btn');

  if (!persona) { errEl.innerHTML = '<div class="alert alert-error">Persona is required.</div>'; return; }
  errEl.innerHTML = '';
  loadEl.style.display = 'block';
  btn.disabled = true;

  try {
    const result = await api('POST', `/tenants/${tenantId}/generate`, {
      persona, vertical, sequence_length: seqLen,
    });
    loadEl.style.display = 'none';
    btn.disabled = false;
    loadGenerations({ id: tenantId, status: 'READY_TO_GENERATE' }, result.generation_id);
  } catch (e) {
    loadEl.style.display = 'none';
    btn.disabled = false;
    errEl.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

async function loadGenerations(tenant, highlightId = null) {
  const container = document.getElementById('generations-section');
  if (!container || tenant.status === 'ONBOARDED') return;

  let gens = [];
  try { gens = await api('GET', `/tenants/${tenant.id}/generations`); } catch { return; }
  window.__gens = gens;

  if (gens.length === 0) { container.innerHTML = ''; return; }

  const displayId = highlightId || gens[0].id;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Campaign Output</span>
        <span style="font-size:13px;color:var(--text-muted)">${gens.length} generation${gens.length===1?'':'s'}</span>
      </div>
      <div class="card-body">
        ${gens.length > 1 ? `
          <div class="generations-list">
            ${gens.map(g => {
              const count = (g.output_json?.angles||[]).length;
              return `
                <div class="generation-item ${g.id===displayId?'active':''}" onclick="selectGen('${g.id}',this)">
                  <div>
                    <div class="generation-item-angles">${count} angle${count===1?'':'s'}</div>
                    <div class="generation-item-info">${fmtDate(g.created_at)}</div>
                  </div>
                  <span style="font-size:12px;color:var(--text-dim)">View →</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
        <div id="campaign-output" class="campaigns-output">
          ${renderCampaignOutput(gens.find(g=>g.id===displayId))}
        </div>
      </div>
    </div>
  `;
}

function selectGen(genId, el) {
  document.querySelectorAll('.generation-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  const gen = (window.__gens||[]).find(g=>g.id===genId);
  if (gen) document.getElementById('campaign-output').innerHTML = renderCampaignOutput(gen);
}

/* ── Campaign output renderer ──────────────────────────────────────── */
// Store email content by key to avoid fragile inline attribute encoding
const emailStore = {};

function renderCampaignOutput(gen) {
  if (!gen) return '';
  const angles = gen.output_json?.angles || [];
  if (!angles.length) return '<div style="color:var(--text-muted);font-size:13px">No campaign data available.</div>';

  // Cache email content so copyEmail() can access it safely
  // Also cache the gen for download
  window.__currentGen = gen;
  angles.forEach((angle, ai) => {
    (angle.sequence||[]).forEach(email => {
      emailStore[`${gen.id}_${ai}_${email.step}`] = {
        subject: email.subject || '',
        body: email.body || '',
      };
    });
  });

  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-secondary btn-sm" onclick="downloadCampaigns(window.__currentGen)">↓ Download Campaigns</button>
    </div>
  ` + angles.map((angle, ai) => `
    <div class="angle-card ${ai===0?'open':''}">
      <div class="angle-header" onclick="this.closest('.angle-card').classList.toggle('open')">
        <span class="angle-number">Angle ${ai+1}</span>
        <div class="angle-info">
          <div class="angle-name">${esc(angle.angle_name||'')}</div>
          <div class="angle-summary">${esc(angle.angle_summary||'')}</div>
        </div>
        <span class="angle-chevron">▾</span>
      </div>
      <div class="angle-body">
        ${(angle.sequence||[]).map(email=>`
          <div class="email-step">
            <div class="email-step-header">
              <span class="step-number">Email ${email.step}</span>
              <button class="copy-btn" onclick="copyEmail(this,'${gen.id}_${ai}_${email.step}')">Copy</button>
            </div>
            <div class="email-subject"><span>Subject:</span> ${esc(email.subject||'')}</div>
            <div class="email-body">${esc(email.body||'')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function copyEmail(btn, key) {
  const data = emailStore[key];
  if (!data) return;
  const text = `Subject: ${data.subject}\n\n${data.body}`;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}

/* ── Escape helpers ────────────────────────────────────────────────── */
function esc(str) {
  if (str==null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
