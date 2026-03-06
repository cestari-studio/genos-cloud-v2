/**
 * genOS Audit System — Chart Components (Canvas API)
 * Zero dependencies — works fully offline
 */

const COLORS = {
  blue: '#0f62fe', cyan: '#33b1ff', green: '#42be65', red: '#fa4d56',
  yellow: '#f1c21b', purple: '#a56eff', orange: '#ff832b', teal: '#08bdba',
  magenta: '#ee5396', gray: '#6f6f6f'
};

const PALETTE = [COLORS.blue, COLORS.cyan, COLORS.green, COLORS.purple, COLORS.teal, COLORS.orange, COLORS.magenta, COLORS.red, COLORS.yellow, COLORS.gray];

/**
 * Horizontal Bar Chart
 */
export function barChart(container, { data, title = '', height = 'auto', showValues = true }) {
  // data: [{ label, value, maxValue?, color? }]
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  const maxVal = Math.max(...data.map(d => d.maxValue || d.value), 1);

  let html = title ? `<div class="chart-title">${title}</div>` : '';
  html += '<div class="bar-chart">';

  data.forEach((d, i) => {
    const pct = Math.round((d.value / maxVal) * 100);
    const color = d.color || PALETTE[i % PALETTE.length];
    html += `<div class="bar-row">
      <span class="bar-label">${d.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      ${showValues ? `<span class="bar-value">${d.value}${d.maxValue ? '/' + d.maxValue : ''}</span>` : ''}
    </div>`;
  });

  html += '</div>';
  el.innerHTML = html;
}

/**
 * Donut Chart (Canvas)
 */
export function donutChart(container, { data, title = '', size = 180, centerLabel = '' }) {
  // data: [{ label, value, color? }]
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  const total = data.reduce((s, d) => s + d.value, 0);

  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;
  canvas.style.cssText = `width:${size}px;height:${size}px;`;

  const ctx = canvas.getContext('2d');
  const cx = size, cy = size, r = size * 0.75, lineW = size * 0.35;

  let startAngle = -Math.PI / 2;
  data.forEach((d, i) => {
    const sliceAngle = (d.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = d.color || PALETTE[i % PALETTE.length];
    ctx.stroke();
    startAngle += sliceAngle;
  });

  // Center text
  if (centerLabel) {
    ctx.fillStyle = '#f4f4f4';
    ctx.font = `600 ${size * 0.35}px IBM Plex Sans, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(centerLabel, cx, cy);
  }

  // Legend
  let html = title ? `<div class="chart-title">${title}</div>` : '';
  html += '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">';
  html += `<div></div>`; // canvas placeholder
  html += '<div style="display:flex;flex-direction:column;gap:4px;">';
  data.forEach((d, i) => {
    const color = d.color || PALETTE[i % PALETTE.length];
    const pct = total > 0 ? Math.round(d.value / total * 100) : 0;
    html += `<div style="display:flex;align-items:center;gap:6px;font-size:12px;">
      <span style="width:10px;height:10px;background:${color};flex-shrink:0;border-radius:2px;"></span>
      <span style="color:#c6c6c6">${d.label}</span>
      <span style="color:#8d8d8d;margin-left:auto">${d.value} (${pct}%)</span>
    </div>`;
  });
  html += '</div></div>';

  el.innerHTML = html;
  el.querySelector('div > div:first-child').appendChild(canvas);
}

/**
 * Sparkline (inline mini chart)
 */
export function sparkline(container, { data, color = COLORS.blue, width = 120, height = 32 }) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.cssText = `width:${width}px;height:${height}px;`;

  const ctx = canvas.getContext('2d');
  const max = Math.max(...data, 1);
  const step = (width * 2) / (data.length - 1);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  data.forEach((v, i) => {
    const x = i * step;
    const y = height * 2 - (v / max) * (height * 2 - 4);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  el.innerHTML = '';
  el.appendChild(canvas);
}

/**
 * Score gauge (simple arc)
 */
export function scoreGauge(container, { score, maxScore = 100, label = '', color }) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  const pct = Math.min(score / maxScore, 1);

  if (!color) {
    if (pct >= 0.8) color = COLORS.green;
    else if (pct >= 0.6) color = COLORS.yellow;
    else color = COLORS.red;
  }

  const size = 80;
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;
  canvas.style.cssText = `width:${size}px;height:${size}px;`;

  const ctx = canvas.getContext('2d');
  const cx = size, cy = size, r = size * 0.8;

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = '#393939';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Value arc
  const endAngle = Math.PI * 0.75 + pct * Math.PI * 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, endAngle);
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Text
  ctx.fillStyle = '#f4f4f4';
  ctx.font = `600 ${size * 0.45}px IBM Plex Sans, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(pct * 100), cx, cy - 4);

  el.innerHTML = `<div style="text-align:center"><div></div><div style="font-size:11px;color:#8d8d8d;margin-top:4px">${label}</div></div>`;
  el.querySelector('div > div:first-child').appendChild(canvas);
}

export { COLORS, PALETTE };
