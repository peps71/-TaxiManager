// La previsione vale finche' non arriva il conto; poi comanda il conto.
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
const p = await b.newPage({ locale: 'it-IT' });
p.on('dialog', d => d.accept());
const errori = []; p.on('pageerror', e => errori.push(String(e)));
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

let buone = 0, storte = 0;
const prova = (nome, visto, atteso) => {
  const bene = Math.abs(visto - atteso) < 0.015;
  bene ? buone++ : storte++;
  console.log(`    ${bene ? 'ok ' : '***'} ${nome.padEnd(46)} ${visto.toFixed(2)} (atteso ${atteso.toFixed(2)})${bene ? '' : '  *** SBAGLIATO ***'}`);
};

const setup = (voci, spese) => p.evaluate(({ voci, spese }) => {
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.vociFisse = voci;
  window.dailyRecords = spese.map((x, i) => Object.assign({ id: 'u' + i, tipo: 'USCITA' }, x));
  window.shifts = [];
  // qui i movimenti si mettono a mano, saltando scriviLocale: si avvisa a mano
  window.versioneDati = (window.versioneDati || 0) + 1;
  // i conti pesanti sono memorizzati per disegno: qui si disegna per svuotare
  renderContent();
}, { voci, spese });

const q = (iso) => p.evaluate(g => ({
  reale: quotaVoceReale(window.vociFisse[0], g, giorniDelMese(g.slice(0,7))),
  previsto: quotaVocePrevista(window.vociFisse[0], g, giorniDelMese(g.slice(0,7)))
}), iso);

console.log('\n  A) nessun pagamento: vale la previsione');
await setup([{ slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'bolletta', dataInizio:'', dataFine:'' }], []);
prova('15 marzo 2026', (await q('2026-03-15')).reale, 1387/365);

console.log('\n  B) rinnovo il 10 ottobre 2026 a 1.500');
await setup(
  [{ slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'bolletta', dataInizio:'', dataFine:'' }],
  [{ data:'2026-10-10', categoria:'Assicurazione auto', metodo:'Bonifico', importo:1500 }]);
prova('9 ottobre 2026 (giorno prima)',   (await q('2026-10-09')).reale, 1387/365);
prova('10 ottobre 2026 (giorno stesso)', (await q('2026-10-10')).reale, 1500/365);
prova('1 gennaio 2027 (annata in corso)',(await q('2027-01-01')).reale, 1500/365);
prova('9 ottobre 2027 (ultimo coperto)', (await q('2027-10-09')).reale, 1500/365);
prova('10 ottobre 2027 (scaduta, non rinnovata)', (await q('2027-10-10')).reale, 1500/365);
prova('e la PREVISIONE resta quella scritta', (await q('2027-01-01')).previsto, 1387/365);

console.log('\n  B2) un pagamento PIU\' BASSO del budget non deve tirare giu\' la giornata');
await setup(
  [{ slug:'tc', nome:'Tasse e Contributi', importo:4800, unita:'anno', tipo:'scadenza', dataInizio:'', dataFine:'' }],
  [{ data:'2026-05-18', categoria:'Tasse e Contributi - INPS', metodo:'Bonifico', importo:2523 }]);
prova('budget 4.800, pagati 2.523: resta al budget', (await q('2026-06-15')).reale, 4800/365);
await setup(
  [{ slug:'tc', nome:'Tasse e Contributi', importo:4800, unita:'anno', tipo:'scadenza', dataInizio:'', dataFine:'' }],
  [{ data:'2026-05-18', categoria:'Tasse e Contributi - INPS', metodo:'Bonifico', importo:6000 }]);
prova('budget 4.800, pagati 6.000: sale alla spesa vera', (await q('2026-06-15')).reale, 6000/365);

console.log('\n  C) due rate da 750: la seconda ricalcola tutta l\'annata');
await setup(
  [{ slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'bolletta', dataInizio:'', dataFine:'' }],
  [{ data:'2026-10-10', categoria:'Assicurazione auto', metodo:'Bonifico', importo:750 },
   { data:'2027-04-10', categoria:'Assicurazione auto', metodo:'Bonifico', importo:750 }]);
prova('10 ottobre 2026 (ricalcolato a 1.500)', (await q('2026-10-10')).reale, 1500/365);
prova('1 gennaio 2027',                        (await q('2027-01-01')).reale, 1500/365);
// e con una rata sola, prima che arrivi la seconda, non deve dimezzare
await setup(
  [{ slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'scadenza', dataInizio:'', dataFine:'' }],
  [{ data:'2026-10-10', categoria:'Assicurazione auto', metodo:'Bonifico', importo:750 }]);
prova('con la sola prima rata resta al budget', (await q('2026-11-01')).reale, 1387/365);

console.log('\n  D) carburante a budget: 6.000 l\'anno, che si accumula');
await setup(
  [{ slug:'carb', nome:'Carburante', importo:6000, unita:'anno', tipo:'accumulo', dataInizio:'', dataFine:'' }],
  [{ data:'2026-01-10', categoria:'Carburante', metodo:'Bonifico', importo:200 },
   { data:'2026-02-10', categoria:'Carburante', metodo:'Bonifico', importo:200 },
   { data:'2026-03-10', categoria:'Carburante', metodo:'Bonifico', importo:3000 }]);
const prev = 6000/365;
prova('5 gennaio: sotto la previsione',  (await q('2026-01-05')).reale, prev);
prova('31 gennaio: 200 spesi, sotto',    (await q('2026-01-31')).reale, prev);
// al 10 marzo: speso 3400 in 69 giorni; previsto 69*16,44 = 1134 -> superata
const r10 = await q('2026-03-10');
prova('10 marzo: 3.400 spesi in 69 giorni', r10.reale, 3400/69);
prova('e la previsione resta 6.000/365',    r10.previsto, prev);

console.log('\n  E) il conguaglio e la scheda del budget parlano di PREVISIONE');
// pagamento in una data GIA' PASSATA: il conguaglio non conta i movimenti
// futuri, perche' non sono ancora usciti dal conto.
await setup(
  [{ slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'bolletta', dataInizio:'', dataFine:'' }],
  [{ data:'2026-06-10', categoria:'Assicurazione auto', metodo:'Bonifico', importo:1500 }]);
const c = await p.evaluate(() => { window.annoScelto='2026'; renderContent();
  return { budgetAnno: budgetAnno('2026'), cong: conguaglioAnno('2026') }; });
prova('budget 2026 = la previsione scritta', c.budgetAnno, 1387);
prova('il conguaglio dice speso 1.500',      c.cong.speso, 1500);
prova('e la differenza e\' -113',            c.cong.differenza, -113);

console.log(`\n  ${storte === 0 ? 'TUTTO BENE' : storte + ' CONTI SBAGLIATI'} · ${buone} giusti · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
process.exit(storte ? 1 : 0);
