/**
 * genOS Audit System — SPA Router
 * Hash-based routing with page caching and fetch-based loading
 */

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

  // Check cache
  if (pageCache.has(pageName)) {
    main.innerHTML = pageCache.get(pageName);
    currentPage = pageName;
    initPageModules(main);
    return;
  }

  // Show loading
  main.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;">
    <div class="skeleton" style="width:200px;height:20px;"></div>
  </div>`;

  try {
    const resp = await fetch(`pages/${pageName}.html`);
    if (!resp.ok) throw new Error(`Page not found: ${pageName}`);
    const html = await resp.text();
    pageCache.set(pageName, html);
    main.innerHTML = html;
    currentPage = pageName;
    initPageModules(main);
  } catch (err) {
    main.innerHTML = `
      <div class="notification notification-error">
        <div>
          <div class="notif-title">Página não encontrada</div>
          <div class="notif-body">${pageName}.html — ${err.message}</div>
        </div>
      </div>`;
  }
}

function initPageModules(container) {
  // Initialize tabs
  import('./tabs.js').then(m => m.initTabs(container));
  // Initialize copy buttons
  import('./copy-button.js').then(m => m.initCopyButtons(container));
  // Initialize accordions
  initAccordions(container);
  // Initialize data tables if the page defines them
  if (window.__initPageTables) {
    window.__initPageTables(container);
    window.__initPageTables = null;
  }
  // Dispatch custom event for page-specific init
  container.dispatchEvent(new CustomEvent('page-loaded', { detail: { page: currentPage } }));
}

function initAccordions(container) {
  container.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      item.classList.toggle('open');
    });
  });
}

export function initRouter() {
  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#/', '') || 'dashboard';
    loadPage(page);
  });

  // Handle nav clicks
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) {
        window.location.hash = `#/${page}`;
      }
    });
  });

  // Handle sidebar section collapse
  document.querySelectorAll('.sidebar .nav-section').forEach(section => {
    section.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      const group = section.nextElementSibling;
      if (group && group.classList.contains('nav-group')) {
        group.classList.toggle('collapsed');
      }
    });
  });

  // Load initial page
  const initial = window.location.hash.replace('#/', '') || 'dashboard';
  loadPage(initial);
}

export function getCurrentPage() { return currentPage; }
export function clearCache() { pageCache.clear(); }
