// =============================================
// Finlytics — Script (PRO Mode Enabled)
// Version: 2025-Q1
// =============================================

document.addEventListener("DOMContentLoaded", () => {

  // --- Utility Helpers ---
  const $ = (s) => document.querySelector(s);

  const fmtDKK = new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0
  });

  const fmtPct = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const toNum = (v) => {
    if (v == null) return 0;
    const x = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(x) ? x : 0;
  };

  const toPct = (v) => {
    if (v == null) return 0;
    const x = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(x) ? x : 0;
  };

  const monthlyFromAnnual = (a) => Math.pow(1 + a, 1 / 12) - 1;

  // --- DOM Elements ---
  const initialEl = $("#initial");
  const monthlyEl = $("#monthly");
  const yearsEl = $("#years");
  const expEl = $("#expReturn");
  const feePresetEl = $("#feePreset");
  const feesEl = $("#fees");

  const kContrib = $("#kpi-contrib");
  const kInterest = $("#kpi-interest");
  const kFinal = $("#kpi-final");
  const kCagr = $("#kpi-cagr");
  const chartCagr = $("#chart-cagr");

  // Premium output DOM hooks
  const ipRiskEl = $("#ip-risk-score");
  const ipSOptEl = $("#ip-s-opt");
  const ipSRealEl = $("#ip-s-real");
  const ipSPessEl = $("#ip-s-pess");
  const ipSuccessEl = $("#ip-success");
  const ipRecosEl = $("#ip-recos");

  const canvas = $("#area-chart");

  const volEl = $("#volatility");
  const simsEl = $("#simulations");
  const mcBtn = $("#mc-btn");
  const mcBody = $("#mc-table tbody");

  const btnPNG = $("#btn-save-png");
  const btnCSVYr = $("#btn-export-year");
  const btnCSVMc = $("#btn-export-mc");
  const btnShare = $("#btn-share");

  const btnReport = $("#btn-report-pdf-big");
  const btnClearAll = $("#btn-clear-data-big");

  const btnSaveA_small = $("#btn-save-scenario-a");
  const btnCompare_small = $("#btn-compare-with-a");
  const btnClear_small = $("#btn-clear-compare");
  const btnSaveA_big = $("#btn-save-a-big");
  const btnCompare_big = $("#btn-compare-big");
  const btnClear_big = $("#btn-clear-cmp-big");

  const cmpBox = $("#compare-summary");
  const cmpAFinal = $("#cmp-a-final");
  const cmpACagr = $("#cmp-a-cagr");
  const cmpBFinal = $("#cmp-b-final");
  const cmpBCagr = $("#cmp-b-cagr");

  const cmpKPIsBox = $("#compare-kpis");
  const cmpAContrib = $("#cmp-a-contrib");
  const cmpBContrib = $("#cmp-b-contrib");
  const cmpDContrib = $("#cmp-d-contrib");
  const cmpAGain = $("#cmp-a-gain");
  const cmpBGain = $("#cmp-b-gain");
  const cmpDGain = $("#cmp-d-gain");
  const cmpAFinal2 = $("#cmp-a-final-2");
  const cmpBFinal2 = $("#cmp-b-final-2");
  const cmpDFinal = $("#cmp-d-final");
  const cmpACagr2 = $("#cmp-a-cagr-2");
  const cmpBCagr2 = $("#cmp-b-cagr-2");
  const cmpDCagr = $("#cmp-d-cagr");

  // --- Fee presets ---
  const PRESETS = {
    manual: null,
    global_index: 0.20,
    danish_index: 0.50,
    etf_broker: 0.35,
    robo: 0.75,
    single_stocks: 0.00,
    crypto_hold: 0.00
  };

  let syncingFeesFromPreset = false;

  function setFeesFromPreset() {
    if (!feePresetEl || !feesEl) return;
    syncingFeesFromPreset = true;

    let p = PRESETS[feePresetEl.value];
    if ((p == null || Number.isNaN(p)) && feePresetEl.value !== "manual") {
      const t = feePresetEl.options[feePresetEl.selectedIndex]?.textContent || "";
      const m = t.replace(/\s+/g, "").match(/([0-9]+[.,][0-9]{1,2})/);
      if (m) p = parseFloat(m[1].replace(",", "."));
    }

    if (p == null || !Number.isFinite(p)) {
      syncingFeesFromPreset = false;
      return;
    }

    try {
      feesEl.valueAsNumber = p;
    } catch {}

    if (isNaN(feesEl.valueAsNumber)) feesEl.value = Number(p).toFixed(2);

    feesEl.step = "0.01";
    syncingFeesFromPreset = false;
  }

  feePresetEl?.addEventListener("change", setFeesFromPreset);
  feePresetEl?.addEventListener("input", setFeesFromPreset);

  // ======================================
  // Projection Core
  // ======================================
  function monthlyIRR(cashflows, maxIter = 100, tol = 1e-7) {
    function npv(r) {
      let v = 0;
      for (let t = 0; t < cashflows.length; t++)
        v += cashflows[t] / Math.pow(1 + r, t);
      return v;
    }

    let lo = -0.999, hi = 0.3;
    let fLo = npv(lo), fHi = npv(hi);

    if (fLo * fHi > 0) return null;

    for (let i = 0; i < maxIter; i++) {
      const mid = (lo + hi) / 2;
      const fM = npv(mid);

      if (Math.abs(fM) < tol) return mid;

      if (fM * fLo < 0) {
        hi = mid;
        fHi = fM;
      } else {
        lo = mid;
        fLo = fM;
      }
    }

    const root = (lo + hi) / 2;
    return (root > -0.9 && root < 0.3) ? root : null;
  }

  function computeProjection(initial, monthly, years, expPct, feePct) {
    const rA = toPct(expPct) / 100;
    const fA = toPct(feePct) / 100;
    const rM = monthlyFromAnnual(rA);
    const fM = monthlyFromAnnual(fA);

    let bal = initial;
    const rows = [];

    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        bal += monthly;
        bal *= (1 + rM);
        bal *= (1 - fM);
      }
      const contrib = initial + monthly * 12 * y;
      const gain = bal - contrib;

      rows.push({
        year: y,
        contrib,
        gain: Math.max(0, gain),
        balance: bal
      });
    }

    const months = years * 12;
    const flows = [-(initial + monthly)];
    for (let m = 1; m < months; m++) flows.push(-monthly);
    flows.push(bal);

    const rMonth = monthlyIRR(flows);
    const effAnnual = (rMonth != null && isFinite(rMonth))
      ? Math.pow(1 + rMonth, 12) - 1
      : null;

    const totalContrib = initial + monthly * 12 * years;

    return {
      rows,
      finalBalance: bal,
      totalContrib,
      totalGain: bal - totalContrib,
      effAnnual
    };
  }
  // ======================================
  // HiDPI Canvas Setup
  // ======================================

  function setupHiDPICanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(rect.width * dpr));
    cv.height = Math.max(1, Math.round(rect.height * dpr));

    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { ctx, W: rect.width, H: rect.height };
  }

  // ======================================
  // Drawing the Chart
  // ======================================

  function drawChart(rowsB, band = null, rowsA = null) {
    if (!canvas) return;
    const { ctx, W, H } = setupHiDPICanvas(canvas);
    ctx.clearRect(0, 0, W, H);

    if (!rowsB || !rowsB.length) return;

    const padL = 56, padR = 10, padT = 14, padB = 40;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const xs = rowsB.map(r => r.year);
    const ysB = rowsB.map(r => r.balance);
    const ysA = rowsA ? rowsA.map(r => r.balance) : [];

    const minY = 0;
    const maxY = Math.max(1, ...ysB, ...(ysA.length ? ysA : [1])) * 1.02;

    const x = (i) => padL + ((i - 1) / (xs.length - 1 || 1)) * innerW;
    const y = (v) => padT + (1 - ((v - minY) / (maxY - minY || 1))) * innerH;

    // Axes
    ctx.strokeStyle = "#94a3c9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - padB);
    ctx.lineTo(W - padR, H - padB);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, H - padB);
    ctx.stroke();

    // Monte Carlo band
    if (band && band.p10 && band.p90) {
      ctx.beginPath();
      ctx.moveTo(x(1), y(band.p10[0]));
      for (let i = 1; i < band.p10.length; i++)
        ctx.lineTo(x(i + 1), y(band.p10[i]));

      for (let i = band.p90.length - 1; i >= 0; i--)
        ctx.lineTo(x(i + 1), y(band.p90[i]));

      ctx.closePath();
      ctx.fillStyle = "rgba(255,165,0,0.22)";
      ctx.fill();
    }

    // Median line (Monte Carlo)
    if (band && band.p50) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,165,0,0.95)";
      ctx.lineWidth = 2;
      ctx.moveTo(x(1), y(band.p50[0]));
      for (let i = 1; i < band.p50.length; i++)
        ctx.lineTo(x(i + 1), y(band.p50[i]));
      ctx.stroke();
    }

    // Line B (current)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(108,168,255,1)";
    ctx.lineWidth = 2;
    ctx.moveTo(x(1), y(rowsB[0].balance));
    for (let i = 1; i < rowsB.length; i++)
      ctx.lineTo(x(i + 1), y(rowsB[i].balance));
    ctx.stroke();

    ctx.lineTo(x(rowsB.length), y(0));
    ctx.lineTo(x(1), y(0));
    ctx.closePath();
    ctx.fillStyle = "rgba(108,168,255,0.22)";
    ctx.fill();

    // Line A (saved scenario)
    if (rowsA && rowsA.length) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(99,230,190,1)";
      ctx.lineWidth = 2;
      ctx.moveTo(x(1), y(rowsA[0].balance));
      for (let i = 1; i < rowsA.length; i++)
        ctx.lineTo(x(i + 1), y(rowsA[i].balance));
      ctx.stroke();

      ctx.lineTo(x(rowsA.length), y(0));
      ctx.lineTo(x(1), y(0));
      ctx.closePath();
      ctx.fillStyle = "rgba(99,230,190,0.16)";
      ctx.fill();
    }

    // Contribution line
    const initial = toNum(initialEl.value);
    const monthly = toNum(monthlyEl.value);
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#55607a";

    for (let i = 0; i < rowsB.length; i++) {
      const xx = x(i + 1);
      const contrib = initial + monthly * 12 * (i + 1);
      const yy = y(contrib);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    // Axis labels (min / max)
    ctx.fillStyle = "#9fb0d1";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";

    ctx.textBaseline = "bottom";
    ctx.fillText(fmtDKK.format(0), padL + 6, H - padB - 2);

    ctx.textBaseline = "top";
    ctx.fillText(fmtDKK.format(rowsB[rowsB.length - 1].balance), padL + 6, padT + 2);
  }

  // ======================================
  // Table Rendering
  // ======================================

  function renderTable(rows) {
    const tbody = $("#year-table tbody");
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => (
      `<tr>
         <td>${r.year}</td>
         <td>${fmtDKK.format(r.contrib)}</td>
         <td>${fmtDKK.format(Math.max(0, r.gain))}</td>
         <td>${fmtDKK.format(r.balance)}</td>
       </tr>`
    )).join("");
  }

  // ======================================
  // Clear UI
  // ======================================

  function clearUI() {
    kContrib.textContent = fmtDKK.format(0);
    kInterest.textContent = fmtDKK.format(0);
    kFinal.textContent = fmtDKK.format(0);
    kCagr.textContent = "—";
    chartCagr.textContent = "—";

    const tbody = $("#year-table tbody");
    if (tbody) tbody.innerHTML = "";

    const tbody2 = $("#mc-table tbody");
    if (tbody2) tbody2.innerHTML = "";

    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    try { clearPremiumOutput(); } catch {}
  }
  // ======================================
  // Base Calculation Runner
  // ======================================

  let currentBand = null;

  function runBaseCalc() {
    const initial = toNum(initialEl.value);
    const monthly = toNum(monthlyEl.value);
    const years = Math.max(1, parseInt(yearsEl.value || "1", 10));
    const expPct = toPct(expEl.value);
    const feePct = toPct(feesEl.value);

    const res = computeProjection(initial, monthly, years, expPct, feePct);

    kContrib.textContent = fmtDKK.format(res.totalContrib);
    kInterest.textContent = fmtDKK.format(Math.max(0, res.totalGain));
    kFinal.textContent = fmtDKK.format(res.finalBalance);

    let eff = res.effAnnual;
    if (eff == null || !isFinite(eff)) {
      const rA = toPct(expEl.value) / 100;
      const fA = toPct(feesEl.value) / 100;
      eff = (1 + rA) / (1 + fA) - 1;
    }

    if (eff == null || !isFinite(eff) || isNaN(eff) || eff < -0.5) {
      kCagr.textContent = "—";
      chartCagr.textContent = "—";
    } else {
      const s = fmtPct.format(eff * 100) + " %";
      kCagr.textContent = s;
      chartCagr.textContent = s;
    }

    drawChart(res.rows, currentBand, null);
    renderTable(res.rows);

    try {
      updatePremiumOutput(res, initial, monthly, years, expPct, currentBand);
    } catch {}
  }


  function clearPremiumOutput() {
    if (!ipRiskEl || !ipSOptEl || !ipSRealEl || !ipSPessEl || !ipSuccessEl || !ipRecosEl) return;
    ipRiskEl.textContent = "—";
    ipSOptEl.textContent = "—";
    ipSRealEl.textContent = "—";
    ipSPessEl.textContent = "—";
    ipSuccessEl.textContent = "—";
    ipRecosEl.innerHTML = "<li>Indtast dine tal og tryk beregn for at se en vurdering.</li>";
  }

  function updatePremiumOutput(res, initial, monthly, years, expPct, band) {
    if (!ipRiskEl || !ipSOptEl || !ipSRealEl || !ipSPessEl || !ipSuccessEl || !ipRecosEl) return;

    const hasValid =
      Number.isFinite(res?.finalBalance) &&
      res.finalBalance > 0 &&
      Number.isFinite(monthly) &&
      years > 0 &&
      Number.isFinite(expPct);

    if (!hasValid) {
      clearPremiumOutput();
      return;
    }

    // Risk score
    try {
      const r = ip_calcRisk(monthly, years, expPct / 100);
      ipRiskEl.textContent = r + " / 100";
    } catch {
      ipRiskEl.textContent = "—";
    }

    // Scenarios based on final balance
    try {
      const scen = ip_calcScenarios(res.finalBalance);
      ipSOptEl.textContent = fmtDKK.format(scen.optim);
      ipSRealEl.textContent = fmtDKK.format(scen.real);
      ipSPessEl.textContent = fmtDKK.format(scen.pess);
    } catch {
      ipSOptEl.textContent = "—";
      ipSRealEl.textContent = "—";
      ipSPessEl.textContent = "—";
    }

    // Success chance – v1 placeholder: shows dash unless Monte Carlo band is present
    if (band && band.p50 && band.p50.length) {
      // Simple placeholder using helper so modellen kan udskiftes senere:
      const hits = Math.round((band.p50.length * 0.6));
      const total = Math.max(1, band.p50.length);
      try {
        ipSuccessEl.textContent = ip_successChance(hits, total);
      } catch {
        ipSuccessEl.textContent = "—";
      }
    } else {
      ipSuccessEl.textContent = "—";
    }

    // Recommendations – simple static v1 based on risk + tidshorisont
    const recos = [];
    const yearsSafe = Math.max(0, years);

    try {
      const rScore = parseInt(ipRiskEl.textContent, 10);
      if (!Number.isNaN(rScore)) {
        if (rScore < 30) {
          recos.push("Din risiko ser lav ud – du prioriterer stabilitet frem for maksimal vækst.");
        } else if (rScore < 70) {
          recos.push("Din risiko er moderat – en fornuftig balance mellem vækst og udsving.");
        } else {
          recos.push("Du ligger højt i risiko – vær sikker på at din tidshorisont og nattesøvn kan følge med.");
        }
      }
    } catch {}

    if (yearsSafe < 5) {
      recos.push("Kort tidshorisont – overvej at holde fokus på mere stabile investeringer.");
    } else if (yearsSafe >= 10) {
      recos.push("Lang tidshorisont – udsving undervejs er naturlige, men kan udjævnes over tid.");
    }

    if (!recos.length) {
      recos.push("Juster dine inputs for at få personlige anbefalinger.");
    }

    ipRecosEl.innerHTML = recos.map(txt => `<li>${txt}</li>`).join("");
  }

  // ======================================
  // Tips
  // ======================================

  function initTips() {
    document.querySelectorAll(".tip").forEach(el => {
      const btn = el.querySelector(".tip-btn");
      const tip = el.querySelector(".tooltip");
      if (!btn || !tip) return;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".tip.open").forEach(o => {
          if (o !== el) o.classList.remove("open");
        });
        el.classList.toggle("open");
      });
    });

    document.addEventListener("click", () => {
      document.querySelectorAll(".tip.open").forEach(o => o.classList.remove("open"));
    });
  }

  // ======================================
  // CSV + PNG + Share
  // ======================================

  const toCSV = (rows, headers) => {
    const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const head = headers.map(esc).join(',');
    const body = rows.map(r => r.map(esc).join(',')).join('\n');
    return head + "\n" + body;
  };

  function download(filename, content, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  btnPNG?.addEventListener("click", () => {
    if (!canvas) return;
    const dataURL = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = "finlytics-chart.png";
    a.click();
  });

  btnCSVYr?.addEventListener("click", () => {
    const tbody = $("#year-table tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"))
      .map(tr => Array.from(tr.children).map(td => td.textContent));
    download("finlytics-year.csv",
      toCSV(rows, ["År", "Samlet indskud", "Afkast", "Saldo"]),
      "text/csv"
    );
  });

  btnCSVMc?.addEventListener("click", () => {
    if (!mcBody || !mcBody.children.length) return;
    const rows = Array.from(mcBody.querySelectorAll("tr"))
      .map(tr => Array.from(tr.children).map(td => td.textContent));
    download("finlytics-montecarlo.csv",
      toCSV(rows, ["År", "P10", "P50", "P90"]),
      "text/csv"
    );
  });

  btnShare?.addEventListener("click", async function () {
    const params = new URLSearchParams({
      initial: String(initialEl?.value || ""),
      monthly: String(monthlyEl?.value || ""),
      years: String(yearsEl?.value || ""),
      exp: String(expEl?.value || ""),
      fees: String(feesEl?.value || ""),
      feePreset: String(feePresetEl?.value || ""),
      vol: String(volEl?.value || ""),
      sims: String(simsEl?.value || "")
    });

    const link = location.origin + location.pathname + "?" + params.toString();

    try {
      await navigator.clipboard.writeText(link);
      this.textContent = "Kopieret!";
      setTimeout(() => this.textContent = "Del", 1200);
    } catch {
      alert("Link: " + link);
    }
  });

  // ======================================
  // CLEAR ALL
  // ======================================

  function handleClearAll() {
    try {
      ["#initial", "#monthly", "#years", "#expReturn",
       "#fees", "#volatility", "#simulations"]
        .forEach(sel => {
          const el = $(sel);
          if (el) el.value = "";
        });

      if (feePresetEl) feePresetEl.value = "manual";

      try {
        localStorage.removeItem("scenarioA");
      } catch {}

      if (cmpBox) cmpBox.hidden = true;
      if (cmpKPIsBox) cmpKPIsBox.hidden = true;

      currentBand = null;
      clearUI();

      if (location.search)
        history.replaceState(null, "", location.pathname);

    } catch (e) {
      console.error(e);
    }
  }
  // ======================================
  // Monte Carlo Simulation
  // ======================================

  function randn() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function simulateMC(years, rA, fA, initial, monthly, sims, sigPct) {
    const muM = monthlyFromAnnual(rA);
    const feeM = monthlyFromAnnual(fA);
    const sigM = (sigPct / 100) / Math.sqrt(12);

    const p10 = [], p50 = [], p90 = [];

    for (let y = 1; y <= years; y++) {
      const vals = [];

      for (let s = 0; s < sims; s++) {
        let bal = initial;

        for (let yy = 1; yy <= y; yy++) {
          for (let m = 0; m < 12; m++) {
            bal += monthly;
            const r = muM + sigM * randn();
            bal *= (1 + r);
            bal *= (1 - feeM);
          }
        }
        vals.push(bal);
      }

      vals.sort((a, b) => a - b);

      const q = (p) => vals[Math.max(0, Math.min(vals.length - 1,
        Math.floor((vals.length - 1) * p)))];

      p10.push(q(0.10));
      p50.push(q(0.50));
      p90.push(q(0.90));
    }

    return { p10, p50, p90 };
  }

  // ======================================
  // Snapshot inputs for saving/loading A
  // ======================================

  function snapshotInputs() {
    return {
      initial: String(initialEl?.value || ""),
      monthly: String(monthlyEl?.value || ""),
      years: String(yearsEl?.value || ""),
      exp: String(expEl?.value || ""),
      fees: String(feesEl?.value || ""),
      feePreset: String(feePresetEl?.value || ""),
      vol: String(volEl?.value || ""),
      sims: String(simsEl?.value || "")
    };
  }

  function loadA() {
    try {
      const raw = localStorage.getItem("scenarioA");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveA(obj) {
    try {
      localStorage.setItem("scenarioA", JSON.stringify(obj));
    } catch {}
  }

  function cagrStr(res, expPct, feePct) {
    let eff = res.effAnnual;

    if (eff == null || !isFinite(eff)) {
      const rA = toPct(expPct) / 100;
      const fA = toPct(feePct) / 100;
      eff = (1 + rA) / (1 + fA) - 1;
    }

    if (eff == null || !isFinite(eff) || isNaN(eff) || eff < -0.5)
      return "—";

    return fmtPct.format(eff * 100) + " %";
  }

  // ======================================
  // Save Scenario A
  // ======================================

  function handleSaveA() {
    const snap = snapshotInputs();
    saveA(snap);

    if (btnSaveA_big) {
      const t = btnSaveA_big.textContent;
      btnSaveA_big.textContent = "A gemt ✓";
      setTimeout(() => btnSaveA_big.textContent = t, 1000);
    }

    if (cmpBox) {
      cmpBox.hidden = false;
      cmpAFinal.textContent = "—";
      cmpACagr.textContent = "—";
      cmpBFinal.textContent = "—";
      cmpBCagr.textContent = "—";
    }

    if (cmpKPIsBox) cmpKPIsBox.hidden = true;
  }

  // ======================================
  // Compare A ↔ B
  // ======================================

  function handleCompare() {
    const A = loadA();

    if (!A) {
      [btnCompare_small, btnCompare_big].forEach(b => {
        if (!b) return;
        const t = b.textContent;
        b.textContent = "Gem A først";
        setTimeout(() => b.textContent = t, 1000);
      });
      return;
    }

    const initB = toNum(initialEl.value);
    const monB = toNum(monthlyEl.value);
    const yrsB = Math.max(1, parseInt(yearsEl.value || "1", 10));
    const expB = toPct(expEl.value);
    const feeB = toPct(feesEl.value);

    const initA = toNum(A.initial);
    const monA = toNum(A.monthly);
    const yrsA = Math.max(1, parseInt(A.years || "1", 10));
    const expA = toPct(A.exp);
    const feeA = toPct(A.fees);

    const resB = computeProjection(initB, monB, yrsB, expB, feeB);
    const resA = computeProjection(initA, monA, yrsA, expA, feeA);

    currentBand = null;
    drawChart(resB.rows, null, resA.rows);

    // Summary box
    if (cmpBox) {
      cmpBox.hidden = false;
      cmpAFinal.textContent = fmtDKK.format(resA.finalBalance);
      cmpACagr.textContent = cagrStr(resA, expA, feeA);
      cmpBFinal.textContent = fmtDKK.format(resB.finalBalance);
      cmpBCagr.textContent = cagrStr(resB, expB, feeB);
    }

    // Detailed table
    if (cmpKPIsBox) {
      const gainA = Math.max(0, resA.totalGain);
      const gainB = Math.max(0, resB.totalGain);

      const diffContrib = resB.totalContrib - resA.totalContrib;
      const diffGain = gainB - gainA;
      const diffFinal = resB.finalBalance - resA.finalBalance;

      const sA = cagrStr(resA, expA, feeA);
      const sB = cagrStr(resB, expB, feeB);

      const pp = (sA === "—" || sB === "—")
        ? "—"
        : fmtPct.format(
            parseFloat(sB.replace(",", ".")) -
            parseFloat(sA.replace(",", "."))
          ) + " pp";

      cmpAContrib.textContent = fmtDKK.format(resA.totalContrib);
      cmpBContrib.textContent = fmtDKK.format(resB.totalContrib);
      cmpDContrib.textContent =
        (diffContrib >= 0 ? "+" : "") +
        fmtDKK.format(Math.abs(diffContrib)).replace("kr.", "kr.");

      cmpAGain.textContent = fmtDKK.format(gainA);
      cmpBGain.textContent = fmtDKK.format(gainB);
      cmpDGain.textContent =
        (diffGain >= 0 ? "+" : "") +
        fmtDKK.format(Math.abs(diffGain)).replace("kr.", "kr.");

      cmpAFinal2.textContent = fmtDKK.format(resA.finalBalance);
      cmpBFinal2.textContent = fmtDKK.format(resB.finalBalance);
      cmpDFinal.textContent =
        (diffFinal >= 0 ? "+" : "") +
        fmtDKK.format(Math.abs(diffFinal)).replace("kr.", "kr.");

      cmpACagr2.textContent = sA;
      cmpBCagr2.textContent = sB;
      cmpDCagr.textContent = pp;

      cmpKPIsBox.hidden = false;
    }
  }

  // ======================================
  // Clear comparison
  // ======================================

  function handleClearCompare() {
    currentBand = null;
    runBaseCalc();
    if (cmpBox) cmpBox.hidden = true;
    if (cmpKPIsBox) cmpKPIsBox.hidden = true;
  }
  // ======================================
  // PDF PRO GENERATOR (2-SIDED)
  // ======================================

  function makePDFReport() {
    try {
      const chart = $("#area-chart");
      const chartImg = chart ? chart.toDataURL("image/png") : null;

      const now = new Date().toLocaleString("da-DK");

      const kpiContrib = kContrib.textContent;
      const kpiInterest = kInterest.textContent;
      const kpiFinal = kFinal.textContent;
      const kpiCagrTxt = kCagr.textContent;

      const years = $("#year-table tbody");
      const yearRows = years ? Array.from(years.children) : [];

      const win = window.open("", "_blank");
      if (!win) return;

      win.document.write(`
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Finlytics – PRO Rapport</title>
        <style>

        body {
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
          padding: 28px;
          color: #111;
          margin: 0;
        }

        h1 {
          font-size: 26px;
          margin: 0 0 6px;
        }
        h2 {
          margin: 20px 0 10px;
          font-size: 20px;
        }
        h3 {
          margin: 16px 0 6px;
          font-size: 16px;
          color: #444;
        }

        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 12px;
        }

        .card {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 14px;
          background: #fafafa;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        th, td {
          padding: 6px 4px;
          border-bottom: 1px solid #e4e4e4;
          text-align: left;
        }

        th {
          font-weight: 600;
          color: #444;
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(140px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .kpi {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 10px;
          background: white;
        }
        .kpi b {
          font-size: 12px;
          color: #666;
        }
        .kpi div {
          font-size: 17px;
          font-weight: 700;
          margin-top: 4px;
        }

        .chart-box {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 12px;
          margin-top: 10px;
        }

        .page-break {
          page-break-before: always;
          margin-top: 40px;
        }

        .foot {
          margin-top: 25px;
          font-size: 12px;
          color: #777;
          text-align: left;
        }

        </style>
      </head>

      <body>

      <!-- PAGE 1 -->
      <h1>Finlytics — Investeringsrapport</h1>
      <div style="font-size:14px;color:#555;margin-bottom:6px;">
        Genereret: ${now}
      </div>

      <div class="grid2">
        <div class="card">
          <h2>Inputs</h2>
          <table>
            <tr><th>Startbeløb</th><td>${initialEl.value || ""} kr</td></tr>
            <tr><th>Månedligt indskud</th><td>${monthlyEl.value || ""} kr</td></tr>
            <tr><th>Antal år</th><td>${yearsEl.value || ""}</td></tr>
            <tr><th>Forventet afkast</th><td>${expEl.value || ""} %</td></tr>
            <tr><th>Årlige omkostninger</th><td>${feesEl.value || ""} %</td></tr>
            <tr><th>Preset</th><td>${feePresetEl.value || "–"}</td></tr>
          </table>
        </div>

        <div class="card">
          <h2>KPI’er</h2>
          <div class="kpis">
            <div class="kpi"><b>Total indskud</b><div>${kpiContrib}</div></div>
            <div class="kpi"><b>Rentegevinst</b><div>${kpiInterest}</div></div>
            <div class="kpi"><b>Slutværdi</b><div>${kpiFinal}</div></div>
            <div class="kpi"><b>Effektiv årlig afkast</b><div>${kpiCagrTxt}</div></div>
          </div>
        </div>
      </div>

      <div class="chart-box">
        <h2>Udviklingsgraf</h2>
        ${chartImg ? `<img src="${chartImg}" style="max-width:100%;height:auto;">` : "<i>Ingen graf</i>"}
      </div>

      <div class="foot">
        Side 1 / 2 — Finlytics (www.finlytics.dk)
      </div>

      <!-- PAGE 2 -->
      <div class="page-break"></div>
      <h2>År-for-år udvikling</h2>

      <table>
        <thead>
          <tr><th>År</th><th>Indskud</th><th>Afkast</th><th>Saldo</th></tr>
        </thead>
        <tbody>
          ${
            yearRows.length
              ? yearRows.map(r => "<tr>" + r.innerHTML + "</tr>").join("")
              : "<tr><td colspan='4'>Ingen data</td></tr>"
          }
        </tbody>
      </table>

      <h3>Noter</h3>
      <p style="font-size:14px;line-height:1.6;color:#555;">
        Denne rapport er baseret på simple fremskrivninger, renters rente og valgte afkast/risiko.
        Faktiske markedsafkast kan variere betydeligt.
      </p>

      <div class="foot">
        Side 2 / 2 — Finlytics (www.finlytics.dk)
      </div>

      <script>
        window.addEventListener('load', () => setTimeout(() => window.print(), 250));
      </script>

      </body>
      </html>
      `);

      win.document.close();

    } catch (e) {
      console.error(e);
      alert("Kunne ikke generere PDF-rapport.");
    }
  }

  // ======================================
  // EVENT LISTENERS
  // ======================================

  $("#calc-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    currentBand = null;
    runBaseCalc();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" &&
        document.activeElement &&
        document.activeElement.tagName === "INPUT") {
      e.preventDefault();
      currentBand = null;
      runBaseCalc();
    }
  });

  initTips();

  [btnSaveA_small, btnSaveA_big].forEach(b => b?.addEventListener("click", handleSaveA));
  [btnCompare_small, btnCompare_big].forEach(b => b?.addEventListener("click", handleCompare));
  [btnClear_small, btnClear_big].forEach(b => b?.addEventListener("click", handleClearCompare));

  btnReport?.addEventListener("click", (e) => {
    e.preventDefault();
    makePDFReport();
  });

  btnClearAll?.addEventListener("click", (e) => {
    e.preventDefault();
    handleClearAll();
  });

  const touchManual = () => {
    if (feePresetEl && feePresetEl.value !== "manual")
      feePresetEl.value = "manual";
  };

  feesEl?.addEventListener("input", touchManual);
  feesEl?.addEventListener("change", touchManual);

  mcBtn?.addEventListener("click", () => {
    const years = Math.max(1, parseInt(yearsEl.value || "1", 10));
    const rA = toPct(expEl.value) / 100;
    const fA = toPct(feesEl.value) / 100;

    const initial = toNum(initialEl.value);
    const monthly = toNum(monthlyEl.value);

    const sims = Math.min(3000, Math.max(50,
      parseInt(simsEl.value || "1000", 10)
    ));

    const vol = Math.max(0, toPct(volEl.value));

    const band = simulateMC(years, rA, fA, initial, monthly, sims, vol);

    currentBand = band;

    const base = computeProjection(initial, monthly, years,
      toPct(expEl.value), toPct(feesEl.value)
    );

    drawChart(base.rows, currentBand, null);

    if (mcBody) {
      mcBody.innerHTML = base.rows
        .map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${fmtDKK.format(band.p10[i])}</td>
            <td>${fmtDKK.format(band.p50[i])}</td>
            <td>${fmtDKK.format(band.p90[i])}</td>
          </tr>
        `).join("");
    }
  });

  // ======================================
  // INIT
  // ======================================

  (function init() {
    document.querySelectorAll("input")
      .forEach(inp => inp.setAttribute("autocomplete", "off"));

    if (feePresetEl && feePresetEl.value !== "manual")
      setFeesFromPreset();

    clearUI();
  })();

});
