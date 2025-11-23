
let step=1;
function showStep(){
  document.querySelectorAll('.th-step').forEach(s=>s.classList.remove('active'));
  document.getElementById('step'+step).classList.add('active');
}
function nextStep(){
  step++; 
  if(step===3){generateRubrikker();}
  showStep();
}
function prevStep(){
  step--; 
  if(step<1)step=1; 
  showStep();
}

function generateRubrikker(){
  let checks=[...document.querySelectorAll('#step2 input:checked')].map(i=>i.value);
  let out=document.getElementById('rubrik-output');
  let html="";

  if(checks.includes("aktie")){
    html+=`<h4>Aktier</h4><p>Rubrik 38 – Aktieindkomst (gevinst/tab).</p>`;
  }
  if(checks.includes("udbytte")){
    html+=`<h4>Udbytte</h4><p>Rubrik 39 – Udbytteindtægter.</p>`;
  }
  if(checks.includes("etf")){
    html+=`<h4>ETF / kapitalindkomst</h4><p>Rubrik 20 – Kapitalindkomst (lagerbeskatning).</p>`;
  }
  if(checks.includes("koersel")){
    html+=`<h4>Kørselsfradrag</h4><p>Rubrik 51 – Befordring.</p>`;
  }
  if(checks.includes("rente")){
    html+=`<h4>Renteudgifter</h4><p>Rubrik 41 – Renteudgifter.</p>`;
  }
  if(html==="") html="<p>Ingen relevante rubrikker.</p>";
  out.innerHTML=html;
}


function buildTaxHelperPdfData(){
  const roles = [];
  document.querySelectorAll('#step1 input:checked').forEach((inp)=>{
    const label = inp.parentElement ? inp.parentElement.textContent.trim() : inp.value;
    roles.push(label);
  });

  const rubrikBox = document.getElementById('rubrik-output');
  const rubrikText = rubrikBox ? rubrikBox.textContent.trim() : '';

  const safetyScoreEl = document.getElementById('th-prem-safety-score');
  const errorRiskEl = document.getElementById('th-prem-error-risk');
  const sOptEl = document.getElementById('th-prem-s-opt');
  const sRealEl = document.getElementById('th-prem-s-real');
  const sPessEl = document.getElementById('th-prem-s-pess');
  const recosEl = document.getElementById('th-prem-recos');

  const recos = [];
  if (recosEl){
    recosEl.querySelectorAll('li').forEach((li)=>{
      const txt = (li.textContent || '').trim();
      if (txt) recos.push(txt);
    });
  }

  return {
    title: 'Årsopgørelsesrapport – vejledende',
    subtitle: 'Opsummering af dine valg og de rubrikker, du skal bruge på skat.dk.',
    kpis: [],
    graph: null,
    table: [],
    premium: {
      riskScore: safetyScoreEl ? (safetyScoreEl.textContent || '–') : '–',
      errorRisk: errorRiskEl ? (errorRiskEl.textContent || '–') : null,
      successChance: '',
      optimistic: sOptEl ? (sOptEl.textContent || '–') : '',
      realistic: sRealEl ? (sRealEl.textContent || '–') : '',
      pessimistic: sPessEl ? (sPessEl.textContent || '–') : '',
      recommendations: recos
    },
    cta: 'Brug denne rapport som en tjekliste sammen med din officielle årsopgørelse på skat.dk.'
  };
}

window.generateTaxHelperPdf = function(){
  try{
    const data = buildTaxHelperPdfData();
    if (window.FinlyticsPDF && typeof window.FinlyticsPDF.generatePDF === 'function'){
      window.FinlyticsPDF.generatePDF('taxhelper', data);
    } else if (typeof window.generatePDF === 'function'){
      window.generatePDF('taxhelper', data);
    } else {
      alert('PDF-funktionen er ikke tilgængelig endnu.');
    }
  } catch(err){
    console.error('PDF fejl (taxhelper)', err);
    alert('Kunne ikke generere PDF-rapport.');
  }
};
