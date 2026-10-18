// DATI STORTI IN ARCHIVIO
// Un backup scritto a mano, un ritorno dal Cloud andato male, un anno vecchio
// importato da un'altra app: in archivio puo' finire roba che non dovrebbe
// esserci. Quello che NON deve succedere e' che l'app mostri numeri diversi
// da una schermata all'altra, o che si fermi.
//
// Da qui e' uscito un difetto vero: con l'importo scritto storto la dashboard
// mostrava «NaN €» e la scheda del commercialista zero. Nessun errore, nessun
// avviso: due schermate che dicevano due cose.
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

const A = String(new Date().getFullYear());
const SCHERMATE = ['dashboard', 'giornata', 'uscite', 'report', 'categorie',
                   'rendimento', 'versamenti', 'auto', 'scadenze', 'note'];

const casi = [
  ['importo mancante',   { id: 'a1', data: `${A}-03-10`, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS' }],
  ['importo null',       { id: 'a2', data: `${A}-03-10`, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: null }],
  ['importo scritto storto', { id: 'a3', data: `${A}-03-10`, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 'abc' }],
  ['importo vuoto',      { id: 'a4', data: `${A}-03-10`, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: '' }],
  ['data senza senso',   { id: 'a5', data: 'pippo', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 }],
  ['data mancante',      { id: 'a6', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 }],
  ['tipo sconosciuto',   { id: 'a7', data: `${A}-03-10`, tipo: 'BOH', categoria: 'Corsa', metodo: 'POS', importo: 10 }],
  ['metodo mancante',    { id: 'a8', data: `${A}-03-10`, tipo: 'ENTRATA', categoria: 'Corsa', importo: 10 }],
  ['29 febbraio di un anno non bisestile', { id: 'a9', data: '2026-02-29', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 }],
  ['importo enorme',     { id: 'a10', data: `${A}-03-10`, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 1e15 }],
  ['due movimenti con lo stesso identificativo', { id: 'a11', data: `${A}-03-10`, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 }]
];

for (const [nome, rec] of casi) {
  const quantiErroriPrima = erroriJS.length;
  const r = await p.evaluate(({ rec, anno, nome }) => {
    window.dailyRecords = nome.startsWith('due movimenti') ? [rec, Object.assign({}, rec)] : [rec];
    window.shifts = []; window.scadenze = []; window.veicoli = [];
    window.vociFisse = []; window.note = []; window.versamenti = [];
    window.annoScelto = anno; window.versioneDati = (window.versioneDati || 0) + 1;
    const st = getStats(); const agg = aggrega(anno); const rep = getReportStats('ALL');
    return { entrate: st.entrate, incassiAgg: agg.incassi, incassiRep: rep.incassiTot,
             utileFiscale: st.utileFiscale, tasse: st.tasse,
             conguaglio: conguaglioAnno(anno).speso, budget: budgetAnno(anno),
             quota: quotaDelGiorno(`${anno}-03-10`).quota };
  }, { rec, anno: A, nome });

  // 1) nessun numero puo' essere NaN o infinito: si attaccherebbe a tutto
  const marci = Object.entries(r).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v));
  c(`${nome}: nessun numero marcio`, marci.length === 0);
  if (marci.length) console.log(`    marci: ${marci.map(([k, v]) => k + '=' + v).join(', ')}`);

  // 2) le tre strade che contano gli incassi devono dire la stessa cifra
  const uguali = Math.abs(r.entrate - r.incassiAgg) < 0.005 && Math.abs(r.entrate - r.incassiRep) < 0.005;
  c(`${nome}: dashboard, riepilogo e report dicono lo stesso incasso`, uguali);
  if (!uguali) console.log(`    entrate ${r.entrate} · aggrega ${r.incassiAgg} · report ${r.incassiRep}`);

  // 3) e tutte le schermate si devono disegnare, senza NaN a video
  const video = await p.evaluate((schede) => {
    let testo = '';
    for (const s of schede) { switchTab(s); renderContent(); testo += document.getElementById('main-container').textContent; }
    return testo;
  }, SCHERMATE);
  c(`${nome}: nessun «NaN» scritto a video`, !/NaN/.test(video));
  c(`${nome}: nessun errore mentre si disegna`, erroriJS.length === quantiErroriPrima);
}

console.log(`${ok} controlli passati` + (ko.length ? `\n*** ${ko.length} FALLITI ***\n  - ` + ko.join('\n  - ') : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.slice(0, 3).join(' | ') + ' ***' : 'nessuno'));
await b.close();
