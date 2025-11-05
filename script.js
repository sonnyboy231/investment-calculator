// ============== Investment Calculator – Clean Script ==============

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const cfDK = new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 });
  const pctFmt = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // ---------- DOM refs ----------
  const initialEl = $("#initial");
  const monthlyEl = $("#monthly");
  const yearsEl   = $("#years");
  const expEl     = $("#expReturn");
  const feePresetEl = $("#feePreset");
  const feesEl    = $("#fees");
  const calcForm  = $("#calc-form");

  // KPI
  const kContrib  = $("#kpi-contrib");
  const kInterest = $("#kpi-interest");
  const kFinal    = $("#kpi-final");
  const kCagr     = $("#kpi-cagr");
  const chartCagr = $("#chart-cagr");

  // Chart
  const canvas = $("#area-chart");

  // MC
  const volEl  = $("#volatility");
  const simsEl = $("#simulations");
  const mcBtn  = $("#mc-btn");
  const mcBody = $("#mc-table tbody");

  // Chart tools
  const btnPNG   = $("#btn-save-png");
  const btnCSVYr = $("#btn-export-year");
  const btnCSVMc = $("#btn-export-mc");
  const btnShare = $("#btn-share");

  // ---------- Fee presets (super-stabil) ----------
  const PRESETS = {
    manual: null,
    global_index: 0.20,
    danish_index: 0.50,
    etf_broker: 0.35,
    robo: 0.75,
    single_stocks: 0.00,
    crypto_hold: 0.00,
  };

  function setFeesFromPreset() {
    if (!feePresetEl || !feesEl) return;

    // 1) mapping
    let p = PRESETS[feePresetEl.value];

    // 2) fallback: parse fra option-label "~0,35 %"
    if ((p == null || Number.isNaN(p)) && feePresetEl.value !== "manual") {
      const t = feePresetEl.options[feePresetEl.selectedIndex]?.textContent || "";
      const m = t.replace(/\s+/g, "").match(/([0-9]+[.,][0-9]{1,2})/);
      if (m) p = parseFloat(m[1].replace(",", "."));
    }

    // 3) manual eller intet fundet → rør ikke feltet
    if (p == null || !Number.isFinite(p)) return;

    // 4) skriv sikkert til number input
    try { feesEl.valueAsNumber = p; } catch (_) {}
    if (isNaN(feesEl.valueAsNumber)) {
      feesEl.value = Number(p).toFixed(2); // dot-decimal; DK UI viser 0,35
    }
    feesEl.step = "0.01";

    // 5) trig beregning
    feesEl.dispatchEvent(new Event("input", { bubbles: true }));
    feesEl.dispatchEvent(new Event("change", { bubbles: true }));
    runBaseCalc();
  }

  feePresetEl?.addEventListener("change", setFeesFromPreset);
  feePresetEl?.addEventListener("input", setFeesFromPreset);

  // ---------- Math / IRR ----------
  function monthlyIRR(cashflows, maxIter = 100, tol = 1e-7) {
    function npv(r) {
      let v = 0;
      for (let t = 0; t < cashflows.length; t++) v += cashflows[t] / Math.pow(1 + r, t);
      return v;
    }
    let lo = -0.999, hi = 0.3; // månedlig r
    let fLo = npv(lo), fHi = npv(hi);
    if (fLo * fHi > 0) return null; // ingen fortegnsskift

    for (let i = 0; i < maxIter; i++) {
      const mid = (lo + hi) / 2, fM = npv(mid);
      if (Math.abs(fM) < tol) return mid;
      if (fM * fLo < 0) { hi = mid; fHi = fM; } else { lo = mid; fLo = fM; }
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
        bal += monthly;            // deposit start of month
        bal *= (1 + rM);           // growth
        bal *= (1 - fM);           // fee
      }
      const contrib = initial + monthly * 12 * y;
      const gain = bal - contrib;
      rows.push({ year: y, contrib, gain: Math.max(0, gain), balance: bal });
    }

    // IRR flows: t=0 indeholder initial + første måneds indskud (start)
    const months = years * 12;
    const flows = [-(initial + monthly)];
    for (let m = 1; m < months; m++) flows.push(-monthly);
    flows.push(bal);

    const rMonth = monthlyIRR(flows);
    const effAnnual = (rMonth != null && isFinite(rMonth)) ? Math.pow(1 + rMonth, 12) - 1 : null;

    const totalContrib = initial + monthly * 12 * years;
    return {
      rows,
      finalBalance: bal,
      totalContrib,
      totalGain: bal - totalContrib,
      effAnnual
    };
  }

  // ---------- Chart ----------
  function setupHiDPICanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W: rect.width, H: rect.height };
  }

  function drawChart(rows, band) {
    if (!canvas) return;
    const { ctx, W, H } = setupHiDPICanvas(canvas);
    ctx.clearRect(0, 0, W, H);
    if (!rows.length) return;

    const padL = 56, padR = 10, padT = 14, padB = 40;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const xs = rows.map(r => r.year);
    const ys = rows.map(r => r.balance);
    const minY = 0;
    const maxY = Math.max(1, ...ys) * 1.02;

    const x = (i) => padL + ((i - 1) / (xs.length - 1 || 1)) * innerW;
    const y = (v) => padT + (1 - (v - minY) / (maxY - minY || 1)) * innerH;

    // Axes
    ctx.strokeStyle = "#9aa0a6";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.stroke();

    // MC band
    if (band && band.p10 && band.p90) {
      ctx.beginPath();
      ctx.moveTo(x(1), y(band.p10[0]));
      for (let i = 1; i < band.p10.length; i++) ctx.lineTo(x(i + 1), y(band.p10[i]));
      for (let i = band.p90.length - 1; i >= 0; i--) ctx.lineTo(x(i + 1), y(band.p90[i]));
      ctx.closePath();
      ctx.fillStyle = "rgba(255,165,0,0.25)";
      ctx.fill();
    }

    if (band && band.p50) {
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,165,0,0.9)";
      ctx.moveTo(x(1), y(band.p50[0]));
      for (let i = 1; i < band.p50.length; i++) ctx.lineTo(x(i + 1), y(band.p50[i]));
      ctx.stroke();
    }

    // Value (blue) + area
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(140,180,255,1)";
    ctx.moveTo(x(1), y(rows[0].balance));
    for (let i = 1; i < rows.length; i++) ctx.lineTo(x(i + 1), y(rows[i].balance));
    ctx.stroke();
    ctx.lineTo(x(rows.length), y(0));
    ctx.lineTo(x(1), y(0));
    ctx.closePath();
    ctx.fillStyle = "rgba(120,160,240,0.25)";
    ctx.fill();

    // Contribution (grey)
    const initial = toNum(initialEl.value);
    const monthly = toNum(monthlyEl.value);
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#555";
    for (let i = 0; i < rows.length; i++) {
      const xx = x(i + 1);
      const contrib = initial + monthly * 12 * (i + 1);
      const yy = y(contrib);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    // Y labels inside
    ctx.fillStyle = "#9fb0d1";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(cfDK.format(0), padL + 6, H - padB - 2);
    ctx.textBaseline = "top";
    ctx.fillText(cfDK.format(rows[rows.length - 1].balance), padL + 6, padT + 2);
  }

  function renderTable(rows) {
    const tbody = document.querySelector("#year-table tbody");
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => (
      `<tr>
        <td>${r.year}</td>
        <td>${cfDK.format(r.contrib)}</td>
        <td>${cfDK.format(r.gain)}</td>
        <td>${cfDK.format(r.balance)}</td>
      </tr>`
    )).join("");
  }

  // ---------- Run calc ----------
  let currentBand = null;

  function runBaseCalc() {
    const initial = toNum(initialEl.value);
    const monthly = toNum(monthlyEl.value);
    const years   = Math.max(1, parseInt(yearsEl.value || "1", 10));
    const expPct  = toPct(expEl.value);
    const feePct  = toPct(feesEl.value);

    const res = computeProjection(initial, monthly, years, expPct, feePct);

    kContrib.textContent  = cfDK.format(res.totalContrib);
    kInterest.textContent = cfDK.format(Math.max(0, res.totalGain));
    kFinal.textContent    = cfDK.format(res.finalBalance);

    // IRR -> annual %, fallback til netto sats
    let eff = res.effAnnual;
    if (eff == null || !isFinite(eff)) {
      const rA = toPct(expEl.value)/100;
      const fA = toPct(feesEl.value)/100;
      eff = (1 + rA) / (1 + fA) - 1;
    }
    const cagrStr = `${pctFmt.format(eff * 100)} %`;
    kCagr.textContent = cagrStr;
    chartCagr.textContent = cagrStr;

    drawChart(res.rows, currentBand);
    renderTable(res.rows);
  }

  // ---------- Monte Carlo ----------
  function randn() {
    let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random();
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
      vals.sort((a,b)=>a-b);
      const q = (p)=> vals[Math.max(0, Math.min(vals.length-1, Math.floor((vals.length-1)*p)))];
      p10.push(q(0.10)); p50.push(q(0.50)); p90.push(q(0.90));
    }
    return { p10, p50, p90 };
  }

  // ---------- Tooltips ----------
  function initTooltips() {
    document.querySelectorAll(".field-with-tip").forEach(container => {
      const btn = container.querySelector(".tip-btn");
      const tip = container.querySelector(".tooltip");
      if (!btn || !tip) return;
      function adjust() {
        container.classList.remove("flip-left","centered");
        const vw = window.innerWidth;
        const rect = tip.getBoundingClientRect();
        if (rect.right > vw - 12) container.classList.add("flip-left");
        if (rect.left < 12) container.classList.add("centered");
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".field-with-tip.open").forEach(c=>{ if(c!==container) c.classList.remove("open"); });
        container.classList.toggle("open");
        if (container.classList.contains("open")) requestAnimationFrame(adjust);
      });
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".field-with-tip")) document.querySelectorAll(".field-with-tip.open").forEach(c=>c.classList.remove("open"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") document.querySelectorAll(".field-with-tip.open").forEach(c=>c.classList.remove("open"));
    });
  }

  // ---------- Exports & Share ----------
  function toCSV(rows, headers) {
    const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const head = headers.map(esc).join(',');
    const body = rows.map(r => r.map(esc).join(',')).join('\n');
    return head + '\n' + body;
  }
  function download(filename, content, mime='text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  btnPNG?.addEventListener('click', () => {
    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = dataURL; a.download = 'investment-chart.png'; a.click();
  });
  btnCSVYr?.addEventListener('click', () => {
    const tbody = document.querySelector('#year-table tbody'); if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => td.textContent));
    download('year-table.csv', toCSV(rows, ['År','Samlet indskud','Afkast','Saldo']), 'text/csv');
  });
  btnCSVMc?.addEventListener('click', () => {
    const tbody = document.querySelector('#mc-table tbody'); if (!tbody || !tbody.children.length) return;
    const rows = Array.from(tbody.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => td.textContent));
    download('monte-carlo.csv', toCSV(rows, ['År (antal)','Slutværdi P10','P50 (median)','P90']), 'text/csv');
  });
  btnShare?.addEventListener('click', async function() {
    const params = new URLSearchParams({
      initial: String(initialEl.value || ''),
      monthly: String(monthlyEl.value || ''),
      years: String(yearsEl.value || ''),
      exp: String(expEl.value || ''),
      fees: String(feesEl.value || ''),
      feePreset: String(feePresetEl.value || ''),
      vol: String(volEl?.value || ''),
      sims: String(simsEl?.value || '')
    });
    const link = location.origin + location.pathname + '?' + params.toString();
    try { await navigator.clipboard.writeText(link); this.textContent = 'Kopieret!'; setTimeout(()=>this.textContent='Del',1200); }
    catch { alert('Link: ' + link); }
  });

  // ---------- Events ----------
  calcForm?.addEventListener("submit", (e) => { e.preventDefault(); currentBand = null; runBaseCalc(); });

  ["input","change"].forEach(evt => {
    [initialEl, monthlyEl, yearsEl, expEl, feesEl].forEach(elm => elm?.addEventListener(evt, runBaseCalc));
  });

  mcBtn?.addEventListener("click", () => {
    const years = Math.max(1, parseInt(yearsEl.value||"1",10));
    const rA = toPct(expEl.value)/100;
    const fA = toPct(feesEl.value)/100;
    const initial = toNum(initialEl.value);
    const monthly = toNum(monthlyEl.value);
    const sims = Math.min(3000, Math.max(50, parseInt(simsEl.value||"350",10)));
    const vol = Math.max(0, toPct(volEl.value));
    currentBand = simulateMC(years, rA, fA, initial, monthly, sims, vol);

    // draw over base rows
    const baseRows = [];
    let bal = initial;
    const rM = monthlyFromAnnual(rA), fM = monthlyFromAnnual(fA);
    for (let y=1; y<=years; y++) {
      for (let m=0; m<12; m++) { bal += monthly; bal *= (1+rM); bal *= (1-fM); }
      baseRows.push({ year:y, balance:bal });
    }
    drawChart(baseRows, currentBand);

    if (mcBody && currentBand) {
      mcBody.innerHTML = baseRows.map((r,i)=>(
        `<tr>
          <td>${i+1}</td>
          <td>${cfDK.format(currentBand.p10[i])}</td>
          <td>${cfDK.format(currentBand.p50[i])}</td>
          <td>${cfDK.format(currentBand.p90[i])}</td>
        </tr>`
      )).join("");
    }
  });

  // ---------- Init ----------
  function applyFromURL() {
    const q = new URLSearchParams(location.search);
    if (q.has('initial')) initialEl.value = q.get('initial');
    if (q.has('monthly')) monthlyEl.value = q.get('monthly');
    if (q.has('years')) yearsEl.value = q.get('years');
    if (q.has('exp')) expEl.value = q.get('exp');
    if (q.has('feePreset')) feePresetEl.value = q.get('feePreset');
    if (q.has('fees')) feesEl.value = q.get('fees');
    if (q.has('vol')) volEl && (volEl.value = q.get('vol'));
    if (q.has('sims')) simsEl && (simsEl.value = q.get('sims'));
  }

  initTooltips();
  applyFromURL();

  // Kør preset-synk én gang ved load (hvis ikke manual)
  if (feePresetEl && feePresetEl.value !== "manual") setFeesFromPreset();

  // Første render
  runBaseCalc();
});
