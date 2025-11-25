document.addEventListener("DOMContentLoaded", () => {
  const primaryBtn = document.querySelector(".hero .btn.btn-primary");
  if (primaryBtn) {
    primaryBtn.addEventListener("click", handleMortgageCalculate);
  }

  const resetBtn = document.querySelector(".btn-tool-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetMortgageUI);
  }

  const pdfBtn = document.querySelector(".btn-tool-pdf");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      alert("PDF-rapport kommer i en senere version.");
    });
  }
});

function getMortgageInput() {
  const price = Number(document.getElementById("home-price").value) || 0;
  const down = Number(document.getElementById("downpayment").value) || 0;
  const years = Number(document.getElementById("mortgage-years").value) || 0;
  const rate = Number(document.getElementById("mortgage-rate").value) || 0;
  const ioYears = Number(document.getElementById("interest-only-years").value) || 0;
  return { price, down, years, rate, ioYears };
}

function handleMortgageCalculate() {
  clearMortgageError();
  const input = getMortgageInput();
  const error = validateMortgageInput(input);
  if (error) {
    showMortgageError(error);
    resetMortgageKPIs();
    return;
  }

  const result = calculateMortgage(input);
  renderMortgage(result);
}

function validateMortgageInput({ price, down, years, rate, ioYears }) {
  if (price <= 0) return "Angiv en boligpris større end 0.";
  if (down < 0) return "Udbetaling kan ikke være negativ.";
  if (down >= price) return "Udbetaling skal være mindre end boligprisen.";
  if (years <= 0) return "Angiv en løbetid større end 0 år.";
  if (rate <= 0) return "Angiv en årlig rente større end 0%.";
  if (ioYears < 0) return "Afdragsfri periode kan ikke være negativ.";
  if (ioYears > years) return "Afdragsfri periode kan ikke være længere end lånets løbetid.";
  return "";
}

function calculateMortgage({ price, down, years, rate, ioYears }) {
  const loanAmount = price - down;
  const r = rate / 100 / 12;
  const n = years * 12;
  const ioMonths = ioYears * 12;

  const n2 = n - ioMonths;
  const interestOnlyPayment = ioMonths > 0 ? loanAmount * r : 0;
  const annuity = loanAmount * r / (1 - Math.pow(1 + r, -n2));

  let monthlyLabel;
  if (ioMonths > 0) {
    monthlyLabel = formatDKK(interestOnlyPayment) + " kr (afdragsfri) / " +
                   formatDKK(annuity) + " kr efter afdragsfri";
  } else {
    monthlyLabel = formatDKK(annuity) + " kr";
  }

  let balance = loanAmount;
  let totalInterest = 0;
  let balance5y = 0;
  let balance10y = 0;

  for (let month = 1; month <= n; month++) {
    const isInterestOnly = month <= ioMonths;
    const payment = isInterestOnly ? interestOnlyPayment : annuity;
    const interest = balance * r;
    const principalPaid = isInterestOnly ? 0 : (payment - interest);

    totalInterest += interest;

    if (!isInterestOnly) {
      balance -= principalPaid;
      if (balance < 0) balance = 0;
    }

    if (month === 60) {
      balance5y = balance;
    }
    if (month === 120) {
      balance10y = balance;
    }
  }

  if (n < 60) balance5y = 0;
  if (n < 120) balance10y = 0;

  return {
    loanAmount,
    monthlyLabel,
    totalInterest,
    balance5y,
    balance10y
  };
}

function renderMortgage(result) {
  const { loanAmount, monthlyLabel, totalInterest, balance5y, balance10y } = result;

  const loanEl = document.getElementById("kpi-loan-amount");
  const monthlyEl = document.getElementById("kpi-monthly-payment");
  const interestEl = document.getElementById("kpi-total-interest");
  const bal5El = document.getElementById("kpi-balance-5y");
  const bal10El = document.getElementById("kpi-balance-10y");

  if (loanEl) loanEl.textContent = formatDKK(loanAmount) + " kr";
  if (monthlyEl) monthlyEl.textContent = monthlyLabel;
  if (interestEl) interestEl.textContent = formatDKK(totalInterest) + " kr";
  if (bal5El) bal5El.textContent = formatDKK(balance5y) + " kr";
  if (bal10El) bal10El.textContent = formatDKK(balance10y) + " kr";
}

function resetMortgageKPIs() {
  const ids = [
    "kpi-loan-amount",
    "kpi-monthly-payment",
    "kpi-total-interest",
    "kpi-balance-5y",
    "kpi-balance-10y"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "–";
  });
}

function resetMortgageUI() {
  const fields = [
    "home-price",
    "downpayment",
    "mortgage-years",
    "mortgage-rate",
    "interest-only-years"
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  resetMortgageKPIs();
  clearMortgageError();
}

function showMortgageError(message) {
  const box = document.getElementById("mortgage-error");
  if (!box) return;
  box.textContent = message;
  box.style.display = "block";
}

function clearMortgageError() {
  const box = document.getElementById("mortgage-error");
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
}

function formatDKK(value) {
  if (!isFinite(value)) return "–";
  return value.toLocaleString("da-DK", { maximumFractionDigits: 0 });
}
