// Dove se ne va il tempo, con un archivio da tassista vero
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
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'it-IT' });
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
const r = await p.evaluate(() => {
  const rec = [], tur = [];
  const met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  const cat = ['Carburante','Lavaggio','Manutenzione','Parcheggio / Pedaggio','Ristoro'];
  for (const a of [2024,2025,2026]) for (let m=1;m<=12;m++) for (let g=1;g<=28;g++) {
    if (g%7===0) continue;
    const d = `${a}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    tur.push({ id:`t${a}${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180 });
    for (let c=0;c<9;c++) rec.push({ id:`e${a}${m}${g}${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:met[c%5], importo:12+c*7, ora:'10:00' });
    rec.push({ id:`u${a}${m}${g}`, data:d, tipo:'USCITA', categoria:cat[g%5], metodo:'Bonifico', importo:40+g });
  }
  // dieci voci di budget, come un budget completo
  const voci = [
    ['finanz','Finanziamento licenza',797,'mese','scadenza'], ['radio','Radio taxi',3151.08,'anno','scadenza'],
    ['comm','Commercialista',1642,'anno','scadenza'], ['assic','Assicurazione auto',1387,'anno','scadenza'],
    ['inf','Assicurazione infortuni',500,'anno','scadenza'], ['bollo','Bollo / Tasse auto',300,'anno','scadenza'],
    ['tc','Tasse e Contributi',4800,'anno','scadenza'], ['banca','Spese banca',500,'anno','scadenza'],
    ['carb','Carburante',14000,'anno','consumo'], ['rist','Ristoro',900,'anno','consumo']
  ].map(([slug,nome,importo,unita,tipo]) => ({ slug, nome, importo, unita, tipo, scadenza:'', dataInizio:'', dataFine:'' }));
  window.vociFisse = voci; localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.dailyRecords = rec; window.shifts = tur;
  window.veicoli = [{ id:'v1', modello:'Skoda', targa:'AB123CD', inUso:true, dataAcquisto:'2024-01-01', kmAcquisto:0, prezzoAcquisto:28000, valoreStimato:14000 }];
  window.annoScelto = '2026'; window.versioneDati = (window.versioneDati||0)+1;
  const out = {};
  for (const t of ['giornata','dashboard','altro','uscite','categorie','scadenze','auto','rendimento','report','cloud']) {
    window.activeTab = t; renderContent();
    const a = performance.now(); for (let i=0;i<3;i++) renderContent(); out[t] = (performance.now()-a)/3;
  }
  for (const per of ['giorno','mese','anno']) {
    window.activeTab='dashboard'; window.periodoDashScelto=per; renderContent();
    const a = performance.now(); for (let i=0;i<3;i++) renderContent(); out['dashboard/'+per] = (performance.now()-a)/3;
  }
  // e i conti pesanti presi uno a uno, fuori da un disegno
  const solo = {};
  const mis = (n, f) => { const a = performance.now(); const v = f(); solo[n] = performance.now()-a; return v; };
  mis('budgetAnno', () => budgetAnno('2026'));
  mis('budgetRealeAnno', () => budgetRealeAnno('2026'));
  mis('conguaglioAnno', () => conguaglioAnno('2026'));
  mis('aggrega(anno)', () => aggrega('2026'));
  mis('getStats', () => getStats());
  mis('getReportStats', () => getReportStats('ALL'));
  mis('statsVeicolo', () => statsVeicolo(window.veicoli[0]));
  mis('serieAnnuale', () => serieAnnuale('2026'));
  mis('indicePagamenti', () => indicePagamenti());
  return { out, solo, mov: rec.length, voci: voci.length,
           heap: performance.memory ? (performance.memory.usedJSHeapSize/1048576).toFixed(1) : '?' };
});
console.log(`  archivio: ${r.mov} movimenti · ${r.voci} voci di budget · heap ${r.heap} MB\n`);
console.log('  disegno di una schermata:');
Object.entries(r.out).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`    ${k.padEnd(20)} ${v.toFixed(0).padStart(5)} ms${v>120?'   <<< lenta':''}`));
console.log('\n  i conti pesanti, presi uno a uno (fuori da un disegno, memoria spenta):');
Object.entries(r.solo).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`    ${k.padEnd(20)} ${v.toFixed(0).padStart(5)} ms${v>150?'   <<< lento':''}`));
await b.close();
