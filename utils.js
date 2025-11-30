// utils.js
// ==========================================
// Fælles hjælpefunktioner til alle Finlytics-værktøjer
// Global namespace: window.Finlytics
// ==========================================

(function () {
  // Undgå at overskrive, hvis noget andet allerede har lavet Finlytics
  const root = (window.Finlytics = window.Finlytics || {});

  // -------------------------------------------------
  // DOM helpers
  // -------------------------------------------------
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  // -------------------------------------------------
  // Number parsing & formatting
  // -------------------------------------------------
  const numberFormatter0 = new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: 0
  });

  const currencyFormatter = new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0
  });

  const percentFormatter = new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: 1
  });

  /**
   * Parser tal fra inputfelter.
   * Accepterer både komma og punktum og ignorerer mellemrum.
   */
  function parseNumber(value, fallback = 0) {
    if (value == null) return fallback;
    const normalized = String(value)
      .replace(/\./g, "")    // 10.000 -> 10000
      .replace(/\s/g, "")    // fjern mellemrum
      .replace(",", ".");    // 2,5 -> 2.5

    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Formaterer heltal uden decimals – fx 10.000 */
  function formatInteger(value) {
    return numberFormatter0.format(value || 0);
  }

  /** Formaterer DKK – fx 10.000 kr. */
  function formatDKK(value) {
    return currencyFormatter.format(value || 0);
  }

  /** Formaterer procent – fx 7,5 % */
  function formatPercent(value) {
    return `${percentFormatter.format(value || 0)} %`;
  }

  // -------------------------------------------------
  // Input helpers
  // -------------------------------------------------

  /**
   * Læs tal direkte fra et <input>, med fallback.
   */
  function readNumberInput(inputEl, fallback = 0) {
    if (!inputEl) return fallback;
    return parseNumber(inputEl.value, fallback);
  }

  /**
   * Synkron helper: skriv en pæn formateret værdi tilbage i et input.
   * (Bruges hvis du senere vil auto-formatere felter on blur.)
   */
  function writeNumberInput(inputEl, value) {
    if (!inputEl) return;
    inputEl.value = formatInteger(value);
  }

  // -------------------------------------------------
  // Små generelle helpers
  // -------------------------------------------------
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // -------------------------------------------------
  // Export på globalt namespace
  // -------------------------------------------------
  root.utils = {
    $,
    $$,
    parseNumber,
    formatInteger,
    formatDKK,
    formatPercent,
    readNumberInput,
    writeNumberInput,
    clamp
  };
})();
