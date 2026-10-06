// UNA CORSA SEGNATA DA VERIFICARE
// Il segno sta sul movimento, quindi deve seguirlo dappertutto: nel registro
// della giornata, nella testata della giornata chiusa, e nel prospetto dei
// corrispettivi - che e' il posto dove i conti del mese si chiudono.
// E non deve toccare nessun importo: e' un promemoria, non un movimento.
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
const p = await b.newPage({ viewport: { width: 390, height: 1600 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
p.on('dialog', d => d.accept());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = String(new Date().getFullYear());
const G = `${ANNO}-03-10`;
await p.evaluate(({ anno, g }) => {
  window.vociFisse = []; localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  window.dailyRecords = [
    { id: 'c1', data: g, tipo: 'ENTRATA', categoria: 'Stazione', metodo: 'POS', importo: 42.50, ora: '09:00' },
    { id: 'c2', data: g, tipo: 'ENTRATA', categoria: 'Aeroporto', metodo: 'Contanti', importo: 61.00, ora: '11:00' },
    { id: 'c3', data: `${anno}-03-12`, tipo: 'ENTRATA', categoria: 'Ospedale', metodo: 'Conto', importo: 18.00, ora: '08:00' }
  ];
  window.shifts = [{ id: 't1', data: g, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 170 }];
  window.scadenze = []; window.veicoli = [];
  window.annoScelto = anno; window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
}, { anno: ANNO, g: G });

const totali = () => p.evaluate((anno) => {
  const st = getStats ? getStats(anno) : null;
  const c = corrispettiviMese(anno + '-03');
  return { incassi: st ? st.incassi : null, totMese: c.totali.tot, nCorse: c.totali.n };
}, ANNO);

const prima = await totali();

// --- si segna, e il dato lo registra ---
await p.evaluate(() => alternaVerificaCorsa('c1'));
await p.waitForTimeout(400);
const dopo = await p.evaluate(() => {
  const r = (window.dailyRecords || []).find(x => x.id === 'c1');
  const c = corrispettiviMese(window.annoScelto + '-03');
  const g = c.righe.find(x => x.iso.endsWith('-10'));
  return { segnata: !!r.daVerificare, importo: r.importo, categoria: r.categoria,
           nelGiorno: g ? g.daVerificare : null, nelMese: c.totali.daVerificare,
           elenco: c.daVerificare.map(x => x.id) };
});
c('il movimento porta il segno', dopo.segnata === true);
c('l\'importo non si tocca', dopo.importo === 42.50);
c('la descrizione non si tocca', dopo.categoria === 'Stazione');
c('il giorno dei corrispettivi conta la corsa segnata', dopo.nelGiorno === 1);
c('il mese dei corrispettivi la conta', dopo.nelMese === 1);
c('l\'elenco del mese la contiene', dopo.elenco.length === 1 && dopo.elenco[0] === 'c1');

const dopoTot = await totali();
c('gli incassi dell\'anno non cambiano', prima.incassi === dopoTot.incassi);
c('il totale del mese non cambia', Math.abs(prima.totMese - dopoTot.totMese) < 0.005);
c('il numero di corse non cambia', prima.nCorse === dopoTot.nCorse);

// --- si vede nel registro della giornata ---
await p.evaluate((g) => { switchTab('giornata'); applyFilterGiornoGiornate(g); }, G);
await p.waitForTimeout(400);
const registro = await p.evaluate(() => document.getElementById('main-container').innerText);
c('il registro della giornata mostra «da verificare»', /da verificare/i.test(registro));

// --- si vede nei corrispettivi ---
await p.evaluate(() => {
  switchTab('dashboard'); cambiaPeriodoDash('mese');
  window.dashMese = window.annoScelto + '-03';
  try { localStorage.setItem('taxi_apri_corrisp', '1'); } catch (e) {}
  renderContent();
});
await p.waitForTimeout(500);
const corrisp = await p.evaluate(() => {
  const t = document.getElementById('main-container').innerText;
  return { testo: t, avviso: /1 corsa da verificare in marzo/i.test(t), riga: /1 da verificare/i.test(t) };
});
c('i corrispettivi avvisano quante ce ne sono', corrisp.avviso);
c('la riga del giorno porta il segno', corrisp.riga);
c('l\'elenco nomina la corsa', /Stazione/.test(corrisp.testo));

// --- il prospetto in CSV porta la colonna solo quando serve ---
const csv = await p.evaluate((anno) => {
  const c = corrispettiviMese(anno + '-03');
  const senza = corrispettiviMese(anno + '-04');
  return { conSegno: c.totali.daVerificare, senzaSegno: senza.totali.daVerificare };
}, ANNO);
c('un mese senza segni non ha niente da verificare', csv.senzaSegno === 0);
c('il mese con il segno lo conta', csv.conSegno === 1);

// --- si toglie ---
await p.evaluate(() => alternaVerificaCorsa('c1'));
await p.waitForTimeout(400);
const tolto = await p.evaluate(() => {
  const r = (window.dailyRecords || []).find(x => x.id === 'c1');
  const c = corrispettiviMese(window.annoScelto + '-03');
  return { campo: Object.prototype.hasOwnProperty.call(r, 'daVerificare'), mese: c.totali.daVerificare };
});
c('togliendo il segno il campo sparisce dal movimento', tolto.campo === false);
c('e i corrispettivi tornano puliti', tolto.mese === 0);

await b.close();
console.log(`  ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
console.log(erroriJS.length ? '  *** errori JS: ' + erroriJS.join(' · ') : '  errori JS: nessuno');
