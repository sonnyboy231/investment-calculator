
/* ============================================================
   Finlytics PDF v2 Engine – Browser-ready (jsPDF via CDN)
   ============================================================ */
(function(global){
  'use strict';

  function loadJsPDF(){
    return new Promise(function(resolve, reject){
      try{
        if (global.jspdf && global.jspdf.jsPDF){
          resolve(global.jspdf.jsPDF);
          return;
        }
        var existing = global.document.querySelector('script[data-finlytics-jspdf]');
        if (existing){
          existing.addEventListener('load', function(){
            if (global.jspdf && global.jspdf.jsPDF){
              resolve(global.jspdf.jsPDF);
            } else {
              reject(new Error('jsPDF ikke tilgængelig efter load.'));
            }
          });
          existing.addEventListener('error', function(){
            reject(new Error('Kunne ikke indlæse jsPDF (eksisterende script).'));
          });
          return;
        }
        var s = global.document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
        s.async = true;
        s.setAttribute('data-finlytics-jspdf', '1');
        s.onload = function(){
          if (global.jspdf && global.jspdf.jsPDF){
            resolve(global.jspdf.jsPDF);
          } else {
            reject(new Error('jsPDF ikke tilgængelig efter load.'));
          }
        };
        s.onerror = function(){
          reject(new Error('Kunne ikke indlæse jsPDF.'));
        };
        global.document.head.appendChild(s);
      } catch (err){
        reject(err);
      }
    });
  }

  function legalFooterText(type){
    var base = 'Dette er en vejledende rapport baseret på de oplysninger, du har indtastet. ' +
               'Finlytics yder ikke individuel investerings-, skatte- eller økonomisk rådgivning. ' +
               'Satser og regler kan ændre sig.';
    if (type === 'investment'){
      return base + ' Scenarier og afkast er anslåede og garanterer ikke fremtidigt afkast.';
    }
    if (type === 'tax'){
      return base + ' Satser er generelle og kan variere afhængigt af kommune og individuelle forhold.';
    }
    if (type === 'taxhelper'){
      return base + ' Guiden er en generel gennemgang og kan ikke erstatte personlig rådgivning.';
    }
    return base;
  }

  function pdfHeader(doc, title){
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Finlytics – ' + title, 40, 40);
    doc.setLineWidth(0.7);
    doc.line(40, 48, 555, 48);
  }

  function pdfFooter(doc, pageNumber, type){
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Side ' + pageNumber, 40, 820);
    var text = legalFooterText(type);
    doc.text(text, 40, 835, { maxWidth: 515 });
  }

  function sectionTitle(doc, text, y){
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(text, 40, y);
    return y + 18;
  }

  function bodyText(doc, text, y){
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(text, 40, y, { maxWidth: 515 });
    return y + 16;
  }

  function renderKpiGrid(doc, kpis, y){
    if (!kpis || !kpis.length) return y;
    y = sectionTitle(doc, 'Nøgletal', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    for (var i = 0; i < kpis.length; i++){
      var k = kpis[i];
      doc.text((k.label || '') + ': ' + (k.value || ''), 40, y);
      y += 14;
    }
    return y + 6;
  }

  function renderGraph(doc, type, graphBase64, y){
    if (!graphBase64) return y;
    y = sectionTitle(doc, 'Udvikling', y);
    try{
      doc.addImage(graphBase64, 'PNG', 40, y, 520, 220);
      y += 230;
      if (type === 'investment'){
        y = bodyText(doc, 'Scenarier er vejledende og garanterer ikke fremtidigt afkast.', y);
      } else if (type === 'tax'){
        y = bodyText(doc, 'Satser og beregninger er vejledende og skal altid sammenholdes med din faktiske årsopgørelse.', y);
      }
    } catch (err){
      console.error('Kunne ikke tilføje graf til PDF', err);
    }
    return y + 4;
  }

  function renderTable(doc, table, y){
    if (!table || !table.length) return y;
    y = sectionTitle(doc, 'Detaljer', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (var i = 0; i < table.length; i++){
      var row = table[i];
      doc.text(row.join('   '), 40, y, { maxWidth: 515 });
      y += 12;
      if (y > 760){
        doc.addPage();
        y = 80;
      }
    }
    return y + 4;
  }

  function renderPremium(doc, premium, y){
    if (!premium) return y;
    y = sectionTitle(doc, 'Premium overblik', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    if (premium.riskScore != null){
      doc.text('Trygheds-score: ' + premium.riskScore, 40, y);
      y += 14;
    }
    if (premium.errorRisk != null){
      doc.text('Risiko for fejl / restskat: ' + premium.errorRisk, 40, y);
      y += 14;
    }
    if (premium.successChance){
      doc.text('Sandsynlighed for at ramme rigtigt: ' + premium.successChance, 40, y);
      y += 16;
    }

    if (premium.optimistic || premium.realistic || premium.pessimistic){
      doc.setFont('helvetica', 'bold');
      doc.text('Scenarier', 40, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      if (premium.optimistic){
        doc.text('Optimistisk: ' + premium.optimistic, 40, y);
        y += 14;
      }
      if (premium.realistic){
        doc.text('Realistisk: ' + premium.realistic, 40, y);
        y += 14;
      }
      if (premium.pessimistic){
        doc.text('Pessimistisk: ' + premium.pessimistic, 40, y);
        y += 14;
      }
    }

    if (premium.recommendations && premium.recommendations.length){
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('Anbefalinger', 40, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      for (var i = 0; i < premium.recommendations.length; i++){
        doc.text('• ' + premium.recommendations[i], 40, y, { maxWidth: 515 });
        y += 13;
      }
    }

    return y + 4;
  }

  function renderCTA(doc, ctaText, y){
    if (!ctaText) return y;
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(ctaText, 40, y, { maxWidth: 515 });
    return y + 16;
  }

  async function generatePDF(type, data){
    try{
      var JsPDF = await loadJsPDF();
      var doc = new JsPDF({ unit: 'pt', format: 'a4' });
      var pageNumber = 1;

      var title = (data && data.title) || 'Finlytics rapport';
      var subtitle = data && data.subtitle;
      var kpis = (data && data.kpis) || [];
      var graph = data && data.graph;
      var table = (data && data.table) || [];
      var premium = data && data.premium;
      var ctaText = data && data.cta;

      pdfHeader(doc, title);

      var y = 80;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(title, 40, y);
      y += 18;

      if (subtitle){
        y = bodyText(doc, subtitle, y);
      }

      y += 4;
      y = renderKpiGrid(doc, kpis, y);
      y = renderGraph(doc, type, graph, y);
      y = renderTable(doc, table, y);
      y = renderPremium(doc, premium, y);
      y = renderCTA(doc, ctaText, y);

      pdfFooter(doc, pageNumber, type);

      doc.save('finlytics_' + type + '_report.pdf');
    } catch (err){
      console.error('PDF generation failed', err);
      if (global.alert){
        global.alert('Kunne ikke generere PDF-rapport. Prøv igen.');
      }
    }
  }


  async function generateDebtPDFEngine(result, graphImage){
    try{
      var JsPDF = await loadJsPDF();
      var doc = new JsPDF({ unit: 'pt', format: 'a4' });
      var left = 40;
      var y = 60;

      function formatDKKLocal(v){
        if (typeof v === 'number'){
          return v.toLocaleString('da-DK', { maximumFractionDigits: 0 });
        }
        return String(v);
      }

      // Header
      doc.setFontSize(20);
      doc.text('Finlytics – Gældsrapport', left, y);
      y += 26;
      doc.setFontSize(13);
      doc.text('Overblik & afviklingsplan', left, y);
      y += 30;

      // Intro
      doc.setFontSize(11);
      var intro = 'Denne rapport giver et vejledende overblik over din gældssituation. ' +
                  'Den estimerer gældfri dato, samlede renteudgifter og månedlig betaling baseret på dine input.';
      var introLines = doc.splitTextToSize(intro, 520);
      doc.text(introLines, left, y);
      y += introLines.length * 14 + 24;

      // KPI grid
      doc.setFontSize(15);
      doc.text('Nøgleresultater', left, y);
      y += 22;

      var kpiWidth = 170;
      var kpiHeight = 80;
      var gap = 18;
      var kpis = [
        {
          title: 'Gældfri dato',
          value: result.summary.debtFreeDate,
          copy: 'Datoen hvor al gæld forventes afviklet.'
        },
        {
          title: 'Samlede renteudgifter',
          value: formatDKKLocal(result.summary.totalInterest) + ' kr',
          copy: 'Total rente betalt over hele perioden.'
        },
        {
          title: 'Månedlig betaling',
          value: formatDKKLocal(result.summary.monthlyPayment) + ' kr',
          copy: 'Samlet månedlig betaling på tværs af lån.'
        }
      ];

      var x = left;
      doc.setFontSize(12);
      kpis.forEach(function(kpi){
        doc.setDrawColor(220,220,220);
        doc.setLineWidth(1);
        doc.rect(x, y, kpiWidth, kpiHeight);

        doc.setFontSize(12);
        doc.text(kpi.title, x + 10, y + 18);

        doc.setFontSize(16);
        doc.text(kpi.value, x + 10, y + 40);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(doc.splitTextToSize(kpi.copy, kpiWidth - 20), x + 10, y + 56);
        doc.setTextColor(0);

        x += kpiWidth + gap;
      });

      y += kpiHeight + 36;

      // Graph
      doc.setFontSize(15);
      doc.text('Udvikling i restgæld', left, y);
      y += 18;

      if (graphImage){
        doc.addImage(graphImage, 'PNG', left, y, 500, 200);
        y += 220;
      } else {
        doc.setFontSize(11);
        doc.text('Ingen graf tilgængelig.', left, y + 14);
        y += 40;
      }

      // Year-by-year table
      doc.setFontSize(15);
      doc.text('År-for-år oversigt', left, y);
      y += 20;

      doc.setFontSize(11);
      doc.text('År', left, y);
      doc.text('Restgæld', left + 80, y);
      doc.text('Betalt rente', left + 180, y);
      y += 14;

      (result.table || []).forEach(function(row){
        doc.text(String(row.year), left, y);
        doc.text(formatDKKLocal(row.balance), left + 80, y);
        doc.text(formatDKKLocal(row.interest), left + 180, y);
        y += 14;
      });

      y += 24;

      // Scenarios
      doc.setFontSize(15);
      doc.text('Scenarier', left, y);
      y += 18;

      doc.setFontSize(11);
      var scenarier = [
        'Baseline: Standardforløb baseret på minimumsbetalinger.',
        '+500 kr/md: Et mindre ekstra afdrag forkorter perioden og reducerer renter.',
        '+1.500 kr/md: Større ekstra afdrag skubber gældfri dato væsentligt frem og minimerer renter.'
      ];
      scenarier.forEach(function(line){
        var wrapped = doc.splitTextToSize(line, 520);
        doc.text(wrapped, left, y);
        y += wrapped.length * 14 + 4;
      });

      // Legal footer
      doc.setFontSize(9);
      var legal = 'Finlytics\\' gældsværktøjer giver kun vejledende og generelle beregninger baseret på dine input. ' +
                  'Modellerne udgør ikke kreditvurdering, finansiel rådgivning eller anbefalinger om lån, refinansiering eller lånetyper.';
      var legalLines = doc.splitTextToSize(legal, 520);
      doc.text(legalLines, left, 800);

      doc.save('finlytics_debt_report.pdf');
    } catch (err){
      console.error('Debt PDF generation failed', err);
      if (global.alert){
        global.alert('Kunne ikke generere gældsrapport. Prøv igen.');
      }
    }
  }

  global.FinlyticsPDF = global.FinlyticsPDF || {};
  global.FinlyticsPDF.generatePDF = generatePDF;
  global.generatePDF = generatePDF;
  global.FinlyticsPDF.generateDebtPDFEngine = generateDebtPDFEngine;
  global.generateDebtPDFEngine = generateDebtPDFEngine;

})(window);
