// ─── State ────────────────────────────────────────────────────────────────────
const S = {
  user: null,
  token: null,
  view: 'dashboard',
  projectId: null,
  projectTab: 'tasks',
  taskView: 'board',       // 'board' | 'list'
  dragTaskId: null,
};

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (S.token) opts.headers['Authorization'] = `Bearer ${S.token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const el = document.createElement('div');
  el.className = `toast-msg toast-${type}`;
  el.innerHTML = `<i class="fas ${icons[type]}"></i> ${msg}`;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ─── Router ───────────────────────────────────────────────────────────────────
function navigate(view, params = {}) {
  S.view = view;
  Object.assign(S, params);
  render();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function showAuthPage(mode = 'login') {
  document.getElementById('auth-page').style.display = 'flex';
  document.getElementById('app-page').style.display = 'none';
  renderAuthForms(mode);
}
function showAppPage() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('app-page').style.display = 'flex';
  updateSidebarUser();
  render();
}

async function doLogin(e) {
  e.preventDefault();
  try {
    const res = await api('POST', '/auth/login', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    });
    S.token = res.access_token; S.user = res.user;
    localStorage.setItem('token', S.token);
    localStorage.setItem('user', JSON.stringify(S.user));
    showAppPage();
    toast('Welcome back, ' + S.user.username + '!');
  } catch (err) { toast(err.message, 'error'); }
}

async function doRegister(e) {
  e.preventDefault();
  try {
    const res = await api('POST', '/auth/register', {
      email: document.getElementById('reg-email').value,
      username: document.getElementById('reg-username').value,
      password: document.getElementById('reg-password').value,
    });
    S.token = res.access_token; S.user = res.user;
    localStorage.setItem('token', S.token);
    localStorage.setItem('user', JSON.stringify(S.user));
    showAppPage();
    toast('Account created! Welcome, ' + S.user.username + ' 🎉');
  } catch (err) { toast(err.message, 'error'); }
}

function doLogout() {
  S.token = null; S.user = null;
  localStorage.clear();
  showAuthPage();
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function updateSidebarUser() {
  if (!S.user) return;
  document.getElementById('sidebar-username').textContent = S.user.username;
  document.getElementById('sidebar-email').textContent = S.user.email;
  document.getElementById('sidebar-avatar').textContent = S.user.username[0].toUpperCase();
}
function setActiveNav(view) {
  document.querySelectorAll('.nav-link').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view)
  );
}

// ─── Render ───────────────────────────────────────────────────────────────────
async function render() {
  setActiveNav(S.view);
  const content = document.getElementById('content');
  content.innerHTML = `<div style="padding:60px;text-align:center;color:#94a3b8">
    <i class="fas fa-spinner fa-spin" style="font-size:28px"></i>
  </div>`;
  try {
    if (S.view === 'dashboard') await renderDashboard(content);
    else if (S.view === 'projects')  await renderProjects(content);
    else if (S.view === 'project')   await renderProjectDetail(content);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i>
      <h3>Something went wrong</h3><p>${err.message}</p></div>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeDate(iso) {
  if (!iso) return `<span class="due-chip due-none"><i class="far fa-calendar"></i> No due date</span>`;
  const now = new Date();
  const due = new Date(iso);
  const diff = Math.round((due - now) / 86400000); // days

  if (diff < 0) {
    const d = Math.abs(diff);
    return `<span class="due-chip due-overdue"><i class="fas fa-exclamation-circle"></i> Overdue ${d}d</span>`;
  }
  if (diff === 0) return `<span class="due-chip due-today"><i class="fas fa-clock"></i> Due today</span>`;
  if (diff === 1) return `<span class="due-chip due-soon"><i class="fas fa-clock"></i> Due tomorrow</span>`;
  if (diff <= 3)  return `<span class="due-chip due-soon"><i class="fas fa-clock"></i> In ${diff} days</span>`;
  return `<span class="due-chip due-ok"><i class="far fa-calendar"></i> ${fmtDate(iso)}</span>`;
}

function statusBadge(status) {
  const m = { todo: ['badge-todo','To Do'], in_progress: ['badge-progress','In Progress'], done: ['badge-done','Done'] };
  const [cls, label] = m[status] || ['badge-todo', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function priorityBadge(p) {
  const m = { low: ['badge-low','↓ Low'], medium: ['badge-medium','→ Medium'], high: ['badge-high','↑ High'] };
  const [cls, label] = m[p] || ['badge-medium', p];
  return `<span class="badge ${cls}">${label}</span>`;
}

function roleBadge(role) {
  const r = String(role).replace('ProjectRole.','');
  return `<span class="badge ${r==='admin'?'badge-admin':'badge-member'}">${r.toUpperCase()}</span>`;
}

function progressColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 40) return '#f59e0b';
  return '#3b82f6';
}

function circularProgress(pct, size = 90, strokeW = 7) {
  const r = (size / 2) - strokeW;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = progressColor(pct);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="${strokeW}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeW}"
        stroke-dasharray="${fill} ${circ}" stroke-dashoffset="${circ*0.25}"
        stroke-linecap="round" class="progress-ring"/>
      <text x="${size/2}" y="${size/2+5}" text-anchor="middle" font-size="14"
        font-weight="800" fill="${color}" font-family="inherit">${pct}%</text>
    </svg>`;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function renderDashboard(content) {
  const [data, projects] = await Promise.all([
    api('GET', '/dashboard/'),
    api('GET', '/projects/'),
  ]);
  const { stats, recent_tasks, my_tasks } = data;
  const total = stats.total_tasks || 1;
  const pct = Math.round((stats.completed_tasks / total) * 100);

  const statDefs = [
    { label: 'Projects',    value: stats.total_projects,    color: '#3b82f6', icon: 'fa-folder' },
    { label: 'Total Tasks', value: stats.total_tasks,       color: '#8b5cf6', icon: 'fa-tasks' },
    { label: 'To Do',       value: stats.todo_tasks,        color: '#64748b', icon: 'fa-circle' },
    { label: 'In Progress', value: stats.in_progress_tasks, color: '#f59e0b', icon: 'fa-spinner' },
    { label: 'Completed',   value: stats.completed_tasks,   color: '#10b981', icon: 'fa-check-circle' },
    { label: 'Overdue',     value: stats.overdue_tasks,     color: '#ef4444', icon: 'fa-exclamation-circle' },
  ];

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="text-muted">Welcome back, <strong>${esc(S.user.username)}</strong></p>
      </div>
      <button class="btn btn-primary" onclick="navigate('projects')">
        <i class="fas fa-plus"></i> New Project
      </button>
    </div>

    <div class="dash-stats-grid">
      ${statDefs.map(s => `
        <div class="stat-card animate-in">
          <div class="accent-bar" style="background:${s.color}"></div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="stat-label">${s.label}</span>
            <i class="fas ${s.icon}" style="color:${s.color};opacity:.7;font-size:15px"></i>
          </div>
          <div class="stat-value">${s.value}</div>
        </div>`).join('')}
    </div>

    <div class="dash-bottom-grid">

      <!-- Completion ring + project list -->
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card animate-in" style="text-align:center">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin-bottom:14px">
            <i class="fas fa-chart-pie" style="color:#3b82f6"></i> Overall Completion
          </h3>
          ${circularProgress(pct, 110, 9)}
          <p style="color:#64748b;font-size:13px;margin-top:10px">
            ${stats.completed_tasks} of ${stats.total_tasks} tasks done
          </p>
          <div style="display:flex;justify-content:center;gap:16px;margin-top:12px;font-size:12px">
            <span style="color:#64748b"><span style="color:#3b82f6;font-weight:700">■</span> Todo ${stats.todo_tasks}</span>
            <span style="color:#64748b"><span style="color:#f59e0b;font-weight:700">■</span> WIP ${stats.in_progress_tasks}</span>
            <span style="color:#64748b"><span style="color:#10b981;font-weight:700">■</span> Done ${stats.completed_tasks}</span>
          </div>
        </div>

        ${projects.length ? `
        <div class="card animate-in">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin-bottom:14px">
            <i class="fas fa-folder" style="color:#8b5cf6"></i> My Projects
          </h3>
          ${projects.slice(0,5).map(p => {
            const donePct = p.task_count ? Math.round((p.tasks_done / p.task_count) * 100) : 0;
            const col = progressColor(donePct);
            return `
              <div onclick="navigate('project',{projectId:${p.id},projectTab:'tasks'})"
                style="cursor:pointer;padding:10px 0;border-bottom:1px solid #f1f5f9;last-child:border-none">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                  <span style="font-size:13px;font-weight:600;color:#0f172a">${esc(p.name)}</span>
                  <span style="font-size:12px;font-weight:700;color:${col}">${donePct}%</span>
                </div>
                <div class="project-progress-bar">
                  <div class="project-progress-fill" style="width:${donePct}%;background:${col}"></div>
                </div>
                <div style="font-size:11px;color:#94a3b8;margin-top:4px">
                  ${p.tasks_done}/${p.task_count} tasks completed
                </div>
              </div>`;
          }).join('')}
        </div>` : ''}
      </div>

      <!-- Recent + My Tasks -->
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card animate-in">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin-bottom:14px">
            <i class="fas fa-clock" style="color:#f59e0b"></i> Recent Tasks
          </h3>
          ${taskMiniTable(recent_tasks)}
        </div>
        <div class="card animate-in">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin-bottom:14px">
            <i class="fas fa-user-check" style="color:#3b82f6"></i> Assigned to Me
          </h3>
          ${taskMiniTable(my_tasks)}
        </div>
      </div>

    </div>
  `;
}

function taskMiniTable(tasks) {
  if (!tasks.length) return `<div class="empty-state" style="padding:24px">
    <i class="fas fa-inbox" style="font-size:24px"></i><p>No tasks</p></div>`;
  return tasks.map(t => `
    <div onclick="navigate('project',{projectId:${t.project_id},projectTab:'tasks'})"
      style="cursor:pointer;display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f8fafc">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${esc(t.title)}
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">${esc(t.project_name)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
        ${statusBadge(t.status)}
        ${t.is_overdue ? '<span class="badge badge-overdue">OVERDUE</span>' : ''}
      </div>
    </div>`).join('');
}

// ─── Projects List ────────────────────────────────────────────────────────────
async function renderProjects(content) {
  const projects = await api('GET', '/projects/');

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Projects</h1>
        <p class="text-muted">${projects.length} project${projects.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-primary" onclick="openCreateProjectModal()">
        <i class="fas fa-plus"></i> New Project
      </button>
    </div>
    ${projects.length ? `
      <div class="projects-grid">
        ${projects.map(projectCard).join('')}
      </div>` : `
      <div class="empty-state">
        <i class="fas fa-folder-open"></i>
        <h3>No projects yet</h3>
        <p>Create your first project to get started</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="openCreateProjectModal()">
          <i class="fas fa-plus"></i> Create Project
        </button>
      </div>`}
  `;
}

function projectCard(p) {
  const donePct = p.task_count ? Math.round((p.tasks_done / p.task_count) * 100) : 0;
  const col = progressColor(donePct);
  const roleStr = String(p.my_role || '').replace('ProjectRole.', '');
  return `
    <div class="project-card animate-in" onclick="navigate('project',{projectId:${p.id},projectTab:'tasks'})">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.3">${esc(p.name)}</h3>
        ${roleBadge(roleStr)}
      </div>
      <p style="color:#64748b;font-size:13px;margin-bottom:14px;min-height:38px;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
        ${esc(p.description || 'No description')}
      </p>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:12px;color:#94a3b8">Progress</span>
        <span style="font-size:12px;font-weight:700;color:${col}">${donePct}%</span>
      </div>
      <div class="project-progress-bar">
        <div class="project-progress-fill" style="width:${donePct}%;background:${col}"></div>
      </div>

      <div style="display:flex;gap:10px;margin-top:12px;font-size:11px;flex-wrap:wrap">
        <span style="color:#64748b"><i class="fas fa-circle" style="color:#e2e8f0;font-size:8px"></i> ${p.tasks_todo} todo</span>
        <span style="color:#64748b"><i class="fas fa-circle" style="color:#f59e0b;font-size:8px"></i> ${p.tasks_in_progress} wip</span>
        <span style="color:#64748b"><i class="fas fa-circle" style="color:#10b981;font-size:8px"></i> ${p.tasks_done} done</span>
        <span style="margin-left:auto;color:#94a3b8"><i class="fas fa-users"></i> ${p.member_count}</span>
      </div>
    </div>`;
}

// ─── Project Detail ───────────────────────────────────────────────────────────
async function renderProjectDetail(content) {
  const [project, tasks, members] = await Promise.all([
    api('GET', `/projects/${S.projectId}`),
    api('GET', `/projects/${S.projectId}/tasks`),
    api('GET', `/projects/${S.projectId}/members`),
  ]);

  window._currentProject = project;
  window._currentMembers = members;
  window._currentTasks = tasks;

  const isAdmin = String(project.my_role || '').includes('admin') || project.owner_id === S.user.id;
  const donePct = project.task_count ? Math.round((project.tasks_done / project.task_count) * 100) : 0;
  const col = progressColor(donePct);

  content.innerHTML = `
    <div style="margin-bottom:18px">
      <button class="btn btn-ghost btn-sm" onclick="navigate('projects')">
        <i class="fas fa-arrow-left"></i> All Projects
      </button>
    </div>

    <div class="card animate-in" style="margin-bottom:20px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:14px">
        <div style="flex:1;min-width:0">
          <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:6px">${esc(project.name)}</h1>
          <p style="color:#64748b;font-size:14px;margin-bottom:12px">${esc(project.description || 'No description')}</p>
          <div style="font-size:12px;color:#94a3b8">
            <i class="fas fa-user"></i> <strong>${esc(project.owner_username)}</strong>
            &nbsp;·&nbsp; Created ${fmtDate(project.created_at)}
            &nbsp;·&nbsp; ${members.length} member${members.length!==1?'s':''}
          </div>
          <div style="margin-top:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:12px;color:#94a3b8">Completion</span>
              <span style="font-size:12px;font-weight:700;color:${col}">${donePct}%</span>
            </div>
            <div class="project-progress-bar" style="height:8px">
              <div class="project-progress-fill" style="width:${donePct}%;background:${col}"></div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
          ${isAdmin ? `
            <button class="btn btn-ghost btn-sm" onclick="openEditProjectModal(${JSON.stringify(project).replace(/"/g,'&quot;')})">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteProject(${project.id})">
              <i class="fas fa-trash"></i>
            </button>` : ''}
        </div>
      </div>
    </div>

    <div class="tab-bar">
      <button class="tab-btn ${S.projectTab==='tasks'?'active':''}" onclick="switchTab('tasks')">
        <i class="fas fa-tasks"></i> Tasks (${tasks.length})
      </button>
      <button class="tab-btn ${S.projectTab==='members'?'active':''}" onclick="switchTab('members')">
        <i class="fas fa-users"></i> Members (${members.length})
      </button>
    </div>

    <div id="tab-content" class="animate-in">
      ${S.projectTab === 'tasks'
        ? renderTasksTab(tasks, members, isAdmin)
        : renderMembersTab(members, isAdmin)}
    </div>
  `;
}

function switchTab(tab) {
  S.projectTab = tab;
  navigate('project', { projectId: S.projectId, projectTab: tab });
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────
function renderTasksTab(tasks, members, isAdmin) {
  return `
    <div class="page-header" style="margin-bottom:14px">
      <div class="filter-bar">
        <select id="filter-status" onchange="filterTasks()">
          <option value="">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select id="filter-priority" onchange="filterTasks()">
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="view-toggle">
          <button class="view-toggle-btn ${S.taskView==='board'?'active':''}" onclick="setTaskView('board')">
            <i class="fas fa-columns"></i> Board
          </button>
          <button class="view-toggle-btn ${S.taskView==='list'?'active':''}" onclick="setTaskView('list')">
            <i class="fas fa-list"></i> List
          </button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openCreateTaskModal()">
          <i class="fas fa-plus"></i> Add Task
        </button>
      </div>
    </div>
    <div id="tasks-view-area">
      ${S.taskView === 'board'
        ? renderKanban(tasks, isAdmin)
        : renderTaskList(tasks, isAdmin)}
    </div>
  `;
}

function setTaskView(view) {
  S.taskView = view;
  const tasks = applyFilters(window._currentTasks || []);
  const isAdmin = isProjectAdmin();
  document.getElementById('tasks-view-area').innerHTML =
    view === 'board' ? renderKanban(tasks, isAdmin) : renderTaskList(tasks, isAdmin);
  document.querySelectorAll('.view-toggle-btn').forEach(btn =>
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase().includes(view))
  );
}

function applyFilters(tasks) {
  const status = document.getElementById('filter-status')?.value || '';
  const priority = document.getElementById('filter-priority')?.value || '';
  return tasks.filter(t =>
    (!status || t.status === status) &&
    (!priority || t.priority === priority)
  );
}

function filterTasks() {
  const tasks = applyFilters(window._currentTasks || []);
  const isAdmin = isProjectAdmin();
  document.getElementById('tasks-view-area').innerHTML =
    S.taskView === 'board' ? renderKanban(tasks, isAdmin) : renderTaskList(tasks, isAdmin);
}

function isProjectAdmin() {
  const p = window._currentProject;
  if (!p) return false;
  return String(p.my_role || '').includes('admin') || p.owner_id === S.user.id;
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────
function renderKanban(tasks, isAdmin) {
  const cols = [
    { key: 'todo',        label: 'To Do',       color: '#94a3b8' },
    { key: 'in_progress', label: 'In Progress',  color: '#f59e0b' },
    { key: 'done',        label: 'Done',         color: '#10b981' },
  ];

  return `<div class="kanban-board">
    ${cols.map(col => {
      const colTasks = tasks.filter(t => t.status === col.key);
      return `
        <div class="kanban-col"
          ondragover="kanbanDragOver(event,'${col.key}')"
          ondragleave="kanbanDragLeave(event)"
          ondrop="kanbanDrop(event,'${col.key}')">
          <div class="kanban-col-header">
            <div class="kanban-col-title">
              <span class="kanban-col-dot" style="background:${col.color}"></span>
              ${col.label}
            </div>
            <span class="kanban-count">${colTasks.length}</span>
          </div>
          <div id="kanban-col-${col.key}">
            ${colTasks.length
              ? colTasks.map(t => kanbanCard(t, isAdmin)).join('')
              : `<div style="padding:20px;text-align:center;color:#cbd5e1;font-size:12px;border:2px dashed #e2e8f0;border-radius:10px">
                  Drop tasks here
                </div>`}
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function kanbanCard(t, isAdmin) {
  const canEdit = isAdmin || t.creator_id === S.user.id || t.assignee_id === S.user.id;
  return `
    <div class="kanban-card priority-${t.priority} animate-in"
      draggable="true"
      id="kcard-${t.id}"
      ondragstart="kanbanDragStart(event,${t.id})"
      ondragend="kanbanDragEnd(event)">
      <div class="kanban-card-body">
        <div class="kanban-card-title">${esc(t.title)}</div>
        ${t.description ? `<div class="kanban-card-desc">${esc(t.description)}</div>` : ''}
        <div class="kanban-card-footer">
          ${relativeDate(t.due_date)}
          <div style="display:flex;align-items:center;gap:6px">
            ${priorityBadge(t.priority)}
            ${t.assignee_username
              ? `<div class="avatar avatar-sm" title="${esc(t.assignee_username)}">${t.assignee_username[0].toUpperCase()}</div>`
              : ''}
          </div>
        </div>
      </div>
      ${canEdit ? `
        <div class="kanban-card-actions">
          <button onclick="openEditTaskModal(${t.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button onclick="deleteTask(${t.id})" title="Delete" style="color:#ef4444"><i class="fas fa-trash"></i></button>
        </div>` : ''}
    </div>`;
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────
function kanbanDragStart(e, taskId) {
  S.dragTaskId = taskId;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const el = document.getElementById(`kcard-${taskId}`);
    if (el) el.classList.add('dragging');
  }, 0);
}

function kanbanDragEnd(e) {
  document.querySelectorAll('.kanban-card').forEach(c => c.classList.remove('dragging'));
  document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
}

function kanbanDragOver(e, status) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function kanbanDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function kanbanDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const taskId = S.dragTaskId;
  if (!taskId) return;

  const task = (window._currentTasks || []).find(t => t.id === taskId);
  if (!task || task.status === newStatus) return;

  try {
    const updated = await api('PUT', `/projects/${S.projectId}/tasks/${taskId}`, { status: newStatus });
    const idx = window._currentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) window._currentTasks[idx] = updated;
    toast('Status updated to ' + newStatus.replace('_', ' '));
    const tasks = applyFilters(window._currentTasks);
    document.getElementById('tasks-view-area').innerHTML = renderKanban(tasks, isProjectAdmin());
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Task List View ───────────────────────────────────────────────────────────
function renderTaskList(tasks, isAdmin) {
  if (!tasks.length) return `<div class="card"><div class="empty-state">
    <i class="fas fa-clipboard-list"></i>
    <h3>No tasks found</h3>
    <p>Add a task or adjust your filters</p>
  </div></div>`;

  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th><th></th></tr>
          </thead>
          <tbody>
            ${tasks.map(t => {
              const canEdit = isAdmin || t.creator_id === S.user.id || t.assignee_id === S.user.id;
              return `
                <tr>
                  <td>
                    <div style="font-weight:600;color:#0f172a">${esc(t.title)}</div>
                    ${t.description ? `<div style="font-size:12px;color:#94a3b8;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.description)}</div>` : ''}
                  </td>
                  <td>${statusBadge(t.status)}</td>
                  <td>${priorityBadge(t.priority)}</td>
                  <td>
                    ${t.assignee_username
                      ? `<div style="display:flex;align-items:center;gap:6px">
                          <div class="avatar avatar-sm">${t.assignee_username[0].toUpperCase()}</div>
                          <span style="font-size:13px">${esc(t.assignee_username)}</span>
                         </div>`
                      : '<span style="color:#94a3b8;font-size:12px">Unassigned</span>'}
                  </td>
                  <td>${relativeDate(t.due_date)}</td>
                  <td>
                    ${canEdit ? `
                      <div style="display:flex;gap:6px">
                        <button class="btn btn-ghost btn-sm" onclick="openEditTaskModal(${t.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="deleteTask(${t.id})"><i class="fas fa-trash"></i></button>
                      </div>` : ''}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── Members Tab ──────────────────────────────────────────────────────────────
function renderMembersTab(members, isAdmin) {
  return `
    <div class="page-header" style="margin-bottom:14px">
      <h2 style="font-size:16px;font-weight:700;margin:0">
        <i class="fas fa-users" style="color:#3b82f6"></i> Team Members
      </h2>
      ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="openAddMemberModal()">
        <i class="fas fa-user-plus"></i> Add Member
      </button>` : ''}
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Joined</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody>
            ${members.map(m => `
              <tr>
                <td><div style="display:flex;align-items:center;gap:10px">
                  <div class="avatar">${m.username[0].toUpperCase()}</div>
                  <div>
                    <div style="font-weight:600;font-size:14px">${esc(m.username)}</div>
                    ${m.user_id === S.user.id ? '<div style="font-size:11px;color:#3b82f6">You</div>' : ''}
                  </div>
                </div></td>
                <td style="color:#64748b;font-size:13px">${esc(m.email)}</td>
                <td>${roleBadge(m.role)}</td>
                <td style="font-size:12px;color:#94a3b8">${fmtDate(m.joined_at)}</td>
                ${isAdmin ? `<td>
                  ${m.user_id !== window._currentProject?.owner_id ? `
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-ghost btn-sm" onclick="toggleMemberRole(${m.user_id},'${m.role}')" title="Toggle role">
                        <i class="fas fa-exchange-alt"></i>
                      </button>
                      <button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="removeMember(${m.user_id},'${esc(m.username)}')">
                        <i class="fas fa-user-minus"></i>
                      </button>
                    </div>` : '<span style="font-size:11px;color:#94a3b8">Owner</span>'}
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── Task Modals ──────────────────────────────────────────────────────────────
function memberOptions(selectedId = null) {
  return (window._currentMembers || []).map(m =>
    `<option value="${m.user_id}" ${selectedId === m.user_id ? 'selected' : ''}>${esc(m.username)}</option>`
  ).join('');
}

function openCreateTaskModal() {
  openModal('Create Task', `
    <form id="task-form">
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="t-title" placeholder="What needs to be done?" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="t-desc" placeholder="Add more details…"></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="t-status">
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="t-priority">
            <option value="low">↓ Low</option>
            <option value="medium" selected>→ Medium</option>
            <option value="high">↑ High</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Assign To</label>
          <select class="form-select" id="t-assignee">
            <option value="">Unassigned</option>
            ${memberOptions()}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input class="form-input" type="datetime-local" id="t-due">
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> Create Task</button>
      </div>
    </form>
  `);

  document.getElementById('task-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const assignee = document.getElementById('t-assignee').value;
      const due = document.getElementById('t-due').value;
      const task = await api('POST', `/projects/${S.projectId}/tasks`, {
        title: document.getElementById('t-title').value,
        description: document.getElementById('t-desc').value || null,
        status: document.getElementById('t-status').value,
        priority: document.getElementById('t-priority').value,
        assignee_id: assignee ? parseInt(assignee) : null,
        due_date: due ? new Date(due).toISOString() : null,
      });
      window._currentTasks.unshift(task);
      closeModal();
      toast('Task created!');
      const tasks = applyFilters(window._currentTasks);
      document.getElementById('tasks-view-area').innerHTML =
        S.taskView === 'board' ? renderKanban(tasks, isProjectAdmin()) : renderTaskList(tasks, isProjectAdmin());
    } catch (err) { toast(err.message, 'error'); }
  };
}

function openEditTaskModal(taskId) {
  const task = (window._currentTasks || []).find(t => t.id === taskId);
  if (!task) return;
  const dueLocal = task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '';

  openModal('Edit Task', `
    <form id="edit-task-form">
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="et-title" value="${esc(task.title)}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="et-desc">${esc(task.description || '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="et-status">
            <option value="todo" ${task.status==='todo'?'selected':''}>To Do</option>
            <option value="in_progress" ${task.status==='in_progress'?'selected':''}>In Progress</option>
            <option value="done" ${task.status==='done'?'selected':''}>Done</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="et-priority">
            <option value="low" ${task.priority==='low'?'selected':''}>↓ Low</option>
            <option value="medium" ${task.priority==='medium'?'selected':''}>→ Medium</option>
            <option value="high" ${task.priority==='high'?'selected':''}>↑ High</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Assign To</label>
          <select class="form-select" id="et-assignee">
            <option value="">Unassigned</option>
            ${memberOptions(task.assignee_id)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input class="form-input" type="datetime-local" id="et-due" value="${dueLocal}">
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Changes</button>
      </div>
    </form>
  `);

  document.getElementById('edit-task-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const assignee = document.getElementById('et-assignee').value;
      const due = document.getElementById('et-due').value;
      const updated = await api('PUT', `/projects/${S.projectId}/tasks/${taskId}`, {
        title: document.getElementById('et-title').value,
        description: document.getElementById('et-desc').value || null,
        status: document.getElementById('et-status').value,
        priority: document.getElementById('et-priority').value,
        assignee_id: assignee ? parseInt(assignee) : null,
        due_date: due ? new Date(due).toISOString() : null,
      });
      const idx = window._currentTasks.findIndex(t => t.id === taskId);
      if (idx !== -1) window._currentTasks[idx] = updated;
      closeModal();
      toast('Task updated!');
      const tasks = applyFilters(window._currentTasks);
      document.getElementById('tasks-view-area').innerHTML =
        S.taskView === 'board' ? renderKanban(tasks, isProjectAdmin()) : renderTaskList(tasks, isProjectAdmin());
    } catch (err) { toast(err.message, 'error'); }
  };
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task? This cannot be undone.')) return;
  try {
    await api('DELETE', `/projects/${S.projectId}/tasks/${taskId}`);
    window._currentTasks = window._currentTasks.filter(t => t.id !== taskId);
    toast('Task deleted');
    const tasks = applyFilters(window._currentTasks);
    document.getElementById('tasks-view-area').innerHTML =
      S.taskView === 'board' ? renderKanban(tasks, isProjectAdmin()) : renderTaskList(tasks, isProjectAdmin());
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Project Modals ───────────────────────────────────────────────────────────
function openCreateProjectModal() {
  openModal('New Project', `
    <form id="proj-form">
      <div class="form-group">
        <label class="form-label">Project Name *</label>
        <input class="form-input" id="p-name" placeholder="My Awesome Project" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="p-desc" placeholder="What is this project about?"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> Create Project</button>
      </div>
    </form>
  `);
  document.getElementById('proj-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const project = await api('POST', '/projects/', {
        name: document.getElementById('p-name').value,
        description: document.getElementById('p-desc').value || null,
      });
      closeModal();
      toast('Project created!');
      navigate('project', { projectId: project.id, projectTab: 'tasks' });
    } catch (err) { toast(err.message, 'error'); }
  };
}

function openEditProjectModal(project) {
  openModal('Edit Project', `
    <form id="edit-proj-form">
      <div class="form-group">
        <label class="form-label">Project Name *</label>
        <input class="form-input" id="ep-name" value="${esc(project.name)}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="ep-desc">${esc(project.description || '')}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save</button>
      </div>
    </form>
  `);
  document.getElementById('edit-proj-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('PUT', `/projects/${project.id}`, {
        name: document.getElementById('ep-name').value,
        description: document.getElementById('ep-desc').value || null,
      });
      closeModal();
      toast('Project updated!');
      navigate('project', { projectId: project.id, projectTab: S.projectTab });
    } catch (err) { toast(err.message, 'error'); }
  };
}

async function deleteProject(projectId) {
  if (!confirm('Delete this entire project and all its tasks? This cannot be undone.')) return;
  try {
    await api('DELETE', `/projects/${projectId}`);
    toast('Project deleted');
    navigate('projects');
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Member Modals ────────────────────────────────────────────────────────────
function openAddMemberModal() {
  window._selectedUserId = null;
  openModal('Add Team Member', `
    <div class="form-group">
      <label class="form-label">Search User</label>
      <input class="form-input" id="member-search" placeholder="Type username or email…" oninput="searchUsers(this.value)" autofocus>
    </div>
    <div id="user-results" style="margin-bottom:16px;min-height:40px"></div>
    <div class="form-group">
      <label class="form-label">Role</label>
      <select class="form-select" id="member-role">
        <option value="member">Member — can create & edit own tasks</option>
        <option value="admin">Admin — full project control</option>
      </select>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="addMember()" id="add-member-btn" disabled>
        <i class="fas fa-user-plus"></i> Add Member
      </button>
    </div>
  `);
}

async function searchUsers(query) {
  if (!query || query.length < 2) { document.getElementById('user-results').innerHTML = ''; return; }
  try {
    const users = await api('GET', `/users/?search=${encodeURIComponent(query)}`);
    const existingIds = (window._currentMembers || []).map(m => m.user_id);
    const filtered = users.filter(u => !existingIds.includes(u.id));
    document.getElementById('user-results').innerHTML = filtered.length ? `
      <div style="border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden">
        ${filtered.map(u => `
          <div onclick="selectUser(${u.id},'${esc(u.username)}')" id="user-opt-${u.id}"
            style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background .1s"
            onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
            <div class="avatar avatar-sm">${u.username[0].toUpperCase()}</div>
            <div>
              <div style="font-weight:600;font-size:14px">${esc(u.username)}</div>
              <div style="font-size:12px;color:#94a3b8">${esc(u.email)}</div>
            </div>
          </div>`).join('')}
      </div>` : `<p style="color:#94a3b8;font-size:13px;text-align:center">No users found</p>`;
  } catch { /* silent */ }
}

function selectUser(id, username) {
  window._selectedUserId = id;
  document.querySelectorAll('[id^="user-opt-"]').forEach(el => el.style.background = '#fff');
  const opt = document.getElementById(`user-opt-${id}`);
  if (opt) { opt.style.background = '#eff6ff'; opt.style.outline = '2px solid #3b82f6'; opt.style.outlineOffset = '-2px'; }
  document.getElementById('add-member-btn').disabled = false;
  document.getElementById('member-search').value = username;
}

async function addMember() {
  if (!window._selectedUserId) return;
  try {
    await api('POST', `/projects/${S.projectId}/members`, {
      user_id: window._selectedUserId,
      role: document.getElementById('member-role').value,
    });
    closeModal();
    toast('Member added!');
    navigate('project', { projectId: S.projectId, projectTab: 'members' });
  } catch (err) { toast(err.message, 'error'); }
}

async function toggleMemberRole(userId, currentRole) {
  const newRole = String(currentRole).includes('admin') ? 'member' : 'admin';
  try {
    await api('PUT', `/projects/${S.projectId}/members/${userId}`, { role: newRole });
    toast(`Role changed to ${newRole}`);
    navigate('project', { projectId: S.projectId, projectTab: 'members' });
  } catch (err) { toast(err.message, 'error'); }
}

async function removeMember(userId, username) {
  if (!confirm(`Remove ${username} from this project?`)) return;
  try {
    await api('DELETE', `/projects/${S.projectId}/members/${userId}`);
    toast('Member removed');
    navigate('project', { projectId: S.projectId, projectTab: 'members' });
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(title, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ─── Auth Forms ───────────────────────────────────────────────────────────────
function renderAuthForms(mode) {
  const isLogin = mode === 'login';
  document.getElementById('auth-card').innerHTML = `
    <div style="text-align:center;margin-bottom:28px">
      <div style="width:60px;height:60px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);
        border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;
        box-shadow:0 8px 24px rgba(59,130,246,.4)">
        <i class="fas fa-check-square" style="color:#fff;font-size:26px"></i>
      </div>
      <h1 style="font-size:26px;font-weight:800;margin:0 0 4px;color:#0f172a">Team Task Manager</h1>
      <p style="color:#64748b;margin:0;font-size:14px">Organize. Assign. Deliver.</p>
    </div>

    <div style="display:flex;background:#f1f5f9;border-radius:10px;padding:4px;margin-bottom:24px">
      <button onclick="renderAuthForms('login')"
        style="flex:1;padding:9px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
          transition:all .15s;background:${isLogin?'#fff':'transparent'};
          color:${isLogin?'#0f172a':'#64748b'};
          box-shadow:${isLogin?'0 1px 6px rgba(0,0,0,.12)':'none'}">
        Sign In
      </button>
      <button onclick="renderAuthForms('register')"
        style="flex:1;padding:9px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
          transition:all .15s;background:${!isLogin?'#fff':'transparent'};
          color:${!isLogin?'#0f172a':'#64748b'};
          box-shadow:${!isLogin?'0 1px 6px rgba(0,0,0,.12)':'none'}">
        Register
      </button>
    </div>

    ${isLogin ? `
      <form onsubmit="doLogin(event)">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="login-email" type="email" placeholder="you@example.com" required autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" id="login-password" type="password" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:15px">
          <i class="fas fa-sign-in-alt"></i> Sign In
        </button>
      </form>
    ` : `
      <form onsubmit="doRegister(event)">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input class="form-input" id="reg-username" placeholder="johndoe" required minlength="3">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="reg-email" type="email" placeholder="you@example.com" required>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" id="reg-password" type="password" placeholder="Min 6 characters" required minlength="6">
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:15px">
          <i class="fas fa-user-plus"></i> Create Account
        </button>
      </form>
    `}
  `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const user  = localStorage.getItem('user');
  if (token && user) {
    S.token = token;
    S.user = JSON.parse(user);
    api('GET', '/auth/me')
      .then(me => { S.user = me; localStorage.setItem('user', JSON.stringify(me)); showAppPage(); })
      .catch(() => { localStorage.clear(); showAuthPage(); });
  } else {
    showAuthPage();
  }
});
