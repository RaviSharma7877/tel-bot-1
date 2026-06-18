/**
 * splitter.js — group expense splitting (Splitwise-style), pure client-side
 * logic. No external dependency: just arithmetic plus a greedy settle-up
 * matcher (largest debtor paired with largest creditor each round), which is
 * the same practical approach popular splitting apps use to minimize the
 * number of payments needed to settle a group.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'splitter_state_v1';
  let state = { groups: [], activeGroupId: null };

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function newGroup(name) {
    return { id: uid('g'), name: name || 'New group', currency: '$', members: [], expenses: [] };
  }

  function activeGroup() {
    return state.groups.find((g) => g.id === state.activeGroupId) || null;
  }

  async function load() {
    const raw = await TG.storage.get(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
    }
    if (!state.groups || state.groups.length === 0) {
      const g = newGroup('My Group');
      state = { groups: [g], activeGroupId: g.id };
    }
    if (!state.activeGroupId || !activeGroup()) {
      state.activeGroupId = state.groups[0].id;
    }
  }

  async function save() {
    await TG.storage.set(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------------- Balance + settle-up math ----------------
  function computeBalances(group) {
    const balances = {};
    group.members.forEach((m) => (balances[m] = 0));
    group.expenses.forEach((exp) => {
      if (!(exp.paidBy in balances)) balances[exp.paidBy] = 0;
      balances[exp.paidBy] += exp.amount;
      const among = exp.splitAmong.length ? exp.splitAmong : group.members;
      if (exp.splitType === 'custom' && exp.customSplits) {
        among.forEach((m) => {
          balances[m] = (balances[m] || 0) - (exp.customSplits[m] || 0);
        });
      } else {
        const share = exp.amount / among.length;
        among.forEach((m) => {
          balances[m] = (balances[m] || 0) - share;
        });
      }
    });
    Object.keys(balances).forEach((k) => (balances[k] = round2(balances[k])));
    return balances;
  }

  function computeSettlements(balances) {
    const creditors = Object.entries(balances)
      .filter(([, v]) => v > 0.005)
      .map(([name, amt]) => ({ name, amt }))
      .sort((a, b) => b.amt - a.amt);
    const debtors = Object.entries(balances)
      .filter(([, v]) => v < -0.005)
      .map(([name, amt]) => ({ name, amt: -amt }))
      .sort((a, b) => b.amt - a.amt);

    const transactions = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = round2(Math.min(debtors[i].amt, creditors[j].amt));
      if (pay > 0) transactions.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
      debtors[i].amt = round2(debtors[i].amt - pay);
      creditors[j].amt = round2(creditors[j].amt - pay);
      if (debtors[i].amt <= 0.005) i++;
      if (creditors[j].amt <= 0.005) j++;
    }
    return transactions;
  }

  // ---------------- Rendering ----------------
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

  let rootEl = null;

  function renderGroupSelect() {
    const sel = rootEl.querySelector('#splitterGroupSelect');
    sel.innerHTML = '';
    state.groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      if (g.id === state.activeGroupId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderMembers() {
    const group = activeGroup();
    const box = rootEl.querySelector('#splitterMembersList');
    box.innerHTML = '';
    if (group.members.length === 0) {
      box.appendChild(el('div', { class: 'hint' }, ['Add people in this group below.']));
    }
    group.members.forEach((m) => {
      const chip = el('span', { class: 'chip' }, [m]);
      const x = el('button', { class: 'chip-x' }, ['✕']);
      x.addEventListener('click', async () => {
        group.members = group.members.filter((n) => n !== m);
        group.expenses.forEach((e) => {
          e.splitAmong = e.splitAmong.filter((n) => n !== m);
          if (e.paidBy === m) e.paidBy = group.members[0] || '';
        });
        await save();
        renderAll();
      });
      chip.appendChild(x);
      box.appendChild(chip);
    });
  }

  function renderPaidBySelect() {
    const group = activeGroup();
    const sel = rootEl.querySelector('#splitterPaidBy');
    sel.innerHTML = '';
    group.members.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      sel.appendChild(opt);
    });
  }

  function renderSplitAmongBox() {
    const group = activeGroup();
    const box = rootEl.querySelector('#splitterSplitAmongBox');
    box.innerHTML = '';
    group.members.forEach((m) => {
      const label = el('label', { class: 'checkbox-row' });
      const cb = el('input', { type: 'checkbox', value: m, checked: 'checked' });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + m));
      box.appendChild(label);
    });
  }

  function renderExpenses() {
    const group = activeGroup();
    const list = rootEl.querySelector('#splitterExpenseList');
    list.innerHTML = '';
    if (group.expenses.length === 0) {
      list.appendChild(el('div', { class: 'hint' }, ['No expenses yet.']));
      return;
    }
    [...group.expenses].reverse().forEach((exp) => {
      const row = el('div', { class: 'card expense-row' });
      const top = el('div', { class: 'expense-top' }, [
        el('strong', {}, [exp.description || '(no description)']),
        el('span', {}, [group.currency + exp.amount.toFixed(2)])
      ]);
      const sub = el('div', { class: 'hint' }, [`Paid by ${exp.paidBy} · split among ${exp.splitAmong.join(', ')}`]);
      const del = el('button', { class: 'icon-btn danger' }, ['✕']);
      del.addEventListener('click', async () => {
        group.expenses = group.expenses.filter((e) => e.id !== exp.id);
        await save();
        renderAll();
      });
      top.appendChild(del);
      row.appendChild(top);
      row.appendChild(sub);
      list.appendChild(row);
    });
  }

  function renderBalancesAndSettlements() {
    const group = activeGroup();
    const balances = computeBalances(group);
    const balBox = rootEl.querySelector('#splitterBalances');
    balBox.innerHTML = '';
    Object.entries(balances).forEach(([name, amt]) => {
      const cls = amt > 0.005 ? 'positive' : amt < -0.005 ? 'negative' : '';
      const text = amt > 0.005 ? `is owed ${group.currency}${amt.toFixed(2)}`
        : amt < -0.005 ? `owes ${group.currency}${Math.abs(amt).toFixed(2)}`
        : 'is settled up';
      balBox.appendChild(el('div', { class: 'balance-row ' + cls }, [`${name} ${text}`]));
    });

    const settlements = computeSettlements(balances);
    const setBox = rootEl.querySelector('#splitterSettlements');
    setBox.innerHTML = '';
    if (settlements.length === 0) {
      setBox.appendChild(el('div', { class: 'hint' }, ['Everyone is settled up. 🎉']));
    } else {
      settlements.forEach((t) => {
        setBox.appendChild(el('div', { class: 'settlement-row' }, [`${t.from} → ${t.to}: ${group.currency}${t.amount.toFixed(2)}`]));
      });
    }
  }

  function renderAll() {
    renderGroupSelect();
    renderMembers();
    renderPaidBySelect();
    renderSplitAmongBox();
    renderExpenses();
    renderBalancesAndSettlements();
  }

  function initSplitterTab(root) {
    rootEl = root;

    root.querySelector('#splitterGroupSelect').addEventListener('change', async (e) => {
      state.activeGroupId = e.target.value;
      await save();
      renderAll();
    });

    const newGroupToggle = root.querySelector('#splitterNewGroupToggle');
    const newGroupForm = root.querySelector('#splitterNewGroupForm');
    newGroupToggle.addEventListener('click', () => {
      newGroupForm.classList.toggle('hidden');
    });
    newGroupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = root.querySelector('#splitterNewGroupName');
      const name = input.value.trim();
      if (!name) return;
      const g = newGroup(name);
      state.groups.push(g);
      state.activeGroupId = g.id;
      input.value = '';
      newGroupForm.classList.add('hidden');
      await save();
      renderAll();
    });

    root.querySelector('#splitterAddMemberForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = root.querySelector('#splitterMemberName');
      const name = input.value.trim();
      if (!name) return;
      const group = activeGroup();
      if (!group.members.includes(name)) group.members.push(name);
      input.value = '';
      await save();
      renderAll();
    });

    root.querySelector('#splitterExpenseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const group = activeGroup();
      const desc = root.querySelector('#splitterDesc').value.trim();
      const amount = parseFloat(root.querySelector('#splitterAmount').value);
      const paidBy = root.querySelector('#splitterPaidBy').value;
      const checked = [...root.querySelectorAll('#splitterSplitAmongBox input:checked')].map((cb) => cb.value);

      if (!amount || amount <= 0 || !paidBy || checked.length === 0) {
        TG.showAlert('Please fill in amount, payer, and at least one person to split among.');
        return;
      }

      group.expenses.push({
        id: uid('e'), description: desc, amount: round2(amount),
        paidBy, splitAmong: checked, splitType: 'equal'
      });

      root.querySelector('#splitterDesc').value = '';
      root.querySelector('#splitterAmount').value = '';
      TG.haptic('light');
      await save();
      renderAll();
    });

    load().then(renderAll);
  }

  window.SplitterTool = { init: initSplitterTab, computeBalances, computeSettlements };
})();
