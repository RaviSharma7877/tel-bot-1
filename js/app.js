/**
 * app.js — top-level app shell. Boots the Telegram integration layer,
 * renders the Home dashboard (tool cards grouped by category) from a single
 * metadata array, drives Home <-> Tool navigation with a back button, wires
 * the header theme toggle, and initializes all 9 tool modules against their
 * own section of the DOM. No external dependency, no build step required.
 *
 * TOOLS is the single source of truth for icon/title/description/category —
 * the home-dashboard cards are generated from it so nothing is hand-written
 * twice between the cards and the header title.
 */
(function () {
  'use strict';

  const TOOLS = [
    { id: 'otp', view: 'view-otp', icon: 'icon-otp', title: 'OTP codes', desc: 'Authenticator codes, on-device', category: 'security' },
    { id: 'password', view: 'view-password', icon: 'icon-password', title: 'Passwords', desc: 'Generate & check strength', category: 'security' },
    { id: 'converter', view: 'view-converter', icon: 'icon-converter', title: 'Converter', desc: 'Units & currency', category: 'money' },
    { id: 'splitter', view: 'view-splitter', icon: 'icon-splitter', title: 'Split expenses', desc: 'Group expense splitting', category: 'money' },
    { id: 'debts', view: 'view-debts', icon: 'icon-debts', title: 'Debt tracker', desc: 'Track who owes who', category: 'money' },
    { id: 'calculators', view: 'view-calculators', icon: 'icon-calculators', title: 'Calculators', desc: 'Tip, BMI, EMI, percent', category: 'money' },
    { id: 'text', view: 'view-text', icon: 'icon-text', title: 'Text tools', desc: 'Counter, case, Base64, hash', category: 'utilities' },
    { id: 'datetime', view: 'view-datetime', icon: 'icon-datetime', title: 'Date & time', desc: 'Age, date diff, countdown', category: 'utilities' },
    { id: 'qr', view: 'view-qr', icon: 'icon-qr', title: 'QR generator', desc: 'Create & download QR codes', category: 'utilities' }
  ];

  const HOME_TITLE = 'Toolkit';
  const HOME_VIEW = 'view-home';

  let headerTitleEl, backBtn, themeToggleBtn;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        if (k === 'class') node.className = props[k];
        else if (k === 'html') node.innerHTML = props[k];
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function buildToolCard(tool) {
    const card = el('button', { class: 'tool-card', type: 'button' });
    const iconWrap = el('span', { class: 'tool-card-icon', html: '<svg class="icon"><use href="#' + tool.icon + '"></use></svg>' });
    const titleEl = el('span', { class: 'tool-card-title' });
    titleEl.textContent = tool.title;
    const descEl = el('span', { class: 'tool-card-desc' });
    descEl.textContent = tool.desc;
    card.appendChild(iconWrap);
    card.appendChild(titleEl);
    card.appendChild(descEl);
    card.addEventListener('click', () => navigateTo(tool.view, tool.title));
    return card;
  }

  function renderHomeGrid() {
    const categories = ['security', 'money', 'utilities'];
    categories.forEach((cat) => {
      const grid = document.querySelector('.home-grid[data-category="' + cat + '"]');
      if (!grid) return;
      TOOLS.filter((t) => t.category === cat).forEach((t) => grid.appendChild(buildToolCard(t)));
    });
  }

  function navigateTo(viewId, title) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    headerTitleEl.textContent = viewId === HOME_VIEW ? HOME_TITLE : title;
    backBtn.classList.toggle('hidden', viewId === HOME_VIEW);
    TG.haptic('light');
  }

  function initNavigation() {
    headerTitleEl = document.getElementById('headerTitle');
    backBtn = document.getElementById('backBtn');
    backBtn.addEventListener('click', () => navigateTo(HOME_VIEW, HOME_TITLE));
  }

  function themeIconId(mode) {
    if (mode === 'light') return 'icon-theme-light';
    if (mode === 'dark') return 'icon-theme-dark';
    return 'icon-theme-system';
  }

  function updateThemeIcon() {
    const use = themeToggleBtn.querySelector('use');
    use.setAttribute('href', '#' + themeIconId(TG.theme.get()));
  }

  function initThemeToggle() {
    themeToggleBtn = document.getElementById('themeToggleBtn');
    updateThemeIcon();
    themeToggleBtn.addEventListener('click', () => {
      TG.theme.cycle();
      updateThemeIcon();
      TG.haptic('light');
    });
  }

  async function boot() {
    await TG.init(); // resolves once the saved theme mode is loaded + applied
    initNavigation();
    renderHomeGrid();
    initThemeToggle();

    OtpTool.init(document.getElementById('view-otp'));
    PasswordTool.init(document.getElementById('view-password'));
    ConverterTool.init(document.getElementById('view-converter'));
    SplitterTool.init(document.getElementById('view-splitter'));
    DebtsTool.init(document.getElementById('view-debts'));
    CalculatorsTool.init(document.getElementById('view-calculators'));
    TextToolsTool.init(document.getElementById('view-text'));
    DatetimeTool.init(document.getElementById('view-datetime'));
    QrTool.init(document.getElementById('view-qr'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
