// QUANDO IL CLOUD O IL DISCO DICONO NO: LA SPEDIZIONE DELLE MODIFICHE
// Le correzioni della revisione della v176 (dopo c5b8761), una per una,
// con il Firestore finto di prove/_finto/ (il Cloud vero non si tocca mai):
//  - B1 disco pieno (a2fb566): con l'archivio delle corse rifiutato dal
//    disco e il segno accettato, partiva la versione VECCHIA letta dal
//    disco: la correzione da 50 a 80 arrivava sul Cloud come 50, e il Mac
//    la riportava indietro. Con il segno rifiutato, o con un telefono
//    arrivato dalla v175 che non ha ancora un registro, non partiva niente.
//  - C1/C2 il Cloud che dice no (d3fca3f): un no a tutto (permessi, rete)
//    faceva ritentare subito, sempre, con tutte le righe; una riga sola
//    rifiutata (invalid-argument) bloccava tutto il suo blocco per sempre, e
//    nessuno lo sapeva. Ora l'attesa cresce (30 s, 1 min, ... 15 min) e
//    riparte da capo col ritorno della rete, dopo un no a tutto si manda un
//    blocco solo di prova, e la riga colpevole si mette da parte ('!'): le
//    altre arrivano, e la scheda Cloud la mostra con data e importo.
//    Un identificativo che fa rompere doc() non fa uscire eccezioni.
//  - C3 avvio senza campo (2293745): l'elenco dalla copia in memoria di
//    Firestore, che contiene solo le righe battute in questa sessione,
//    prendeva il posto del telefono: battuta una corsa in galleria, a
//    video e sul disco restava solo lei.
//  - S3 ripristino (7f50a25): con 200 righe per archivio il registro si
//    riscriveva una volta per riga (centinaia di JSON.stringify di tutto il
//    registro su iPhone); ora una volta per archivio.
//  - CSP (98a42f7): con l'accesso fallito e la rete accesa il messaggio
//    consigliava SEMPRE di spegnere la protezione sugli indirizzi; ora solo
//    se la protezione ha fermato davvero qualcosa (window.cspViolazioni), e
//    di ogni violazione si tiene solo la regola e l'origine: percorso e
//    query possono contenere l'account o la chiave.
// Ogni caso sta in un recinto: se su una versione vecchia una funzione non
// c'e', il caso si segna «***» e si passa al successivo.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, createReadStream } from 'node:fs';
import http from 'node:http';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const FINTO = join(RADICE, 'prove', '_finto');
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato: installalo o indicalo con PLAYWRIGHT=...'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

let ok = 0; const ko = [];
const c = (nome, vero, dettaglio) => {
  if (vero) { ok++; console.log('  ok  ' + nome); }
  else { ko.push(nome); console.log('  *** ' + nome + (dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio).slice(0, 300) : '')); }
};

const B = 'artifacts/taximanager-2026/users/';
const U = B + 'u1/';
const b = await chromium.launch();
const erroriJS = [];
const avvisi = [];
const dialoghi = [];

// Una pagina col Firebase finto. Sul disco, il «disco pieno» si simula:
// localStorage.__pieni = 'taxi_records' fa rifiutare (QuotaExceededError)
// ogni scrittura di quelle chiavi, come Safari quando lo spazio e' finito.
// Il conto delle scritture del registro serve a S3.
async function apriPagina(ctx, indirizzo) {
  for (const [n, f] of [['firebase-app.js', 'app.js'], ['firebase-auth.js', 'auth.js'], ['firebase-firestore.js', 'firestore.js']])
    await ctx.route('**/firebasejs/11.6.1/' + n, r => r.fulfill({ contentType: 'application/javascript', body: readFileSync(join(FINTO, f), 'utf8') }));
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-10-30T12:00:00+01:00'));
  p.on('pageerror', e => erroriJS.push(String(e.message || e)));
  p.on('dialog', d => { dialoghi.push(d.message()); d.accept(); });
  await p.exposeFunction('__avviso', (t) => avvisi.push(t));
  await p.addInitScript(() => {
    const vero = Storage.prototype.setItem;
    window.__scritteRegistro = 0;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'taxi_in_sospeso') window.__scritteRegistro++;
      const pieni = (Storage.prototype.getItem.call(this, '__pieni') || '').split(',');
      if (pieni.includes(k)) throw Object.assign(new DOMException('quota', 'QuotaExceededError'));
      return vero.call(this, k, v);
    };
    const spia = () => { if (window.showToast && !window.showToast.__spia) { const v = window.showToast; window.showToast = function (t) { window.__avviso(String(t)); return v.apply(this, arguments); }; window.showToast.__spia = 1; } };
    document.addEventListener('DOMContentLoaded', spia); setInterval(spia, 20);
  });
  await p.goto(indirizzo); await p.evaluate(() => localStorage.clear());
  return p;
}

const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
await ctx.route(/^https?:\/\//, r => r.abort());
const p = await apriPagina(ctx, APP);

let aperture = 0;
const ricarica = async (pg = p, dove = APP) => {
  aperture++;
  await pg.goto(dove);
  await pg.waitForFunction(() => window.moduloFirebaseVivo === true && window.__authFatto === true, null, { timeout: 15000 });
  await pg.evaluate((n) => { try { contatoreId = n; } catch (e) { /* versione senza contatore */ } }, (aperture * 50) % 1000);
  await pg.waitForTimeout(700);
};
const cloud = (pg = p) => pg.evaluate(() => JSON.parse(localStorage.__cloud || '{}'));
const reg = () => p.evaluate(() => { try { const r = JSON.parse(localStorage.taxi_in_sospeso || 'null'); return r && r.per ? r : { uid: null, per: {} }; } catch (e) { return { uid: null, per: {} }; } });
const nVoci = (r) => Object.values(r.per || {}).reduce((a, v) => a + Object.keys(v || {}).length, 0);
// Il disco si prepara da una pagina senza l'app (stesso file://, stesso
// localStorage): cosi' nessun timer dell'app ancora aperta ci riscrive sopra.
// Il caso della CSP sta su http e prepara il disco dall'app stessa.
const VUOTA = 'file://' + join(RADICE, 'prove', 'LEGGIMI.md');
const ini = async (o, pg = p) => { if (pg === p) await p.goto(VUOTA); return pg.evaluate((o) => {
  localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
}, o); };
const registro = (per) => ({ v: 1, uid: 'u1', n: 9, dal: per ? '2026-10-29T10:00:00.000Z' : null, per: per || {} });
const turno = { id: 't1', data: '2026-10-30', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true };
const corsa = (id, imp, extra) => Object.assign({ id, data: '2026-10-30', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: imp, ora: '09:00' }, extra || {});
const sulServer = (uid, archivio, elenco) => Object.fromEntries(elenco.map(x => [B + uid + '/' + archivio + '/' + x.id, x]));
const importiServer = async () => Object.entries(await cloud()).filter(([k]) => k.startsWith(U + 'taxi_records/')).map(([, d]) => d.importo);
const idsQui = async () => (await p.evaluate(() => (window.dailyRecords || []).map(r => r.id).sort())).join(',');
const corsaDalTasto = async (testo, metodo = 'Contanti') => {
  await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); });
  await p.waitForTimeout(200);
  const prima = await p.evaluate(() => (window.dailyRecords || []).length);
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    await p.fill('#corsa-lampo', testo);
    await p.locator(`button[onclick="corsaLampo('${metodo}')"]`).first().click();
    try { await p.waitForFunction((n) => (window.dailyRecords || []).length > n, prima, { timeout: 1500 }); break; }
    catch (e) { if (tentativo === 2) throw new Error('la corsa da ' + testo + ' non si e\' registrata dal tasto'); }
  }
  await p.waitForTimeout(300);
};
const caso = async (titolo, fn) => {
  console.log('--- ' + titolo + ' ---');
  try { await fn(); }
  catch (e) { ko.push(titolo + ' (interrotto)'); console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0]); }
};

// ------------------------------------------------------------------ B1
await caso('B1: disco pieno per le corse, la correzione da 50 a 80', async () => {
  await ini({ taxi_in_sospeso: registro(), taxi_shifts: [turno], taxi_records: [corsa('r1', 50)],
    __cloud: Object.assign(sulServer('u1', 'taxi_shifts', [turno]), sulServer('u1', 'taxi_records', [corsa('r1', 50)])) });
  await ricarica();
  await p.evaluate(() => { localStorage.__pieni = 'taxi_records'; switchTab('giornata'); setVistaGiornata('giornate'); });
  await p.waitForTimeout(200);
  await p.locator(`button[onclick="apriModificaRecord('r1')"]`).first().click();
  await p.waitForTimeout(200);
  await p.fill('#mv-imp-r1', '80');
  await p.locator(`button[onclick="salvaModificaRecord('r1')"]`).first().click();
  await p.waitForTimeout(500);
  const d = await p.evaluate(() => ({ memoria: (dailyRecords.find(r => r.id === 'r1') || {}).importo, disco: JSON.parse(localStorage.taxi_records)[0].importo }));
  console.log('    sul telefono: memoria ' + d.memoria + ', disco ' + d.disco + ' (il disco ha rifiutato)');
  const lassu = (await cloud())[U + 'taxi_records/r1'];
  c('sul Cloud arriva 80, non il 50 rimasto sul disco', lassu && lassu.importo === 80, lassu);
  c('a video resta 80', d.memoria === 80, d);
  c('niente resta in attesa', nVoci(await reg()) === 0, (await reg()).per);
  await p.evaluate(() => localStorage.removeItem('__pieni'));
});

await caso('B1: disco pieno per il registro, la corsa dal tasto va lo stesso', async () => {
  await ini({ taxi_in_sospeso: registro(), taxi_shifts: [turno], __cloud: sulServer('u1', 'taxi_shifts', [turno]) });
  await ricarica();
  await p.evaluate(() => { localStorage.__pieni = 'taxi_in_sospeso'; });
  await corsaDalTasto('23,40');
  c('il segno non si scrive, la corsa arriva sul Cloud direttamente', (await importiServer()).includes(23.4), await importiServer());
  await p.evaluate(() => localStorage.removeItem('__pieni'));
});

await caso('B1: telefono dalla v175 (nessun registro) col disco pieno', async () => {
  await ini({ __uid: 'u1', taxi_shifts: [turno], taxi_records: [corsa('a', 1)], __pieni: 'taxi_in_sospeso',
    __cloud: Object.assign(sulServer('u1', 'taxi_shifts', [turno]), sulServer('u1', 'taxi_records', [corsa('a', 1)])) });
  await ricarica();
  c('il registro non si scrive: nessun account ricordato', (await reg()).uid === null, await reg());
  await corsaDalTasto('31');
  c('la corsa dal tasto arriva lo stesso sul Cloud', (await importiServer()).includes(31), await importiServer());
  await p.evaluate(() => localStorage.removeItem('__pieni'));
});

// ------------------------------------------------------------------ C1/C2
await caso('C1: il Cloud dice no a tutto, l\'attesa cresce', async () => {
  const molte = []; for (let i = 0; i < 900; i++) molte.push(corsa('m' + i, i + 1));
  await ini({ taxi_records: molte, taxi_in_sospeso: registro({ taxi_records: Object.fromEntries(molte.map((x, i) => [x.id, 's' + (i + 1)])) }),
    __cloud: sulServer('u1', 'taxi_records', [corsa('r0', 1)]), __rifiuta: '1' });
  await ricarica();
  const st = () => p.evaluate(() => typeof statoSpedizione === 'function' ? statoSpedizione() : null);
  let s = await st();
  c('dopo il primo no: si aspetta 30 s, e poi solo un blocco di prova', s && s.attesa === 30000 && s.soloProva === true, s);
  const t0 = await p.evaluate(() => window.__tentativi);
  c('il primo giro tenta i 3 blocchi (900 righe), senza spezzarli riga per riga', t0 === 3, t0);
  c('nessuna riga messa da parte per un no a tutto', !JSON.stringify((await reg()).per).includes('!'));
  await p.evaluate(() => { window.__tentativi = 0; return inviaSospesi({ forza: true }); }); await p.waitForTimeout(200);
  s = await st();
  const t1 = await p.evaluate(() => window.__tentativi);
  c('il tentativo dopo: un blocco solo, e l\'attesa raddoppia (1 min)', t1 === 1 && s.attesa === 60000, { t1, s });
  for (let i = 0; i < 6; i++) { await p.evaluate(() => inviaSospesi({ forza: true })); await p.waitForTimeout(120); }
  s = await st();
  c('cresce fino a 15 minuti e li\' si ferma', s.attesa === 900000, s);
  await p.evaluate(() => { window.__tentativi = 0; });
  await p.evaluate(() => saveRecordToCloud({ id: 'n1', data: '2026-10-29', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 1 }));
  await p.waitForTimeout(200);
  c('un salvataggio durante l\'attesa non bussa al server', (await p.evaluate(() => window.__tentativi)) === 0, await p.evaluate(() => window.__tentativi));
  await p.evaluate(() => { localStorage.removeItem('__rifiuta'); window.dispatchEvent(new Event('online')); });
  await p.waitForTimeout(1000);
  const lassu = Object.keys(await cloud()).filter(k => k.includes('/taxi_records/m')).length;
  c('torna la rete: l\'attesa si azzera, passa la prova e poi il resto (900)', lassu === 900, lassu);
  s = await st();
  c('stato pulito: attesa 0, niente prova, registro vuoto', s.attesa === 0 && s.soloProva === false && nVoci(await reg()) === 0, { s, n: nVoci(await reg()) });
});

await caso('C2: il Cloud rifiuta una riga sola (invalid-argument)', async () => {
  avvisi.length = 0;
  await ini({ taxi_shifts: [turno], taxi_records: [corsa('r0', 1), corsa('b1', 10), corsa('b2', 45, { data: '2026-10-12' }), corsa('b3', 12)],
    taxi_in_sospeso: registro({ taxi_records: { b1: 's1', b2: 's2', b3: 's3' } }),
    __cloud: Object.assign(sulServer('u1', 'taxi_shifts', [turno]), sulServer('u1', 'taxi_records', [corsa('r0', 1)])), __rifiutaId: 'b2' });
  await ricarica();
  const cl = await cloud(); const r = await reg();
  c('le altre del blocco arrivano', !!cl[U + 'taxi_records/b1'] && !!cl[U + 'taxi_records/b3'], Object.keys(cl));
  c('la colpevole non arriva, e nel registro e\' messa da parte con «!»', !cl[U + 'taxi_records/b2'] && (r.per.taxi_records || {}).b2 === 's2!', r.per);
  c('sul telefono resta', (await idsQui()).split(',').includes('b2'), await idsQui());
  c('non e\' un no a tutto: nessuna attesa', (await p.evaluate(() => statoSpedizione().attesa)) === 0);
  c('un avviso che lo dice', avvisi.some(t => t.includes('non è accettata dal Cloud')), avvisi);
  await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(250);
  const riga = await p.evaluate(() => (document.getElementById('cloud-in-attesa') || {}).textContent || '');
  console.log('    la riga della scheda Cloud: ' + JSON.stringify(riga));
  c('la scheda Cloud la mostra con data e importo («movimento del 12/10/2026 da 45,00»)', riga.includes('non accetta') && riga.includes('12/10/2026') && riga.includes('45,00'), riga);
  c('e non la conta fra quelle in attesa di invio', !/in attesa di invio/.test(riga), riga);
  await p.evaluate(() => { window.__tentativi = 0; });
  await corsaDalTasto('7');
  c('una corsa dopo parte, la riga ferma resta ferma e non si ritenta', (await importiServer()).includes(7) && (await reg()).per.taxi_records.b2 === 's2!' && (await p.evaluate(() => window.__tentativi)) === 1,
    { server: await importiServer(), reg: (await reg()).per, tentativi: await p.evaluate(() => window.__tentativi) });
  for (const w of [320, 390]) {
    await p.setViewportSize({ width: w, height: 800 }); await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(150);
    const m = await p.evaluate(() => { const e = document.getElementById('cloud-in-attesa'); const q = e.getBoundingClientRect(); return { sw: e.scrollWidth, cw: e.clientWidth, destra: Math.round(q.right), larga: innerWidth }; });
    c('a ' + w + ' px la riga sta nella scheda', m.sw <= m.cw + 1 && m.destra <= m.larga, m);
  }
  await p.setViewportSize({ width: 390, height: 900 });
});

await caso('C2: una riga che non si puo\' nemmeno preparare (lista dentro una lista)', async () => {
  await ini({ taxi_records: [corsa('r0', 1), corsa('a1', 10), corsa('a2', 45, { extra: [[1, 2]] }), corsa('a3', 12)],
    taxi_in_sospeso: registro({ taxi_records: { a1: 's1', a2: 's2', a3: 's3' } }), __cloud: sulServer('u1', 'taxi_records', [corsa('r0', 1)]) });
  await ricarica();
  const cl = await cloud(); const r = await reg();
  c('le buone arrivano', !!cl[U + 'taxi_records/a1'] && !!cl[U + 'taxi_records/a3'], Object.keys(cl));
  c('la storta resta sul telefono, ferma nel registro', !cl[U + 'taxi_records/a2'] && (r.per.taxi_records || {}).a2 === 's2!', r.per);
});

await caso('C2: identificativi che fanno rompere doc(), nessuna eccezione', async () => {
  const prima = erroriJS.length;
  const errori = []; const ascolta = m => { if (m.type() === 'error' && /Uncaught|unhandled/i.test(m.text())) errori.push(m.text()); };
  p.on('console', ascolta);
  const nonGestite = [];
  await p.exposeFunction('__nonGestita', (t) => nonGestite.push(t)).catch(() => {});
  await p.addInitScript(() => window.addEventListener('unhandledrejection', e => window.__nonGestita && window.__nonGestita(String(e.reason && e.reason.message || e.reason))));
  // un registro scritto a mano con un id con la «/»...
  await ini({ taxi_records: [corsa('r0', 1), corsa('c1', 3)], taxi_in_sospeso: '{"v":1,"uid":"u1","n":3,"per":{"taxi_records":{"a/b":"d1","c1":"s2"}}}',
    __cloud: sulServer('u1', 'taxi_records', [corsa('r0', 1)]) });
  await ricarica();
  // ...e una scrittura diretta (disco pieno, niente segno) di una riga con la «/»
  await p.evaluate(() => { localStorage.__pieni = 'taxi_in_sospeso'; });
  const lancia = await p.evaluate(() => { try { saveRecordToCloud({ id: 'x/y', data: '2026-10-30', tipo: 'ENTRATA', importo: 2 }); deleteRecordFromCloud('p/q'); return null; } catch (e) { return String(e.message); } });
  await p.waitForTimeout(400);
  await p.evaluate(() => localStorage.removeItem('__pieni'));
  c('nessuna eccezione dalla pagina', erroriJS.length === prima, erroriJS.slice(prima));
  c('nessuna promessa rifiutata senza gestione', nonGestite.length === 0, nonGestite);
  c('il salvataggio non lancia verso chi lo chiama', lancia === null, lancia);
  c('la riga buona dello stesso registro arriva', !!(await cloud())[U + 'taxi_records/c1'], Object.keys(await cloud()));
  p.off('console', ascolta);
});

// ------------------------------------------------------------------ C3
await caso('C3: avvio senza campo, la copia in memoria ha solo la corsa nuova', async () => {
  const tre = [corsa('a', 1), corsa('b', 2), corsa('c', 3)];
  await ini({ taxi_shifts: [turno], taxi_records: tre, taxi_in_sospeso: registro(), __offline: '1', __cacheVera: '1',
    __cloud: Object.assign(sulServer('u1', 'taxi_shifts', [turno]), sulServer('u1', 'taxi_records', tre)) });
  await ricarica();
  c('aperta senza campo: le tre corse ci sono', (await idsQui()) === 'a,b,c', await idsQui());
  await corsaDalTasto('4');
  await p.waitForTimeout(300);
  const qui = await p.evaluate(() => dailyRecords.map(r => r.importo).sort((x, y) => x - y).join());
  const disco = await p.evaluate(() => JSON.parse(localStorage.taxi_records).map(r => r.importo).sort((x, y) => x - y).join());
  c('battuta una corsa: a video restano tutte e quattro', qui === '1,2,3,4', qui);
  c('e sul disco', disco === '1,2,3,4', disco);
  await p.evaluate(() => window.__tornaRete()); await p.waitForTimeout(700);
  const lassu = (await importiServer()).sort((x, y) => x - y).join();
  c('torna la rete: sul server tutte e quattro, e a video lo stesso', lassu === '1,2,3,4' && (await p.evaluate(() => dailyRecords.length)) === 4, lassu);
});

// ------------------------------------------------------------------ S3
await caso('S3: ripristino di 200 righe per archivio dal tasto vero', async () => {
  // Un account in uso: lassu' c'e' gia' una riga per archivio. (Con un
  // archivio vuoto sul server il Firestore finto, che avvisa tutti gli
  // ascolti a ogni scrittura, fa partire la migrazione di quell'archivio a
  // ripristino in corso, e le sue righe partono due volte. Il Firestore
  // vero non riavvisa l'ascolto di un archivio per le scritture degli
  // altri: li' serve un primo elenco vuoto arrivato in ritardo, a
  // ripristino gia' partito.)
  await ini({ taxi_in_sospeso: registro(), __cloud: Object.assign(sulServer('u1', 'taxi_records', [corsa('r0', 1)]),
    sulServer('u1', 'taxi_scadenze', [{ id: 's0', nome: 'Bollo', data: '2027-01-01' }]), sulServer('u1', 'taxi_note', [{ id: 'n0', data: '2026-01-01', testo: 'x' }]),
    sulServer('u1', 'taxi_versamenti', [{ id: 'v0', data: '2026-01-01', importo: 1 }])) });
  await ricarica();
  await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(250);
  const N = 200; const sc = [], no = [], ve = [];
  for (let i = 0; i < N; i++) {
    sc.push({ id: 'sc' + i, nome: 'Scadenza ' + i, data: '2027-01-' + String(1 + i % 28).padStart(2, '0') });
    no.push({ id: 'no' + i, data: '2026-02-01', testo: 't' + i });
    ve.push({ id: 've' + i, data: '2026-03-01', importo: i + 1 });
  }
  const backup = { records: [corsa('k1', 2)], shifts: [], scadenze: sc, note: no, versamenti: ve };
  await p.evaluate(() => { window.__scritteRegistro = 0; window.__scritture.length = 0; });
  await p.setInputFiles('input[onchange="importBackup(event)"]', { name: 'TaxiManager_Backup_2026-10-01.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await p.waitForTimeout(1500);
  const scritte = await p.evaluate(() => window.__scritteRegistro);
  console.log('    scritture del registro durante il ripristino: ' + scritte + ' (600 righe)');
  c('il registro si scrive poche volte, non una per riga (meno di 40)', scritte > 0 && scritte < 40, scritte);
  const cl = await cloud();
  const conta = (pre) => Object.keys(cl).filter(k => k.startsWith(U + pre)).length;
  c('tutto sul Cloud: 200 scadenze, 200 note, 200 versamenti e la corsa', conta('taxi_scadenze/sc') === N && conta('taxi_note/no') === N && conta('taxi_versamenti/ve') === N && !!cl[U + 'taxi_records/k1'],
    [conta('taxi_scadenze/sc'), conta('taxi_note/no'), conta('taxi_versamenti/ve')]);
  const doppie = await p.evaluate(() => { const v = window.__scritture.map(s => s[1]); return v.length - new Set(v).size; });
  c('nessuna riga scritta due volte', doppie === 0, doppie);
  c('registro vuoto alla fine', nVoci(await reg()) === 0, nVoci(await reg()));
});

await caso('S3: migrazione degli archivi comuni, una scrittura per riga', async () => {
  await ini({ taxi_in_sospeso: registro(), taxi_note: [{ id: 'na', data: '2026-01-01', testo: 'a' }, { id: 'nb', data: '2026-01-02', testo: 'b' }],
    __cloud: sulServer('u1', 'taxi_records', [corsa('r0', 1)]) });
  await ricarica();
  const scr = await p.evaluate(() => window.__scritture.filter(s => s[1].includes('/taxi_note/')).map(s => s[1].split('/').pop()));
  c('le due note partono una volta sola ciascuna', scr.sort().join() === 'na,nb', scr);
});

await ctx.close();

// ------------------------------------------------------------------ CSP
// La protezione si applica davvero solo da un indirizzo http (su file:// il
// «self» non dice niente): un piccolo server locale serve index.html.
await caso('CSP: il consiglio di spegnere la protezione solo se ha fermato qualcosa', async () => {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); createReadStream(join(RADICE, 'index.html')).pipe(res); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const QUI = `http://127.0.0.1:${server.address().port}/`;
  try {
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome', serviceWorkers: 'block' });
    // fuori dal server locale e dal Firebase finto non esce niente
    await ctx2.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    const q = await apriPagina(ctx2, QUI);
    await ini({ __uid: '', __accessoRete: '1' }, q);
    await ricarica(q, QUI);
    c('la protezione e\' accesa e raccoglie le violazioni', await q.evaluate(() => window.cspAttiva === true && Array.isArray(window.cspViolazioni)));
    c('a pagina appena aperta nessuna violazione', (await q.evaluate(() => (window.cspViolazioni || []).length)) === 0, await q.evaluate(() => window.cspViolazioni));
    await q.evaluate(() => switchTab('cloud')); await q.waitForTimeout(200);
    avvisi.length = 0;
    await q.locator('button[onclick="entraConGoogle()"]').first().click(); await q.waitForTimeout(400);
    const senza = avvisi.find(t => /accesso/i.test(t)) || '';
    console.log('    senza violazioni: ' + JSON.stringify(senza));
    c('senza violazioni: «riprova», e la protezione solo se continua', senza.includes('riprova') && senza.includes('Se continua con la rete buona') && !senza.includes('ha fermato'), senza);
    // una richiesta vera verso un indirizzo che la protezione non ammette,
    // con dentro un percorso e una query «segreti»
    await q.evaluate(() => fetch('https://esempio.invalid/artifacts/users/UIDSEGRETO/x?key=CHIAVE').catch(() => {}));
    await q.waitForTimeout(400);
    const v = await q.evaluate(() => window.cspViolazioni);
    console.log('    violazioni raccolte: ' + JSON.stringify(v));
    c('la violazione si segna: regola e origine', Array.isArray(v) && v.length === 1 && v[0].direttiva === 'connect-src' && v[0].origine === 'https://esempio.invalid', v);
    c('e niente percorso ne\' query', !JSON.stringify(v).includes('SEGRETO') && !JSON.stringify(v).includes('CHIAVE') && Object.keys((v || [])[0] || {}).sort().join() === 'direttiva,origine', v);
    avvisi.length = 0;
    await q.locator('button[onclick="entraConGoogle()"]').first().click(); await q.waitForTimeout(400);
    const con = avvisi.find(t => /accesso/i.test(t)) || '';
    console.log('    con una violazione: ' + JSON.stringify(con));
    c('con una violazione vera: «ha fermato un collegamento. Spegnila»', con.includes('ha fermato un collegamento') && con.includes('Gestione → Backup e impostazioni'), con);
    await ctx2.close();
  } finally { server.close(); }
});

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') : 'nessuno'));
await b.close();
