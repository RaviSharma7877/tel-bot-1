/**
 * telegram-integration.js
 *
 * Thin wrapper around the Telegram WebApp JS SDK so the rest of the app
 * never has to care whether it's running inside Telegram or in a plain
 * browser tab (useful for local development/testing).
 *
 * Provides:
 *   - TG.init()              -> call once on load, returns a Promise that
 *                              resolves once the saved theme mode is loaded
 *                              and applied (await it before reading theme.get())
 *   - TG.storage.get(key)    -> Promise<string|null>
 *   - TG.storage.set(key,v)  -> Promise<void>
 *   - TG.storage.remove(key) -> Promise<void>
 *   - TG.haptic(style)       -> best-effort haptic feedback, no-op if unavailable
 *   - TG.showAlert(msg)      -> Telegram-native alert, falls back to window.alert
 *   - TG.theme.get()         -> 'light' | 'dark' | 'system' (current override mode)
 *   - TG.theme.cycle()       -> advances light -> dark -> system -> light, persists choice
 *   - TG.theme.apply()       -> re-applies CSS vars for the current mode (call after cycle)
 */
(function (global) {
  'use strict';

  const tg = global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null;
  const hasCloudStorage = !!(tg && tg.CloudStorage && typeof tg.CloudStorage.setItem === 'function');

  const LIGHT_VARS = {
    '--tg-bg-color': '#ffffff',
    '--tg-text-color': '#1c1c1e',
    '--tg-hint-color': '#8e8e93',
    '--tg-link-color': '#2678b6',
    '--tg-button-color': '#2678b6',
    '--tg-button-text-color': '#ffffff',
    '--tg-secondary-bg-color': '#f0f0f3',
    '--tg-section-bg-color': '#ffffff',
    '--tg-destructive-text-color': '#e53935'
  };
  const DARK_VARS = {
    '--tg-bg-color': '#17181c',
    '--tg-text-color': '#f0f0f2',
    '--tg-hint-color': '#8d8d93',
    '--tg-link-color': '#5eb0ed',
    '--tg-button-color': '#3b8fd4',
    '--tg-button-text-color': '#ffffff',
    '--tg-secondary-bg-color': '#222329',
    '--tg-section-bg-color': '#1e1f25',
    '--tg-destructive-text-color': '#ff6b6b'
  };

  const THEME_KEY = 'theme_override_v1';
  let themeMode = 'system'; // 'light' | 'dark' | 'system'

  function applyThemeVars() {
    const root = document.documentElement;
    let vars, scheme;

    if (themeMode === 'system') {
      const tgTheme = (tg && tg.themeParams) || {};
      const hasTgTheme = Object.keys(tgTheme).length > 0;
      if (hasTgTheme) {
        vars = {
          '--tg-bg-color': tgTheme.bg_color || LIGHT_VARS['--tg-bg-color'],
          '--tg-text-color': tgTheme.text_color || LIGHT_VARS['--tg-text-color'],
          '--tg-hint-color': tgTheme.hint_color || LIGHT_VARS['--tg-hint-color'],
          '--tg-link-color': tgTheme.link_color || LIGHT_VARS['--tg-link-color'],
          '--tg-button-color': tgTheme.button_color || LIGHT_VARS['--tg-button-color'],
          '--tg-button-text-color': tgTheme.button_text_color || LIGHT_VARS['--tg-button-text-color'],
          '--tg-secondary-bg-color': tgTheme.secondary_bg_color || LIGHT_VARS['--tg-secondary-bg-color'],
          '--tg-section-bg-color': tgTheme.section_bg_color || LIGHT_VARS['--tg-section-bg-color'],
          '--tg-destructive-text-color': tgTheme.destructive_text_color || LIGHT_VARS['--tg-destructive-text-color']
        };
        scheme = (tg && tg.colorScheme) || 'light';
      } else {
        const prefersDark = global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
        vars = prefersDark ? DARK_VARS : LIGHT_VARS;
        scheme = prefersDark ? 'dark' : 'light';
      }
    } else if (themeMode === 'dark') {
      vars = DARK_VARS;
      scheme = 'dark';
    } else {
      vars = LIGHT_VARS;
      scheme = 'light';
    }

    Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
    root.setAttribute('data-color-scheme', scheme);
    root.setAttribute('data-theme-mode', themeMode);
  }

  async function loadThemeMode() {
    try {
      const raw = await storage.get(THEME_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') themeMode = raw;
    } catch (e) {}
  }

  function cycleTheme() {
    themeMode = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light';
    storage.set(THEME_KEY, themeMode);
    applyThemeVars();
    return themeMode;
  }

  function init() {
    if (tg) {
      try { tg.ready(); } catch (e) {}
      try { tg.expand(); } catch (e) {}
      try { tg.setHeaderColor && tg.setHeaderColor('secondary_bg_color'); } catch (e) {}
      try { tg.onEvent && tg.onEvent('themeChanged', applyThemeVars); } catch (e) {}
    }
    // Returned so callers can await theme-mode load before reading TG.theme.get().
    return loadThemeMode().then(applyThemeVars);
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

  const theme = {
    get: () => themeMode,
    cycle: cycleTheme,
    apply: applyThemeVars
  };

  global.TG = { raw: tg, init, storage, haptic, showAlert, hasCloudStorage, theme };
})(window);
