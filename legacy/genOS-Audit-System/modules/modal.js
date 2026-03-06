/**
 * genOS Audit System — Modal Component
 */

let overlay = null;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box">
    <div class="modal-header"><h3 class="modal-title"></h3><button class="modal-close">×</button></div>
    <div class="modal-body"></div>
    <div class="modal-footer"></div>
  </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  return overlay;
}

export function openModal({ title = '', content = '', footer = '', width = '720px' }) {
  const ov = ensureOverlay();
  ov.querySelector('.modal-title').textContent = title;
  ov.querySelector('.modal-body').innerHTML = content;
  ov.querySelector('.modal-footer').innerHTML = footer;
  ov.querySelector('.modal-box').style.maxWidth = width;
  requestAnimationFrame(() => ov.classList.add('active'));
}

export function closeModal() {
  if (overlay) overlay.classList.remove('active');
}

export function getModalBody() {
  return overlay?.querySelector('.modal-body');
}
