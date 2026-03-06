/**
 * genOS Audit System — DataTable Component
 * Searchable, sortable, filterable data table with pagination
 */

export class AuditDataTable {
  constructor(container, config) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.config = {
      columns: [],        // [{ key, label, sortable, filterable, filterOptions, render, width }]
      data: [],
      title: '',
      searchable: true,
      pageSize: 15,
      onRowClick: null,
      emptyMessage: 'Nenhum item encontrado',
      ...config
    };

    this.filteredData = [...this.config.data];
    this.sortKey = null;
    this.sortDir = 'asc';
    this.searchTerm = '';
    this.filters = {};
    this.currentPage = 0;

    this.render();
  }

  render() {
    const { columns, title, searchable } = this.config;
    const wrap = document.createElement('div');
    wrap.className = 'audit-table-wrap';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'audit-table-toolbar';

    if (title) {
      const t = document.createElement('span');
      t.className = 'table-title';
      t.textContent = title;
      toolbar.appendChild(t);
    }

    // Filter dropdowns
    columns.forEach(col => {
      if (col.filterable && col.filterOptions) {
        const sel = document.createElement('select');
        sel.innerHTML = `<option value="">Todos: ${col.label}</option>` +
          col.filterOptions.map(o => `<option value="${o}">${o}</option>`).join('');
        sel.addEventListener('change', () => {
          if (sel.value) this.filters[col.key] = sel.value;
          else delete this.filters[col.key];
          this.applyFilters();
        });
        toolbar.appendChild(sel);
      }
    });

    // Search
    if (searchable) {
      const searchWrap = document.createElement('div');
      searchWrap.style.cssText = 'position:relative;margin-left:auto;';
      searchWrap.innerHTML = `<svg style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:16px;height:16px;fill:var(--cds-text-helper)" viewBox="0 0 32 32"><path d="M29 27.586l-7.552-7.552a11.018 11.018 0 10-1.414 1.414L27.586 29zM4 13a9 9 0 119 9 9.01 9.01 0 01-9-9z"/></svg>`;
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = 'Buscar...';
      input.addEventListener('input', () => {
        this.searchTerm = input.value.toLowerCase();
        this.applyFilters();
      });
      searchWrap.appendChild(input);
      toolbar.appendChild(searchWrap);
    }

    wrap.appendChild(toolbar);

    // Table
    const table = document.createElement('table');
    table.className = 'audit-table';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      if (col.width) th.style.width = col.width;
      if (col.sortable !== false) {
        th.innerHTML += ' <span class="sort-icon">↑</span>';
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => this.sort(col.key, th));
      }
      th.dataset.key = col.key;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    this.tbody = document.createElement('tbody');
    table.appendChild(this.tbody);
    wrap.appendChild(table);

    // Pagination
    this.paginationEl = document.createElement('div');
    this.paginationEl.className = 'audit-table-pagination';
    wrap.appendChild(this.paginationEl);

    this.container.innerHTML = '';
    this.container.appendChild(wrap);
    this.tableEl = table;

    this.renderRows();
  }

  renderRows() {
    const { columns, pageSize, onRowClick, emptyMessage } = this.config;
    const start = this.currentPage * pageSize;
    const pageData = this.filteredData.slice(start, start + pageSize);

    this.tbody.innerHTML = '';

    if (pageData.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="${columns.length}" style="text-align:center;color:var(--cds-text-helper);padding:24px;">${emptyMessage}</td>`;
      this.tbody.appendChild(tr);
    } else {
      pageData.forEach(row => {
        const tr = document.createElement('tr');
        if (onRowClick) tr.classList.add('clickable');
        columns.forEach(col => {
          const td = document.createElement('td');
          if (col.render) {
            td.innerHTML = col.render(row[col.key], row);
          } else {
            td.textContent = row[col.key] ?? '';
          }
          tr.appendChild(td);
        });
        if (onRowClick) tr.addEventListener('click', () => onRowClick(row));
        this.tbody.appendChild(tr);
      });
    }

    this.renderPagination();
  }

  renderPagination() {
    const { pageSize } = this.config;
    const total = this.filteredData.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = this.currentPage * pageSize + 1;
    const end = Math.min(start + pageSize - 1, total);

    this.paginationEl.innerHTML = `
      <span>${total > 0 ? `${start}–${end} de ${total} itens` : '0 itens'}</span>
      <div class="page-btns">
        <button ${this.currentPage === 0 ? 'disabled' : ''} data-action="prev">‹</button>
        ${Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = totalPages <= 7 ? i : (this.currentPage <= 3 ? i : (this.currentPage >= totalPages - 4 ? totalPages - 7 + i : this.currentPage - 3 + i));
          return `<button class="${p === this.currentPage ? 'active' : ''}" data-page="${p}">${p + 1}</button>`;
        }).join('')}
        <button ${this.currentPage >= totalPages - 1 ? 'disabled' : ''} data-action="next">›</button>
      </div>
    `;

    this.paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => { this.currentPage = +btn.dataset.page; this.renderRows(); });
    });
    this.paginationEl.querySelector('[data-action="prev"]')?.addEventListener('click', () => { if (this.currentPage > 0) { this.currentPage--; this.renderRows(); } });
    this.paginationEl.querySelector('[data-action="next"]')?.addEventListener('click', () => { if (this.currentPage < totalPages - 1) { this.currentPage++; this.renderRows(); } });
  }

  sort(key, thEl) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }

    // Update header UI
    this.tableEl.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
    thEl.classList.add(this.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');

    this.filteredData.sort((a, b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return this.sortDir === 'asc' ? cmp : -cmp;
    });

    this.currentPage = 0;
    this.renderRows();
  }

  applyFilters() {
    const { data, columns } = this.config;

    this.filteredData = data.filter(row => {
      // Search
      if (this.searchTerm) {
        const match = columns.some(col => {
          const val = String(row[col.key] ?? '').toLowerCase();
          return val.includes(this.searchTerm);
        });
        if (!match) return false;
      }
      // Filters
      for (const [key, val] of Object.entries(this.filters)) {
        if (String(row[key]) !== val) return false;
      }
      return true;
    });

    // Re-sort
    if (this.sortKey) {
      this.filteredData.sort((a, b) => {
        const va = a[this.sortKey] ?? '';
        const vb = b[this.sortKey] ?? '';
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return this.sortDir === 'asc' ? cmp : -cmp;
      });
    }

    this.currentPage = 0;
    this.renderRows();
  }

  updateData(newData) {
    this.config.data = newData;
    this.applyFilters();
  }

  getFilteredData() { return [...this.filteredData]; }
}
