/**
 * Agent Refinement Platform — IDE-style Web UI
 * Single-file vanilla JS, no frameworks, no imports.
 */

/* ============================================================
   CONSTANTS
   ============================================================ */
const ORG_ROLES = {
  ceo:            { icon: '👑', color: '#f9e2af', name: 'CEO',         short: 'CEO'    },
  manager:        { icon: '📊', color: '#89b4fa', name: 'Manager',     short: 'Mgr'    },
  pmo:            { icon: '📋', color: '#cba6f7', name: 'PMO',         short: 'PMO'    },
  worker:         { icon: '⚒️', color: '#94e2d5', name: 'Worker',      short: 'Worker' },
  qa:             { icon: '✅', color: '#a6e3a1', name: 'QA',          short: 'QA'     },
  ui_designer:    { icon: '🎨', color: '#f5c2e7', name: 'UI Designer', short: 'UI'     },
  system_designer:{ icon: '🏗',  color: '#fab387', name: 'Sys Designer',short: 'Sys'   },
  ops_designer:   { icon: '🔧', color: '#74c7ec', name: 'Ops Designer',short: 'Ops'   },
}

const PROVIDERS = ['gemini_cli', 'claude_cli', 'codex_cli', 'custom_cli']
const MODES     = ['writer', 'reviewer', 'editor']

/* ============================================================
   STATE
   ============================================================ */
const state = {
  agents:          [],
  projects:        [],
  templates:       [],
  selectedAgentId: null,
  selectedProjectId: null,
  activeTab:       'requirements',
  activeBottomTab: 'carousel',
  roleFilter:      null,  // null = all
  searchQuery:     '',
  running:         false,
}

/* ============================================================
   UTILITIES
   ============================================================ */
function el(id) { return document.getElementById(id) }

function notify(msg, type = 'info') {
  const container = el('notifContainer') || (() => {
    const c = document.createElement('div')
    c.id = 'notifContainer'
    document.body.appendChild(c)
    return c
  })()
  const n = document.createElement('div')
  n.className = `notif is-${type}`
  n.textContent = msg
  container.appendChild(n)
  setTimeout(() => n.remove(), 3500)
}

async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`${res.status} ${res.statusText}: ${text}`)
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return res.json()
    return res
  } catch (err) {
    notify(`API エラー: ${err.message}`, 'error')
    throw err
  }
}

function roleBadgeHTML(roleKey) {
  const role = ORG_ROLES[roleKey]
  if (!role) return `<span class="role-badge" data-role="${roleKey}">${roleKey}</span>`
  return `<span class="role-badge" data-role="${roleKey}">${role.icon} ${role.short}</span>`
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  })
  document.querySelectorAll('.bottom-tab').forEach(btn => {
    btn.addEventListener('click', () => switchBottomTab(btn.dataset.btab))
  })
}

function switchTab(tabId) {
  state.activeTab = tabId
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tabId))
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('is-active', p.id === `tab${capitalize(tabId)}`))
  if (tabId === 'agents') renderAgentGrid()
  if (tabId === 'templates') loadTemplates()
}

function switchBottomTab(tabId) {
  state.activeBottomTab = tabId
  document.querySelectorAll('.bottom-tab').forEach(b => b.classList.toggle('is-active', b.dataset.btab === tabId))
  el('agentCarousel').hidden = tabId !== 'carousel'
  el('terminalPanel').hidden = tabId !== 'terminal'
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/* ============================================================
   PROJECTS
   ============================================================ */
async function loadProjects() {
  try {
    const data = await apiFetch('/api/projects')
    state.projects = Array.isArray(data) ? data : (data.projects ?? [])
    renderProjectList()
  } catch (_) {
    state.projects = []
    renderProjectList()
  }
}

function renderProjectList() {
  const container = el('projectList')
  if (!container) return
  if (state.projects.length === 0) {
    container.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--overlay0)">案件なし</div>'
    return
  }
  container.innerHTML = state.projects.map(p => `
    <div class="project-item ${p.id === state.selectedProjectId ? 'is-selected' : ''}"
         data-project-id="${escapeHTML(p.id)}">
      📄 ${escapeHTML(p.name ?? p.id)}
    </div>
  `).join('')
  container.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', () => selectProject(item.dataset.projectId))
  })
}

function selectProject(id) {
  state.selectedProjectId = id
  renderProjectList()
}

async function addProject() {
  const name = prompt('案件名を入力してください:')
  if (!name) return
  try {
    const created = await apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    state.projects = [...state.projects, created]
    notify(`案件「${created.name ?? created.id}」を作成しました`, 'success')
    renderProjectList()
  } catch (_) {}
}

/* ============================================================
   AGENTS — load & render
   ============================================================ */
async function loadAgents() {
  try {
    const data = await apiFetch('/api/agents')
    state.agents = Array.isArray(data) ? data : (data.agents ?? [])
  } catch (_) {
    state.agents = []
  }
  renderAgentGrid()
  renderAgentCarousel()
  renderRoleFilters()
}

/** Normalise: return the primary role key for an agent */
function agentRole(agent) {
  // API returns orgRoles[] or role string
  if (agent.role) return agent.role
  if (Array.isArray(agent.orgRoles) && agent.orgRoles.length) return agent.orgRoles[0]
  return 'worker'
}

function filteredAgents() {
  return state.agents.filter(a => {
    const role = agentRole(a)
    const matchesRole    = !state.roleFilter || role === state.roleFilter
    const q = state.searchQuery.toLowerCase()
    const matchesSearch  = !q
      || (a.name ?? '').toLowerCase().includes(q)
      || role.toLowerCase().includes(q)
      || (a.system_prompt ?? '').toLowerCase().includes(q)
    return matchesRole && matchesSearch
  })
}

function renderAgentGrid() {
  const grid = el('agentGrid')
  if (!grid) return
  const agents = filteredAgents()
  if (agents.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">エージェントが見つかりません</div>'
    return
  }
  grid.innerHTML = agents.map(a => buildAgentCard(a)).join('')
  grid.querySelectorAll('.agent-card').forEach(card => {
    card.addEventListener('click', () => selectAgent(card.dataset.agentId))
  })
}

function buildAgentCard(agent) {
  const roleKey = agentRole(agent)
  const role    = ORG_ROLES[roleKey] ?? { icon: '🤖', name: roleKey ?? '?', short: '?' }
  const selected = agent.id === state.selectedAgentId ? 'is-selected' : ''
  return `
    <div class="agent-card ${selected}" data-agent-id="${escapeHTML(agent.id)}">
      <div class="agent-card-header">
        <div class="agent-avatar" data-role="${escapeHTML(roleKey)}">
          ${role.icon}
        </div>
        <div class="agent-card-meta">
          <div class="agent-name">${escapeHTML(agent.name)}</div>
          ${roleBadgeHTML(roleKey)}
        </div>
      </div>
      <div class="agent-card-body">${escapeHTML(agent.system_prompt ?? agent.description ?? '')}</div>
      <div class="agent-card-footer">
        <span class="provider-badge">${escapeHTML(agent.provider ?? 'gemini_cli')}</span>
        <span class="mode-badge">${escapeHTML(agent.mode ?? 'writer')}</span>
      </div>
    </div>
  `
}

/* ============================================================
   ROLE FILTERS
   ============================================================ */
function renderRoleFilters() {
  const container = el('roleFilters')
  if (!container) return
  const allBtn = `<button class="role-filter-btn ${!state.roleFilter ? 'is-active' : ''}" data-role="">全て</button>`
  const roleBtns = Object.entries(ORG_ROLES).map(([key, r]) =>
    `<button class="role-filter-btn ${state.roleFilter === key ? 'is-active' : ''}" data-role="${key}">
      ${r.icon} ${r.short}
    </button>`
  ).join('')
  container.innerHTML = allBtn + roleBtns
  container.querySelectorAll('.role-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.roleFilter = btn.dataset.role || null
      renderRoleFilters()
      renderAgentGrid()
    })
  })
}

/* ============================================================
   AGENT CAROUSEL
   ============================================================ */
function renderAgentCarousel() {
  const carousel = el('agentCarousel')
  if (!carousel) return
  const chips = state.agents.map(a => {
    const roleKey = agentRole(a)
    const role = ORG_ROLES[roleKey] ?? { icon: '🤖' }
    const selected = a.id === state.selectedAgentId ? 'is-selected' : ''
    return `
      <div class="carousel-chip ${selected}" data-agent-id="${escapeHTML(a.id)}">
        <div class="carousel-chip-icon" data-role="${escapeHTML(roleKey)}">
          ${role.icon}
        </div>
        <span class="carousel-chip-name">${escapeHTML(a.name)}</span>
      </div>
    `
  }).join('')
  carousel.innerHTML = chips + '<button id="carouselAddBtn" class="carousel-add">+</button>'
  carousel.querySelectorAll('.carousel-chip').forEach(chip => {
    chip.addEventListener('click', () => selectAgent(chip.dataset.agentId))
  })
  el('carouselAddBtn')?.addEventListener('click', openNewAgentPanel)
}

/* ============================================================
   AGENT SELECTION
   ============================================================ */
function selectAgent(id) {
  state.selectedAgentId = id
  const agent = state.agents.find(a => a.id === id)
  renderAgentGrid()
  renderAgentCarousel()
  if (agent) renderAgentDetailPanel(agent)
}

/* ============================================================
   AGENT DETAIL PANEL (right panel)
   ============================================================ */
function renderAgentDetailPanel(agent) {
  const panel = el('agentDetail')
  if (!panel) return
  const roleKey = agentRole(agent)
  const role = ORG_ROLES[roleKey] ?? { icon: '🤖', name: roleKey }
  panel.innerHTML = `
    <div class="agent-detail-header">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="agent-avatar" data-role="${escapeHTML(roleKey)}" style="width:40px;height:40px;font-size:20px">
          ${role.icon}
        </div>
        <div>
          <div class="agent-detail-name">${escapeHTML(agent.name)}</div>
          ${roleBadgeHTML(roleKey)}
        </div>
      </div>
    </div>
    <div class="agent-detail-body">
      <div class="form-group">
        <label class="form-label">名前</label>
        <input class="form-input" id="detailName" value="${escapeHTML(agent.name)}" />
      </div>
      <div class="form-group">
        <label class="form-label">ロール</label>
        <select class="form-select" id="detailRole">
          ${Object.entries(ORG_ROLES).map(([k, r]) =>
            `<option value="${k}" ${roleKey === k ? 'selected' : ''}>${r.icon} ${r.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">プロバイダー</label>
        <select class="form-select" id="detailProvider">
          ${PROVIDERS.map(p =>
            `<option value="${p}" ${agent.provider === p ? 'selected' : ''}>${p}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">モード</label>
        <select class="form-select" id="detailMode">
          ${MODES.map(m =>
            `<option value="${m}" ${agent.mode === m ? 'selected' : ''}>${m}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">システムプロンプト</label>
        <textarea class="form-textarea" id="detailPrompt" rows="6">${escapeHTML(agent.system_prompt ?? '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">スキル（カンマ区切り）</label>
        <input class="form-input" id="detailSkills" value="${escapeHTML((agent.skills ?? []).join(', '))}" />
      </div>
    </div>
    <div class="detail-actions">
      <button class="btn-primary" id="detailSaveBtn">💾 保存</button>
      <button class="btn-danger" id="detailDeleteBtn">🗑 削除</button>
    </div>
  `
  el('detailSaveBtn').addEventListener('click', () => saveAgent(agent.id))
  el('detailDeleteBtn').addEventListener('click', () => deleteAgent(agent.id))

  // Live role update
  el('detailRole').addEventListener('change', () => {
    const newRole = el('detailRole').value
    const r = ORG_ROLES[newRole] ?? { icon: '🤖' }
    panel.querySelector('.agent-avatar').dataset.role = newRole
    panel.querySelector('.agent-avatar').textContent = r.icon
    panel.querySelector('.role-badge').dataset.role = newRole
    panel.querySelector('.role-badge').innerHTML = roleBadgeHTML(newRole)
  })
}

function openNewAgentPanel() {
  const panel = el('agentDetail')
  if (!panel) return
  state.selectedAgentId = null
  renderAgentGrid()
  renderAgentCarousel()
  panel.innerHTML = `
    <div class="agent-detail-header">
      <div class="agent-detail-name">+ 新規エージェント</div>
    </div>
    <div class="agent-detail-body">
      <div class="form-group">
        <label class="form-label">名前</label>
        <input class="form-input" id="detailName" placeholder="エージェント名..." />
      </div>
      <div class="form-group">
        <label class="form-label">ロール</label>
        <select class="form-select" id="detailRole">
          ${Object.entries(ORG_ROLES).map(([k, r]) =>
            `<option value="${k}">${r.icon} ${r.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">プロバイダー</label>
        <select class="form-select" id="detailProvider">
          ${PROVIDERS.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">モード</label>
        <select class="form-select" id="detailMode">
          ${MODES.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">システムプロンプト</label>
        <textarea class="form-textarea" id="detailPrompt" rows="6" placeholder="システムプロンプトを入力..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">スキル（カンマ区切り）</label>
        <input class="form-input" id="detailSkills" placeholder="skill1, skill2" />
      </div>
    </div>
    <div class="detail-actions">
      <button class="btn-primary" id="detailCreateBtn">✨ 作成</button>
    </div>
  `
  el('detailCreateBtn').addEventListener('click', createAgent)
}

/* ============================================================
   AGENT CRUD
   ============================================================ */
function collectDetailFormData() {
  const role = el('detailRole')?.value ?? 'worker'
  return {
    name:          el('detailName')?.value?.trim() ?? '',
    role,
    orgRoles:      [role],
    provider:      el('detailProvider')?.value ?? 'gemini_cli',
    mode:          el('detailMode')?.value ?? 'writer',
    system_prompt: el('detailPrompt')?.value?.trim() ?? '',
    skills:        (el('detailSkills')?.value ?? '').split(',').map(s => s.trim()).filter(Boolean),
  }
}

async function createAgent() {
  const data = collectDetailFormData()
  if (!data.name) { notify('名前を入力してください', 'error'); return }
  try {
    const created = await apiFetch('/api/agents', { method: 'POST', body: JSON.stringify(data) })
    state.agents = [...state.agents, created]
    notify(`エージェント「${created.name}」を作成しました`, 'success')
    selectAgent(created.id)
    renderAgentGrid()
    renderAgentCarousel()
    renderRoleFilters()
  } catch (_) {}
}

async function saveAgent(id) {
  const data = collectDetailFormData()
  if (!data.name) { notify('名前を入力してください', 'error'); return }
  try {
    const updated = await apiFetch(`/api/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    state.agents = state.agents.map(a => a.id === id ? { ...a, ...updated } : a)
    notify(`保存しました`, 'success')
    renderAgentGrid()
    renderAgentCarousel()
    renderRoleFilters()
  } catch (_) {}
}

async function deleteAgent(id) {
  if (!confirm('このエージェントを削除しますか?')) return
  try {
    await apiFetch(`/api/agents/${id}`, { method: 'DELETE' })
    state.agents = state.agents.filter(a => a.id !== id)
    state.selectedAgentId = null
    el('agentDetail').innerHTML = '<div class="empty-state">エージェントを選択</div>'
    notify('エージェントを削除しました', 'info')
    renderAgentGrid()
    renderAgentCarousel()
    renderRoleFilters()
  } catch (_) {}
}

/* ============================================================
   SEARCH
   ============================================================ */
function initSearch() {
  const searchInput = el('agentSearch')
  if (!searchInput) return
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value
    renderAgentGrid()
  })
}

/* ============================================================
   ADD AGENT BUTTON (in agents tab toolbar)
   ============================================================ */
function initAddAgentBtn() {
  el('addAgentBtn')?.addEventListener('click', () => {
    openNewAgentPanel()
    // If not already on agents tab, switch
    if (state.activeTab !== 'agents') switchTab('agents')
  })
}

/* ============================================================
   REQUIREMENTS EXECUTION (NDJSON streaming)
   ============================================================ */
function initRequirements() {
  el('runBtn')?.addEventListener('click', runRequirements)
  el('requirementsInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') runRequirements()
  })
}

async function runRequirements() {
  if (state.running) return
  const input = el('requirementsInput')
  const req   = input?.value?.trim()
  if (!req) { notify('要件を入力してください', 'error'); return }

  state.running = true
  const runBtn = el('runBtn')
  if (runBtn) { runBtn.disabled = true; runBtn.textContent = '⏳ 実行中...' }

  const logEl = el('executionLog')
  if (logEl) {
    logEl.innerHTML = `
      <table class="log-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Role</th>
            <th>Status</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody id="logTableBody"></tbody>
      </table>
    `
  }

  const agentRows = {}

  function appendLogRow(event) {
    const tbody = el('logTableBody')
    if (!tbody) return
    const agentId = event.agent_id ?? event.agent ?? '?'
    const role    = event.role ?? ''
    const status  = event.status ?? event.type ?? ''
    const output  = event.output ?? event.message ?? event.content ?? ''
    const roleInfo = ORG_ROLES[role] ?? { icon: '🤖', short: role }

    if (agentRows[agentId]) {
      const row = agentRows[agentId]
      const statusEl = row.querySelector('.log-status')
      const outputEl = row.querySelector('.log-output')
      if (statusEl) {
        statusEl.className = `log-status log-status-${status}`
        statusEl.textContent = status
      }
      if (outputEl && output) outputEl.textContent = output
    } else {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td class="log-agent">${escapeHTML(agentId)}</td>
        <td class="log-role">${roleInfo.icon} ${escapeHTML(roleInfo.short || role)}</td>
        <td><span class="log-status log-status-${escapeHTML(status)}">${escapeHTML(status)}</span></td>
        <td class="log-output">${escapeHTML(output)}</td>
      `
      tbody.appendChild(tr)
      agentRows[agentId] = tr
    }
  }

  try {
    const res = await fetch('/api/refine/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirements: req, project_id: state.selectedProjectId }),
    })

    if (!res.ok) {
      const text = await res.text()
      notify(`実行エラー: ${res.status} ${text}`, 'error')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const event = JSON.parse(trimmed)
          appendLogRow(event)
          // Append CEO messages to chat
          if (event.role === 'ceo' && event.output) {
            appendCeoMessage(event.output, 'ceo')
          }
        } catch (_) {
          // Non-JSON line, append as raw log
          const tbody = el('logTableBody')
          if (tbody) {
            const tr = document.createElement('tr')
            tr.innerHTML = `<td colspan="4" class="log-entry">${escapeHTML(trimmed)}</td>`
            tbody.appendChild(tr)
          }
        }
      }
    }
    notify('実行完了', 'success')
  } catch (err) {
    notify(`実行エラー: ${err.message}`, 'error')
  } finally {
    state.running = false
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = '▶ 実行' }
  }
}

/* ============================================================
   CEO CHAT
   ============================================================ */
function initCeoChat() {
  el('ceoChatSend')?.addEventListener('click', sendCeoMessage)
  el('ceoChatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendCeoMessage()
  })
}

function appendCeoMessage(text, sender = 'ceo') {
  const container = el('ceoChatMessages')
  if (!container) return
  const msg = document.createElement('div')
  msg.className = `chat-msg is-${sender}`
  msg.textContent = text
  container.appendChild(msg)
  container.scrollTop = container.scrollHeight
}

async function sendCeoMessage() {
  const input = el('ceoChatInput')
  const text  = input?.value?.trim()
  if (!text) return
  input.value = ''
  appendCeoMessage(text, 'user')
  // No dedicated CEO chat API yet — show placeholder reply
  setTimeout(() => {
    appendCeoMessage('（CEO への送信機能は準備中です）', 'system')
  }, 300)
}

/* ============================================================
   TEMPLATES
   ============================================================ */
async function loadTemplates() {
  try {
    const data = await apiFetch('/api/templates')
    state.templates = Array.isArray(data) ? data : (data.templates ?? [])
  } catch (_) {
    state.templates = []
  }
  renderTemplateList()
}

function renderTemplateList() {
  const list = el('templateList')
  if (!list) return
  if (state.templates.length === 0) {
    list.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--overlay0)">テンプレートなし</div>'
    return
  }
  list.innerHTML = state.templates.map(t => `
    <div class="template-item" data-template-id="${escapeHTML(t.id)}">
      🏢 ${escapeHTML(t.name ?? t.id)}
    </div>
  `).join('')
  list.querySelectorAll('.template-item').forEach(item => {
    item.addEventListener('click', () => showTemplateDetail(item.dataset.templateId))
  })
}

function showTemplateDetail(id) {
  const template = state.templates.find(t => t.id === id)
  if (!template) return

  el('templateList')?.querySelectorAll('.template-item').forEach(item => {
    item.classList.toggle('is-selected', item.dataset.templateId === id)
  })

  const detail = el('templateDetail')
  if (!detail) return
  const agents = template.agents ?? []
  detail.innerHTML = `
    <h2>${escapeHTML(template.name ?? id)}</h2>
    <p style="font-size:12px;color:var(--overlay1)">${escapeHTML(template.description ?? '')}</p>
    <div class="divider"></div>
    <div class="form-label">エージェント構成 (${agents.length})</div>
    <div class="template-agents-list">
      ${agents.map(a => {
        const role = ORG_ROLES[a.role ?? a] ?? { icon: '🤖', name: a.role ?? a }
        return `
          <div class="template-agent-row">
            <span>${role.icon}</span>
            <span style="font-weight:600">${escapeHTML(a.name ?? a)}</span>
            ${roleBadgeHTML(a.role ?? '')}
          </div>
        `
      }).join('')}
    </div>
    <div style="margin-top:8px">
      <button class="btn-primary" id="applyTemplateBtn">✨ 適用</button>
    </div>
  `
  el('applyTemplateBtn')?.addEventListener('click', () => applyTemplate(template))
}

async function applyTemplate(template) {
  try {
    await apiFetch('/api/templates/' + template.id + '/apply', { method: 'POST', body: JSON.stringify({}) })
    notify(`テンプレート「${template.name}」を適用しました`, 'success')
    await loadAgents()
  } catch (err) {
    // Fallback: endpoint may not exist
    notify('テンプレートの適用に失敗しました', 'error')
  }
}

function initAddTemplate() {
  el('addTemplateBtn')?.addEventListener('click', async () => {
    const name = prompt('テンプレート名:')
    if (!name) return
    try {
      const created = await apiFetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      state.templates = [...state.templates, created]
      notify(`テンプレート「${created.name ?? created.id}」を作成しました`, 'success')
      renderTemplateList()
    } catch (_) {}
  })
}

/* ============================================================
   RESIZE HANDLES
   ============================================================ */
function initResizeHandles() {
  const app = document.getElementById('app')
  document.querySelectorAll('.resize-handle').forEach(handle => {
    let startX = 0
    let startSize = 0
    const side = handle.dataset.resize

    handle.addEventListener('mousedown', e => {
      startX = e.clientX
      const panel = side === 'left' ? el('leftPanel') : el('rightPanel')
      startSize = panel.getBoundingClientRect().width
      handle.classList.add('is-dragging')

      const onMove = ev => {
        const dx = ev.clientX - startX
        const newSize = side === 'left' ? startSize + dx : startSize - dx
        const clamped = Math.max(150, Math.min(500, newSize))
        if (side === 'left') {
          app.style.gridTemplateColumns = `${clamped}px 4px 1fr 4px ${getComputedStyle(document.documentElement).getPropertyValue('--right-width').trim()}`
        } else {
          app.style.gridTemplateColumns = `${getComputedStyle(document.documentElement).getPropertyValue('--left-width').trim()} 4px 1fr 4px ${clamped}px`
        }
      }
      const onUp = () => {
        handle.classList.remove('is-dragging')
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  })
}

/* ============================================================
   ADD PROJECT BUTTON
   ============================================================ */
function initAddProject() {
  el('addProjectBtn')?.addEventListener('click', addProject)
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  initTabs()
  initSearch()
  initAddAgentBtn()
  initRequirements()
  initCeoChat()
  initAddTemplate()
  initAddProject()
  initResizeHandles()

  // Load data in parallel
  await Promise.allSettled([
    loadProjects(),
    loadAgents(),
  ])
}

document.addEventListener('DOMContentLoaded', boot)
