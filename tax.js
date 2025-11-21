
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
