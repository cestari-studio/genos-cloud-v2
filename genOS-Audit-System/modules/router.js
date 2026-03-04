/**
 * genOS Audit System — SPA Router v3
 * Hash-based routing. Pages are pure HTML (no inline scripts).
 * The router handles ALL initialization: tabs, charts, DataTables, copy buttons.
 */

import { initTabs } from './tabs.js';
import { initCopyButtons } from './copy-button.js';
import { openModal } from './modal.js';
import { AuditDataTable } from './data-table.js';
import { barChart, donutChart, scoreGauge, sparkline, COLORS } from './charts.js';

const pageCache = new Map();
let currentPage = null;

const mainEl = () => document.getElementById('main-content');

export async function loadPage(pageName) {
  if (currentPage === pageName) return;
  const main = mainEl();
  if (!main) return;

  // Update nav
  document.querySelectorAll('.sidebar .nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`[data-page="${pageName}"]`);
  if (navItem) navItem.classList.add('active');

  // Show loading
  main.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;">
    <div class="skeleton" style="width:200px;height:20px;"></div>
  </div>`;

  try {
    let html;
    if (pageCache.has(pageName)) {
      html = pageCache.get(pageName);
    } else {
      const resp = await fetch(`pages/${pageName}.html`);
      if (!resp.ok) throw new Error(`Page not found: ${pageName}`);
      html = await resp.text();
      // Strip any <script> tags from cached HTML (we don't need them)
      html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
      pageCache.set(pageName, html);
    }

    main.innerHTML = html;
    currentPage = pageName;

    // Initialize everything
    initTabs(main);
    initCopyButtons(main);
    initAccordions(main);
    initModalTriggers(main);

    // Page-specific initialization
    await initPageData(pageName, main);

  } catch (err) {
    console.error('Router error:', err);
    main.innerHTML = `
      <div style="margin:32px;padding:16px;background:#393939;border-left:3px solid #fa4d56;color:#f4f4f4;">
        <strong>Página não encontrada</strong><br>
        <span style="color:#8d8d8d;">${pageName}.html — ${err.message}</span>
      </div>`;
  }
}

/**
 * Page-specific data loading & chart/table rendering
 */
async function initPageData(pageName, container) {
  try {
    switch (pageName) {
      case 'dashboard': await initDashboard(container); break;
      case 'database': await initDatabase(container); break;
      case 'edge-functions': await initEdgeFunctions(container); break;
      case 'bugs': await initBugs(container); break;
      case 'prompts': await initPrompts(container); break;
      case 'components': await initComponents(container); break;
      case 'roadmap': await initRoadmap(container); break;
      case 'realignment': await initRealignment(container); break;
    }
  } catch (e) {
    console.warn(`Page data init error (${pageName}):`, e);
  }
}

/* ── Dashboard ── */
async function initDashboard(c) {
  const resp = await fetch('data/audit-scores.json');
  const scores = await resp.json();

  // Render score gauges
  scores.forEach(s => {
    const el = c.querySelector(`#gauge-${s.id}`);
    if (el) scoreGauge(el, { score: s.score, maxScore: 100, label: s.area, color: s.status === 'ok' ? COLORS.green : s.status === 'warn' ? COLORS.yellow : COLORS.red });
  });

  // Render bar chart
  const barEl = c.querySelector('#scores-bar-chart');
  if (barEl) {
    barChart(barEl, {
      data: scores.map(s => ({ label: s.area, value: s.score, color: s.status === 'ok' ? COLORS.green : s.status === 'warn' ? COLORS.yellow : COLORS.red })),
      title: 'Scores por Área',
      height: 300,
      showValues: true
    });
  }
}

/* ── Database ── */
async function initDatabase(c) {
  const resp = await fetch('data/tables.json');
  const tables = await resp.json();

  const target = c.querySelector('#tables-datatable');
  if (target) {
    new AuditDataTable(target, {
      title: 'Schema de Tabelas',
      data: tables,
      pageSize: 15,
      columns: [
        { key: 'name', label: 'Nome', sortable: true },
        { key: 'schema', label: 'Schema', sortable: true },
        { key: 'columns', label: 'Colunas', sortable: true },
        { key: 'category', label: 'Categoria', sortable: true, filterable: true, filterOptions: [...new Set(tables.map(t => t.category))] },
        { key: 'hasRLS', label: 'RLS', sortable: true, filterable: true, filterOptions: ['true', 'false'],
          render: v => `<span class="tag ${v ? 'tag-green' : 'tag-red'}">${v ? 'Sim' : 'Não'}</span>` },
        { key: 'description', label: 'Descrição' }
      ],
      onRowClick: (row) => {
        openModal({
          title: row.name,
          content: `<div style="display:grid;gap:12px;">
            <div><strong>Schema:</strong> ${row.schema}</div>
            <div><strong>Categoria:</strong> ${row.category}</div>
            <div><strong>Colunas:</strong> ${row.columns}</div>
            <div><strong>RLS:</strong> ${row.hasRLS ? 'Ativo' : 'Inativo'}</div>
            <div><strong>Descrição:</strong> ${row.description}</div>
          </div>`
        });
      }
    });
  }
}

/* ── Edge Functions ── */
async function initEdgeFunctions(c) {
  const resp = await fetch('data/edge-functions.json');
  const fns = await resp.json();

  const target = c.querySelector('#ef-datatable');
  if (target) {
    new AuditDataTable(target, {
      title: 'Edge Functions',
      data: fns,
      pageSize: 15,
      columns: [
        { key: 'name', label: 'Nome', sortable: true },
        { key: 'category', label: 'Categoria', sortable: true, filterable: true, filterOptions: [...new Set(fns.map(f => f.category))] },
        { key: 'lines', label: 'Linhas', sortable: true },
        { key: 'status', label: 'Status', sortable: true, filterable: true, filterOptions: [...new Set(fns.map(f => f.status))],
          render: v => `<span class="tag ${v === 'active' ? 'tag-green' : v === 'development' ? 'tag-yellow' : 'tag-gray'}">${v}</span>` },
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'lastUpdate', label: 'Atualização', sortable: true }
      ],
      onRowClick: (row) => {
        openModal({
          title: row.name,
          content: `<div style="display:grid;gap:12px;">
            <div><strong>Categoria:</strong> ${row.category}</div>
            <div><strong>Endpoint:</strong> <code>${row.endpoint}</code></div>
            <div><strong>Linhas:</strong> ${row.lines}</div>
            <div><strong>Status:</strong> ${row.status}</div>
            <div><strong>Última Atualização:</strong> ${row.lastUpdate}</div>
          </div>`
        });
      }
    });
  }
}

/* ── Bugs ── */
async function initBugs(c) {
  const resp = await fetch('data/bugs.json');
  const bugs = await resp.json();

  // Update stats
  const statsEls = c.querySelectorAll('[data-stat]');
  statsEls.forEach(el => {
    const stat = el.dataset.stat;
    if (stat === 'total') el.textContent = bugs.length;
    if (stat === 'critical') el.textContent = bugs.filter(b => b.severity === 'critical' || b.severity === 'high').length;
    if (stat === 'fixed') el.textContent = bugs.filter(b => b.status === 'fixed' || b.status === 'verified').length;
    if (stat === 'open') el.textContent = bugs.filter(b => b.status === 'open' || b.status === 'in-progress').length;
  });

  const target = c.querySelector('#bugs-datatable');
  if (target) {
    const sevColors = { critical: 'tag-red', high: 'tag-yellow', medium: 'tag-cyan', low: 'tag-gray' };
    const statusColors = { open: 'tag-red', 'in-progress': 'tag-yellow', fixed: 'tag-green', verified: 'tag-blue' };

    new AuditDataTable(target, {
      title: 'Bug Tracker',
      data: bugs,
      columns: [
        { key: 'id', label: 'ID', sortable: true },
        { key: 'title', label: 'Título', sortable: true },
        { key: 'severity', label: 'Severidade', sortable: true, filterable: true, filterOptions: ['critical', 'high', 'medium', 'low'],
          render: v => `<span class="tag ${sevColors[v] || 'tag-gray'}">${v}</span>` },
        { key: 'status', label: 'Status', sortable: true, filterable: true, filterOptions: ['open', 'in-progress', 'fixed', 'verified'],
          render: v => `<span class="tag ${statusColors[v] || 'tag-gray'}">${v}</span>` },
        { key: 'file', label: 'Arquivo' }
      ],
      onRowClick: (row) => {
        openModal({
          title: `${row.id} — ${row.title}`,
          content: `<div style="display:grid;gap:12px;">
            <div><span class="tag ${sevColors[row.severity]}">${row.severity}</span> <span class="tag ${statusColors[row.status]}">${row.status}</span></div>
            <div><strong>Arquivo:</strong> <code>${row.file}</code></div>
            <div><strong>Correção:</strong> ${row.fix}</div>
            <div><strong>Fonte:</strong> ${row.source}</div>
            <div class="code-wrap"><pre>${row.fix}</pre><button class="copy-btn" data-copy="${row.fix.replace(/"/g, '&quot;')}">Copiar Fix</button></div>
          </div>`
        });
        // Init copy buttons inside the new modal
        const modal = document.querySelector('.modal-overlay');
        if (modal) initCopyButtons(modal);
      }
    });
  }

  // Copy all open bugs button
  const copyAllBtn = c.querySelector('#copy-all-bugs');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => {
      const openBugs = bugs.filter(b => b.status === 'open' || b.status === 'in-progress');
      const text = openBugs.map(b => `## ${b.id}: ${b.title}\nArquivo: ${b.file}\nFix: ${b.fix}\n`).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        copyAllBtn.textContent = 'Copiado!';
        setTimeout(() => copyAllBtn.textContent = 'Copiar Todos os Fix Prompts', 2000);
      });
    });
  }
}

/* ── Prompts ── */
async function initPrompts(c) {
  const resp = await fetch('data/prompts.json');
  const prompts = await resp.json();

  // Update stats
  const statsEls = c.querySelectorAll('[data-stat]');
  statsEls.forEach(el => {
    const stat = el.dataset.stat;
    if (stat === 'total') el.textContent = prompts.length;
    if (stat === 'super') el.textContent = prompts.filter(p => p.type === 'SuperPrompt').length;
    if (stat === 'mega') el.textContent = prompts.filter(p => p.type === 'MegaPrompt').length;
    if (stat === 'fix') el.textContent = prompts.filter(p => p.type === 'FixPrompt').length;
  });

  const target = c.querySelector('#prompts-datatable');
  if (target) {
    const typeColors = { SuperPrompt: 'tag-purple', MegaPrompt: 'tag-blue', FixPrompt: 'tag-red', TechDoc: 'tag-cyan' };

    new AuditDataTable(target, {
      title: 'Biblioteca de Prompts',
      data: prompts,
      columns: [
        { key: 'name', label: 'Nome', sortable: true },
        { key: 'type', label: 'Tipo', sortable: true, filterable: true, filterOptions: [...new Set(prompts.map(p => p.type))],
          render: v => `<span class="tag ${typeColors[v] || 'tag-gray'}">${v}</span>` },
        { key: 'feature', label: 'Feature', sortable: true, filterable: true, filterOptions: [...new Set(prompts.map(p => p.feature))] },
        { key: 'status', label: 'Status', sortable: true,
          render: v => `<span class="tag ${v === 'implemented' ? 'tag-green' : v === 'in-progress' ? 'tag-yellow' : 'tag-cyan'}">${v}</span>` }
      ],
      onRowClick: (row) => {
        openModal({
          title: row.name,
          content: `<div style="display:grid;gap:12px;">
            <div><span class="tag ${typeColors[row.type]}">${row.type}</span> <span class="tag">${row.feature}</span></div>
            <div><strong>Status:</strong> ${row.status}</div>
            ${row.description ? `<div>${row.description}</div>` : ''}
            ${row.source ? `<div><strong>Fonte:</strong> <a href="docs/${row.source}" target="_blank" style="color:var(--cds-link-primary)">${row.source}</a></div>` : ''}
          </div>`
        });
      }
    });
  }
}

/* ── Components ── */
async function initComponents(c) {
  const resp = await fetch('data/components.json');
  const components = await resp.json();

  const target = c.querySelector('#components-datatable');
  if (target) {
    new AuditDataTable(target, {
      title: 'Componentes React',
      data: components,
      columns: [
        { key: 'name', label: 'Nome', sortable: true },
        { key: 'file', label: 'Arquivo', sortable: true },
        { key: 'page', label: 'Página', sortable: true, filterable: true, filterOptions: [...new Set(components.map(c => c.page))] },
        { key: 'feature', label: 'Feature', sortable: true, filterable: true, filterOptions: [...new Set(components.map(c => c.feature))] },
        { key: 'carbonComponents', label: 'Carbon Components',
          render: v => Array.isArray(v) ? v.map(c => `<span class="tag tag-cyan" style="font-size:11px;margin:1px;">${c}</span>`).join(' ') : v }
      ],
      onRowClick: (row) => {
        openModal({
          title: row.name,
          content: `<div style="display:grid;gap:12px;">
            <div><strong>Arquivo:</strong> <code>${row.file}</code></div>
            <div><strong>Página:</strong> ${row.page}</div>
            <div><strong>Feature:</strong> ${row.feature}</div>
            <div><strong>Carbon Components:</strong> ${Array.isArray(row.carbonComponents) ? row.carbonComponents.join(', ') : row.carbonComponents}</div>
            <div><strong>Descrição:</strong> ${row.description}</div>
          </div>`
        });
      }
    });
  }
}

/* ── Roadmap ── */
async function initRoadmap(c) {
  const resp = await fetch('data/roadmap.json');
  const sprints = await resp.json();

  const target = c.querySelector('#roadmap-timeline');
  if (!target) return;

  const statusColors = { completed: 'tag-green', 'in-progress': 'tag-yellow', planned: 'tag-cyan' };

  target.innerHTML = sprints.map(sprint => `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;color:var(--cds-text-primary)">${sprint.name}</h3>
        <div>
          <span class="tag ${statusColors[sprint.status] || 'tag-gray'}">${sprint.status}</span>
          ${sprint.target ? `<span style="color:var(--cds-text-helper);font-size:12px;margin-left:8px;">${sprint.target}</span>` : ''}
        </div>
      </div>
      ${sprint.priority ? `<div style="margin-bottom:8px;"><strong>Prioridade:</strong> ${sprint.priority}</div>` : ''}
      <ul style="margin:0;padding-left:20px;color:var(--cds-text-secondary);">
        ${(sprint.items || []).map(item => `<li style="margin-bottom:4px;">${item}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

/* ── Realignment ── */
async function initRealignment(c) {
  const resp = await fetch('data/realignment.json');
  const data = await resp.json();

  // Update stat counters
  const niTotal = c.querySelector('#stat-ni-total');
  const niCrit = c.querySelector('#stat-ni-critical');
  if (niTotal) niTotal.textContent = data.never_implemented.length;
  if (niCrit) niCrit.textContent = data.never_implemented.filter(f => f.priority === 'critical').length;

  // DataTable
  const target = c.querySelector('#realignment-datatable');
  if (target) {
    const priColors = { critical: 'tag-red', high: 'tag-yellow', medium: 'tag-cyan', low: 'tag-gray' };
    const statusLabels = { never_built: 'Nunca construído', designed_not_built: 'Desenhado, não construído', stubs_only: 'Apenas stubs', concept_only: 'Apenas conceito' };

    new AuditDataTable(target, {
      title: 'Features Nunca Implementadas',
      data: data.never_implemented,
      pageSize: 15,
      columns: [
        { key: 'id', label: 'ID', sortable: true },
        { key: 'feature', label: 'Feature', sortable: true },
        { key: 'priority', label: 'Prioridade', sortable: true, filterable: true, filterOptions: ['critical', 'high', 'medium', 'low'],
          render: v => `<span class="tag ${priColors[v] || 'tag-gray'}">${v}</span>` },
        { key: 'category', label: 'Categoria', sortable: true, filterable: true, filterOptions: [...new Set(data.never_implemented.map(f => f.category))] },
        { key: 'status', label: 'Status',
          render: v => `<span class="tag tag-gray">${statusLabels[v] || v}</span>` }
      ],
      onRowClick: (row) => {
        openModal({
          title: `${row.id} — ${row.feature}`,
          content: `<div style="display:grid;gap:12px;">
            <div><span class="tag ${priColors[row.priority]}">${row.priority}</span> <span class="tag tag-gray">${statusLabels[row.status] || row.status}</span></div>
            <div><strong>Categoria:</strong> ${row.category}</div>
            <div><strong>Descrição:</strong> ${row.description}</div>
            <div><strong>Planejado em:</strong> ${row.planned_in}</div>
            <div><strong>Estado atual:</strong> ${row.current_state}</div>
            <div><strong>Impacto:</strong> ${row.impact}</div>
          </div>`
        });
      }
    });
  }
}

/* ── Modal triggers ── */
function initModalTriggers(container) {
  container.querySelectorAll('[data-modal]').forEach(trigger => {
    if (trigger.dataset.modalInit) return;
    trigger.dataset.modalInit = 'true';
    trigger.addEventListener('click', () => {
      const title = trigger.dataset.modalTitle || '';
      const contentEl = document.getElementById(trigger.dataset.modal);
      if (contentEl) {
        openModal({ title, content: contentEl.innerHTML });
      }
    });
  });
}

function initAccordions(container) {
  container.querySelectorAll('.accordion-header').forEach(header => {
    if (header.dataset.initDone) return;
    header.dataset.initDone = 'true';
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      item.classList.toggle('open');
    });
  });
}

export function initRouter() {
  window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#/', '') || 'dashboard';
    loadPage(page);
  });

  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const page = item.dataset.page;
      if (page) {
        e.preventDefault();
        window.location.hash = `#/${page}`;
      }
    });
  });

  document.querySelectorAll('.sidebar .nav-section').forEach(section => {
    section.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      const group = section.nextElementSibling;
      if (group && group.classList.contains('nav-group')) {
        group.classList.toggle('collapsed');
      }
    });
  });

  const initial = window.location.hash.replace('#/', '') || 'dashboard';
  loadPage(initial);
}

export function getCurrentPage() { return currentPage; }
export function clearCache() { pageCache.clear(); }
