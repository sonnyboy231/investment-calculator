
function safeNumber(value){
    const n = Number(value);
    return isNaN(n)?0:n;
}
function formatDKK(value){
    return new Intl.NumberFormat("da-DK").format(Math.round(value));
}
function formatDebtFree(monthsTotal){
    const years=Math.floor(monthsTotal/12);
    const months=monthsTotal%12;
    return `${years} år og ${months} måneder`;
}

function validateLoans(loans){
    let errors=[];
    if(loans.every(l=>!l.name && !l.principal)){
        errors.push("Tilføj mindst ét lån for at fortsætte.");
    }
    for(const l of loans){
        if(l.principal<=0) errors.push(`Restgæld skal være større end 0 for ${l.name||"et lån"}`);
        if(l.annualRate<0) errors.push(`Renten skal være ≥ 0 for ${l.name||"et lån"}`);
        if(l.minPayment<=0) errors.push(`Minimumsydelse skal være større end 0 for ${l.name||"et lån"}`);
        if(!l.startDate) errors.push(`Startdato skal angives for ${l.name||"et lån"}`);
        const monthlyRate=l.annualRate/12;
        const interest=l.principal*monthlyRate;
        if(l.minPayment + l.extraPayment < interest){
            errors.push(`Din betaling dækker ikke renterne på ${l.name||"lånet"} – gælden vil vokse.`);
        }
    }
    return {valid: errors.length===0, errors};
}


// Debt Logic v1.0 – STRICT MODE

function calculateDebtPlan(loans, strategy) {
    // Deep copy loans
    let ls = loans.map(l => ({...l, principal: Number(l.principal)}));

    // Strategy sorting
    if (strategy === "snowball") {
        ls.sort((a,b)=> a.principal - b.principal);
    } else if (strategy === "avalanche") {
        ls.sort((a,b)=> b.annualRate - a.annualRate);
    }

    const monthlyPayment = ls.reduce((sum,l)=> sum + l.minPayment + l.extraPayment, 0);

    // find earliest start date
    function parseDate(d){
        const [y,m]=d.split('-').map(Number);
        return {year:y, month:m};
    }
    function nextMonth(d){
        let y=d.year, m=d.month+1;
        if(m>12){m=1; y++;}
        return {year:y, month:m};
    }
    function dateStr(d){
        return d.year.toString().padStart(4,'0') + '-' + d.month.toString().padStart(2,'0');
    }

    let currentDate = ls.map(l=>parseDate(l.startDate)).sort((a,b)=> a.year-b.year || a.month-b.month)[0];
    let totalInterest = 0;
    let graph = [];
    let table = [];
    let months=0;

    while(ls.length>0 && months<600){
        // compute total balance
        let totalBalance = ls.reduce((s,l)=> s + l.principal, 0);

        // monthly interest & payment
        let monthInterest = 0;
        let paymentLeft = monthlyPayment;

        // order again each month based on strategy
        if (strategy === "snowball") {
            ls.sort((a,b)=> a.principal - b.principal);
        } else {
            ls.sort((a,b)=> b.annualRate - a.annualRate);
        }

        for (let l of ls){
            if(l.principal <= 0) continue;

            let rate = l.annualRate/12;
            let interest = l.principal * rate;
            monthInterest += interest;

            let pmt = l.minPayment + l.extraPayment;
            if(paymentLeft < pmt) pmt = paymentLeft;
            let principalPay = pmt - interest;
            if(principalPay <0) principalPay=0;

            l.principal -= principalPay;
            paymentLeft -= pmt;
        }

        totalInterest += monthInterest;

        graph.push({month: dateStr(currentDate), balance: totalBalance});

        // table yearly aggregation
        if(currentDate.month===12){
            table.push({
                year: currentDate.year,
                balance: totalBalance,
                interest: monthInterest
            });
        }

        ls = ls.filter(l=> l.principal>0.01);
        currentDate = nextMonth(currentDate);
        months++;
    }

    const debtFreeDate = dateStr(currentDate);
    const years = Math.floor(months/12);

    return {
        loans: loans,
        strategy: strategy,
        summary: {
            monthlyPayment: monthlyPayment,
            totalInterest: Number(totalInterest.toFixed(2)),
            debtFreeDate: debtFreeDate,
            months: months,
            years: years
        },
        graph: graph,
        table: table
    };
}

// Export for module environments
if (typeof module !== "undefined") {
    module.exports = { calculateDebtPlan };
}


function getLoansFromUI(){
    return [
        {
            id:1,
            name: document.getElementById("loan1-name").value,
            type: document.querySelectorAll("select")[0].value,
            principal: safeNumber(document.getElementById("loan1-principal").value),
            annualRate: safeNumber(document.getElementById("loan1-rate").value)/100,
            minPayment: safeNumber(document.getElementById("loan1-min").value),
            extraPayment: safeNumber(document.getElementById("loan1-extra").value),
            startDate: document.getElementById("loan1-start").value
        },
        {
            id:2,
            name: document.getElementById("loan2-name").value,
            type: document.querySelectorAll("select")[1].value,
            principal: safeNumber(document.getElementById("loan2-principal").value),
            annualRate: safeNumber(document.getElementById("loan2-rate").value)/100,
            minPayment: safeNumber(document.getElementById("loan2-min").value),
            extraPayment: safeNumber(document.getElementById("loan2-extra").value),
            startDate: document.getElementById("loan2-start").value
        }
    ];
}

function getStrategyFromUI(){
    return document.querySelector("input[name='strategy']:checked").value;
}

function renderKPIs(result){
    const kpis=document.querySelectorAll(".card.kpi p");
    kpis[0].textContent = formatDebtFree(result.summary.months);
    kpis[1].textContent = formatDKK(result.summary.totalInterest);
    kpis[2].textContent = formatDKK(result.summary.monthlyPayment);
}

function renderTable(result){
    const tbody=document.querySelector(".table-basic tbody");
    tbody.innerHTML="";
    result.table.forEach(row=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${row.year}</td><td>${row.balance}</td><td>${row.interest}</td>`;
        tbody.appendChild(tr);
    });
}

function renderGraph(result){
    const el=document.querySelector(".chart-placeholder");
    el.innerHTML="<p>Graf kommer i næste sprint ("+result.graph.length+" punkter)</p>";
}

function resetAll(){
    const ids=["loan1-name","loan1-principal","loan1-rate","loan1-min","loan1-extra","loan1-start",
               "loan2-name","loan2-principal","loan2-rate","loan2-min","loan2-extra","loan2-start"];
    ids.forEach(id=>document.getElementById(id).value="");
    document.querySelectorAll(".card.kpi p").forEach(p=>p.textContent="–");
    document.querySelector(".table-basic tbody").innerHTML="<tr><td>–</td><td>–</td><td>–</td></tr>"; document.getElementById("error-box").innerText="";
    document.querySelector(".chart-placeholder").innerHTML="<p>Tilføj et lån for at se grafen.</p>";
}

document.querySelector(".btn-tool-reset").addEventListener("click", resetAll);

document.querySelector(".btn.btn-primary").addEventListener("click", ()=>{
    const loans=getLoansFromUI();
    const strategy=getStrategyFromUI();
    const check=validateLoans(loans);
    if(!check.valid){ document.getElementById("error-box").innerText = check.errors.join("\n"); return; } else { document.getElementById("error-box").innerText=""; }
    const result=calculateDebtPlan(loans, strategy);
    renderGraph(result);
    renderKPIs(result);
    renderTable(result);
    renderGraph(result);
});


function generateDebtPDF(){
    const loans = getLoansFromUI();
    const strategy = getStrategyFromUI();
    const check = validateLoans(loans);
    if(!check.valid){
        // fejl vises allerede via validateLoans + error-box i main flow
        return;
    }
    const result = calculateDebtPlan(loans, strategy);
    let graphImage = null;
    try{
        const canvas = document.getElementById('debtChart');
        if (canvas && canvas.toDataURL){
            graphImage = canvas.toDataURL('image/png');
        }
    } catch(e){
        console.error('Kunne ikke hente graf-billede til PDF', e);
    }

    if (typeof generateDebtPDFEngine === 'function'){
        generateDebtPDFEngine(result, graphImage);
    } else if (window.FinlyticsPDF && typeof window.FinlyticsPDF.generateDebtPDFEngine === 'function'){
        window.FinlyticsPDF.generateDebtPDFEngine(result, graphImage);
    } else {
        if (window.alert){
            window.alert('PDF-motor ikke klar endnu.');
        }
    }
}

document.addEventListener('DOMContentLoaded', function(){
    const pdfBtn = document.querySelector('.btn-tool-pdf');
    if (pdfBtn){
        pdfBtn.addEventListener('click', function(ev){
            ev.preventDefault();
            generateDebtPDF();
        });
    }
});
