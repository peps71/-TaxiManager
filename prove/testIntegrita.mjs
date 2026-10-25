// INTEGRITA' DEI DATI
// 1. backup esportato e reimportato: deve tornare tutto, identico
// 2. le scadenze: le occorrenze generate devono rispettare la cadenza
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
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
let t = true;
const prova = (n, bene, extra) => { t &= bene; console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + (extra===undefined?'':extra) + ' ***'}`); };

// --- 1. andata e ritorno di un backup ---
const giro = await p.evaluate(async () => {
  const met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  const rec = [], tur = [];
  for (let m = 1; m <= 6; m++) for (const g of [4, 12, 21]) {
    const d = `2026-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    tur.push({ id:`t${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180 });
    for (let c = 0; c < 4; c++) rec.push({ id:`e${m}${g}${c}`, data:d, tipo:'ENTRATA', categoria:"Corsa «con l'apice»", metodo:met[c%5], importo: 15+c*9.37, ora:'10:0'+c });
    rec.push({ id:`u${m}${g}`, data:d, tipo:'USCITA', categoria:'Carburante - Q8', nota:'nota & simboli <b>', metodo:'Bonifico', importo: 61.73, fattura:true });
  }
  window.dailyRecords = rec; window.shifts = tur;
  window.scadenze = [{ id:'s1', nome:'Bollo Auto', data:'2026-10-31', cadenza:'anno', ancora:'2026-10-31' }];
  window.veicoli = [{ id:'v1', modello:'Skoda «Octavia»', targa:"AB'123CD", inUso:true, dataAcquisto:'2026-01-01', kmAcquisto:42000, prezzoAcquisto:28000 }];
  window.vociFisse = [{ slug:'assic', nome:'Assicurazione auto', importo:1387.5, unita:'anno', tipo:'scadenza', scadenza:'2026-10-10', dataInizio:'', dataFine:'' }];
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.profilo = { nome:'Giuseppe', cognome:"D'Angelo", licenza:'1234', sigla:'Livorno 71', piva:'12345678901', coloreTurno:'giallo' };
  window.annoScelto = '2026'; window.versioneDati = (window.versioneDati||0)+1;

  const prima = {
    records: JSON.parse(JSON.stringify(window.dailyRecords)),
    shifts: JSON.parse(JSON.stringify(window.shifts)),
    scadenze: JSON.parse(JSON.stringify(window.scadenze)),
    veicoli: JSON.parse(JSON.stringify(window.veicoli)),
    vociFisse: JSON.parse(JSON.stringify(window.vociFisse)),
    profilo: JSON.parse(JSON.stringify(window.profilo)),
    incassi: aggrega('2026').incassi, uscite: aggrega('2026').uscite
  };
  const pacco = JSON.parse(JSON.stringify(datiDaSalvare()));
  // si butta via tutto e si rimette dal backup
  window.dailyRecords = []; window.shifts = []; window.scadenze = []; window.veicoli = []; window.vociFisse = [];
  window.profilo = {}; window.versioneDati = (window.versioneDati||0)+1;
  await applicaBackup(pacco);
  const dopo = {
    records: window.dailyRecords, shifts: window.shifts, scadenze: window.scadenze,
    veicoli: window.veicoli, vociFisse: window.vociFisse, profilo: window.profilo,
    incassi: aggrega('2026').incassi, uscite: aggrega('2026').uscite
  };
  const chiavi = (a) => a.map(x => String(x.id)).sort().join('|');
  const somma = (a) => a.reduce((t,x)=>t+(parseFloat(x.importo)||0),0);
  return {
    nRecPrima: prima.records.length, nRecDopo: dopo.records.length,
    idUguali: chiavi(prima.records) === chiavi(dopo.records),
    sommaUguale: Math.abs(somma(prima.records) - somma(dopo.records)) < 0.005,
    turniUguali: chiavi(prima.shifts) === chiavi(dopo.shifts),
    scadenzeUguali: chiavi(prima.scadenze) === chiavi(dopo.scadenze),
    veicoliUguali: chiavi(prima.veicoli) === chiavi(dopo.veicoli),
    vociUguali: JSON.stringify(prima.vociFisse) === JSON.stringify(dopo.vociFisse),
    profiloUguale: ['nome','cognome','licenza','sigla','piva'].every(k => prima.profilo[k] === dopo.profilo[k]),
    incassiUguali: Math.abs(prima.incassi - dopo.incassi) < 0.005,
    usciteUguali: Math.abs(prima.uscite - dopo.uscite) < 0.005,
    // i campi di una riga sopravvivono? nota, fattura, ora, metodo
    campi: (() => {
      const a = prima.records.find(x => x.tipo === 'USCITA');
      const b2 = dopo.records.find(x => String(x.id) === String(a.id));
      return b2 && b2.nota === a.nota && b2.fattura === a.fattura && b2.metodo === a.metodo && b2.categoria === a.categoria;
    })()
  };
});
prova(`i movimenti tornano tutti (${giro.nRecDopo} di ${giro.nRecPrima})`, giro.nRecPrima === giro.nRecDopo && giro.idUguali, `${giro.nRecPrima}/${giro.nRecDopo}`);
prova('gli importi tornano al centesimo', giro.sommaUguale);
prova('i turni tornano', giro.turniUguali);
prova('le scadenze tornano', giro.scadenzeUguali);
prova('le vetture tornano', giro.veicoliUguali);
prova('le voci di budget tornano identiche', giro.vociUguali);
prova('la scheda del tassista torna', giro.profiloUguale);
prova('nota, fattura, metodo e categoria di una riga sopravvivono', giro.campi);
prova('e i totali dell\'anno sono gli stessi', giro.incassiUguali && giro.usciteUguali);

// --- 2. le scadenze ---
const sc = await p.evaluate(() => {
  window.scadenze = [
    { id:'a', nome:'Bollo',      data:'2026-10-31', cadenza:'anno',  ancora:'2026-10-31' },
    { id:'b', nome:'Revisione',  data:'2025-04-02', cadenza:'2anni', ancora:'2025-04-02' },
    { id:'c', nome:'Tassametro', data:'2026-02-16', cadenza:'3mesi', ancora:'2026-02-16' }
  ];
  window.dailyRecords = []; window.shifts = [];
  const cal = calendarioScadenze('2026');
  const perNome = {};
  cal.forEach(v => { (perNome[v.nome] = perNome[v.nome] || []).push(v.data); });
  Object.values(perNome).forEach(a => a.sort());
  return { perNome, tot: cal.length };
});
prova(`il bollo ogni anno compare una volta nel 2026 (${JSON.stringify(sc.perNome['Bollo'])})`,
      (sc.perNome['Bollo']||[]).length === 1 && sc.perNome['Bollo'][0] === '2026-10-31', JSON.stringify(sc.perNome['Bollo']));
prova(`la revisione ogni 2 anni NON compare nel 2026 (ancora 2025, prossima 2027)`,
      !(sc.perNome['Revisione']||[]).length, JSON.stringify(sc.perNome['Revisione']));
prova(`il tassametro ogni 3 mesi compare 4 volte (${(sc.perNome['Tassametro']||[]).length})`,
      (sc.perNome['Tassametro']||[]).length === 4, JSON.stringify(sc.perNome['Tassametro']));
const passi = (sc.perNome['Tassametro']||[]).map(x => x.slice(5,7));
prova(`e cade di tre mesi in tre mesi (${passi.join(', ')})`, JSON.stringify(passi) === '["02","05","08","11"]', passi.join(','));

console.log(`\n  ${t && !errori.length ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'} · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
