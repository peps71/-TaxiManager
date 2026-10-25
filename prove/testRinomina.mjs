// RINOMINARE UNA VOCE DI BUDGET NON DEVE PERDERE LA SUA STORIA
// Una spesa si aggancia al budget dal NOME. Rinominando una voce, tutte le
// spese gia' registrate smettevano di agganciarsi, in silenzio, e il danno era
// doppio: la voce risultava non pagata, e quegli stessi soldi ricominciavano a
// pesare sulla giornata come spese fuori budget mentre la quota del budget
// pesava lo stesso. Misurato prima della correzione: 8,63 € al giorno
// diventavano 18,01 €.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

let ok = 0; const ko = [];
const c = (nome, vero) => { if (vero) ok++; else ko.push(nome); };
const vicino = (a, b) => Math.abs(a - b) < 0.02;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 1000 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = String(new Date().getFullYear());
const semina = () => p.evaluate((anno) => {
  window.vociFisse = [{ slug: 'radio', nome: 'Radio taxi', importo: 3151.08, unita: 'anno',
                        tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' }];
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['carburante']));
  window.dailyRecords = [
    { id: 'e1', data: `${anno}-02-01`, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 3000 },
    { id: 'r1', data: `${anno}-02-10`, tipo: 'USCITA', categoria: 'Radio taxi', metodo: 'Bonifico', importo: 262.59 },
    { id: 'r2', data: `${anno}-03-10`, tipo: 'USCITA', categoria: 'Radio taxi - rata marzo', metodo: 'Bonifico', importo: 262.59 }
  ];
  window.shifts = []; window.scadenze = []; window.veicoli = [];
  window.annoScelto = anno; window.versioneDati = (window.versioneDati || 0) + 1;
  switchTab('categorie'); renderContent();
}, ANNO);

const stato = () => p.evaluate((anno) => {
  const cong = conguaglioAnno(anno);
  const r = cong.righe[0] || {};
  const q = quotaDelGiorno(`${anno}-02-15`);
  return { nome: r.nome, speso: +(r.speso || 0).toFixed(2), movimenti: r.movimenti || 0,
           quota: +q.quota.toFixed(4), altre: +q.altre.toFixed(4), budget: +q.budget.toFixed(4),
           categorie: (window.dailyRecords || []).filter(x => x.tipo === 'USCITA').map(x => x.categoria),
           importi: (window.dailyRecords || []).filter(x => x.tipo === 'USCITA').map(x => x.importo) };
}, ANNO);

await semina();
const prima = await stato();
c('prima del rinomino le due rate sono agganciate', prima.movimenti === 2 && vicino(prima.speso, 525.18));
c('e sulla giornata pesa solo la quota del budget', vicino(prima.quota, prima.budget) && vicino(prima.altre, 0));

// --- si rinomina rifiutando la proposta: la storia resta staccata ---
p.once('dialog', d => d.dismiss());
await p.evaluate(() => {
  apriVoceFissa('radio');
  document.getElementById('cf-nome-radio').value = 'Radio';
  chiudiVoceFissa();
});
await p.waitForTimeout(500);
const rifiutato = await stato();
c('rifiutando, l\'app non tocca niente', rifiutato.categorie.join('|') === prima.categorie.join('|'));

// --- si torna indietro e si rinomina accettando ---
await semina();
let chiesto = false;
p.once('dialog', d => { chiesto = /Riaggancio al nome nuovo/i.test(d.message()); d.accept(); });
await p.evaluate(() => {
  apriVoceFissa('radio');
  document.getElementById('cf-nome-radio').value = 'Radio';
  chiudiVoceFissa();
});
await p.waitForTimeout(700);
const dopo = await stato();
c('l\'app si accorge del rinomino e lo chiede', chiesto);
c('la voce si chiama come l\'hai rinominata', dopo.nome === 'Radio');
c('le due rate restano agganciate', dopo.movimenti === 2 && vicino(dopo.speso, 525.18));
c('la giornata non raddoppia: pesa solo la quota del budget',
  vicino(dopo.quota, prima.quota) && vicino(dopo.altre, 0));
c('gli importi non si toccano', dopo.importi.join('|') === prima.importi.join('|'));
c('il dettaglio dopo il trattino si conserva',
  dopo.categorie.some(x => /^Radio - rata marzo$/.test(x)));
c('e la spesa senza dettaglio prende il nome nuovo secco',
  dopo.categorie.some(x => x === 'Radio'));

await b.close();
console.log(`  ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
console.log(erroriJS.length ? '  *** errori JS: ' + erroriJS.join(' · ') : '  errori JS: nessuno');
