// IL CONTROLLO CHE TROVA LE SPESE RIMASTE SENZA VOCE
// Una spesa si aggancia al budget dal nome. Se una voce viene rinominata dopo
// che le spese erano gia' registrate, quelle smettono di agganciarsi: la voce
// risulta non pagata e gli stessi soldi pesano due volte sulla giornata.
// Dalla v139 l'app lo chiede al momento del rinomino, ma chi l'ha gia' fatto
// prima si ritrova il danno in archivio. Qui si prova il controllo che lo
// trova da solo, e il tasto che lo ripara.
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
const p = await b.newPage({ viewport: { width: 420, height: 1100 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = String(new Date().getFullYear());
// L'archivio di chi ha rinominato la voce prima della v139: la voce si chiama
// «Radio», le spese sono rimaste «Radio taxi». Piu' due spese che non c'entrano
// niente con nessuna voce, e che NON devono essere proposte.
await p.evaluate((anno) => {
  window.vociFisse = [
    { slug: 'radio', nome: 'Radio', importo: 3151.08, unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' },
    { slug: 'assic', nome: 'Assicurazione', importo: 1387, unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' }
  ];
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['carburante']));
  window.dailyRecords = [
    { id: 'e1', data: `${anno}-02-01`, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 4000 },
    { id: 'r1', data: `${anno}-02-10`, tipo: 'USCITA', categoria: 'Radio taxi', metodo: 'Bonifico', importo: 262.59 },
    { id: 'r2', data: `${anno}-03-10`, tipo: 'USCITA', categoria: 'Radio taxi - rata marzo', metodo: 'Bonifico', importo: 262.59 },
    { id: 'x1', data: `${anno}-02-12`, tipo: 'USCITA', categoria: 'Carburante', metodo: 'Bonifico', importo: 61 },
    { id: 'x2', data: `${anno}-02-14`, tipo: 'USCITA', categoria: 'Lavaggio', metodo: 'Contanti', importo: 18 }
  ];
  window.shifts = []; window.scadenze = []; window.veicoli = [];
  window.annoScelto = anno; window.versioneDati = (window.versioneDati || 0) + 1;
  switchTab('categorie'); renderContent();
}, ANNO);
await p.waitForTimeout(500);

const stato = () => p.evaluate((anno) => {
  const g = speseOrfaneDiVoce();
  const cong = conguaglioAnno(anno);
  const q = quotaDelGiorno(`${anno}-02-15`);
  const riga = cong.righe.find(r => r.nome === 'Radio') || {};
  return {
    gruppi: g.map(x => ({ voce: x.voce.nome, n: x.spese.length, totale: +x.totale.toFixed(2) })),
    spesoRadio: +(riga.speso || 0).toFixed(2), movRadio: riga.movimenti || 0,
    quota: +q.quota.toFixed(4), altre: +q.altre.toFixed(4), budget: +q.budget.toFixed(4),
    giorniAltre: q.giorniAltre,
    categorie: (window.dailyRecords || []).filter(x => x.tipo === 'USCITA').map(x => x.categoria).sort().join('|'),
    importi: (window.dailyRecords || []).filter(x => x.tipo === 'USCITA').map(x => x.importo).sort().join('|'),
    aVideo: document.getElementById('main-container').innerText
  };
}, ANNO);

const prima = await stato();
c('il controllo trova il gruppo rimasto orfano', prima.gruppi.length === 1 && prima.gruppi[0].voce === 'Radio');
c('con tutte e due le spese', prima.gruppi[0].n === 2 && vicino(prima.gruppi[0].totale, 525.18));
c('e non propone carburante e lavaggio, che non c\'entrano',
  !prima.gruppi.some(x => /Assicurazione/.test(x.voce)));
c('prima di ripararlo la voce risulta non pagata', prima.spesoRadio === 0 && prima.movRadio === 0);
c('e la giornata porta due volte la stessa spesa', prima.altre > 0 && prima.quota > prima.budget);
c('l\'avviso compare nella schermata', /somigliano a una voce ma non le sono agganciate/i.test(prima.aVideo));
c('e la sezione del budget si apre da sola', /Le voci del/i.test(prima.aVideo));

// --- si rifiuta: niente cambia ---
p.once('dialog', d => d.dismiss());
await p.evaluate(() => agganciaOrfaneAVoce('radio'));
await p.waitForTimeout(400);
const rifiutato = await stato();
c('rifiutando non si tocca niente', rifiutato.categorie === prima.categorie);

// --- si accetta ---
let chiesto = false;
p.once('dialog', d => { chiesto = /Aggancio 2 spese/i.test(d.message()); d.accept(); });
await p.evaluate(() => agganciaOrfaneAVoce('radio'));
await p.waitForTimeout(700);
const dopo = await stato();
c('il tasto chiede conferma dicendo quante e quanto', chiesto);
c('dopo, non c\'e\' piu\' niente di orfano', dopo.gruppi.length === 0);
c('la voce risulta pagata', dopo.movRadio === 2 && vicino(dopo.spesoRadio, 525.18));
// Carburante e lavaggio restano fuori budget per davvero: quello che deve
// sparire e' solo il doppione della rata. La media del giorno guarda il mese,
// e in febbraio di rate ce n'e' una sola - l'altra e' di marzo.
c('la giornata perde esattamente il doppione della rata di febbraio',
  vicino(prima.altre - dopo.altre, 262.59 / prima.giorniAltre));
c('e quello che resta fuori budget e\' solo carburante + lavaggio',
  vicino(dopo.altre, 79 / dopo.giorniAltre));
c('gli importi non si toccano', dopo.importi === prima.importi);
c('il dettaglio dopo il trattino si conserva', /Radio - rata marzo/.test(dopo.categorie));
c('e l\'avviso sparisce', !/somigliano a una voce ma non le sono agganciate/i.test(dopo.aVideo));

await b.close();
console.log(`  ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
console.log(erroriJS.length ? '  *** errori JS: ' + erroriJS.join(' · ') : '  errori JS: nessuno');
