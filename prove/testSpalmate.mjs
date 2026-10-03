// Le spese a budget non devono pesare sul giorno in cui le paghi:
// la rata dell'assicurazione si spalma su tutti i giorni dell'anno.
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
const U = APP;
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.goto(U);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = new Date().getFullYear();
const GIORNO_RATA = `${ANNO}-03-10`;   // il giorno in cui esce la rata
const GIORNO_NORMALE = `${ANNO}-03-11`; // un giorno qualsiasi

await p.evaluate(({ rata, normale, anno }) => {
  // una sola voce a budget: 1.825 € all'anno = 5,00 € al giorno su 365
  window.vociFisse = [{ slug: 'assic-auto', nome: 'Assicurazione auto', importo: 1825, unita: 'anno', dataInizio: '', dataFine: '' }];
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  window.dailyRecords = [
    { id: 'r1', data: rata, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 100, ora: '10:00' },
    { id: 'r2', data: normale, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 100, ora: '10:00' },
    { id: 's1', data: rata, tipo: 'USCITA', categoria: 'Assicurazione auto', metodo: 'Bonifico', importo: 1825 },
    { id: 's2', data: normale, tipo: 'USCITA', categoria: 'Carburante', metodo: 'Bonifico', importo: 60 }
  ];
  window.shifts = [
    { id: 't1', data: rata, turno: 'Le otto', inizio: '08:00', fine: '16:00', ore: 8, lavorato: true, kmTot: 100 },
    { id: 't2', data: normale, turno: 'Le otto', inizio: '08:00', fine: '16:00', ore: 8, lavorato: true, kmTot: 100 }
  ];
  window.annoScelto = String(anno);
  // v108: le cifre sono coperte per difetto, qui le scopriamo per poterle leggere
  localStorage.setItem('taxi_incasso_visibile', 'si'); window.incassoVisibile = true;
}, { rata: GIORNO_RATA, normale: GIORNO_NORMALE, anno: ANNO });

const conti = await p.evaluate(({ rata, normale }) => ({
  giorniAnno: giorniDellAnno(String(rata).slice(0, 4)),
  quota: budgetDelGiorno(rata),
  rata: speseGiornataSpalmate(rata, window.dailyRecords.filter(r => r.tipo === 'USCITA' && r.data === rata)),
  normale: speseGiornataSpalmate(normale, window.dailyRecords.filter(r => r.tipo === 'USCITA' && r.data === normale)),
  annoVero: window.dailyRecords.filter(r => r.tipo === 'USCITA').reduce((a, r) => a + r.importo, 0)
}), { rata: GIORNO_RATA, normale: GIORNO_NORMALE });

const quota = 1825 / conti.giorniAnno;
const ok = (nome, vero, atteso) => {
  const bene = Math.abs(vero - atteso) < 0.02;
  console.log(`  ${bene ? 'ok ' : '***'} ${nome.padEnd(42)} ${vero.toFixed(2)} (atteso ${atteso.toFixed(2)})${bene ? '' : '  *** SBAGLIATO ***'}`);
  return bene;
};
let tutto = true;
tutto &= ok('quota a budget del giorno', conti.quota, quota);
tutto &= ok('giorno della rata: spese spalmate', conti.rata.totale, quota);
tutto &= ok('giorno della rata: fuori budget', conti.rata.fuoriBudget, 0);
tutto &= ok('giorno della rata: pagate a budget', conti.rata.pagateOggiABudget, 1825);
tutto &= ok('giorno normale: spese spalmate', conti.normale.totale, 60 + quota);
tutto &= ok('totale anno: resta quello vero', conti.annoVero, 1885);

// e adesso a video: la scheda di «Oggi» filtrata sul giorno della rata
await p.evaluate(g => { switchTab('giornata'); applyFilterGiornoGiornate(g); }, GIORNO_RATA);
await p.waitForTimeout(400);
const video = await p.evaluate(() => {
  const t = document.getElementById('main-container').innerText;
  return { spese: (t.match(/SPESE\s+(\u2212[\d.,]+)/i) || [])[1] || '?', aBudget: /a budget/.test(t), nota: /spalmat/i.test(t) };
});
console.log(`\n  testata «Oggi» del giorno della rata: Spese ${video.spese}`);
console.log(`  marchio «a budget» sulla riga: ${video.aBudget ? 'sì' : 'NO ***'}`);
console.log(`  spiegazione dello spalmare: ${video.nota ? 'sì' : 'NO ***'}`);
const atteso = '−' + quota.toFixed(2).replace('.', ',');
const beneVideo = video.spese.replace(/\s/g, ' ').includes(atteso);
console.log(`  ${beneVideo ? 'ok ' : '***'} la testata mostra ${atteso}${beneVideo ? '' : '  *** SBAGLIATO ***'}`);

// e il riepilogo giornaliero in Andamento deve dire lo stesso numero
await p.evaluate(g => { switchTab('dashboard'); cambiaPeriodoDash('giorno'); setDashGiorno(g); }, GIORNO_RATA);
await p.waitForTimeout(400);
const vid2 = await p.evaluate(() => {
  const t = document.getElementById('main-container').innerText;
  return (t.match(/SPESE\s+(\u2212[\d.,]+)/i) || [])[1] || '?';
});
console.log(`  riepilogo di Andamento: Spese ${vid2}`);
const bene2 = vid2.replace(/\s/g, ' ').includes(atteso);
console.log(`  ${bene2 ? 'ok ' : '***'} le due schermate dicono lo stesso numero${bene2 ? '' : '  *** SBAGLIATO ***'}`);

console.log('\nerrori JS:', errori.length ? errori : 'nessuno');
console.log(tutto && beneVideo && bene2 && !errori.length ? '\nTUTTO BENE' : '\nQUALCOSA NON TORNA');
await b.close();
