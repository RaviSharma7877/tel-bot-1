/**
 * debts.js — simple personal IOU tracker (separate from the group
 * splitter): "who owes me" / "who I owe", with a settle toggle and running
 * totals. Pure client-side state, no external dependency.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'debts_v1';
  let debts = []; // {id, person, amount, direction: 'owed_to_me'|'i_owe', note, createdAt, settled}
  let rootEl = null;

  function uid() { return 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  async function load() {
    const raw = await TG.storage.get(STORAGE_KEY);
    debts = raw ? JSON.parse(raw) : [];
  }
  async function save() {
    await TG.storage.set(STORAGE_KEY, JSON.stringify(debts));
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) Object.keys(props).forEach((k) => {
      if (k === 'class') node.className = props[k];
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), props[k]);
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  function computeTotals() {
    let owedToMe = 0, iOwe = 0;
    debts.filter((d) => !d.settled).forEach((d) => {
      if (d.direction === 'owed_to_me') owedToMe += d.amount;
      else iOwe += d.amount;
    });
    return { owedToMe, iOwe, net: owedToMe - iOwe };
  }

  function renderTotals() {
    const { owedToMe, iOwe, net } = computeTotals();
    const box = rootEl.querySelector('#debtsTotals');
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'totals-row positive' }, [`Owed to you: $${owedToMe.toFixed(2)}`]));
    box.appendChild(el('div', { class: 'totals-row negative' }, [`You owe: $${iOwe.toFixed(2)}`]));
    box.appendChild(el('div', { class: 'totals-row ' + (net >= 0 ? 'positive' : 'negative') }, [`Net: ${net >= 0 ? '+' : ''}$${net.toFixed(2)}`]));
  }

  function renderList() {
    const list = rootEl.querySelector('#debtsList');
    list.innerHTML = '';
    if (debts.length === 0) {
      list.appendChild(el('div', { class: 'hint' }, ['No debts tracked yet — add one below.']));
      return;
    }
    const sorted = [...debts].sort((a, b) => (a.settled === b.settled ? b.createdAt - a.createdAt : a.settled ? 1 : -1));
    sorted.forEach((d) => {
      const row = el('div', { class: 'card debt-row' + (d.settled ? ' settled' : '') });
      const top = el('div', { class: 'expense-top' });
      const label = d.direction === 'owed_to_me' ? `${d.person} owes you` : `You owe ${d.person}`;
      top.appendChild(el('strong', {}, [label]));
      top.appendChild(el('span', { class: d.direction === 'owed_to_me' ? 'positive' : 'negative' }, [`$${d.amount.toFixed(2)}`]));
      row.appendChild(top);
      if (d.note) row.appendChild(el('div', { class: 'hint' }, [d.note]));

      const actions = el('div', { class: 'row-actions' });
      const settleBtn = el('button', { class: 'small-btn' }, [d.settled ? 'Reopen' : 'Mark settled']);
      settleBtn.addEventListener('click', async () => {
        d.settled = !d.settled;
        TG.haptic(d.settled ? 'success' : 'light');
        await save();
        renderAll();
      });
      const delBtn = el('button', { class: 'icon-btn danger' }, ['✕']);
      delBtn.addEventListener('click', async () => {
        debts = debts.filter((x) => x.id !== d.id);
        await save();
        renderAll();
      });
      actions.appendChild(settleBtn);
      actions.appendChild(delBtn);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function renderAll() {
    renderTotals();
    renderList();
  }

  function initDebtsTab(root) {
    rootEl = root;

    root.querySelector('#debtsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const person = root.querySelector('#debtsPerson').value.trim();
      const amount = parseFloat(root.querySelector('#debtsAmount').value);
      const direction = root.querySelector('#debtsDirection').value;
      const note = root.querySelector('#debtsNote').value.trim();

      if (!person || !amount || amount <= 0) {
        TG.showAlert('Please enter a person and a valid amount.');
        return;
      }

      debts.push({ id: uid(), person, amount, direction, note, createdAt: Date.now(), settled: false });

      root.querySelector('#debtsPerson').value = '';
      root.querySelector('#debtsAmount').value = '';
      root.querySelector('#debtsNote').value = '';
      TG.haptic('light');
      await save();
      renderAll();
    });

    load().then(renderAll);
  }

  window.DebtsTool = { init: initDebtsTab, computeTotals };
})();
