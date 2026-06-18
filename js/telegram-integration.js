/**
 * telegram-integration.js
 *
 * Thin wrapper around the Telegram WebApp JS SDK so the rest of the app
 * never has to care whether it's running inside Telegram or in a plain
 * browser tab (useful for local development/testing).
 *
 * Provides:
 *   - TG.init()              -> call once on load
 *   - TG.storage.get(key)    -> Promise<string|null>
 *   - TG.storage.set(key,v)  -> Promise<void>
 *   - TG.storage.remove(key) -> Promise<void>
 *   - TG.haptic(style)       -> best-effort haptic feedback, no-op if unavailable
 *   - TG.showAlert(msg)      -> Telegram-native alert, falls back to window.alert
 */
(function (global) {
  'use strict';

  const tg = global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null;
  const hasCloudStorage = !!(tg && tg.CloudStorage && typeof tg.CloudStorage.setItem === 'function');

  function applyThemeVars() {
    const root = document.documentElement;
    const theme = (tg && tg.themeParams) || {};

    const map = {
      '--tg-bg-color': theme.bg_color || '#ffffff',
      '--tg-text-color': theme.text_color || '#222222',
      '--tg-hint-color': theme.hint_color || '#999999',
      '--tg-link-color': theme.link_color || '#2678b6',
      '--tg-button-color': theme.button_color || '#2678b6',
      '--tg-button-text-color': theme.button_text_color || '#ffffff',
      '--tg-secondary-bg-color': theme.secondary_bg_color || '#f0f0f0',
      '--tg-section-bg-color': theme.section_bg_color || '#ffffff',
      '--tg-destructive-text-color': theme.destructive_text_color || '#e53935'
    };

    Object.keys(map).forEach((k) => root.style.setProperty(k, map[k]));
    root.setAttribute('data-color-scheme', (tg && tg.colorScheme) || 'light');
  }

  function init() {
    if (tg) {
      try { tg.ready(); } catch (e) {}
      try { tg.expand(); } catch (e) {}
      try { tg.setHeaderColor && tg.setHeaderColor('secondary_bg_color'); } catch (e) {}
      try { tg.onEvent && tg.onEvent('themeChanged', applyThemeVars); } catch (e) {}
    }
    applyThemeVars();
  }

  // ---- Storage: Telegram CloudStorage when available, localStorage otherwise ----
  // CloudStorage syncs per-user across that user's Telegram devices and needs
  // zero backend. localStorage fallback keeps the app fully testable in any
  // regular browser tab during development.

  const memoryFallback = {}; // last-resort if even localStorage is unavailable

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return memoryFallback[key] ?? null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { memoryFallback[key] = value; }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { delete memoryFallback[key]; }
  }

  const storage = {
    get(key) {
      return new Promise((resolve) => {
        if (hasCloudStorage) {
          tg.CloudStorage.getItem(key, (err, value) => {
            if (err) { resolve(lsGet(key)); }
            else { resolve(value === '' ? null : value); }
          });
        } else {
          resolve(lsGet(key));
        }
      });
    },
    set(key, value) {
      return new Promise((resolve) => {
        lsSet(key, value); // always mirror locally too, cheap insurance
        if (hasCloudStorage) {
          tg.CloudStorage.setItem(key, value, () => resolve());
        } else {
          resolve();
        }
      });
    },
    remove(key) {
      return new Promise((resolve) => {
        lsRemove(key);
        if (hasCloudStorage) {
          tg.CloudStorage.removeItem(key, () => resolve());
        } else {
          resolve();
        }
      });
    }
  };

  function haptic(style) {
    if (!tg || !tg.HapticFeedback) return;
    try {
      if (style === 'success' || style === 'error' || style === 'warning') {
        tg.HapticFeedback.notificationOccurred(style);
      } else {
        tg.HapticFeedback.impactOccurred(style || 'light');
      }
    } catch (e) {}
  }

  function showAlert(message) {
    if (tg && typeof tg.showAlert === 'function') {
      tg.showAlert(message);
    } else {
      global.alert(message);
    }
  }

  global.TG = { raw: tg, init, storage, haptic, showAlert, hasCloudStorage };
})(window);
