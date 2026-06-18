/**
 * password.js — password generator (crypto.getRandomValues, rejection
 * sampling to avoid modulo bias) and a strength checker built on entropy
 * estimation + pattern heuristics. No external library (no zxcvbn) — this
 * is intentionally a simple, auditable, dependency-free implementation.
 */
(function () {
  'use strict';

  const SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>/?'
  };
  const AMBIGUOUS = new Set('0O1lI|'.split(''));

  const COMMON_PASSWORDS = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password1',
    '111111', '12345678', 'letmein', 'iloveyou', 'admin', 'welcome',
    'monkey', 'dragon', 'football', '12345', '000000', '1234567',
    'sunshine', 'princess', 'qwerty123', '1q2w3e4r', 'starwars'
  ];

  // ---------------- Generation ----------------

  function randomInt(maxExclusive) {
    // Rejection sampling against a Uint32 range avoids modulo bias.
    const range = 256 * 256 * 256 * 256;
    const limit = range - (range % maxExclusive);
    const buf = new Uint32Array(1);
    let val;
    do {
      crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return val % maxExclusive;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildCharset(setKey, excludeAmbiguous) {
    let chars = SETS[setKey].split('');
    if (excludeAmbiguous) chars = chars.filter((c) => !AMBIGUOUS.has(c));
    return chars;
  }

  function generatePassword(length, opts) {
    const activeKeys = ['upper', 'lower', 'numbers', 'symbols'].filter((k) => opts[k]);
    if (activeKeys.length === 0) activeKeys.push('lower');

    const setsByKey = {};
    activeKeys.forEach((k) => { setsByKey[k] = buildCharset(k, opts.excludeAmbiguous); });

    const pool = activeKeys.reduce((acc, k) => acc.concat(setsByKey[k]), []);

    const result = [];
    // Guarantee at least one char from each active set (when length allows).
    activeKeys.forEach((k) => {
      if (result.length < length) {
        const set = setsByKey[k];
        result.push(set[randomInt(set.length)]);
      }
    });
    while (result.length < length) {
      result.push(pool[randomInt(pool.length)]);
    }
    return shuffle(result).slice(0, length).join('');
  }

  // ---------------- Strength estimation ----------------

  function classesOf(pw) {
    return {
      lower: /[a-z]/.test(pw),
      upper: /[A-Z]/.test(pw),
      digit: /[0-9]/.test(pw),
      symbol: /[^a-zA-Z0-9]/.test(pw)
    };
  }

  function poolSizeForClasses(c) {
    let n = 0;
    if (c.lower) n += 26;
    if (c.upper) n += 26;
    if (c.digit) n += 10;
    if (c.symbol) n += 33;
    return n || 1;
  }

  function hasSequential(pw) {
    const lower = pw.toLowerCase();
    const seqs = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    for (const seq of seqs) {
      for (let i = 0; i <= seq.length - 3; i++) {
        const fwd = seq.slice(i, i + 3);
        const rev = fwd.split('').reverse().join('');
        if (lower.includes(fwd) || lower.includes(rev)) return true;
      }
    }
    return false;
  }

  function hasRepeats(pw) {
    return /(.)\1\1/.test(pw);
  }

  function estimateStrength(pw) {
    if (!pw) return { score: 0, label: 'Empty', bits: 0, feedback: ['Type a password to check it.'] };

    const feedback = [];
    const classes = classesOf(pw);
    const poolSize = poolSizeForClasses(classes);
    let bits = pw.length * Math.log2(poolSize);

    const lower = pw.toLowerCase();
    if (COMMON_PASSWORDS.includes(lower)) {
      bits = Math.min(bits, 8);
      feedback.push('This is one of the most common passwords in the world — avoid it.');
    }
    if (hasRepeats(pw)) {
      bits *= 0.7;
      feedback.push('Avoid repeating the same character 3+ times in a row.');
    }
    if (hasSequential(pw)) {
      bits *= 0.7;
      feedback.push('Avoid sequential runs like "abc" or "1234".');
    }
    if (pw.length < 8) feedback.push('Use at least 8 characters — longer is much stronger.');
    if (!classes.upper || !classes.lower) feedback.push('Mix uppercase and lowercase letters.');
    if (!classes.digit) feedback.push('Add some numbers.');
    if (!classes.symbol) feedback.push('Add a symbol (e.g. ! @ # $).');

    const score = Math.max(0, Math.min(100, Math.round((bits / 80) * 100)));
    let label;
    if (score < 20) label = 'Very weak';
    else if (score < 40) label = 'Weak';
    else if (score < 60) label = 'Fair';
    else if (score < 80) label = 'Strong';
    else label = 'Very strong';

    if (feedback.length === 0) feedback.push('Looks good.');
    return { score, label, bits: Math.round(bits), feedback };
  }

  function colorForScore(score) {
    if (score < 30) return 'var(--negative)';
    if (score < 60) return '#e8a33d';
    return 'var(--positive)';
  }

  function renderMeter(barEl, labelEl, result) {
    barEl.style.width = result.score + '%';
    barEl.style.backgroundColor = colorForScore(result.score);
    labelEl.textContent = result.bits ? `${result.label} · ~${result.bits} bits of entropy` : result.label;
  }

  // ---------------- DOM wiring ----------------

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

  function initGenerate(root) {
    const output = root.querySelector('#pwdOutput');
    const copyBtn = root.querySelector('#pwdCopyBtn');
    const meter = root.querySelector('#pwdMeterGen');
    const label = root.querySelector('#pwdLabelGen');
    const lengthInput = root.querySelector('#pwdLength');
    const lengthVal = root.querySelector('#pwdLengthVal');
    const upperCb = root.querySelector('#pwdUpper');
    const lowerCb = root.querySelector('#pwdLower');
    const numbersCb = root.querySelector('#pwdNumbers');
    const symbolsCb = root.querySelector('#pwdSymbols');
    const excludeCb = root.querySelector('#pwdExcludeAmbiguous');
    const generateBtn = root.querySelector('#pwdGenerateBtn');

    function doGenerate() {
      const length = parseInt(lengthInput.value, 10) || 16;
      if (!upperCb.checked && !lowerCb.checked && !numbersCb.checked && !symbolsCb.checked) {
        lowerCb.checked = true; // never allow an empty character pool
      }
      const pw = generatePassword(length, {
        upper: upperCb.checked,
        lower: lowerCb.checked,
        numbers: numbersCb.checked,
        symbols: symbolsCb.checked,
        excludeAmbiguous: excludeCb.checked
      });
      output.value = pw;
      renderMeter(meter, label, estimateStrength(pw));
    }

    lengthInput.addEventListener('input', () => {
      lengthVal.textContent = lengthInput.value;
      doGenerate();
    });
    [upperCb, lowerCb, numbersCb, symbolsCb, excludeCb].forEach((cb) => cb.addEventListener('change', doGenerate));
    generateBtn.addEventListener('click', () => { doGenerate(); TG.haptic('light'); });

    copyBtn.addEventListener('click', async () => {
      if (!output.value) return;
      try {
        await navigator.clipboard.writeText(output.value);
        TG.haptic('success');
        const original = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = original; }, 1200);
      } catch (e) {
        TG.showAlert('Could not copy automatically — tap the field and copy manually.');
      }
    });

    doGenerate();
  }

  function initCheck(root) {
    const input = root.querySelector('#pwdCheckInput');
    const showToggle = root.querySelector('#pwdShowToggle');
    const meter = root.querySelector('#pwdMeterCheck');
    const label = root.querySelector('#pwdLabelCheck');
    const feedback = root.querySelector('#pwdFeedback');

    input.type = 'password';

    function recompute() {
      const result = estimateStrength(input.value);
      renderMeter(meter, label, result);
      feedback.textContent = result.feedback.join(' ');
    }

    input.addEventListener('input', recompute);
    showToggle.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      showToggle.textContent = showing ? 'Show' : 'Hide';
    });

    recompute();
  }

  function initPasswordTool(root) {
    initSubtabs(root);
    initGenerate(root);
    initCheck(root);
  }

  window.PasswordTool = { init: initPasswordTool, generatePassword, estimateStrength };
})();
