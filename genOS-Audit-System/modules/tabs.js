/**
 * genOS Audit System — Tab Component
 */

export function initTabs(container) {
  const tabGroups = container.querySelectorAll('.tabs');
  tabGroups.forEach(tabs => {
    const buttons = tabs.querySelectorAll('.tab-btn');
    const panelContainer = tabs.parentElement;

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        // Deactivate all
        buttons.forEach(b => b.classList.remove('active'));
        panelContainer.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        // Activate target
        btn.classList.add('active');
        const panel = panelContainer.querySelector(`#${target}`);
        if (panel) panel.classList.add('active');
      });
    });
  });
}
