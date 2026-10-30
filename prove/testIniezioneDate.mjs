// IDENTIFICATIVI E DATE VELENOSI NEI MOVIMENTI E NELLE SCADENZE
// testIniezione guarda il backup (che scarta le righe storte) e i campi dei
// turni. Qui la strada e' l'altra: movimenti e scadenze scritti DIRETTAMENTE
// in taxi_records e taxi_scadenze, dove nessuno pulisce - e' quello che
// arriva dal Cloud, o da un telefono con dati vecchi. L'identificativo e la
// data finiscono dentro onclick="...('${...}')" e value="${...}": prima
// della fase 1 molte di queste strade non passavano da escJs/esc, e una data
// come «2026-03-11');x();//» chiudeva l'apice e faceva partire x() al tocco
// (nel riepilogo del mese, nelle scadenze), mentre un «"><img onerror>» nella
// data partiva da solo, appena disegnata la dashboard.
// Qui si guarda in due modi, tutti e due necessari:
//   - un'immagine «x» nella pagina: il veleno e' entrato come HTML (anche se
//     il suo onerror non e' ancora partito);
//   - ogni gestore on...="..." della pagina, preso com'e', si esegue in una
//     scatola chiusa (node:vm) dove ogni nome e' una funzione muta, tranne
//     x() e __veleno() che prendono nota: se un gestore li chiama, l'apice e'
//     scappato. Cosi' si provano TUTTI i tasti senza toccarli uno a uno (e
//     senza far partire le azioni vere: cancellazioni, conferme).
// E naturalmente: nessun codice parte davvero (x() vero nella pagina).
// Le date storte non cadono in nessun giorno: le loro righe si cercano
// nell'anno intero (Giornate con «tutti i mesi», Spese con «ALL»), ed e' li'
// che la data finisce scritta a video nell'elenco delle spese.
//
// La scheda Rendimento con le DATE storte si ferma con «Cannot read
// properties of undefined (reading 'gg')»: e' un difetto noto, che c'era
// gia' prima della fase 1 e si sistema a parte (una data che non e' una data
// non trova il suo giorno nel calendario del rendimento). Per questo gli
// errori JS di quella scheda non fanno fallire la prova; ma che li' non parta
// codice si controlla lo stesso, come altrove.
// Orologio e fuso fermi: 11 marzo 2026, mezzogiorno a Torino, turno vivo.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import vm from 'node:vm';
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
// Ogni veleno firma col suo nome: x('nome'). Quello «da manuale» richiesto
// dalla revisione e' «');x();//», senza firma: lo si tiene uguale. Dentro
// l'onerror di un'immagine pero' «x» e' la coordinata dell'immagine stessa
// (HTMLImageElement.x), non la funzione: li' si firma con __veleno().
const APICE = k => `');x('${k}');//`;
const TAG = k => `"><img src=x onerror="__veleno('${k}')">`;
const corsa = (id, data, tipo = 'ENTRATA') => ({ id, data, tipo, categoria: tipo === 'ENTRATA' ? 'Corsa' : 'Carburante',
                                                 metodo: 'Contanti', importo: 25, ora: '10:00' });
const MOVIMENTI = [
  corsa("id'apice", OGGI),
  corsa("m1');x();//", OGGI),
  corsa('m2' + TAG('idCorsa'), OGGI),
  corsa('m3' + APICE('idSpesa'), OGGI, 'USCITA'),
  corsa('d1', OGGI + "');x();//"),
  corsa('d2', OGGI + APICE('dataCorsa')),
  corsa('d3', '2026-03-1' + TAG('dataMese')),
  corsa('d4', '2026-03-05' + APICE('dataSpesa'), 'USCITA'),
  corsa('d5', '2026-03-06' + TAG('dataSpesaTag'), 'USCITA'),
  corsa('buona', OGGI)
];
const scad = (id, data, nome = 'Bollo') => ({ id, data, nome, cadenza: 'annuale' });
const SCADENZE = [
  scad("s'apice", '2026-03-20'),
  scad("s1');x();//", '2026-03-21'),
  scad('s2' + TAG('idScad'), '2026-03-22'),
  scad('s3', "2026-03-25');x();//"),
  scad('s4', '2026-03-26' + APICE('dataScad')),
  scad('s5', '2026-03-27' + TAG('dataScadTag')),
  scad('sbuona', '2026-04-15', 'Revisione')
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
await p.clock.setFixedTime(new Date('2026-03-11T12:00:00+01:00'));
// x() e __veleno() veri nella pagina: se partono, lo si sa.
await p.addInitScript(() => {
  window.__partiti = [];
  window.x = window.__veleno = (k) => { window.__partiti.push(String(k === undefined ? 'x()' : k)); };
});
const errori = [];
let dove = 'avvio';
p.on('pageerror', e => errori.push({ dove, testo: String(e) }));
p.on('dialog', d => d.dismiss());
await p.goto(APP);
await p.evaluate(({ m, s, oggi }) => {
  localStorage.clear();
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_records', JSON.stringify(m));
  localStorage.setItem('taxi_scadenze', JSON.stringify(s));
  localStorage.setItem('taxi_shifts', JSON.stringify([
    { id: 'toggi', data: oggi, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true }]));
}, { m: MOVIMENTI, s: SCADENZE, oggi: OGGI });
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
const caricati = await p.evaluate(() => ({ m: (window.dailyRecords || []).length, s: (window.scadenze || []).length }));
ok(caricati.m === MOVIMENTI.length, `i ${MOVIMENTI.length} movimenti sono davvero in memoria, storti compresi`, JSON.stringify(caricati));
ok(caricati.s === SCADENZE.length, `e le ${SCADENZE.length} scadenze`, JSON.stringify(caricati));

// I gestori visti, per vista; le immagini «x» entrate.
const gestori = new Map();
const entrati = [];
async function guarda(nome, azione) {
  dove = nome;
  try { await p.evaluate(azione.f, azione.a); }
  catch (e) { errori.push({ dove, testo: String(e).split('\n')[0] }); }
  await p.waitForTimeout(150);
  const r = await p.evaluate(() => {
    const h = [];
    document.querySelectorAll('*').forEach(el => {
      for (const at of el.attributes) if (/^on/i.test(at.name)) h.push(at.value);
    });
    return { img: document.querySelectorAll('img[src="x"]').length, h };
  });
  if (r.img) entrati.push(`${nome} (${r.img} img)`);
  for (const g of r.h) if (!gestori.has(g)) gestori.set(g, nome);
}
const SCHEDE = ['dashboard', 'giornata', 'uscite', 'auto', 'scadenze', 'rendimento', 'categorie',
                'report', 'versamenti', 'note', 'cloud', 'altro'];
for (const t of SCHEDE) await guarda('scheda ' + t, { f: t => switchTab(t), a: t });
for (const per of ['giorno', 'mese', 'anno']) {
  await guarda('dashboard ' + per, { f: per => { switchTab('dashboard'); cambiaPeriodoDash(per); }, a: per });
}
await guarda('dashboard giorno ' + OGGI, { f: d => { switchTab('dashboard'); cambiaPeriodoDash('giorno'); setDashGiorno(d); }, a: OGGI });
await guarda('dashboard mese', { f: () => { switchTab('dashboard'); cambiaPeriodoDash('mese'); setDashMese('2026-03'); }, a: null });
await guarda('giornate di oggi', { f: d => { switchTab('giornata'); setVistaGiornata('giornate'); applyFilterGiornoGiornate(d); }, a: OGGI });
await guarda('calendario', { f: d => { switchTab('giornata'); setVistaGiornata('calendario'); window.giornoCalendarioAperto = null; toccaGiornoCalendario(d); }, a: OGGI });
await guarda('report del mese', { f: () => { switchTab('report'); }, a: null });

// La modifica di ogni movimento, dove si apre: le corse nelle giornate di
// oggi, le spese nella loro scheda. Si conta quante si sono aperte davvero
// (il campo dell'importo c'e'), cosi' la prova non passa per finta.
let aperte = 0;
for (const r of MOVIMENTI) {
  await guarda('modifica ' + r.id, {
    // Le righe con la data buona dal loro giorno; quelle con la data storta
    // non cadono in nessun giorno, e si cercano nell'anno intero.
    f: ({ id, tipo, oggi, buona }) => {
      if (tipo === 'USCITA') { switchTab('uscite'); if (buona) applyFilterGiornoUscite(oggi); else applyFilterUscite('ALL'); }
      else { switchTab('giornata'); setVistaGiornata('giornate'); if (buona) applyFilterGiornoGiornate(oggi); else applyFilterMeseGiornate('ALL'); }
      apriModificaRecord(id);
    }, a: { id: r.id, tipo: r.tipo, oggi: OGGI, buona: r.data === OGGI }
  });
  if (await p.evaluate(id => !!document.getElementById('mv-imp-' + id), r.id)) aperte++; else if (process.env.DEBUG) console.log("  non aperta:", r.id, r.tipo, r.data);
  await p.evaluate(() => { window.editRecordId = null; });
}
// Le date storte non cadono in nessun giorno: le loro corse non si vedono
// nelle giornate di oggi. Si aprono le spese (tutte in elenco) e le corse
// con la data buona.
const attese = MOVIMENTI.filter(r => r.tipo === 'USCITA' || r.data === OGGI).length;
ok(aperte >= attese, `la modifica si e' aperta per ${aperte} movimenti (almeno ${attese})`, String(aperte));

// Le scadenze: elenco, e il modulo di modifica della data.
await guarda('scadenze', { f: () => switchTab('scadenze'), a: null });
await p.waitForTimeout(300);
const partitiPagina = await p.evaluate(() => window.__partiti);
await b.close();

// I gestori nella scatola chiusa.
const evasi = [];
for (const [g, vista] of gestori) {
  const presi = [];
  const muta = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : muta, apply: () => muta, construct: () => muta });
  const spia = (...a) => { presi.push(a.length ? String(a[0]) : 'x()'); return muta; };
  const glob = new Proxy({}, {
    has: () => true,
    get: (t, k) => (k === 'x' || k === '__veleno') ? spia : (k === Symbol.unscopables ? undefined : muta)
  });
  try { vm.runInNewContext('with (glob) { ' + g + '\n}', { glob }, { timeout: 200 }); } catch (e) { /* un gestore che si ferma non e' un gestore evaso */ }
  if (presi.length) evasi.push(`${vista}: ${g.slice(0, 120)}`);
}
console.log(`\n  gestori on...="..." provati nella scatola: ${gestori.size}`);
ok(gestori.size > 100, 'ne sono stati raccolti abbastanza da dire qualcosa', String(gestori.size));
ok(evasi.length === 0, 'nessun gestore fa partire x(): ogni apice esce scappato', evasi.slice(0, 6).join(' || '));
ok(entrati.length === 0, 'nessun veleno e\' entrato nella pagina come HTML', entrati.slice(0, 6).join(', '));
ok(partitiPagina.length === 0, 'e nella pagina vera non e\' partito niente', JSON.stringify(partitiPagina));
const rendimento = errori.filter(e => /rendimento/.test(e.dove));
const altri = errori.filter(e => !/rendimento/.test(e.dove));
if (rendimento.length) console.log(`  (noto, fuori dal conto: ${rendimento.length} errori nella scheda Rendimento - ${rendimento[0].testo})`);
ok(altri.length === 0, 'nessun errore JS fuori dalla scheda Rendimento', altri.slice(0, 4).map(e => e.dove + ': ' + e.testo).join(' | '));
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
