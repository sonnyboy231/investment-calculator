
document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  const fmtDKK = new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0
  });

  const toNum = (v) => {
    if (v == null) return 0;
    const x = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(x) ? x : 0;
  };

  const elStockGain = $("#tax-stock-gain");
  const elStockLoss = $("#tax-stock-loss");
  const elStockDiv  = $("#tax-stock-dividend");
  const elStockThr  = $("#tax-stock-threshold");

  const elCapChange = $("#tax-capital-change");
  const elCapDiv    = $("#tax-capital-dividend");
  const elCapRate   = $("#tax-capital-rate");

  const elCryGain   = $("#tax-crypto-gain");
  const elCryLoss   = $("#tax-crypto-loss");
  const elCryRate   = $("#tax-crypto-rate");

  const btnCalc     = $("#btn-tax-calc");
  const btnClear    = $("#btn-tax-clear");

  const kpiTotal    = $("#tax-kpi-total");
  const kpiNet      = $("#tax-kpi-net");
  const kpiStock    = $("#tax-kpi-stock");
  const kpiCap      = $("#tax-kpi-capital");
  const kpiCrypto   = $("#tax-kpi-crypto");
  const taxPremRiskScoreEl = document.querySelector("#tax-prem-risk-score");
  const taxPremRiskTextEl  = document.querySelector("#tax-prem-risk-text");
  const taxPremSOptEl      = document.querySelector("#tax-prem-s-opt");
  const taxPremSRealEl     = document.querySelector("#tax-prem-s-real");
  const taxPremSPessEl     = document.querySelector("#tax-prem-s-pess");
  const taxPremRestEl      = document.querySelector("#tax-prem-rest");
  const taxPremRecosEl     = document.querySelector("#tax-prem-recos");


  const canvas      = document.getElementById("tax-chart");
  const ctx         = canvas?.getContext("2d") || null;

  function calc() {
    // === Read inputs ===
    const stockGain = Math.max(0, toNum(elStockGain.value));
    const stockLoss = Math.max(0, toNum(elStockLoss.value));
    const stockDiv  = Math.max(0, toNum(elStockDiv.value));
    const stockThr  = Math.max(0, toNum(elStockThr.value) || 62000);

    const capChange = toNum(elCapChange.value);
    const capDiv    = Math.max(0, toNum(elCapDiv.value));
    const capRate   = parseFloat(elCapRate.value || "0") || 0;

    const cryGain   = Math.max(0, toNum(elCryGain.value));
    const cryLoss   = Math.max(0, toNum(elCryLoss.value));
    const cryRate   = parseFloat(elCryRate.value || "0") || 0;

    // === Basic income bases ===
    const stockBase = Math.max(0, stockGain - stockLoss) + stockDiv;
    const capBase   = capChange + capDiv;
    const cryBase   = Math.max(0, cryGain - cryLoss);

    // === Taxes ===
    // Aktieindkomst: 27% op til threshold, 42% over
    let taxStock = 0;
    if (stockBase > 0) {
      const low = Math.min(stockBase, stockThr);
      const high = Math.max(0, stockBase - stockThr);
      taxStock = low * 0.27 + high * 0.42;
    }

    // Kapitalindkomst: valgt sats (kan være negativ hvis capBase < 0)
    let taxCap = 0;
    if (capBase > 0 && capRate > 0) {
      taxCap = capBase * capRate;
    }

    // Crypto: personlig indkomstsats
    let taxCry = 0;
    if (cryBase > 0 && cryRate > 0) {
      taxCry = cryBase * cryRate;
    }

    const totalTax = taxStock + taxCap + taxCry;

    // Total brutto-indkomst (kun positive dele)
    const gross = stockBase + Math.max(0, capBase) + cryBase;
    const net   = Math.max(0, gross - totalTax);

    // === Update KPIs ===
    kpiTotal.textContent  = totalTax > 0 ? fmtDKK.format(totalTax) : "0 kr";
    kpiNet.textContent    = gross > 0   ? fmtDKK.format(net) : "0 kr";
    kpiStock.textContent  = taxStock > 0 ? fmtDKK.format(taxStock) : "0 kr";
    kpiCap.textContent    = taxCap > 0   ? fmtDKK.format(taxCap) : "0 kr";
    kpiCrypto.textContent = taxCry > 0   ? fmtDKK.format(taxCry) : "0 kr";

    drawChart(gross, net, totalTax);

    // Opdater premium-output
    updateTaxPremium(net, taxStock, taxCap, taxCry);
  }


  function updateTaxPremium(net, taxStock, taxCap, taxCry) {
    if (!taxPremRiskScoreEl || !taxPremRiskTextEl || !taxPremSOptEl || !taxPremSRealEl || !taxPremSPessEl || !taxPremRestEl || !taxPremRecosEl) {
      return;
    }

    const totalTax = Math.max(0, (taxStock || 0) + (taxCap || 0) + (taxCry || 0));
    const safeNet  = Math.max(0, net || 0);

    if (!(safeNet > 0) && !(totalTax > 0)) {
      taxPremRiskScoreEl.textContent = "–";
      taxPremRiskTextEl.textContent  = "Indtast dine tal og beregn for at se en vurdering.";
      taxPremSOptEl.textContent      = "–";
      taxPremSRealEl.textContent     = "–";
      taxPremSPessEl.textContent     = "–";
      taxPremRestEl.textContent      = "–";
      taxPremRecosEl.innerHTML       = "";
      return;
    }

    // Enkel heuristik: mere crypto og høj skat = højere risiko for restskat
    let risk = 20;
    if (taxCry > 0) risk += 30;
    if (taxCap > 0) risk += 15;
    if (totalTax > 0 && taxCry / totalTax > 0.4) risk += 15;
    if (totalTax > 0 && totalTax > safeNet * 0.35) risk += 10;

    risk = Math.max(0, Math.min(100, Math.round(risk)));
    taxPremRiskScoreEl.textContent = String(risk);

    let riskText = "";
    if (risk <= 30) {
      riskText = "Lav til moderat risiko for restskat – men tjek stadig din forskudsopgørelse.";
    } else if (risk <= 60) {
      riskText = "Middel risiko for restskat – dine tal kan svinge en del, så vær ekstra opmærksom.";
    } else {
      riskText = "Forhøjet risiko for restskat – gennemgå din forskudsopgørelse nøje og overvej at justere dine tal.";
    }
    taxPremRiskTextEl.textContent = riskText;

    const opt  = safeNet * 1.2;
    const real = safeNet;
    const pess = safeNet * 0.75;

    const fmt = new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0
    });

    taxPremSOptEl.textContent  = fmt.format(Math.round(opt));
    taxPremSRealEl.textContent = fmt.format(Math.round(real));
    taxPremSPessEl.textContent = fmt.format(Math.round(pess));

    const restRisk = Math.max(0, Math.min(98, 100 - risk + (taxCry > 0 ? 5 : 0)));
    taxPremRestEl.textContent  = restRisk.toFixed(0) + " %";

    // Byg anbefalinger
    const recos = [];

    if (taxCry > 0) {
      recos.push("Dobbelttjek at dine crypto-gevinster og -tab er indberettet korrekt i din årsopgørelse.");
    }
    if (taxCap > 0) {
      recos.push("Sørg for at dine ETF- og kapitalindkomsttal stemmer med dine årsopgørelser fra bank og mægler.");
    }
    if (taxStock > 0) {
      recos.push("Gennemgå dine aktiehandler og udbytter, så de matcher dine indberettede beløb.");
    }
    if (totalTax > 0 && totalTax > safeNet * 0.35) {
      recos.push("Din samlede skat er relativt høj ift. dine gevinster – overvej om din forskudsopgørelse skal justeres.");
    }
    if (!recos.length) {
      recos.push("Din beregning ser relativt balanceret ud – husk stadig at sammenligne med din endelige årsopgørelse.");
    }

    taxPremRecosEl.innerHTML = "";
    recos.forEach((txt) => {
      const li = document.createElement("li");
      li.textContent = txt;
      taxPremRecosEl.appendChild(li);
    });
  }

  function clearForm() {
    [elStockGain, elStockLoss, elStockDiv, elStockThr,
     elCapChange, elCapDiv,
     elCryGain, elCryLoss].forEach(inp => { if (inp) inp.value = ""; });

    kpiTotal.textContent  = "–";
    kpiNet.textContent    = "–";
    kpiStock.textContent  = "–";
    kpiCap.textContent    = "–";
    kpiCrypto.textContent = "–";

    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawChart(gross, net, totalTax) {
    if (!ctx || !canvas) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    if (!(gross > 0)) {
      // Nothing to draw
      return;
    }

    const pad = 32;
    const maxVal = gross;

    const barW = (W - pad * 2) / 4;
    const baseY = H - pad;

    function barHeight(v) {
      return (v / maxVal) * (H - pad * 2);
    }

    // Background grid line
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, baseY + 0.5);
    ctx.lineTo(W - pad, baseY + 0.5);
    ctx.stroke();

    // Brutto-bar (left)
    const hGross = barHeight(gross);
    ctx.fillStyle = "#60a5fa";
    ctx.beginPath();
    ctx.roundRect(pad + barW * 0.5, baseY - hGross, barW, hGross, 8);
    ctx.fill();

    // Netto-bar (right)
    const hNet = barHeight(net);
    ctx.fillStyle = "#34d399";
    ctx.beginPath();
    ctx.roundRect(pad + barW * 2.5, baseY - hNet, barW, hNet, 8);
    ctx.fill();

    // Labels
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";

    ctx.fillText("Brutto", pad + barW * 0.5 + barW / 2, baseY + 16);
    ctx.fillText("Netto",  pad + barW * 2.5 + barW / 2, baseY + 16);

    // Values above bars
    ctx.textBaseline = "bottom";
    ctx.fillText(fmtDKK.format(gross), pad + barW * 0.5 + barW / 2, baseY - hGross - 4);
    ctx.fillText(fmtDKK.format(net),   pad + barW * 2.5 + barW / 2, baseY - hNet - 4);
  }

  btnCalc?.addEventListener("click", calc);
  btnClear?.addEventListener("click", clearForm);
});

// ACCORDION TOGGLE
document.querySelectorAll('.acc-header').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const item=btn.parentElement;
    item.classList.toggle('open');
  });
});
