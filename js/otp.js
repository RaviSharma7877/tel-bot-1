/**
 * otp.js — TOTP (RFC 6238) authenticator codes, generated entirely on-device.
 *
 * No external library, no network call: uses the browser's native
 * Web Crypto API (crypto.subtle) to compute the HMAC, exactly like every
 * other authenticator app does under the hood.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'otp_accounts_v1';
  let accounts = []; // {id, label, secret, digits, period, algorithm}
  let tickHandle = null;

  // ---------- Base32 (RFC 4648) decode, no external dependency ----------
  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function base32Decode(input) {
    const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
    let bits = '';
    for (const char of clean) {
      const idx = BASE32_ALPHABET.indexOf(char);
      if (idx === -1) throw new Error('Invalid Base32 character in secret: "' + char + '"');
      bits += idx.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return new Uint8Array(bytes);
  }

  function counterToBytes(counter) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    // JS numbers are safe up to 2^53; counter (seconds/period) fits easily.
    view.setUint32(4, counter % 0x100000000, false);
    view.setUint32(0, Math.floor(counter / 0x100000000), false);
    return buf;
  }

  async function totp(secretBase32, { digits = 6, period = 30, algorithm = 'SHA-1' } = {}, atMs = Date.now()) {
    const keyBytes = base32Decode(secretBase32);
    const counter = Math.floor(atMs / 1000 / period);
    const key = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'HMAC', hash: algorithm }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, counterToBytes(counter));
    const digest = new Uint8Array(sig);
    const offset = digest[digest.length - 1] & 0x0f;
    const binCode =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    const otp = (binCode % Math.pow(10, digits)).toString().padStart(digits, '0');
    const secondsIntoPeriod = Math.floor(atMs / 1000) % period;
    const secondsRemaining = period - secondsIntoPeriod;
    return { code: otp, secondsRemaining, period };
  }

  // ---------- Persistence ----------
  async function loadAccounts() {
    const raw = await TG.storage.get(STORAGE_KEY);
    accounts = raw ? JSON.parse(raw) : [];
  }
  async function saveAccounts() {
    await TG.storage.set(STORAGE_KEY, JSON.stringify(accounts));
  }

  function uid() {
    return 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Rendering ----------
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

  async function renderAccount(container, account) {
    let result;
    try {
      result = await totp(account.secret, account);
    } catch (e) {
      result = { code: 'ERROR', secondsRemaining: 0, period: account.period || 30 };
    }

    const card = el('div', { class: 'card otp-card' });
    const top = el('div', { class: 'otp-card-top' });
    const label = el('div', { class: 'otp-label' }, [account.label]);
    const del = el('button', { class: 'icon-btn danger', title: 'Delete' }, ['✕']);
    del.addEventListener('click', async () => {
      accounts = accounts.filter((a) => a.id !== account.id);
      await saveAccounts();
      renderAll(container.parentElement);
    });
    top.appendChild(label);
    top.appendChild(del);

    const codeRow = el('div', { class: 'otp-code-row' });
    const codeEl = el('div', { class: 'otp-code' }, [result.code.replace(/(\d{3})(\d{3})/, '$1 $2')]);
    codeRow.appendChild(codeEl);
    codeRow.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(result.code);
        TG.haptic('success');
        codeEl.classList.add('copied');
        setTimeout(() => codeEl.classList.remove('copied'), 600);
      } catch (e) {
        TG.showAlert('Code: ' + result.code);
      }
    });

    const barOuter = el('div', { class: 'otp-progress-outer' });
    const pct = Math.max(0, Math.min(100, (result.secondsRemaining / result.period) * 100));
    const barInner = el('div', { class: 'otp-progress-inner', style: `width:${pct}%` });
    barOuter.appendChild(barInner);

    card.appendChild(top);
    card.appendChild(codeRow);
    card.appendChild(barOuter);
    container.appendChild(card);
  }

  async function renderAll(root) {
    const list = root.querySelector('#otpList');
    const empty = root.querySelector('#otpEmpty');
    list.innerHTML = '';
    if (accounts.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    for (const account of accounts) {
      await renderAccount(list, account);
    }
  }

  function startTicking(root) {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(() => renderAll(root), 1000);
  }

  function initOtpTab(root) {
    const form = root.querySelector('#otpAddForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const labelInput = root.querySelector('#otpLabel');
      const secretInput = root.querySelector('#otpSecret');
      const label = labelInput.value.trim();
      const secret = secretInput.value.trim().replace(/\s+/g, '');
      if (!label || !secret) return;
      try {
        await totp(secret); // validate it decodes & computes before saving
      } catch (err) {
        TG.showAlert('That secret key looks invalid: ' + err.message);
        return;
      }
      accounts.push({ id: uid(), label, secret, digits: 6, period: 30, algorithm: 'SHA-1' });
      await saveAccounts();
      labelInput.value = '';
      secretInput.value = '';
      TG.haptic('light');
      renderAll(root);
    });

    loadAccounts().then(() => {
      renderAll(root);
      startTicking(root);
    });
  }

  window.OtpTool = { init: initOtpTab, totp, base32Decode };
})();
