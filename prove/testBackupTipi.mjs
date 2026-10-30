// UN BACKUP CON I TIPI STORTI NON ROMPE LE SCHERMATE
// L'app scrive categoria, metodo, nome di una scadenza e modello di una
// vettura sempre come stringhe, e l'importo come cifra; il resto del codice
// li tratta cosi' senza chiedersi niente. Un file arrivato da fuori pero'
// puo' avere «metodo: 5», «importo: {}», un oggetto al posto del nome: e un
// «(metodo || '').toLowerCase()» con un numero dentro si ferma, e con lui
// tutta la scheda. Prima della fase 1 il ripristino controllava solo id e
// data, e quei campi entravano com'erano: aperta la scheda sbagliata, la
// pagina restava vuota fino a quando non si cancellava il dato a mano.
// Qui si rimette dal tasto vero (scheda Cloud, «Scegli un file di backup»,
// rispondendo si') un backup con dentro, insieme, righe storte e righe
// buone, e si guarda:
//   - nessun errore JS aprendo tutte le schede (e le viste del dashboard);
//   - le righe buone entrano IDENTICHE, campo per campo e tipo per tipo;
//   - quelle storte sono state ripulite come promesso: un numero diventa la
//     stessa cifra scritta, un oggetto diventa vuoto; una riga con l'importo
//     che non e' una cifra si scarta (un importo inventato sposterebbe i
//     conti); una vettura senza modello si scarta come prima;
//   - i conti a video: l'incasso del giorno e' quello delle sole righe buone.
// Orologio e fuso fermi: 11 marzo 2026, mezzogiorno a Torino.
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

let guai = 0;
const ok = (c, testo, dettaglio) => {
  if (!c) guai++;
  console.log(`  ${c ? 'ok  ' : '*** '}${testo}${dettaglio ? '  (' + dettaglio + ')' : ''}${c ? '' : ' ***'}`);
};

const OGGI = '2026-03-11';
const corsa = (id, extra) => Object.assign({ id, data: OGGI, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 30, ora: '10:00' }, extra);
// Le righe buone, con le forme meno ovvie che l'app scrive davvero.
const BUONE = {
  records: [corsa('rb1', { importo: 42.5 }), corsa('rb2', { metodo: 'Contanti', importo: 18 }),
            corsa('rb3', { tipo: 'USCITA', categoria: 'Carburante', metodo: 'Contanti', importo: 60, nota: 'pieno' })],
  scadenze: [{ id: 'scb', data: '2026-04-15', nome: 'Revisione', cadenza: 'annuale' }],
  veicoli: [{ id: 'vb', modello: 'Toyota Prius', targa: 'AB123CD', kmAcquisto: 1200, manutenzioni: [{ slug: 'tagliando', nome: 'Tagliando', ogniKm: 15000, kmBase: 1200 }] }]
};
const STORTE = {
  records: [corsa('rs-metodo', { metodo: 5, importo: 11 }),
            corsa('rs-importo', { importo: {} }),
            corsa('rs-categoria', { categoria: { a: 1 }, importo: 7 }),
            corsa('rs-metodo-oggetto', { metodo: { nome: 'POS' }, importo: 9 })],
  scadenze: [{ id: 'scs', data: '2026-04-20', nome: { testo: 'Bollo' }, cadenza: 'annuale' }],
  veicoli: [{ id: 'vs', modello: { marca: 'Fiat' }, targa: 'ZZ999ZZ' }]
};
const BACKUP = {
  versione: 3, date: '2026-03-10T10:00:00.000Z',
  records: [...BUONE.records, ...STORTE.records],
  shifts: [{ id: 'toggi', data: OGGI, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true }],
  scadenze: [...BUONE.scadenze, ...STORTE.scadenze],
  veicoli: [...BUONE.veicoli, ...STORTE.veicoli],
  vociFisse: [], note: [], versamenti: []
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
await p.clock.setFixedTime(new Date('2026-03-11T12:00:00+01:00'));
const errori = [];
let dove = 'avvio';
p.on('pageerror', e => errori.push(`${dove}: ${String(e).split('\n')[0]}`));
const domande = [];
p.on('dialog', d => { domande.push(d.message()); return d.accept(); });
await p.goto(APP);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si'); });
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
await p.evaluate(() => switchTab('cloud'));
await p.waitForTimeout(250);
dove = 'ripristino';
await p.setInputFiles('input[onchange="importBackup(event)"]',
  { name: 'TaxiManager_Backup_2026-03-10.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(BACKUP)) });
await p.waitForTimeout(1200);
ok(domande.length === 1, 'il ripristino chiede, e si risponde si\'', JSON.stringify(domande).slice(0, 160));

const dentro = await p.evaluate(() => ({
  rec: window.dailyRecords || [], scad: window.scadenze || [], vei: window.veicoli || [],
  disco: JSON.parse(localStorage.getItem('taxi_records') || '[]')
}));
const per = (lista, id) => lista.find(x => String(x.id) === id);
console.log('\n1. LE RIGHE BUONE ENTRANO IDENTICHE');
for (const r of BUONE.records) {
  ok(JSON.stringify(per(dentro.rec, r.id)) === JSON.stringify(r), `movimento ${r.id} identico in memoria`, JSON.stringify(per(dentro.rec, r.id)));
  ok(JSON.stringify(per(dentro.disco, r.id)) === JSON.stringify(r), `  e su disco`, JSON.stringify(per(dentro.disco, r.id)));
}
ok(JSON.stringify(per(dentro.scad, 'scb')) === JSON.stringify(BUONE.scadenze[0]), 'la scadenza buona identica', JSON.stringify(per(dentro.scad, 'scb')));
ok(JSON.stringify(per(dentro.vei, 'vb')) === JSON.stringify(BUONE.veicoli[0]), 'la vettura buona identica, interventi compresi', JSON.stringify(per(dentro.vei, 'vb')));

console.log('\n2. LE RIGHE STORTE, RIPULITE');
const rm = per(dentro.rec, 'rs-metodo');
ok(!!rm && rm.metodo === '5' && rm.importo === 11, 'metodo 5: la riga entra, col metodo scritto «5»', JSON.stringify(rm));
ok(!per(dentro.rec, 'rs-importo'), 'importo {}: la riga si scarta', JSON.stringify(per(dentro.rec, 'rs-importo')));
const rc = per(dentro.rec, 'rs-categoria');
ok(!!rc && rc.categoria === '' && rc.importo === 7, 'categoria oggetto: la riga entra, con la categoria vuota', JSON.stringify(rc));
const ro = per(dentro.rec, 'rs-metodo-oggetto');
ok(!!ro && ro.metodo === '', 'metodo oggetto: vuoto', JSON.stringify(ro));
const ss = per(dentro.scad, 'scs');
ok(!!ss && ss.nome === '', 'scadenza col nome oggetto: entra col nome vuoto', JSON.stringify(ss));
ok(!per(dentro.vei, 'vs'), 'vettura col modello oggetto: si scarta (senza modello non e\' una vettura)', JSON.stringify(per(dentro.vei, 'vs')));
const nessunOggetto = [...dentro.rec, ...dentro.scad, ...dentro.vei].every(x =>
  ['categoria', 'metodo', 'nome', 'modello', 'tipo'].every(k => x[k] === undefined || typeof x[k] === 'string'));
ok(nessunOggetto, 'in memoria nessun campo di testo e\' rimasto un numero o un oggetto');

console.log('\n3. NESSUNA SCHERMATA SI ROMPE');
const errPrima = errori.length;
const SCHEDE = ['dashboard', 'giornata', 'uscite', 'auto', 'scadenze', 'rendimento', 'categorie',
                'report', 'versamenti', 'note', 'cloud', 'altro'];
const vuote = [];
for (const t of SCHEDE) {
  dove = 'scheda ' + t;
  await p.evaluate(t => switchTab(t), t).catch(e => errori.push(`${dove}: ${String(e).split('\n')[0]}`));
  await p.waitForTimeout(150);
  const testo = await p.evaluate(() => (document.getElementById('main-container') || {}).innerText || '');
  if (testo.trim().length < 20) vuote.push(t);
}
for (const per of ['giorno', 'mese', 'anno']) {
  dove = 'dashboard ' + per;
  await p.evaluate(per => { switchTab('dashboard'); cambiaPeriodoDash(per); }, per).catch(e => errori.push(`${dove}: ${String(e).split('\n')[0]}`));
  await p.waitForTimeout(150);
}
dove = 'giornate di oggi';
await p.evaluate(d => { switchTab('giornata'); setVistaGiornata('giornate'); applyFilterGiornoGiornate(d); }, OGGI)
  .catch(e => errori.push(`${dove}: ${String(e).split('\n')[0]}`));
await p.waitForTimeout(150);
ok(errori.length === 0, 'nessun errore JS, dal ripristino a tutte le schede', errori.slice(0, 5).join(' | '));
ok(vuote.length === 0, 'nessuna scheda resta vuota', vuote.join(', '));

console.log('\n4. I CONTI A VIDEO');
// Le corse di oggi entrate: rb1 42,50, rb2 18, rs-metodo 11, rs-categoria 7,
// rs-metodo-oggetto 9. Non quella con l'importo {}.
const attese = [42.5, 18, 11, 7, 9].reduce((a, v) => a + v, 0);
const lette = await p.evaluate(() => {
  window.incassoVisibile = true;
  try { renderContent(); } catch (e) { /* l'errore e' gia' contato sopra */ }
  return { video: document.getElementById('main-container').innerText,
           somma: (window.dailyRecords || []).filter(r => r.tipo === 'ENTRATA' && r.data === '2026-03-11').reduce((t, r) => t + importoDi(r.importo), 0) };
});
ok(Math.abs(lette.somma - attese) < 0.001, `l'incasso di oggi in archivio e' ${attese}`, String(lette.somma));
ok(/87,50/.test(lette.video), 'e a video, nelle giornate di oggi, si legge 87,50', lette.video.slice(0, 200).replace(/\n/g, ' '));
ok(!/NaN|undefined|\[object Object\]|Infinity/.test(lette.video), 'a video niente NaN, undefined, [object Object]');

await b.close();
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
