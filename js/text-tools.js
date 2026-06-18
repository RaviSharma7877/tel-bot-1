/**
 * text-tools.js — text counter, case converter, Base64 encode/decode, and a
 * hash generator. All pure client-side: Base64 goes through TextEncoder/
 * TextDecoder so UTF-8 (not just ASCII) round-trips correctly, and hashing
 * uses the native crypto.subtle.digest — no external library needed.
 */
(function () {
  'use strict';

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

  function copyToClipboard(text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      TG.haptic('success');
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1200);
    }).catch(() => {
      TG.showAlert('Could not copy automatically — select and copy manually.');
    });
  }

  // ---------------- Counter ----------------
  function countText(text) {
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    const words = (text.trim().match(/\S+/g) || []).length;
    const sentences = (text.trim().match(/[^.!?]+[.!?]+|\S+$/g) || []).filter((s) => s.trim()).length;
    const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
    return { chars, charsNoSpaces, words, sentences, lines };
  }

  function initCounter(root) {
    const input = root.querySelector('#counterInput');
    const result = root.querySelector('#counterResult');

    function recompute() {
      const c = countText(input.value);
      result.innerHTML =
        `Characters: <strong>${c.chars}</strong> (${c.charsNoSpaces} without spaces)<br>` +
        `Words: <strong>${c.words}</strong><br>` +
        `Sentences: <strong>${c.sentences}</strong><br>` +
        `Lines: <strong>${c.lines}</strong>`;
    }

    input.addEventListener('input', recompute);
    recompute();
  }

  // ---------------- Case conversion ----------------
  function toTitleCase(s) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function toSentenceCase(s) {
    const lower = s.toLowerCase();
    return lower.replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
  }
  function toCamelCase(s) {
    const words = s.trim().split(/[^a-zA-Z0-9]+/).filter(Boolean);
    return words.map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
  }
  function toSnakeCase(s) {
    const words = s.trim().split(/[^a-zA-Z0-9]+/).filter(Boolean);
    return words.map((w) => w.toLowerCase()).join('_');
  }

  function applyCase(text, mode) {
    switch (mode) {
      case 'upper': return text.toUpperCase();
      case 'lower': return text.toLowerCase();
      case 'title': return toTitleCase(text);
      case 'sentence': return toSentenceCase(text);
      case 'camel': return toCamelCase(text);
      case 'snake': return toSnakeCase(text);
      default: return text;
    }
  }

  function initCase(root) {
    const input = root.querySelector('#caseInput');
    const output = root.querySelector('#caseOutput');
    const copyBtn = root.querySelector('#caseCopyBtn');
    const chips = Array.from(root.querySelectorAll('.chip-btn[data-case]'));
    let activeMode = null;

    function recompute() {
      if (!activeMode) return;
      output.value = applyCase(input.value, activeMode);
    }

    chips.forEach((chip) => chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeMode = chip.dataset.case;
      recompute();
      TG.haptic('light');
    }));
    input.addEventListener('input', recompute);
    copyBtn.addEventListener('click', () => copyToClipboard(output.value, copyBtn));
  }

  // ---------------- Base64 ----------------
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }
  function base64ToUtf8(b64) {
    const binary = atob(b64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function initBase64(root) {
    const input = root.querySelector('#b64Input');
    const output = root.querySelector('#b64Output');
    const copyBtn = root.querySelector('#b64CopyBtn');
    const encodeBtn = root.querySelector('#b64EncodeBtn');
    const decodeBtn = root.querySelector('#b64DecodeBtn');
    let mode = 'encode';

    function recompute() {
      const val = input.value;
      if (!val) { output.value = ''; return; }
      try {
        output.value = mode === 'encode' ? utf8ToBase64(val) : base64ToUtf8(val);
      } catch (e) {
        output.value = mode === 'encode' ? 'Could not encode this text.' : 'Not valid Base64.';
      }
    }

    encodeBtn.addEventListener('click', () => {
      mode = 'encode';
      encodeBtn.classList.add('active'); decodeBtn.classList.remove('active');
      input.placeholder = 'Type or paste text…';
      recompute();
    });
    decodeBtn.addEventListener('click', () => {
      mode = 'decode';
      decodeBtn.classList.add('active'); encodeBtn.classList.remove('active');
      input.placeholder = 'Paste Base64 to decode…';
      recompute();
    });
    input.addEventListener('input', recompute);
    copyBtn.addEventListener('click', () => copyToClipboard(output.value, copyBtn));
  }

  // ---------------- Hash ----------------
  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function computeHash(text, algo) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest(algo, data);
    return bufToHex(digest);
  }

  function initHash(root) {
    const input = root.querySelector('#hashInput');
    const algoSel = root.querySelector('#hashAlgo');
    const output = root.querySelector('#hashOutput');
    const copyBtn = root.querySelector('#hashCopyBtn');

    async function recompute() {
      if (!input.value) { output.value = ''; return; }
      try {
        output.value = await computeHash(input.value, algoSel.value);
      } catch (e) {
        output.value = 'Could not compute hash.';
      }
    }

    input.addEventListener('input', recompute);
    algoSel.addEventListener('change', recompute);
    copyBtn.addEventListener('click', () => copyToClipboard(output.value, copyBtn));
  }

  function initTextToolsTool(root) {
    initSubtabs(root);
    initCounter(root);
    initCase(root);
    initBase64(root);
    initHash(root);
  }

  window.TextToolsTool = { init: initTextToolsTool, countText, applyCase, utf8ToBase64, base64ToUtf8, computeHash };
})();
