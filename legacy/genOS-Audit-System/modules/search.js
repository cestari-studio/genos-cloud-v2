/**
 * genOS Audit System — Global Search
 * Indexes all JSON data files for full-text search across pages
 */

let searchIndex = [];
let initialized = false;

const DATA_FILES = [
  { file: 'tables.json',         page: 'database',       type: 'Tabela' },
  { file: 'edge-functions.json', page: 'edge-functions',  type: 'Edge Function' },
  { file: 'components.json',     page: 'components',      type: 'Componente' },
  { file: 'bugs.json',           page: 'bugs',            type: 'Bug' },
  { file: 'prompts.json',        page: 'prompts',         type: 'Prompt' },
  { file: 'roadmap.json',        page: 'roadmap',         type: 'Roadmap' },
  { file: 'audit-scores.json',   page: 'dashboard',       type: 'Audit' },
];

export async function initSearch() {
  if (initialized) return;

  for (const { file, page, type } of DATA_FILES) {
    try {
      const resp = await fetch(`data/${file}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      items.forEach(item => {
        const text = Object.values(item).filter(v => typeof v === 'string').join(' ').toLowerCase();
        searchIndex.push({
          text,
          title: item.name || item.title || item.id || item.slug || 'Item',
          page,
          type,
          item
        });
      });
    } catch { /* skip unavailable */ }
  }

  initialized = true;
}

export function search(query) {
  if (!query || query.length < 2) return [];
  const terms = query.toLowerCase().split(/\s+/);
  return searchIndex
    .filter(entry => terms.every(t => entry.text.includes(t)))
    .slice(0, 20)
    .map(entry => ({
      title: entry.title,
      page: entry.page,
      type: entry.type,
      item: entry.item
    }));
}

export function getIndexSize() { return searchIndex.length; }
