let step = 1;

function showStep(){
  document.querySelectorAll('.th-step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('step' + step);
  if (el) el.classList.add('active');
}

function nextStep(){
  step++;
  if (step === 3){
    generateRubrikker();
  }
  showStep();
}

function prevStep(){
  step--;
  if (step < 1) step = 1;
  showStep();
}

// Beregner rubrikker + opdaterer premium-output
function generateRubrikker(){
  const checks = Array.from(document.querySelectorAll('#step2 input:checked')).map(i => i.value);
  const out = document.getElementById('rubrik-output');
  let html = "";

  if (checks.includes("aktie")){
    html += `<h4>Aktier</h4><p>Rubrik 38 – Aktieindkomst (gevinst/tab).</p>`;
  }
  if (checks.includes("udbytte")){
    html += `<h4>Udbytte</h4><p>Rubrik 39 – Udbytteindtægter.</p>`;
  }
  if (checks.includes("etf")){
    html += `<h4>ETF / kapitalindkomst</h4><p>Rubrik 20 – Kapitalindkomst (lagerbeskatning).</p>`;
  }
  if (checks.includes("koersel")){
    html += `<h4>Kørselsfradrag</h4><p>Rubrik 51 – Befordring.</p>`;
  }
  if (checks.includes("rente")){
    html += `<h4>Renteudgifter</h4><p>Rubrik 41 – Renteudgifter.</p>`;
  }
  if (html === "") html = "<p>Ingen relevante rubrikker.</p>";
  if (out) out.innerHTML = html;

  // Premium-output hook
  const roles = Array.from(document.querySelectorAll('#step1 input:checked')).map(i => i.value);
  updateHelperPremiumOutput(roles, checks);
}

// ===== Premium Output – helper =====

function updateHelperPremiumOutput(roles, checks){
  const safetyEl = document.getElementById('th-prem-safety-score');
  const safetyTextEl = document.getElementById('th-prem-safety-text');
  const sOptEl = document.getElementById('th-prem-s-opt');
  const sRealEl = document.getElementById('th-prem-s-real');
  const sPessEl = document.getElementById('th-prem-s-pess');
  const errorRiskEl = document.getElementById('th-prem-error-risk');
  const recosEl = document.getElementById('th-prem-recos');

  if (!safetyEl || !safetyTextEl || !sOptEl || !sRealEl || !sPessEl || !errorRiskEl || !recosEl){
    return;
  }

  const hasRoles = Array.isArray(roles) && roles.length > 0;
  const hasChecks = Array.isArray(checks) && checks.length > 0;

  if (!hasRoles && !hasChecks){
    resetHelperPremium();
    return;
  }

  // Simpel heuristik: jo mere kompleks (flere roller + flere typer indkomst), jo lavere trygheds-score
  let complexity = 0;
  const complexRoles = ["investor", "udlejer"];
  const baseRoles = ["lonmodtager", "studerende"];

  roles.forEach(r => {
    if (complexRoles.includes(r)) complexity += 2;
    else if (baseRoles.includes(r)) complexity += 1;
  });

  complexity += Math.max(0, checks.length - 2);

  let safety = 90 - complexity * 8;
  safety = Math.max(20, Math.min(95, safety));

  const errorRisk = 100 - safety;

  safetyEl.textContent = String(Math.round(safety));
  errorRiskEl.textContent = Math.round(errorRisk) + " %";

  // Tekst til trygheds-score
  let sText = "";
  if (safety >= 75){
    sText = "Din situation ser relativt enkel ud – du har gode chancer for at ramme rigtigt første gang.";
  } else if (safety >= 50){
    sText = "Din situation er moderat kompleks – vær ekstra opmærksom på detaljer i skat.dk.";
  } else {
    sText = "Din situation virker ret kompleks – tag dig god tid og overvej at få hjælp, hvis du bliver i tvivl.";
  }
  safetyTextEl.textContent = sText;

  // Scenarier – tekstbaseret, ikke tal
  let opt, real, pess;

  if (safety >= 75){
    opt = "Du får styr på alt i første forsøg og undgår restskat.";
    real = "Små justeringer kan blive nødvendige, men overblikket er godt.";
    pess = "Du overser enkelte fradrag, men risikoen for større fejl er lav.";
  } else if (safety >= 50){
    opt = "Du får styr på de vigtigste punkter og retter til efter første årsopgørelse.";
    real = "Du skal sandsynligvis igennem et par tilretninger, før alt stemmer.";
    pess = "Der er risiko for, at nogle tal ikke rammer helt præcist første gang.";
  } else {
    opt = "Du får lavet en grundskitse og forbedrer den løbende.";
    real = "Du skal forvente at bruge tid på at tjekke felter og dokumentation grundigt.";
    pess = "Uden ekstra fokus er der betydelig risiko for fejl og utryghed omkring resultatet.";
  }

  sOptEl.textContent = opt;
  sRealEl.textContent = real;
  sPessEl.textContent = pess;

  // Anbefalinger
  const recos = [];

  if (checks.includes("aktie") || checks.includes("etf") || checks.includes("udbytte")){
    recos.push("Sammenlign dine investeringstal med årsopgørelser fra bank og mægler, før du indtaster dem.");
  }
  if (checks.includes("koersel")){
    recos.push("Dobbelttjek antal kilometer og satser for kørselsfradrag i den relevante periode.");
  }
  if (checks.includes("rente")){
    recos.push("Tjek at dine renteudgifter er indberettet automatisk – ellers tilføj dem manuelt.");
  }
  if (roles.includes("udlejer")){
    recos.push("Gem dokumentation for lejeindtægter og udgifter til vedligeholdelse, så tallene kan dokumenteres.");
  }
  if (roles.includes("investor")){
    recos.push("Lav en lille oversigt over køb/salg i året, så du nemt kan se gevinster og tab.");
  }

  if (!recos.length){
    recos.push("Brug guiden som tjekliste og sammenlign altid med din faktiske årsopgørelse på skat.dk.");
  }

  recosEl.innerHTML = "";
  recos.forEach(txt => {
    const li = document.createElement('li');
    li.textContent = txt;
    recosEl.appendChild(li);
  });
}

function resetHelperPremium(){
  const safetyEl = document.getElementById('th-prem-safety-score');
  const safetyTextEl = document.getElementById('th-prem-safety-text');
  const sOptEl = document.getElementById('th-prem-s-opt');
  const sRealEl = document.getElementById('th-prem-s-real');
  const sPessEl = document.getElementById('th-prem-s-pess');
  const errorRiskEl = document.getElementById('th-prem-error-risk');
  const recosEl = document.getElementById('th-prem-recos');

  if (safetyEl) safetyEl.textContent = "–";
  if (safetyTextEl) safetyTextEl.textContent = "Gennemfør guiden for at få en vurdering af, hvor tryg din årsopgørelse ser ud.";
  if (sOptEl) sOptEl.textContent = "–";
  if (sRealEl) sRealEl.textContent = "–";
  if (sPessEl) sPessEl.textContent = "–";
  if (errorRiskEl) errorRiskEl.textContent = "–";
  if (recosEl) recosEl.innerHTML = "";
}
