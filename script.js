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
  const ipRiskScoreEl = document.querySelector("#ip-risk-score");
  const ipRiskTextEl = document.querySelector("#ip-risk-text");
  const ipSOptEl = document.querySelector("#ip-s-opt");
  const ipSRealEl = document.querySelector("#ip-s-real");
  const ipSPessEl = document.querySelector("#ip-s-pess");
  const ipSuccessEl = document.querySelector("#ip-success");
  const ipRecosEl = document.querySelector("#ip-recos");

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

        updateIpPremiumOutput(res, monthly, years, expPct);

    drawChart(res.rows, currentBand, null);
    renderTable(res.rows);
  }

  
  // ======================================
  // Premium Output – Investment Planner
  // ======================================

  function ipCalcRisk(monthly, years, expPct){
    const m = Math.max(0, monthly);
    const y = Math.max(1, years);
    const r = Math.max(0, expPct);

    // Simpel heuristik: mere tid og højere månedlig indbetaling dæmper risiko
    let risk = r * 1.8 - y * 0.9 - (m / 1200);
    if (!Number.isFinite(risk)) risk = 0;
    risk = Math.max(0, Math.min(100, risk));
    return risk;
  }

  function ipCalcScenarios(finalBalance){
    const base = Math.max(0, finalBalance || 0);
    return {
      pessimistic: base * 0.7,
      realistic: base,
      optimistic: base * 1.3
    };
  }

  function ipCalcSuccessChance(years, expPct){
    const y = Math.max(1, years);
    const r = Math.max(0, expPct);
    // Simpel model: længere tid og moderat afkast giver højere "success"
    let score = 40 + (y * 2) + (r * 1.5);
    score = Math.max(0, Math.min(98, score));
    return score;
  }

  function ipBuildRecommendations(riskScore, years, monthly){
    const recos = [];
    const y = Math.max(1, years);
    const m = Math.max(0, monthly);

    if (riskScore <= 30){
      recos.push("Din risiko ser fornuftig ud – fokusér på at holde din plan stabil.");
    } else if (riskScore <= 60){
      recos.push("Din risiko er moderat – overvej om løbetid eller månedligt beløb passer til din mavefornemmelse.");
    } else {
      recos.push("Din risiko er høj – overvej lavere forventet afkast eller længere tidshorisont.");
    }

    if (m < 1000){
      recos.push("Et lidt højere månedligt indskud kan gøre en stor forskel på lang sigt.");
    } else if (m > 5000){
      recos.push("Du indbetaler allerede et relativt højt beløb hver måned – sørg for at din øvrige økonomi også hænger sammen.");
    }

    if (y < 10){
      recos.push("En længere tidshorisont kan gøre din plan mere robust mod udsving.");
    } else if (y > 25){
      recos.push("Din tidshorisont er lang – sørg for løbende at justere planen, når din situation ændrer sig.");
    }

    if (!recos.length){
      recos.push("Din plan ser balanceret ud – husk at gennemgå den jævnligt.");
    }
    return recos;
  }

  function updateIpPremiumOutput(res, monthly, years, expPct){
    if (!ipRiskScoreEl || !ipRiskTextEl || !ipSOptEl || !ipSRealEl || !ipSPessEl || !ipSuccessEl || !ipRecosEl){
      return;
    }

    const finalBalance = res && res.finalBalance ? res.finalBalance : 0;
    if (!Number.isFinite(finalBalance) || finalBalance <= 0){
      ipRiskScoreEl.textContent = "—";
      ipRiskTextEl.textContent = "Indtast dine tal og beregn for at se en samlet vurdering.";
      ipSOptEl.textContent = "—";
      ipSRealEl.textContent = "—";
      ipSPessEl.textContent = "—";
      ipSuccessEl.textContent = "—";
      ipRecosEl.innerHTML = "";
      return;
    }

    const risk = Math.round(ipCalcRisk(monthly, years, expPct));
    ipRiskScoreEl.textContent = risk;

    let riskLabel = "";
    if (risk <= 30) riskLabel = "Lav til moderat risiko baseret på din tidshorisont og forventede afkast.";
    else if (risk <= 60) riskLabel = "Middel risiko – typisk for en balanceret langsigtet investeringsplan.";
    else riskLabel = "Høj risiko – vær opmærksom på udsving og justér ved behov.";
    ipRiskTextEl.textContent = riskLabel;

    const scen = ipCalcScenarios(finalBalance);
    ipSOptEl.textContent = fmtDKK.format(Math.round(scen.optimistic));
    ipSRealEl.textContent = fmtDKK.format(Math.round(scen.realistic));
    ipSPessEl.textContent = fmtDKK.format(Math.round(scen.pessimistic));

    const success = Math.round(ipCalcSuccessChance(years, expPct));
    ipSuccessEl.textContent = success + " %";

    const recos = ipBuildRecommendations(risk, years, monthly);
    ipRecosEl.innerHTML = "";
    recos.forEach(txt => {
      const li = document.createElement("li");
      li.textContent = txt;
      ipRecosEl.appendChild(li);
    });
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
  // PDF v2 – Investment Planner Rapport
  // ======================================

  function buildInvestmentPdfData() {
    const graphCanvas = document.getElementById("area-chart");
    const graphImg = graphCanvas && graphCanvas.toDataURL ? graphCanvas.toDataURL("image/png") : null;

    const yearBody = document.querySelector("#year-table tbody");
    const table = [];
    if (yearBody) {
      yearBody.querySelectorAll("tr").forEach((tr) => {
        const cells = Array.from(tr.children).map((td) => (td.textContent || "").trim());
        table.push(cells);
      });
    }

    const kpis = [
      { label: "Samlet indskud", value: kContrib?.textContent || "" },
      { label: "Rentegevinst", value: kInterest?.textContent || "" },
      { label: "Slutværdi", value: kFinal?.textContent || "" },
      { label: "Anslået årligt afkast (vejledende)", value: kCagr?.textContent || "" }
    ];

    const recos = [];
    if (ipRecosEl) {
      ipRecosEl.querySelectorAll("li").forEach((li) => {
        const txt = (li.textContent || "").trim();
        if (txt) recos.push(txt);
      });
    }

    return {
      title: "Investeringsrapport",
      subtitle: "Vejledende rapport baseret på dine nuværende input og beregninger i Finlytics Investment Planner.",
      kpis: kpis,
      graph: graphImg,
      table: table,
      premium: {
        riskScore: ipRiskScoreEl ? (ipRiskScoreEl.textContent || "–") : "–",
        errorRisk: null,
        successChance: ipSuccessEl ? (ipSuccessEl.textContent || "–") : "",
        optimistic: ipSOptEl ? (ipSOptEl.textContent || "–") : "",
        realistic: ipSRealEl ? (ipSRealEl.textContent || "–") : "",
        pessimistic: ipSPessEl ? (ipSPessEl.textContent || "–") : "",
        recommendations: recos
      },
      cta: "Brug denne rapport som udgangspunkt for dine egne vurderinger, og justér dine tal løbende, når din økonomi ændrer sig."
    };
  }

  function makePDFReport() {
    try {
      const data = buildInvestmentPdfData();
      if (window.FinlyticsPDF && typeof window.FinlyticsPDF.generatePDF === "function") {
        window.FinlyticsPDF.generatePDF("investment", data);
      } else if (typeof window.generatePDF === "function") {
        window.generatePDF("investment", data);
      } else {
        alert("PDF-funktionen er ikke tilgængelig endnu.");
      }
    } catch (err) {
      console.error("PDF fejl (investment)", err);
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
