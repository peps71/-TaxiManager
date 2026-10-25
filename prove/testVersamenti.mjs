// I VERSAMENTI DI CONTANTI
// Un versamento non e' un incasso nuovo: sono gli stessi soldi delle corse,
// che smettono di stare in tasca e cominciano a lasciare traccia. Quindi
// esattamente due cifre si devono muovere - l'utile fiscale sale, i contanti
// in cassa scendono - e tutto il resto deve restare fermo al centesimo.
// Qui si prova il giro vero dai tasti, e si guardano tutte e due le cose.
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
const vicino = (a, b) => Math.abs(a - b) < 0.005;

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
    // Cifre da anno vero: con 500 euro di utile le tasse sono piatte - domina
    // il minimale dell'INPS - e la prova non vedrebbe muoversi niente.
    { id: 'e1', data: g, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'Contanti', importo: 8000 },
    { id: 'e2', data: g, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS',      importo: 24000 },
    { id: 'u1', data: g, tipo: 'USCITA',  categoria: 'Carburante', metodo: 'Bonifico', importo: 4000 },
    { id: 'u2', data: g, tipo: 'USCITA',  categoria: 'Carburante', metodo: 'Contanti', importo: 1000 }
  ];
  window.shifts = [{ id: 't1', data: g, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 170 }];
  window.scadenze = []; window.veicoli = []; window.note = []; window.versamenti = [];
  window.annoScelto = anno; window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
}, { anno: ANNO, g: G });

// La fotografia completa: tutto quello che NON si deve muovere, piu' le due
// cifre che si devono muovere.
const foto = () => p.evaluate((anno) => {
  const st = getStats();
  const agg = aggrega(anno);
  const rep = getReportStats('ALL');
  const cong = conguaglioAnno(anno);
  return {
    // fermi
    entrate: st.entrate, uscite: st.uscite, utileCassa: st.utileCassa,
    contantiCorse: st.entrateContanti, tracciateCorse: st.entrateTracciateCorse,
    deducibili: st.deducibili, nCorse: agg.nCorse, incassiAgg: agg.incassi,
    contantiAgg: agg.contanti, budget: budgetAnno(anno), cong: cong.speso,
    repIncassi: rep.incassiTot, repContanti: rep.incassiContanti,
    // in movimento
    versato: st.versato, inCassa: st.contantiInCassa,
    tracciate: st.entrateTracciate, utileFiscale: st.utileFiscale, tasse: st.tasse,
    // le tre strade che calcolano la base: devono coincidere
    fiscaleGetStats: st.utileFiscale,
    fiscaleReport: rep.utileFiscale,
    fiscaleAnno: utileFiscaleAnno(anno),
    proiettato: utileProiettato(anno),
    quota: +quotaDelGiorno(`${anno}-03-10`).quota.toFixed(4)
  };
}, ANNO);

const prima = await foto();
c('si parte con 32.000 di incassi, 8.000 in contanti', vicino(prima.entrate, 32000) && vicino(prima.contantiCorse, 8000));
c('e l\'utile fiscale e\' 24.000 - 4.000 = 20.000', vicino(prima.utileFiscale, 20000));
c('i contanti in cassa sono tutti e 8.000', vicino(prima.inCassa, 8000));
c('le tre strade della base dicono la stessa cifra',
  vicino(prima.fiscaleGetStats, prima.fiscaleReport) && vicino(prima.fiscaleGetStats, prima.fiscaleAnno));

// ------------------------------------------------------------------
// Si registra un versamento dal modulo vero
await p.evaluate(() => { switchTab('versamenti'); renderContent(); });
await p.waitForTimeout(400);
c('la schermata dei versamenti si apre', await p.evaluate(() => !!document.getElementById('vers-importo')));

await p.evaluate(({ g }) => {
  document.getElementById('vers-data').value = g;
  document.getElementById('vers-importo').value = '5.000,00';
  document.getElementById('vers-dove').value = 'Intesa';
  document.getElementById('vers-nota').value = 'incassi della settimana';
  aggiungiVersamento(new Event('submit'));
}, { g: G });
await p.waitForTimeout(400);

const v = await p.evaluate(() => (window.versamenti || []).map(x => ({ data: x.data, importo: x.importo, dove: x.dove, nota: x.nota })));
c('il versamento si salva con data, cifra, dove e nota',
  v.length === 1 && v[0].data === G && vicino(v[0].importo, 5000) && v[0].dove === 'Intesa' && /settimana/.test(v[0].nota));
c('ed e\' finito su disco', await p.evaluate(() => (JSON.parse(localStorage.getItem('taxi_versamenti') || '[]')).length === 1));

const dopo = await foto();

// --- QUELLO CHE SI DEVE MUOVERE, E DI QUANTO ESATTO ---
c('l\'utile fiscale sale esattamente di 5.000', vicino(dopo.utileFiscale - prima.utileFiscale, 5000));
c('i contanti in cassa scendono esattamente di 5.000', vicino(prima.inCassa - dopo.inCassa, 5000));
c('e restano 3.000 in cassa', vicino(dopo.inCassa, 3000));
c('gli incassi che contano per il fisco salgono di 5.000', vicino(dopo.tracciate - prima.tracciate, 5000));
c('le tasse stimate salgono', dopo.tasse > prima.tasse);

// --- QUELLO CHE NON SI DEVE MUOVERE DI UN CENTESIMO ---
const fermi = ['entrate', 'uscite', 'utileCassa', 'contantiCorse', 'tracciateCorse', 'deducibili',
               'nCorse', 'incassiAgg', 'contantiAgg', 'budget', 'cong', 'repIncassi', 'repContanti'];
const mossi = fermi.filter(k => !vicino(prima[k], dopo[k]));
c('incassi, uscite, utile di cassa, contanti delle corse, spese, corse, budget e conguaglio: tutto fermo',
  mossi.length === 0);
if (mossi.length) console.log('    si sono mossi: ' + mossi.map(k => `${k} ${prima[k]} -> ${dopo[k]}`).join(' · '));

// --- LE TRE STRADE DEVONO RESTARE D'ACCORDO ---
c('getStats, il report e la proiezione dicono ancora la stessa base',
  vicino(dopo.fiscaleGetStats, dopo.fiscaleReport) && vicino(dopo.fiscaleGetStats, dopo.fiscaleAnno));
c('e la quota del costo giornaliero si e\' mossa con loro', dopo.quota > prima.quota);
// Il quarto punto che calcola la base, quello che era sfuggito: la proiezione
// dell'anno rifa' il conto per conto suo, e senza i versamenti restava ferma -
// i totali erano giusti ma la quota di IRPEF della giornata no.
c('anche la proiezione dell\'anno vede il versamento', dopo.proiettato > prima.proiettato);

// --- il mese filtrato nel report vede il versamento del suo mese ---
const perMese = await p.evaluate(() => ({
  marzo: getReportStats(3).versato, aprile: getReportStats(4).versato
}));
c('il report di marzo vede i 5.000, quello di aprile no', vicino(perMese.marzo, 5000) && vicino(perMese.aprile, 0));

// ------------------------------------------------------------------
// Versare piu' di quanto si e' incassato in contanti: si registra ma si avvisa
await p.evaluate(({ g }) => {
  document.getElementById('vers-data').value = g;
  document.getElementById('vers-importo').value = '6000';
  aggiungiVersamento(new Event('submit'));
}, { g: G });
await p.waitForTimeout(400);
const avviso = await p.evaluate((anno) => avvisoVersamentiEccessivi(anno), ANNO);
c('versando piu' + '’ del contante incassato, l\'app avvisa', avviso && vicino(avviso.eccesso, 3000));
c('e lo dice a video', /più di quanto hai incassato/.test(await p.evaluate(() => document.getElementById('main-container').textContent)));
c('non blocca: il versamento c\'e\'', (await p.evaluate(() => window.versamenti.length)) === 2);

// ------------------------------------------------------------------
// Una cifra storta non deve entrare
const quanti = await p.evaluate(({ g }) => {
  const prima = window.versamenti.length;
  document.getElementById('vers-data').value = g;
  document.getElementById('vers-importo').value = '0';
  aggiungiVersamento(new Event('submit'));
  document.getElementById('vers-importo').value = '-30';
  aggiungiVersamento(new Event('submit'));
  document.getElementById('vers-importo').value = 'abc';
  aggiungiVersamento(new Event('submit'));
  return { prima, dopo: window.versamenti.length };
}, { g: G });
c('zero, negativo e lettere vengono rifiutati', quanti.prima === quanti.dopo);

// ------------------------------------------------------------------
// Il backup se li porta dietro, e li rimette
const backup = await p.evaluate(() => JSON.stringify(datiDaSalvare()));
c('i versamenti stanno nel backup', JSON.parse(backup).versamenti.length === 2);
await p.evaluate(() => { window.versamenti = []; salvaVersamenti(); renderContent(); });
c('tolti, l\'utile fiscale torna quello di prima', vicino((await foto()).utileFiscale, prima.utileFiscale));
await p.evaluate((b) => applicaBackup(JSON.parse(b)), backup);
await p.waitForTimeout(600);
const tornati = await foto();
c('rimessi dal backup, tornano tutti e due', (await p.evaluate(() => window.versamenti.length)) === 2);
c('e l\'utile fiscale torna a salire di 11.000', vicino(tornati.utileFiscale - prima.utileFiscale, 11000));

// un backup con dentro un versamento storto non lo deve far entrare
await p.evaluate(() => { window.versamenti = []; salvaVersamenti(); });
await p.evaluate((anno) => applicaBackup({
  versione: 3, records: [], shifts: [], scadenze: [], veicoli: [], vociFisse: [], note: [],
  versamenti: [{ id: 'x1', data: `${anno}-03-10`, importo: -500 },
               { id: 'x2', data: 'non-una-data', importo: 100 },
               { id: 'x3', data: `${anno}-03-11`, importo: 'abc' },
               { id: 'x4', data: `${anno}-03-12`, importo: 80 }]
}), ANNO);
await p.waitForTimeout(600);
const soloBuono = await p.evaluate(() => (window.versamenti || []).map(x => x.id));
c('dal backup entra solo il versamento buono', soloBuono.length === 1 && soloBuono[0] === 'x4');

// ------------------------------------------------------------------
// Eliminare restituisce i soldi alla cassa
await p.evaluate(() => { const x = window.versamenti[0]; eliminaVersamento(x.id); });
await p.waitForTimeout(400);
const finale = await foto();
c('eliminandolo, l\'utile fiscale torna esattamente al punto di partenza', vicino(finale.utileFiscale, prima.utileFiscale));
c('e i contanti tornano tutti in cassa', vicino(finale.inCassa, prima.inCassa));
c('mentre incassi e corse non si sono mai mossi',
  vicino(finale.entrate, prima.entrate) && finale.nCorse === prima.nCorse);

console.log(`${ok} controlli passati` + (ko.length ? `\n*** ${ko.length} FALLITI ***\n  - ` + ko.join('\n  - ') : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') + ' ***' : 'nessuno'));
await b.close();
