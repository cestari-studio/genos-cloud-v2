/**
 * genOS Audit System — Copy to Clipboard
 */

export function initCopyButtons(container) {
  container.querySelectorAll('.copy-btn').forEach(btn => {
    if (btn.dataset.initialized) return;
    btn.dataset.initialized = 'true';

    btn.addEventListener('click', () => {
      // Support data-copy attribute OR find pre inside .code-wrap
      const directText = btn.dataset.copy;
      const wrap = btn.closest('.code-wrap');
      const pre = wrap?.querySelector('pre');
      const textToCopy = directText || pre?.textContent;
      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ Copiado!';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
      }).catch(() => {
        // Fallback for file:// protocol
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        ta.style.cssText = 'position:fixed;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ Copiado!';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
      });
    });
  });
}
