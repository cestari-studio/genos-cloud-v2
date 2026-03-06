/**
 * genOS Audit System — Tab Component
 * Handles all tab class-name variants used across pages:
 *   Container: .tabs | .tab-bar | .tabs-container | .tabs-nav | .tabs-header | .prompts-tabs
 *   Buttons:   .tab-btn | .tab-button
 *   Panels:    .tab-panel | .tab-content
 */

export function initTabs(container = document) {
  // Find all tab button groups — try every variant
  const selectors = [
    '.tab-bar',
    '.tabs-nav',
    '.tabs-header',
    '.tabs',
    '.prompts-tabs',
    '.tabs-container',
  ];

  // Collect all tab buttons in container
  const buttons = container.querySelectorAll('.tab-btn, .tab-button');
  if (buttons.length === 0) return;

  buttons.forEach(btn => {
    // Skip if already has listener
    if (btn.dataset.tabInit) return;
    btn.dataset.tabInit = 'true';

    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      if (!target) return;

      // Find sibling buttons (same parent or same level)
      const parent = btn.parentElement;
      const siblingBtns = parent.querySelectorAll('.tab-btn, .tab-button');

      // Deactivate all sibling buttons
      siblingBtns.forEach(b => b.classList.remove('active'));

      // Activate clicked button
      btn.classList.add('active');

      // Find the scope to search for panels
      // Go up to the nearest tabs-container or the page itself
      const scope = btn.closest('.tabs-container, .prompts-tabs, .audit-page, section')
        || parent.parentElement
        || container;

      // Find all panels in scope
      const panels = scope.querySelectorAll('.tab-panel, .tab-content');
      panels.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });

      // Activate target panel — try both id match and data-tab match
      let panel = scope.querySelector(`#${target}`)
        || scope.querySelector(`#tab-${target}`)
        || scope.querySelector(`[data-tab="${target}"].tab-content`)
        || scope.querySelector(`[data-tab="${target}"].tab-panel`);

      if (panel) {
        panel.classList.add('active');
        panel.style.display = '';
      }
    });
  });

  // Ensure the first active panel is visible and others are hidden
  const tabGroups = new Set();
  buttons.forEach(btn => tabGroups.add(btn.parentElement));

  tabGroups.forEach(group => {
    const scope = group.closest('.tabs-container, .prompts-tabs, .audit-page, section')
      || group.parentElement
      || container;

    const panels = scope.querySelectorAll('.tab-panel, .tab-content');
    let hasActive = false;

    panels.forEach(p => {
      if (p.classList.contains('active')) {
        p.style.display = '';
        hasActive = true;
      } else {
        p.style.display = 'none';
      }
    });

    // If no panel is active, activate the first one
    if (!hasActive && panels.length > 0) {
      panels[0].classList.add('active');
      panels[0].style.display = '';
      const btns = group.querySelectorAll('.tab-btn, .tab-button');
      if (btns.length > 0 && !group.querySelector('.tab-btn.active, .tab-button.active')) {
        btns[0].classList.add('active');
      }
    }
  });
}
