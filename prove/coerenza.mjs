// CONTROLLO DI COERENZA
// Un archivio solo, e si verifica che lo stesso numero, detto da parti diverse
// dell'app, sia lo stesso. Non si controlla che i conti siano "giusti" in
// assoluto: si controlla che non si contraddicano.
// Le prove girano da dove sta il repository, non da un percorso fisso: cosi'
// funzionano anche su un'altra macchina. Il motore del browser si cerca dove
// e' installato, oppure lo si dice con PLAYWRIGHT=/percorso/index.mjs.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato: installalo o indicalo con PLAYWRIGHT=...'); process.exit(2); }
const { chromium } = await import(DOVE_PW);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, locale: 'it-IT' });
p.on('dialog', d => d.accept());
const errori = []; p.on('pageerror', e => errori.push(String(e)));
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = '2026';
await p.evaluate((anno) => {
  const rec = [], tur = [];
  const met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  const cat = ['Carburante','Lavaggio','Manutenzione','Parcheggio / Pedaggio','Ristoro','Assicurazione'];
  const metSpesa = ['Contanti','Bonifico','Carta Carburante','Conto'];
  let n = 0;
  for (const y of [String(Number(anno)-1), anno]) {
    for (let m = 1; m <= 12; m++) for (let g = 1; g <= 28; g++) {
      if (g % 7 === 0) continue;                     // un riposo a settimana
      const d = `${y}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
      tur.push({ id:`t${y}${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:170 + (g % 40) });
      const quante = 5 + (g % 4);
      for (let c = 0; c < quante; c++) {
        n++;
        rec.push({ id:`e${n}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:met[(g + c) % 5], importo: 11 + ((g * 3 + c * 7) % 48), ora:'1' + (c % 10) + ':0' + (c % 6) });
      }
      if (g % 3 === 0) { n++; rec.push({ id:`u${n}`, data:d, tipo:'USCITA', categoria:cat[(g + m) % 6], metodo: metSpesa[(g + m) % 4], importo: 18 + ((g * 5) % 70), fattura: g % 2 === 0 }); }
    }
    // riposi espliciti e spese fisse vere
    tur.push({ id:`rip${y}`, data:`${y}-08-15`, turno:'Festivo', inizio:'', fine:'', ore:0, lavorato:false });
    rec.push({ id:`as${y}`, data:`${y}-10-10`, tipo:'USCITA', categoria:'Assicurazione auto', metodo:'Bonifico', importo: 1387 });
    rec.push({ id:`rt${y}1`, data:`${y}-03-05`, tipo:'USCITA', categoria:'Radio taxi', metodo:'Bonifico', importo: 1575.54 });
    rec.push({ id:`rt${y}2`, data:`${y}-09-05`, tipo:'USCITA', categoria:'Radio taxi', metodo:'Bonifico', importo: 1575.54 });
    rec.push({ id:`tc${y}`, data:`${y}-05-18`, tipo:'USCITA', categoria:'Tasse e Contributi - INPS', metodo:'Conto', importo: 1130.34 });
    rec.push({ id:`fissi-${y}-01`, data:`${y}-01-20`, tipo:'USCITA', categoria:'Costi fissi - Voce sparita', metodo:'Bonifico', importo: 240 });
  }
  window.vociFisse = [
    { slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'scadenza', scadenza:'2025-10-10', dataInizio:'', dataFine:'' },
    { slug:'radio', nome:'Radio taxi', importo:3151.08, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' },
    { slug:'banca', nome:'Spese banca', importo:18, unita:'mese', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' },
    { slug:'tc', nome:'Tasse e Contributi', importo:4800, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' },
    { slug:'carb', nome:'Carburante', importo:14000, unita:'anno', tipo:'consumo', scadenza:'', dataInizio:'', dataFine:'' }
  ];
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.veicoli = [{ id:'v1', modello:'Skoda Octavia', targa:'AB123CD', anno:2021, kmIniziali:10000, prezzo:28000, inUso:true }];
  window.scadenze = [{ id:'s1', nome:'Bollo Auto', data:`${anno}-10-31`, cadenza:'anno', ancora:`${anno}-10-31` }];
  window.profilo = { nome:'Giuseppe', cognome:'Rossi', licenza:'1234', sigla:'Livorno 71', piva:'12345678901', coloreTurno:'giallo' };
  window.dailyRecords = rec; window.shifts = tur;
  window.annoScelto = anno; window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
}, ANNO);

const dati = await p.evaluate((anno) => {
  window.activeTab = 'categorie'; renderContent();
  const a = aggrega(anno);
  const serieA = serieAnnuale(anno);
  const st = getStats();
  const cong = conguaglioAnno(anno);
  const rec = (window.dailyRecords || []).filter(r => String(r.data).slice(0,4) === anno);
  const somma = (f) => rec.filter(f).reduce((t, r) => t + (parseFloat(r.importo)||0), 0);
  const giorni = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${anno}-${String(m).padStart(2,'0')}`;
    for (let g = 1; g <= giorniDelMese(ym); g++) giorni.push(`${ym}-${String(g).padStart(2,'0')}`);
  }
  return {
    anno,
    aggrega: { incassi:a.incassi, uscite:a.uscite, saldo:a.saldo, nCorse:a.nCorse, ore:a.ore,
               contanti:a.contanti, pos:a.pos, satispay:a.satispay, app:a.app, conto:a.conto,
               categorie: a.speseCategorie.reduce((t,c)=>t+c.tot,0), nCategorie:a.speseCategorie.length,
               mediaCorsa:a.mediaCorsa, mediaOra:a.mediaOra },
    serieAnno: { incassi: serieA.reduce((t,x)=>t+x.incassi,0), uscite: serieA.reduce((t,x)=>t+x.uscite,0),
                 nCorse: serieA.reduce((t,x)=>t+x.nCorse,0), ore: serieA.reduce((t,x)=>t+x.ore,0) },
    serieMesi: (() => { let i=0,u=0,c=0,o=0;
      for (let m=1;m<=12;m++){ const s=serieMensile(`${anno}-${String(m).padStart(2,'0')}`);
        s.forEach(x=>{i+=x.incassi;u+=x.uscite;c+=x.nCorse;o+=x.ore;}); } return {incassi:i,uscite:u,nCorse:c,ore:o}; })(),
    aggregaMesi: (() => { let i=0,u=0,c=0;
      for (let m=1;m<=12;m++){ const d=aggrega(`${anno}-${String(m).padStart(2,'0')}`); i+=d.incassi;u+=d.uscite;c+=d.nCorse; } return {incassi:i,uscite:u,nCorse:c}; })(),
    grezzo: { entrate: somma(r=>r.tipo==='ENTRATA'), uscite: somma(r=>r.tipo==='USCITA'),
              entrateTracciate: somma(r=>r.tipo==='ENTRATA'&&metodoTracciato(r.metodo)),
              usciteTracciate: somma(r=>r.tipo==='USCITA'&&metodoTracciato(r.metodo)),
              nCorse: rec.filter(r=>r.tipo==='ENTRATA').length },
    stats: st,
    utileFiscaleAnno: utileFiscaleAnno(anno),
    budget: { previstoAnno: budgetAnno(anno), realeAnno: budgetRealeAnno(anno),
              sommaVoci: elencoVociFisse().reduce((t,v)=>t+budgetVocePeriodo(v,`${anno}-01-01`,`${anno}-12-31`).totale,0),
              sommaGiorniReale: giorni.reduce((t,g)=>t+budgetDelGiorno(g),0),
              sommaMesiPrevisto: (()=>{let t=0;for(let m=1;m<=12;m++)t+=budgetMese(`${anno}-${String(m).padStart(2,'0')}`);return t;})() },
    conguaglio: { budget:cong.budget, speso:cong.speso, differenza:cong.differenza,
                  sommaRigheBudget: cong.righe.reduce((t,r)=>t+r.budget,0),
                  sommaRigheSpeso: cong.righe.reduce((t,r)=>t+r.speso,0),
                  sommaMovimenti: cong.righe.reduce((t,r)=>t+r.voci.reduce((x,m)=>x+(parseFloat(m.importo)||0),0),0),
                  nMovimenti: cong.righe.reduce((t,r)=>t+r.voci.length,0),
                  contaDichiarata: cong.righe.reduce((t,r)=>t+r.movimenti,0) },
    tasse: (()=>{ const f=calcolaTasseOrdinario(st.utileFiscale, anno);
                  return { tot:f.tasseTot, inps:f.contributiInps, irpef:f.irpef, add:f.addizionali, imponibile:f.imponibileIrpef }; })(),
    giornata: (()=>{ const g = `${anno}-06-15`;
      const uscite = (window.dailyRecords||[]).filter(r=>r.tipo==='USCITA'&&r.data===g);
      const sp = speseGiornataSpalmate(g, uscite);
      const q = quotaDelGiorno(g);
      return { vere:sp.vere, fuoriBudget:sp.fuoriBudget, quotaBudget:sp.quotaBudget, totale:sp.totale,
               pagateABudget:sp.pagateOggiABudget, qBudget:q.budget, qAltre:q.altre, qQuota:q.quota }; })()
  };
}, ANNO);

// ---------- i controlli ----------
let ok = 0, ko = [];
const E = 0.02;
const c = (nome, a, b2) => {
  const bene = Math.abs(a - b2) < E;
  if (bene) ok++; else ko.push(`${nome}: ${a.toFixed(2)} contro ${b2.toFixed(2)} (scarto ${(a-b2).toFixed(2)})`);
};
const d = dati;
console.log(`  archivio: ${d.grezzo.nCorse} corse e ${d.aggrega.nCategorie} categorie di spesa nel ${d.anno}\n`);

console.log('  --- i totali dell\'anno, contati in quattro modi ---');
c('incassi: aggrega contro somma grezza', d.aggrega.incassi, d.grezzo.entrate);
c('incassi: aggrega contro grafico annuale', d.aggrega.incassi, d.serieAnno.incassi);
c('incassi: aggrega contro i 12 grafici mensili', d.aggrega.incassi, d.serieMesi.incassi);
c('incassi: aggrega contro i 12 aggrega mensili', d.aggrega.incassi, d.aggregaMesi.incassi);
c('uscite: aggrega contro somma grezza', d.aggrega.uscite, d.grezzo.uscite);
c('uscite: aggrega contro grafico annuale', d.aggrega.uscite, d.serieAnno.uscite);
c('uscite: aggrega contro i 12 grafici mensili', d.aggrega.uscite, d.serieMesi.uscite);
c('uscite: aggrega contro i 12 aggrega mensili', d.aggrega.uscite, d.aggregaMesi.uscite);
c('corse: aggrega contro grafico annuale', d.aggrega.nCorse, d.serieAnno.nCorse);
c('corse: aggrega contro i 12 mensili', d.aggrega.nCorse, d.aggregaMesi.nCorse);
c('ore: aggrega contro grafico annuale', d.aggrega.ore, d.serieAnno.ore);
c('saldo = incassi - uscite', d.aggrega.saldo, d.aggrega.incassi - d.aggrega.uscite);
c('media a corsa = incassi / corse', d.aggrega.mediaCorsa, d.aggrega.incassi / d.aggrega.nCorse);
c('media oraria = incassi / ore', d.aggrega.mediaOra, d.aggrega.incassi / d.aggrega.ore);

console.log('  --- le ripartizioni devono ricomporre il totale ---');
c('metodi di incasso sommano al totale', d.aggrega.contanti+d.aggrega.pos+d.aggrega.satispay+d.aggrega.app+d.aggrega.conto, d.aggrega.incassi);
c('categorie di spesa sommano al totale', d.aggrega.categorie, d.aggrega.uscite);
c('tracciato + contanti = entrate', d.stats.entrateTracciate + d.stats.entrateContanti, d.stats.entrate);
c('deducibili + non deducibili = uscite', d.stats.deducibili + d.stats.nonDeducibili, d.stats.uscite);

console.log('  --- Spese e tasse contro il registro ---');
c('getStats.entrate contro somma grezza', d.stats.entrate, d.grezzo.entrate);
c('getStats.uscite contro somma grezza', d.stats.uscite, d.grezzo.uscite);
c('getStats.entrateTracciate contro somma grezza', d.stats.entrateTracciate, d.grezzo.entrateTracciate);
c('getStats.deducibili contro somma grezza', d.stats.deducibili, d.grezzo.usciteTracciate);
c('getStats.entrate contro aggrega', d.stats.entrate, d.aggrega.incassi);
c('utile di cassa = entrate - uscite', d.stats.utileCassa, d.stats.entrate - d.stats.uscite);
c('utile fiscale = tracciate - deducibili', d.stats.utileFiscale, d.stats.entrateTracciate - d.stats.deducibili);
c('utileFiscaleAnno dice lo stesso di getStats', d.utileFiscaleAnno, d.stats.utileFiscale);
c('netto = utile di cassa - tasse', d.stats.netto, d.stats.utileCassa - d.stats.tasse);

console.log('  --- la stima delle tasse ---');
c('tasse = INPS + IRPEF + addizionali', d.tasse.tot, d.tasse.inps + d.tasse.irpef + d.tasse.add);
c('tasse di getStats contro ricalcolo', d.stats.tasse, d.tasse.tot);
c('imponibile IRPEF = utile - contributi', d.tasse.imponibile, Math.max(0, d.stats.utileFiscale - d.tasse.inps));

console.log('  --- il budget ---');
c('budget anno = somma delle voci', d.budget.previstoAnno, d.budget.sommaVoci);
c('budget anno previsto = somma dei 12 mesi', d.budget.previstoAnno, d.budget.sommaMesiPrevisto);
c('budget REALE anno = somma dei 365 giorni', d.budget.realeAnno, d.budget.sommaGiorniReale);

console.log('  --- il conguaglio ---');
c('budget totale = somma delle righe', d.conguaglio.budget, d.conguaglio.sommaRigheBudget);
c('speso totale = somma delle righe', d.conguaglio.speso, d.conguaglio.sommaRigheSpeso);
c('differenza = budget - speso', d.conguaglio.differenza, d.conguaglio.budget - d.conguaglio.speso);
c('speso = somma dei movimenti elencati', d.conguaglio.speso, d.conguaglio.sommaMovimenti);
c('il conteggio dichiarato = i movimenti elencati', d.conguaglio.contaDichiarata, d.conguaglio.nMovimenti);
c('budget del conguaglio = budget della scheda', d.conguaglio.budget, d.budget.previstoAnno);

console.log('  --- la giornata ---');
c('spese vere = fuori budget + pagate a budget', d.giornata.vere, d.giornata.fuoriBudget + d.giornata.pagateABudget);
c('spese spalmate = fuori budget + quota', d.giornata.totale, d.giornata.fuoriBudget + d.giornata.quotaBudget);
c('quota del giorno = budget + altre spese', d.giornata.qQuota, d.giornata.qBudget + d.giornata.qAltre);
c('il budget della quota = quello delle spese spalmate', d.giornata.qBudget, d.giornata.quotaBudget);

console.log(`\n  ${ko.length ? ko.length + ' INCOERENZE' : 'nessuna incoerenza'} · ${ok} controlli passati`);
ko.forEach(x => console.log('   *** ' + x));
console.log('  errori JS:', errori.length ? errori : 'nessuno');
await b.close();
