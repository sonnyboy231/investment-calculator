
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
