/**
 * calculators.js — four pure-arithmetic calculators in one tabbed view:
 * Tip splitter, BMI (metric/imperial), Loan/EMI, and a general Percentage
 * toolkit (X% of Y / X is what % of Y / % change). No external dependency.
 */
(function () {
  'use strict';

  function fmt(n, decimals) {
    if (!isFinite(n)) return '—';
    const d = decimals == null ? 2 : decimals;
    return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
  }

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

  // ---------------- Tip ----------------
  function calcTip(bill, pct, people) {
    const tipAmount = bill * (pct / 100);
    const total = bill + tipAmount;
    const p = Math.max(1, people || 1);
    return { tipAmount, total, perPerson: total / p, tipPerPerson: tipAmount / p };
  }

  function initTip(root) {
    const bill = root.querySelector('#tipBill');
    const pctSlider = root.querySelector('#tipPct');
    const pctVal = root.querySelector('#tipPctVal');
    const people = root.querySelector('#tipPeople');
    const result = root.querySelector('#tipResult');
    const chips = Array.from(root.querySelectorAll('.chip-btn[data-pct]'));

    function syncChips() {
      chips.forEach((c) => c.classList.toggle('active', c.dataset.pct === pctSlider.value));
    }

    function recompute() {
      pctVal.textContent = pctSlider.value;
      syncChips();
      const billVal = parseFloat(bill.value);
      if (isNaN(billVal)) { result.innerHTML = '<span class="hint">Enter a bill amount.</span>'; return; }
      const r = calcTip(billVal, parseFloat(pctSlider.value) || 0, parseInt(people.value, 10) || 1);
      result.innerHTML =
        `Tip: <strong>${fmt(r.tipAmount)}</strong><br>` +
        `Total: <strong>${fmt(r.total)}</strong><br>` +
        `Per person: <strong>${fmt(r.perPerson)}</strong> (tip ${fmt(r.tipPerPerson)})`;
    }

    bill.addEventListener('input', recompute);
    pctSlider.addEventListener('input', recompute);
    people.addEventListener('input', recompute);
    chips.forEach((chip) => chip.addEventListener('click', () => {
      pctSlider.value = chip.dataset.pct;
      recompute();
      TG.haptic('light');
    }));

    recompute();
  }

  // ---------------- BMI ----------------
  function calcBmiMetric(heightCm, weightKg) {
    const h = heightCm / 100;
    return weightKg / (h * h);
  }
  function calcBmiImperial(heightIn, weightLb) {
    return (703 * weightLb) / (heightIn * heightIn);
  }
  function bmiCategory(bmi) {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  }

  function initBmi(root) {
    const metricBtn = root.querySelector('#bmiUnitMetric');
    const imperialBtn = root.querySelector('#bmiUnitImperial');
    const metricFields = root.querySelector('#bmiMetricFields');
    const imperialFields = root.querySelector('#bmiImperialFields');
    const heightCm = root.querySelector('#bmiHeightCm');
    const weightKg = root.querySelector('#bmiWeightKg');
    const heightFt = root.querySelector('#bmiHeightFt');
    const heightIn = root.querySelector('#bmiHeightIn');
    const weightLb = root.querySelector('#bmiWeightLb');
    const result = root.querySelector('#bmiResult');

    let useMetric = true;

    function recompute() {
      let bmi;
      if (useMetric) {
        const h = parseFloat(heightCm.value), w = parseFloat(weightKg.value);
        if (!h || !w) { result.innerHTML = '<span class="hint">Enter height and weight.</span>'; return; }
        bmi = calcBmiMetric(h, w);
      } else {
        const ft = parseFloat(heightFt.value) || 0, inch = parseFloat(heightIn.value) || 0, w = parseFloat(weightLb.value);
        const totalIn = ft * 12 + inch;
        if (!totalIn || !w) { result.innerHTML = '<span class="hint">Enter height and weight.</span>'; return; }
        bmi = calcBmiImperial(totalIn, w);
      }
      result.innerHTML = `BMI: <strong>${fmt(bmi, 1)}</strong><br>${bmiCategory(bmi)}`;
    }

    metricBtn.addEventListener('click', () => {
      useMetric = true;
      metricBtn.classList.add('active'); imperialBtn.classList.remove('active');
      metricFields.classList.remove('hidden'); imperialFields.classList.add('hidden');
      recompute();
    });
    imperialBtn.addEventListener('click', () => {
      useMetric = false;
      imperialBtn.classList.add('active'); metricBtn.classList.remove('active');
      imperialFields.classList.remove('hidden'); metricFields.classList.add('hidden');
      recompute();
    });

    [heightCm, weightKg, heightFt, heightIn, weightLb].forEach((inp) => inp.addEventListener('input', recompute));
    recompute();
  }

  // ---------------- Loan / EMI ----------------
  function calcEmi(principal, annualRatePct, tenureMonths) {
    const r = annualRatePct / 12 / 100;
    if (r === 0) return principal / tenureMonths;
    const factor = Math.pow(1 + r, tenureMonths);
    return (principal * r * factor) / (factor - 1);
  }

  function initLoan(root) {
    const principal = root.querySelector('#loanPrincipal');
    const rate = root.querySelector('#loanRate');
    const tenure = root.querySelector('#loanTenure');
    const result = root.querySelector('#loanResult');

    function recompute() {
      const p = parseFloat(principal.value), r = parseFloat(rate.value), n = parseInt(tenure.value, 10);
      if (!p || !n || r == null || isNaN(r)) { result.innerHTML = '<span class="hint">Enter loan amount, rate, and tenure.</span>'; return; }
      const emi = calcEmi(p, r, n);
      const totalPayment = emi * n;
      const totalInterest = totalPayment - p;
      result.innerHTML =
        `Monthly EMI: <strong>${fmt(emi)}</strong><br>` +
        `Total payment: <strong>${fmt(totalPayment)}</strong><br>` +
        `Total interest: <strong>${fmt(totalInterest)}</strong>`;
    }

    [principal, rate, tenure].forEach((inp) => inp.addEventListener('input', recompute));
    recompute();
  }

  // ---------------- Percentage ----------------
  function initPercent(root) {
    const ofX = root.querySelector('#pctOfX'), ofY = root.querySelector('#pctOfY'), ofResult = root.querySelector('#pctOfResult');
    const isX = root.querySelector('#pctIsX'), isY = root.querySelector('#pctIsY'), isResult = root.querySelector('#pctIsResult');
    const chgX = root.querySelector('#pctChgX'), chgY = root.querySelector('#pctChgY'), chgResult = root.querySelector('#pctChgResult');

    function recomputeOf() {
      const x = parseFloat(ofX.value), y = parseFloat(ofY.value);
      ofResult.textContent = (isNaN(x) || isNaN(y)) ? '' : `${fmt(x)}% of ${fmt(y)} = ${fmt((x / 100) * y)}`;
    }
    function recomputeIs() {
      const x = parseFloat(isX.value), y = parseFloat(isY.value);
      isResult.textContent = (isNaN(x) || isNaN(y) || y === 0) ? '' : `${fmt(x)} is ${fmt((x / y) * 100)}% of ${fmt(y)}`;
    }
    function recomputeChg() {
      const x = parseFloat(chgX.value), y = parseFloat(chgY.value);
      if (isNaN(x) || isNaN(y) || x === 0) { chgResult.textContent = ''; return; }
      const change = ((y - x) / x) * 100;
      const dir = change >= 0 ? 'increase' : 'decrease';
      chgResult.textContent = `${fmt(Math.abs(change))}% ${dir} (from ${fmt(x)} to ${fmt(y)})`;
    }

    [ofX, ofY].forEach((i) => i.addEventListener('input', recomputeOf));
    [isX, isY].forEach((i) => i.addEventListener('input', recomputeIs));
    [chgX, chgY].forEach((i) => i.addEventListener('input', recomputeChg));
  }

  function initCalculatorsTool(root) {
    initSubtabs(root);
    initTip(root);
    initBmi(root);
    initLoan(root);
    initPercent(root);
  }

  window.CalculatorsTool = { init: initCalculatorsTool, calcTip, calcEmi, calcBmiMetric, calcBmiImperial };
})();
