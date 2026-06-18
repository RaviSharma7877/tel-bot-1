/**
 * datetime.js — age calculator, date-difference calculator, and a
 * persistent countdown timer. All pure calendar math, zero dependency. The
 * countdown target is saved via TG.storage so it survives reloads/restarts.
 */
(function () {
  'use strict';

  const COUNTDOWN_KEY = 'countdown_target_v1';

  function initSubtabs(root) {
    const btns = Array.from(root.querySelectorAll('.subtab-btn')).filter((b) => b.dataset.target);
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        btns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        btns.forEach((b) => {
          const panel = root.querySelector('#' + b.dataset.target);
          if (panel) panel.classList.toggle('active', b === btn);
        });
      });
    });
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ---------------- Age ----------------
  function calcAge(birthDateStr) {
    const birth = new Date(birthDateStr + 'T00:00:00');
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();
    if (days < 0) {
      months -= 1;
      const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }
    if (months < 0) { years -= 1; months += 12; }
    const totalDays = Math.floor((now - birth) / 86400000);

    let nextBday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (nextBday < todayStart) nextBday = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
    const daysToNextBday = Math.round((nextBday - todayStart) / 86400000);

    return { years, months, days, totalDays, daysToNextBday };
  }

  function initAge(root) {
    const input = root.querySelector('#ageBirthDate');
    const result = root.querySelector('#ageResult');

    function recompute() {
      if (!input.value) { result.innerHTML = '<span class="hint">Pick a birth date.</span>'; return; }
      const a = calcAge(input.value);
      if (a.totalDays < 0) { result.innerHTML = '<span class="hint">That date is in the future.</span>'; return; }
      result.innerHTML =
        `Age: <strong>${a.years} years, ${a.months} months, ${a.days} days</strong><br>` +
        `Total days lived: <strong>${a.totalDays.toLocaleString()}</strong><br>` +
        `Next birthday in: <strong>${a.daysToNextBday} day${a.daysToNextBday === 1 ? '' : 's'}</strong>`;
    }

    input.addEventListener('input', recompute);
    recompute();
  }

  // ---------------- Date diff ----------------
  function calcDateDiff(fromStr, toStr) {
    const from = new Date(fromStr + 'T00:00:00');
    const to = new Date(toStr + 'T00:00:00');
    const totalDays = Math.round((to - from) / 86400000);

    const [start, end] = totalDays >= 0 ? [from, to] : [to, from];
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();
    if (days < 0) {
      months -= 1;
      days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    }
    if (months < 0) { years -= 1; months += 12; }

    const absDays = Math.abs(totalDays);
    return { totalDays, weeks: Math.floor(absDays / 7), remDays: absDays % 7, years, months, days };
  }

  function initDiff(root) {
    const fromInput = root.querySelector('#diffFrom');
    const toInput = root.querySelector('#diffTo');
    const result = root.querySelector('#diffResult');

    function recompute() {
      if (!fromInput.value || !toInput.value) { result.innerHTML = '<span class="hint">Pick both dates.</span>'; return; }
      const d = calcDateDiff(fromInput.value, toInput.value);
      const direction = d.totalDays < 0 ? ' (in the past)' : '';
      result.innerHTML =
        `${Math.abs(d.totalDays).toLocaleString()} days total${direction}<br>` +
        `≈ ${d.weeks} weeks, ${d.remDays} days<br>` +
        `≈ ${d.years} years, ${d.months} months, ${d.days} days`;
    }

    fromInput.addEventListener('input', recompute);
    toInput.addEventListener('input', recompute);
    recompute();
  }

  // ---------------- Countdown ----------------
  function isoToLocalInputValue(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatRemaining(ms) {
    if (ms <= 0) return 'Countdown reached! 🎉';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
  }

  function initCountdown(root) {
    const targetInput = root.querySelector('#countdownTarget');
    const labelInput = root.querySelector('#countdownLabel');
    const setBtn = root.querySelector('#countdownSetBtn');
    const clearBtn = root.querySelector('#countdownClearBtn');
    const result = root.querySelector('#countdownResult');

    let state = null; // { target: isoString, label: string }
    let tickHandle = null;

    function render() {
      if (!state) { result.innerHTML = '<span class="hint">No countdown set.</span>'; return; }
      const remaining = new Date(state.target).getTime() - Date.now();
      const label = state.label ? `${state.label}<br>` : '';
      result.innerHTML = `${label}<strong>${formatRemaining(remaining)}</strong>`;
    }

    function startTicking() {
      if (tickHandle) clearInterval(tickHandle);
      tickHandle = setInterval(render, 1000);
      render();
    }

    setBtn.addEventListener('click', () => {
      if (!targetInput.value) { TG.showAlert('Pick a target date and time first.'); return; }
      state = { target: new Date(targetInput.value).toISOString(), label: labelInput.value.trim() };
      TG.storage.set(COUNTDOWN_KEY, JSON.stringify(state));
      startTicking();
      TG.haptic('success');
    });

    clearBtn.addEventListener('click', () => {
      state = null;
      if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
      targetInput.value = '';
      labelInput.value = '';
      TG.storage.remove(COUNTDOWN_KEY);
      render();
      TG.haptic('light');
    });

    TG.storage.get(COUNTDOWN_KEY).then((raw) => {
      if (!raw) { render(); return; }
      try {
        state = JSON.parse(raw);
        targetInput.value = isoToLocalInputValue(state.target);
        labelInput.value = state.label || '';
        startTicking();
      } catch (e) {
        render();
      }
    });
  }

  function initDatetimeTool(root) {
    initSubtabs(root);
    initAge(root);
    initDiff(root);
    initCountdown(root);
  }

  window.DatetimeTool = { init: initDatetimeTool, calcAge, calcDateDiff };
})();
