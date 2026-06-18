/**
 * app.js — top-level app shell. Boots the Telegram integration layer, wires
 * up the 5-way tab navigation, and initializes each tool module against its
 * own section of the DOM. No external dependency, no build step required.
 */
(function () {
  'use strict';

  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.view');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        tabBtns.forEach((b) => b.classList.remove('active'));
        views.forEach((v) => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.view).classList.add('active');
        TG.haptic('light');
      });
    });
  }

  function boot() {
    TG.init();
    initTabs();

    OtpTool.init(document.getElementById('view-otp'));
    ConverterTool.init(document.getElementById('view-converter'));
    SplitterTool.init(document.getElementById('view-splitter'));
    DebtsTool.init(document.getElementById('view-debts'));
    QrTool.init(document.getElementById('view-qr'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
