// LE NOTE: QUELLO CHE E' SUCCESSO, CON LA SUA DATA
// Non sono movimenti e non devono entrare in nessun conto. Qui si prova il
// giro completo dai tasti veri - scrivere, filtrare per tipo, modificare,
// eliminare - piu' le due cose che contano: che compaiano sotto la giornata a
// cui si riferiscono, e che non spostino di un centesimo incassi, spese,
// budget e tasse.
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

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 1200 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
p.on('dialog', d => d.accept());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = String(new Date().getFullYear());
const G = `${ANNO}-03-10`;
await p.evaluate(({ anno, g }) => {
  window.vociFisse = [{ slug: 'r', nome: 'Radio taxi', importo: 3151.08, unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' }];
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['carburante']));
  window.dailyRecords = [
    { id: 'e1', data: g, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 120 },
    { id: 'u1', data: g, tipo: 'USCITA', categoria: 'Carburante', metodo: 'Bonifico', importo: 60 }
  ];
  window.shifts = [{ id: 't1', data: g, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 170 }];
  window.scadenze = []; window.veicoli = []; window.note = [];
  window.annoScelto = anno; window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
}, { anno: ANNO, g: G });

const conti = () => p.evaluate((anno) => {
  const st = getStats(); const agg = aggrega(anno); const cong = conguaglioAnno(anno);
  const q = quotaDelGiorno(`${anno}-03-10`);
  return { entrate: st.entrate, uscite: st.uscite, tasse: st.tasse, budget: budgetAnno(anno),
           cong: cong.speso, quota: +q.quota.toFixed(4), corse: agg.nCorse };
}, ANNO);

const prima = await conti();

// --- si scrive una nota dal modulo vero ---
await p.evaluate(() => { switchTab('note'); renderContent(); });
await p.waitForTimeout(400);
await p.evaluate(({ g }) => {
  document.getElementById('nota-data').value = g;
  document.getElementById('nota-tipo').value = 'Vettura';
  document.getElementById('nota-testo').value = 'Gomme nuove sull\'anteriore';
  aggiungiNota(new Event('submit'));
}, { g: G });
await p.waitForTimeout(400);
let n = await p.evaluate(() => (window.note || []).map(x => ({ data: x.data, tipo: x.tipo, testo: x.testo })));
c('la nota si salva con data, tipo e testo',
  n.length === 1 && n[0].data === G && n[0].tipo === 'Vettura' && /Gomme nuove/.test(n[0].testo));
c('ed e\' finita su disco', await p.evaluate(() => (JSON.parse(localStorage.getItem('taxi_note') || '[]')).length === 1));

// --- un tipo scritto a mano ---
await p.evaluate(({ anno }) => {
  document.getElementById('nota-data').value = `${anno}-05-02`;
  document.getElementById('nota-tipo').value = '__altro__';
  alternaTipoNotaAltro(document.getElementById('nota-tipo'), 'nota-tipo-altro');
  document.getElementById('nota-tipo-altro').value = 'Grandine';
  document.getElementById('nota-testo').value = 'Grandinata, ammaccatura sul tetto';
  aggiungiNota(new Event('submit'));
}, { anno: ANNO });
await p.waitForTimeout(400);
n = await p.evaluate(() => (window.note || []).map(x => x.tipo));
c('un tipo scritto a mano si salva com\'e\'', n.includes('Grandine'));
c('e le note stanno dalla piu\' recente',
  await p.evaluate(() => { const l = window.note || []; return l.length === 2 && l[0].data > l[1].data; }));

// --- il filtro per tipo ---
await p.evaluate(() => { cambiaFiltroNota('Vettura'); });
await p.waitForTimeout(400);
let video = await p.evaluate(() => document.getElementById('main-container').innerText);
c('il filtro mostra solo quel tipo', /Gomme nuove/.test(video) && !/Grandinata/.test(video));
await p.evaluate(() => { cambiaFiltroNota('ALL'); });
await p.waitForTimeout(400);
video = await p.evaluate(() => document.getElementById('main-container').innerText);
c('e «Tutte» le rimette', /Gomme nuove/.test(video) && /Grandinata/.test(video));

// --- i conti non si muovono ---
const dopo = await conti();
c('gli incassi non cambiano', prima.entrate === dopo.entrate);
c('le uscite non cambiano', prima.uscite === dopo.uscite);
c('le tasse non cambiano', Math.abs(prima.tasse - dopo.tasse) < 0.005);
c('il budget non cambia', Math.abs(prima.budget - dopo.budget) < 0.005);
c('il conguaglio non cambia', Math.abs(prima.cong - dopo.cong) < 0.005);
c('il costo della giornata non cambia', Math.abs(prima.quota - dopo.quota) < 0.005);
c('il numero di corse non cambia', prima.corse === dopo.corse);

// --- compare sotto la giornata a cui si riferisce ---
await p.evaluate((g) => { switchTab('giornata'); applyFilterGiornoGiornate(g); }, G);
await p.waitForTimeout(500);
video = await p.evaluate(() => document.getElementById('main-container').innerText);
c('la nota compare nel registro di quella giornata', /Gomme nuove/.test(video));
c('e porta il suo tipo', /Vettura/.test(video));
c('ma non compare quella di un altro giorno', !/Grandinata/.test(video));

// --- modifica ---
await p.evaluate(() => { switchTab('note'); renderContent(); });
await p.waitForTimeout(400);
const idVettura = await p.evaluate(() => (window.note || []).find(x => x.tipo === 'Vettura').id);
await p.evaluate((id) => apriModificaNota(id), idVettura);
await p.waitForTimeout(300);
await p.evaluate((id) => {
  document.getElementById('nt-testo-' + id).value = 'Gomme nuove su tutte e quattro';
  salvaModificaNota(id);
}, idVettura);
await p.waitForTimeout(400);
c('la modifica si salva',
  await p.evaluate((id) => ((window.note || []).find(x => x.id === id) || {}).testo === 'Gomme nuove su tutte e quattro', idVettura));

// --- backup: le note viaggiano ---
const backup = await p.evaluate(() => JSON.parse(JSON.stringify(datiDaSalvare())));
c('il backup si porta dietro le note', Array.isArray(backup.note) && backup.note.length === 2);
await p.evaluate(() => { window.note = []; salvaNote(); });
await p.evaluate(async (b) => { await applicaBackup(b); }, backup);
await p.waitForTimeout(600);
c('e reimportandolo tornano tutte',
  await p.evaluate(() => (window.note || []).length === 2));

// --- eliminazione ---
await p.evaluate((id) => eliminaNota(id), idVettura);
await p.waitForTimeout(400);
c('l\'eliminazione toglie solo quella',
  await p.evaluate((id) => { const l = window.note || []; return l.length === 1 && !l.some(x => x.id === id); }, idVettura));

await b.close();
console.log(`  ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
console.log(erroriJS.length ? '  *** errori JS: ' + erroriJS.join(' · ') : '  errori JS: nessuno');
