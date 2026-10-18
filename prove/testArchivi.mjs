// GLI ARCHIVI CHE SI SINCRONIZZANO
// Cinque archivi - scadenze, versamenti, note, parco auto, voci di budget -
// passano tutti dallo stesso pezzo di codice. Su quel pezzo ci sono i dati di
// anni di lavoro, e fino alla versione 157 non lo provava niente: senza un
// Cloud vero non si poteva. Adesso la logica e' separata dal cablaggio, e si
// puo' chiamare a mano con elenchi finti.
//
// Quello che si prova qui e' soprattutto la prudenza: una cartella vuota sul
// Cloud non deve MAI svuotare quello che c'e' sul telefono.
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
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.applicaSnapshotArchivio === 'function');
c('la logica degli archivi e\' raggiungibile e si puo\' provare', true);

// Un banco di prova: si tiene il conto di cosa e' stato mandato sul Cloud e
// di cosa e' stato scritto sul telefono.
const prova = (opz, locale, dalCloud, vuoto, salvaRompe) => p.evaluate(async (a) => {
  window[a.opz.nome] = a.locale;
  window.mandati = [];
  window.scritti = [];
  const scriviVero = window.scriviLocale;
  window.scriviLocale = (k, v) => { window.scritti.push({ k, n: (v || []).length }); return true; };
  const salvaUno = async (x) => {
    if (a.salvaRompe) throw new Error('il Cloud ha detto no');
    window.mandati.push(x[a.opz.campoId || 'id']);
  };
  let esito;
  try { esito = await window.applicaSnapshotArchivio(a.opz, a.dalCloud, a.vuoto, salvaUno); }
  finally { window.scriviLocale = scriviVero; }
  return { esito, mandati: window.mandati, scritti: window.scritti,
           inMemoria: (window[a.opz.nome] || []).map(x => x[a.opz.campoId || 'id']) };
}, { opz, locale, dalCloud, vuoto, salvaRompe });

// Ogni caso usa un archivio finto SUO. Le spie «il Cloud ha accettato» non si
// azzerano mai - e' voluto, valgono per tutta la vita della pagina - quindi due
// casi che usassero lo stesso nome si influenzerebbero a vicenda. Ci sono
// cascato scrivendo questa prova.
let n = 0;
const finto = (extra) => Object.assign({ nome: 'provaArchivio' + (++n),
                                         chiave: 'taxi_prova' + n, etichetta: 'Prova' }, extra || {});

// ------------------------------------------------------------------
// 1) LA COSA PIU' IMPORTANTE: il Cloud vuoto non svuota il telefono
let r = await prova(finto(), [{ id: 'n1', data: '2026-01-01', testo: 'mia' }], [], true, false);
c('Cloud vuoto + roba qui: NON si svuota niente', r.inMemoria.length === 1 && r.inMemoria[0] === 'n1');
c('e quello che c\'e\' qui viene portato su', r.mandati.length === 1 && r.mandati[0] === 'n1');
c('e non si riscrive il disco con una lista vuota', r.scritti.length === 0);
c('l\'esito lo dice: migrato', r.esito === 'migrato');

// 2) se il Cloud rifiuta la scrittura, i dati restano comunque qui
r = await prova(finto(), [{ id: 'n9', data: '2026-01-01', testo: 'mia' }], [], true, true);
c('se il Cloud rifiuta, i dati restano sul telefono', r.inMemoria.length === 1 && r.inMemoria[0] === 'n9');
c('e il disco non viene svuotato', r.scritti.length === 0);

// 2b) QUANDO INVECE SVUOTARE E' GIUSTO
// Se il Cloud ha gia' consegnato dati almeno una volta, un elenco vuoto vuol
// dire che li hai cancellati da un altro dispositivo, e la cancellazione deve
// arrivare anche qui. E' il comportamento voluto, e vale per tutti gli archivi
// tranne le voci di budget (vedi piu' sotto).
const a2 = finto();
await prova(a2, [], [{ id: 'z1' }], false, false);          // il Cloud consegna: spia accesa
r = await prova(a2, [{ id: 'z1' }], [], true, false);       // poi arriva vuoto
c('dopo che il Cloud ha consegnato, un elenco vuoto cancella anche qui', r.inMemoria.length === 0);
c('e il disco viene riscritto vuoto', r.scritti.length === 1 && r.scritti[0].n === 0);

// 3) il Cloud ha roba: si prende quella e si scrive sul disco
r = await prova(finto(), [{ id: 'vecchia' }],
                [{ id: 'a', data: '2026-01-01' }, { id: 'b', data: '2026-02-01' }], false, false);
c('con roba sul Cloud si prende quella', r.inMemoria.join(',') === 'a,b');
c('e la si scrive sul telefono', r.scritti.length === 1 && r.scritti[0].n === 2);
c('senza rimandare su niente', r.mandati.length === 0);
c('l\'esito lo dice: applicato', r.esito === 'applicato');

// 4) l'ordinamento viene applicato
r = await p.evaluate(async () => {
  window.provaOrdine = [];
  const scriviVero = window.scriviLocale; window.scriviLocale = () => true;
  await window.applicaSnapshotArchivio(
    { nome: 'provaOrdine', chiave: 'taxi_prova_ordine', ordina: perDataDecrescente },
    [{ id: 'vecchia', data: '2026-01-01' }, { id: 'nuova', data: '2026-12-01' }], false, async () => {});
  window.scriviLocale = scriviVero;
  return (window.provaOrdine || []).map(x => x.id);
});
c('l\'elenco arriva ordinato come deve', r.join(',') === 'nuova,vecchia');

// ------------------------------------------------------------------
// 5) LE VOCI DI BUDGET NON SI SVUOTANO MAI
// E' la regola di chi usa l'app: quell'elenco si modifica, non si cancella.
// Qui il Cloud ha gia' accettato dati una volta (cloudOk vero), quindi la
// strada della migrazione non si apre: senza la guardia, l'elenco sparirebbe.
r = await p.evaluate(async () => {
  const opz = { nome: 'provaVoci', chiave: 'taxi_prova_voci', etichetta: 'Voci di prova',
                campoId: 'slug', maiVuoto: true, conNav: false };
  const scriviVero = window.scriviLocale;
  let scritture = 0;
  window.scriviLocale = () => { scritture++; return true; };
  // prima un elenco pieno, cosi' la spia «il Cloud accetta» si accende
  window.provaVoci = [];
  await window.applicaSnapshotArchivio(opz, [{ slug: 'radio', nome: 'Radio taxi', importo: 3151 }], false, async () => {});
  const dopoPieno = (window.provaVoci || []).length;
  // poi arriva un elenco VUOTO: non deve cancellare niente
  const esito = await window.applicaSnapshotArchivio(opz, [], true, async () => {});
  const dopoVuoto = (window.provaVoci || []).map(x => x.slug);
  window.scriviLocale = scriviVero;
  return { dopoPieno, dopoVuoto, esito, scritture };
});
c('le voci di budget arrivano dal Cloud', r.dopoPieno === 1);
c('un elenco vuoto dal Cloud NON cancella le voci di budget', r.dopoVuoto.join(',') === 'radio');
c('e non riscrive il disco', r.scritture === 1);
c('l\'esito lo dice: tenuto', r.esito === 'tenuto');

// 6) la chiave «slug» viene rispettata
r = await p.evaluate(async () => {
  window.provaVoci2 = [];
  const scriviVero = window.scriviLocale; window.scriviLocale = () => true;
  await window.applicaSnapshotArchivio(
    { nome: 'provaVoci2', chiave: 'taxi_prova_voci2', campoId: 'slug', maiVuoto: true, conNav: false },
    [{ slug: 'assic', nome: 'Assicurazione' }], false, async () => {});
  window.scriviLocale = scriviVero;
  return (window.provaVoci2 || []).map(x => x.slug + ':' + x.nome);
});
c('la chiave slug arriva intera', r.join(',') === 'assic:Assicurazione');

// 7) tutti e cinque gli archivi sono agganciati con i dati giusti
const agganci = await p.evaluate(() => {
  const t = document.documentElement.innerHTML;
  return ['taxi_scadenze', 'taxi_versamenti', 'taxi_note', 'taxi_veicoli', 'taxi_voci_fisse']
    .map(k => ({ chiave: k, agganciato: t.includes(`chiave: '${k}'`) }));
});
for (const a of agganci) c(`${a.chiave} passa dallo schema comune`, a.agganciato);

// 8) movimenti e turni NON devono passare di qui: hanno il loro meccanismo
const fuori = await p.evaluate(() => {
  const t = document.documentElement.innerHTML;
  return { records: !t.includes("chiave: 'taxi_records'"), shifts: !t.includes("chiave: 'taxi_shifts'"),
           ancoraLoro: t.includes('onSnapshot(recordsCol') && t.includes('onSnapshot(shiftsCol') };
});
c('i movimenti restano sul loro meccanismo', fuori.records && fuori.ancoraLoro);
c('e i turni anche', fuori.shifts);

console.log(`${ok} controlli passati` + (ko.length ? `\n*** ${ko.length} FALLITI ***\n  - ` + ko.join('\n  - ') : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') + ' ***' : 'nessuno'));
await b.close();
