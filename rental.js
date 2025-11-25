// Udlejningsberegner v1 – Finlytics

// Bind events (script ligger i bunden af <body>, så DOM er klar)
const primaryBtn = document.querySelector(".hero .btn.btn-primary");
if (primaryBtn) {
  primaryBtn.addEventListener("click", handleRentalCalculate);
}

const resetBtn = document.querySelector(".btn-tool-reset");
if (resetBtn) {
  resetBtn.addEventListener("click", resetRentalUI);
}

const pdfBtn = document.querySelector(".btn-tool-pdf");
if (pdfBtn) {
  pdfBtn.addEventListener("click", () => {
    alert("PDF-rapport kommer i en senere version.");
  });
}

function handleRentalCalculate() {
  clearRentalError();

  const input = getRentalInput();
  const error = validateRentalInput(input);

  if (error) {
    showRentalError(error);
    resetRentalKPIs();
    return;
  }

  const result = calculateRental(input);
  renderRental(result);
}

function getRentalInput() {
  return {
    rent: Number(document.getElementById("rent").value) || 0,
    vacancy: Number(document.getElementById("vacancy").value) || 0,
    utilities: Number(document.getElementById("utilities").value) || 0,
    maintenance: Number(document.getElementById("maintenance").value) || 0,
    propertyTax: Number(document.getElementById("property-tax").value) || 0,
    insurance: Number(document.getElementById("insurance").value) || 0,
    loanPayment: Number(document.getElementById("loan-payment").value) || 0
  };
}

function validateRentalInput(input) {
  const {
    rent,
    vacancy,
    utilities,
    maintenance,
    propertyTax,
    insurance,
    loanPayment
  } = input;

  const values = [rent, vacancy, utilities, maintenance, propertyTax, insurance, loanPayment];

  if (values.some(v => Number.isNaN(v))) {
    return "Der er en eller flere ugyldige værdier. Tjek venligst dine indtastninger.";
  }

  if (rent <= 0) {
    return "Husleje skal være større end 0.";
  }

  if (vacancy < 0) {
    return "Tomgang kan ikke være negativ.";
  }

  if (propertyTax < 0 || insurance < 0 || utilities < 0 || maintenance < 0 || loanPayment < 0) {
    return "Beløb kan ikke være negative.";
  }

  return "";
}

function calculateRental(input) {
  const monthlyExpenses =
    input.utilities +
    input.maintenance +
    input.loanPayment +
    input.propertyTax / 12 +
    input.insurance / 12;

  const monthlyCashflow = input.rent - monthlyExpenses;
  const yearlyCashflow = monthlyCashflow * 12;
  const adjustedCashflow = monthlyCashflow * (1 - input.vacancy / 100);

  const breakevenRent = monthlyExpenses;

  // Simpel v1-ROI: årligt cashflow efter tomgang / (ejendomsskat + forsikring + vedligehold pr. år)
  const invested =
    input.propertyTax +
    input.insurance +
    input.maintenance * 12;

  const roi = invested > 0 ? (adjustedCashflow * 12) / invested : 0;

  return {
    monthlyCashflow,
    yearlyCashflow,
    adjustedCashflow,
    breakevenRent,
    roi
  };
}

function renderRental(result) {
  document.getElementById("kpi-monthly").textContent = formatDKK(result.monthlyCashflow);
  document.getElementById("kpi-yearly").textContent = formatDKK(result.yearlyCashflow);
  document.getElementById("kpi-adjusted").textContent = formatDKK(result.adjustedCashflow);
  document.getElementById("kpi-breakeven").textContent = formatDKK(result.breakevenRent);
  document.getElementById("kpi-roi").textContent = (result.roi * 100).toFixed(1) + "%";
}

function resetRentalKPIs() {
  const ids = [
    "kpi-monthly",
    "kpi-yearly",
    "kpi-adjusted",
    "kpi-breakeven",
    "kpi-roi"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "–";
  });
}

function resetRentalUI() {
  const ids = [
    "rent",
    "vacancy",
    "utilities",
    "maintenance",
    "property-tax",
    "insurance",
    "loan-payment"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  resetRentalKPIs();
  clearRentalError();
}

function showRentalError(message) {
  const box = document.getElementById("rental-error");
  if (!box) return;
  box.textContent = message;
  box.style.display = "block";
}

function clearRentalError() {
  const box = document.getElementById("rental-error");
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
}

function formatDKK(value) {
  if (!isFinite(value)) return "–";
  return value.toLocaleString("da-DK", { maximumFractionDigits: 0 }) + " kr";
}
