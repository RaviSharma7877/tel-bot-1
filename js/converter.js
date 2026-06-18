/**
 * converter.js — unit converter (100% pure math, zero dependency) plus a
 * currency converter that uses one small free, no-key FX API
 * (api.frankfurter.dev, backed by European Central Bank reference rates) with
 * a cached fallback so it still works offline using the last known rates.
 */
(function () {
  'use strict';

  // ---------------- Unit conversion (pure logic) ----------------
  const CATEGORIES = {
    length: {
      label: 'Length', base: 'm',
      units: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nmi: 1852 },
      names: { m: 'Meters', km: 'Kilometers', cm: 'Centimeters', mm: 'Millimeters', mi: 'Miles', yd: 'Yards', ft: 'Feet', in: 'Inches', nmi: 'Nautical miles' }
    },
    weight: {
      label: 'Weight', base: 'kg',
      units: { kg: 1, g: 0.001, mg: 0.000001, t: 1000, lb: 0.45359237, oz: 0.0283495231, st: 6.35029318 },
      names: { kg: 'Kilograms', g: 'Grams', mg: 'Milligrams', t: 'Metric tons', lb: 'Pounds', oz: 'Ounces', st: 'Stone' }
    },
    temperature: {
      label: 'Temperature', base: 'C',
      units: { C: null, F: null, K: null },
      names: { C: 'Celsius', F: 'Fahrenheit', K: 'Kelvin' }
    },
    volume: {
      label: 'Volume', base: 'l',
      units: { l: 1, ml: 0.001, m3: 1000, galUS: 3.785411784, qtUS: 0.946352946, ptUS: 0.473176473, cupUS: 0.2365882365, flozUS: 0.0295735296 },
      names: { l: 'Liters', ml: 'Milliliters', m3: 'Cubic meters', galUS: 'Gallons (US)', qtUS: 'Quarts (US)', ptUS: 'Pints (US)', cupUS: 'Cups (US)', flozUS: 'Fluid oz (US)' }
    },
    area: {
      label: 'Area', base: 'm2',
      units: { m2: 1, km2: 1e6, ha: 10000, acre: 4046.8564224, mi2: 2589988.110336, ft2: 0.09290304, yd2: 0.83612736 },
      names: { m2: 'Sq. meters', km2: 'Sq. kilometers', ha: 'Hectares', acre: 'Acres', mi2: 'Sq. miles', ft2: 'Sq. feet', yd2: 'Sq. yards' }
    },
    speed: {
      label: 'Speed', base: 'mps',
      units: { mps: 1, kmph: 1 / 3.6, mph: 0.44704, knot: 0.514444 },
      names: { mps: 'Meters/sec', kmph: 'Km/h', mph: 'Miles/h', knot: 'Knots' }
    },
    time: {
      label: 'Time', base: 's',
      units: { s: 1, min: 60, hr: 3600, day: 86400, week: 604800 },
      names: { s: 'Seconds', min: 'Minutes', hr: 'Hours', day: 'Days', week: 'Weeks' }
    },
    data: {
      label: 'Data', base: 'byte',
      units: { byte: 1, KB: 1000, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1048576, GiB: 1073741824 },
      names: { byte: 'Bytes', KB: 'Kilobytes (1000)', MB: 'Megabytes (1000^2)', GB: 'Gigabytes (1000^3)', TB: 'Terabytes (1000^4)', KiB: 'Kibibytes (1024)', MiB: 'Mebibytes (1024^2)', GiB: 'Gibibytes (1024^3)' }
    }
  };

  function celsiusToX(c, unit) {
    if (unit === 'C') return c;
    if (unit === 'F') return c * 9 / 5 + 32;
    if (unit === 'K') return c + 273.15;
  }
  function xToCelsius(v, unit) {
    if (unit === 'C') return v;
    if (unit === 'F') return (v - 32) * 5 / 9;
    if (unit === 'K') return v - 273.15;
  }

  function convertUnit(category, fromUnit, toUnit, value) {
    if (category === 'temperature') {
      return celsiusToX(xToCelsius(value, fromUnit), toUnit);
    }
    const cat = CATEGORIES[category];
    const inBase = value * cat.units[fromUnit];
    return inBase / cat.units[toUnit];
  }

  // ---------------- Currency conversion (1 lightweight FX API + cache) ----------------
  const FX_CACHE_KEY = 'fx_rates_v1';
  const FX_MAX_AGE_MS = 12 * 60 * 60 * 1000; // refresh after 12h, else reuse cache
  const FX_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD',
    'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'ZAR', 'MXN', 'BRL', 'KRW', 'THB', 'PLN', 'TRY', 'ILS', 'IDR', 'MYR', 'PHP', 'CZK', 'HUF'];

  let fxCache = null; // {base:'USD', date, rates:{...}, fetchedAt}

  async function loadFxCache() {
    const raw = await TG.storage.get(FX_CACHE_KEY);
    fxCache = raw ? JSON.parse(raw) : null;
  }

  async function fetchFreshRates() {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?from=USD');
    if (!res.ok) throw new Error('FX request failed: ' + res.status);
    const data = await res.json();
    const rates = Object.assign({ USD: 1 }, data.rates);
    fxCache = { base: 'USD', date: data.date, rates, fetchedAt: Date.now() };
    await TG.storage.set(FX_CACHE_KEY, JSON.stringify(fxCache));
    return fxCache;
  }

  async function ensureRates() {
    if (!fxCache) await loadFxCache();
    const stale = !fxCache || (Date.now() - (fxCache.fetchedAt || 0)) > FX_MAX_AGE_MS;
    if (stale) {
      try {
        await fetchFreshRates();
      } catch (e) {
        // Offline or the FX API is down: silently keep using whatever we
        // last cached (even if old). If we have nothing at all, surface it.
        if (!fxCache) throw e;
      }
    }
    return fxCache;
  }

  function convertCurrency(amount, fromCcy, toCcy) {
    if (!fxCache) throw new Error('Rates not loaded yet');
    const rFrom = fxCache.rates[fromCcy];
    const rTo = fxCache.rates[toCcy];
    if (rFrom == null || rTo == null) throw new Error('Unsupported currency');
    // rates are USD -> ccy, so cross rate from->to = rTo / rFrom
    return amount * (rTo / rFrom);
  }

  // ---------------- DOM wiring ----------------
  function fillSelect(select, optionsMap, selected) {
    select.innerHTML = '';
    Object.keys(optionsMap).forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = optionsMap[key] || key;
      if (key === selected) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function initUnitsSubtab(root) {
    const categorySel = root.querySelector('#unitCategory');
    const fromSel = root.querySelector('#unitFrom');
    const toSel = root.querySelector('#unitTo');
    const input = root.querySelector('#unitInput');
    const output = root.querySelector('#unitOutput');
    const swapBtn = root.querySelector('#unitSwap');

    fillSelect(categorySel, Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])), 'length');

    function refreshUnitOptions() {
      const cat = CATEGORIES[categorySel.value];
      const keys = Object.keys(cat.units);
      fillSelect(fromSel, cat.names, keys[0]);
      fillSelect(toSel, cat.names, keys[1] || keys[0]);
      recompute();
    }

    function recompute() {
      const val = parseFloat(input.value);
      if (isNaN(val)) { output.value = ''; return; }
      const result = convertUnit(categorySel.value, fromSel.value, toSel.value, val);
      output.value = formatNumber(result);
    }

    categorySel.addEventListener('change', refreshUnitOptions);
    fromSel.addEventListener('change', recompute);
    toSel.addEventListener('change', recompute);
    input.addEventListener('input', recompute);
    swapBtn.addEventListener('click', () => {
      const tmp = fromSel.value;
      fromSel.value = toSel.value;
      toSel.value = tmp;
      recompute();
    });

    refreshUnitOptions();
    input.value = '1';
    recompute();
  }

  function formatNumber(n) {
    if (!isFinite(n)) return '';
    const abs = Math.abs(n);
    const decimals = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
    return parseFloat(n.toFixed(decimals)).toString();
  }

  async function initCurrencySubtab(root) {
    const fromSel = root.querySelector('#fxFrom');
    const toSel = root.querySelector('#fxTo');
    const amountInput = root.querySelector('#fxAmount');
    const output = root.querySelector('#fxOutput');
    const status = root.querySelector('#fxStatus');
    const swapBtn = root.querySelector('#fxSwap');
    const refreshBtn = root.querySelector('#fxRefresh');

    const ccyNames = Object.fromEntries(FX_CURRENCIES.map((c) => [c, c]));
    fillSelect(fromSel, ccyNames, 'USD');
    fillSelect(toSel, ccyNames, 'EUR');

    function recompute() {
      const val = parseFloat(amountInput.value);
      if (isNaN(val) || !fxCache) { output.value = ''; return; }
      try {
        output.value = formatNumber(convertCurrency(val, fromSel.value, toSel.value));
      } catch (e) {
        output.value = '';
      }
    }

    function renderStatus(loading) {
      if (loading) { status.textContent = 'Updating rates…'; return; }
      if (!fxCache) { status.textContent = 'Rates unavailable (offline, no cache yet).'; return; }
      const ageHrs = Math.round((Date.now() - fxCache.fetchedAt) / 3600000);
      status.textContent = `Rates as of ${fxCache.date} (1 USD base, fetched ${ageHrs === 0 ? 'just now' : ageHrs + 'h ago'}).`;
    }

    amountInput.addEventListener('input', recompute);
    fromSel.addEventListener('change', recompute);
    toSel.addEventListener('change', recompute);
    swapBtn.addEventListener('click', () => {
      const tmp = fromSel.value;
      fromSel.value = toSel.value;
      toSel.value = tmp;
      recompute();
    });
    refreshBtn.addEventListener('click', async () => {
      renderStatus(true);
      try {
        await fetchFreshRates();
      } catch (e) { /* keep old cache, just report below */ }
      renderStatus(false);
      recompute();
    });

    amountInput.value = '1';
    renderStatus(true);
    try {
      await ensureRates();
    } catch (e) {
      // truly first-run + offline: nothing to show yet
    }
    renderStatus(false);
    recompute();
  }

  function initConverterTab(root) {
    initUnitsSubtab(root);
    initCurrencySubtab(root);

    const subtabBtns = root.querySelectorAll('.subtab-btn');
    subtabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        subtabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        root.querySelectorAll('.subtab-panel').forEach((p) => p.classList.remove('active'));
        root.querySelector('#' + btn.dataset.target).classList.add('active');
      });
    });
  }

  window.ConverterTool = { init: initConverterTab, convertUnit, convertCurrency };
})();
