// SENZA CAMPO: LE MODIFICHE IN ATTESA DEL CLOUD, USATE DALL'APP VERA
// Firestore tiene le scritture fatte senza campo solo nella memoria della
// pagina. Fino alla v175: corsa battuta in galleria, iOS chiude l'app, la si
// riapre con la rete - e l'elenco del server, che quella corsa non l'ha mai
// vista, prendeva il posto dell'archivio del telefono. La corsa spariva,
// dal telefono e dalla dichiarazione. Lo stesso per una cancellazione (la
// corsa cancellata risorgeva), per la migrazione interrotta (il telefono si
// accorciava a quello che era arrivato), per il ripristino senza campo, per
// la cartella vuota che arriva dalla cache (si migrava la copia vecchia sopra
// quella del Mac), per il profilo (un campo cambiato qui cancellava quello
// cambiato sul Mac). Dalla v176 ogni modifica lascia un segno nel registro
// 'taxi_in_sospeso' e il segno si toglie solo quando il server conferma.
//
// Qui l'app si usa dai suoi tasti (corsa veloce, Elimina, Salva la scheda,
// Entra con Google, Esci dal Cloud) con un Firestore FINTO (prove/_finto/):
// il «server» e' una riga di localStorage, e la prova lo semina e lo rilegge
// come se fosse il Mac. Il Cloud vero non si tocca mai: i tre file di
// gstatic.com si servono dalla cartella _finto intercettando la rete.
// «App chiusa» = la pagina si ricarica: la coda in memoria del Firestore
// finto si perde, come su iOS.
//
// Ogni caso sta in un recinto: se sulla v175 un tasto o una funzione non c'e',
// il caso si segna «***» e si passa al successivo.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
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
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
// Tutto quello che non e' il file locale o il Firebase finto si ferma qui:
// nessuna richiesta esce davvero.
await ctx.route(/^https?:\/\//, r => r.abort());
for (const [n, f] of [['firebase-app.js', 'app.js'], ['firebase-auth.js', 'auth.js'], ['firebase-firestore.js', 'firestore.js']])
  await ctx.route('**/firebasejs/11.6.1/' + n, r => r.fulfill({ contentType: 'application/javascript', body: readFileSync(join(FINTO, f), 'utf8') }));
const p = await ctx.newPage();
// Venerdi' 30 ottobre 2026, mezzogiorno a Torino: col turno 8-20 il registro e' aperto.
await p.clock.setFixedTime(new Date('2026-10-30T12:00:00+01:00'));
const erroriJS = []; p.on('pageerror', e => erroriJS.push(String(e.message || e)));
const dialoghi = []; let risposta = true;
p.on('dialog', d => { dialoghi.push(d.message()); risposta ? d.accept() : d.dismiss(); });
// Gli avvisi in basso (showToast): si annotano tutti.
const avvisi = [];
await p.exposeFunction('__avviso', (t) => avvisi.push(t));
await p.addInitScript(() => {
  const spia = () => { if (window.showToast && !window.showToast.__spia) { const v = window.showToast; window.showToast = function (t) { window.__avviso(String(t)); return v.apply(this, arguments); }; window.showToast.__spia = 1; } };
  document.addEventListener('DOMContentLoaded', spia); setInterval(spia, 20);
});
await p.goto(APP); await p.evaluate(() => localStorage.clear());

// --- attrezzi ---
// L'orologio e' fermo, e l'identificativo di una corsa e' l'ora in
// millesimi piu' un contatore che riparte da zero a ogni apertura
// (nuovoId): due corse battute in due aperture diverse avrebbero lo stesso
// identificativo, cosa che sul telefono vero, dove l'ora va avanti, non
// succede. Spostare l'orologio a ogni apertura ferma per secondi i timer di
// Playwright (provato: la risposta dell'accesso non arrivava); si fa partire
// invece il contatore da un punto diverso a ogni apertura.
let aperture = 0;
const ricarica = async () => {
  aperture++;
  await p.goto(APP);
  await p.waitForFunction(() => window.moduloFirebaseVivo === true && window.__authFatto === true, null, { timeout: 15000 });
  await p.evaluate((n) => { try { contatoreId = n; } catch (e) { /* versione senza contatore */ } }, (aperture * 50) % 1000);
  await p.waitForTimeout(700);
};
const cloud = () => p.evaluate(() => JSON.parse(localStorage.__cloud || '{}'));
// Il registro si legge dal disco, non dalle funzioni: cosi' sulla v175 dice «vuoto» invece di rompersi.
const reg = () => p.evaluate(() => { try { const r = JSON.parse(localStorage.taxi_in_sospeso || 'null'); return r && r.per ? r : { uid: null, per: {} }; } catch (e) { return { uid: null, per: {} }; } });
const nVoci = (r) => Object.values(r.per || {}).reduce((a, v) => a + Object.keys(v || {}).length, 0);
const ini = (o) => p.evaluate((o) => {
  localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
}, o);
const registro = (uid) => ({ v: 1, uid, n: 0, dal: null, per: {} });
const turno = { id: 't1', data: '2026-10-30', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true };
const corsa = (id, imp) => ({ id, data: '2026-10-30', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: imp, ora: '09:00' });
const sulServer = (uid, archivio, elenco) => Object.fromEntries(elenco.map(x => [B + uid + '/' + archivio + '/' + x.id, x]));
const importiServer = async (uid) => Object.entries(await cloud()).filter(([k]) => k.startsWith(B + uid + '/taxi_records/')).map(([, d]) => d.importo);
const idsServer = async (uid) => Object.keys(await cloud()).filter(k => k.startsWith(B + uid + '/taxi_records/')).map(k => k.split('/').pop()).sort().join(',');
const importiQui = () => p.evaluate(() => (window.dailyRecords || []).map(r => r.importo));
const idsQui = async () => (await p.evaluate(() => (window.dailyRecords || []).map(r => r.id).sort())).join(',');
// La corsa veloce dal tasto vero, nella scheda Giornate.
const corsaDalTasto = async (testo, metodo = 'Contanti') => {
  await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); });
  await p.waitForTimeout(200);
  // Un disegno arrivato in ritardo (l'ascolto del Cloud dopo la riapertura)
  // rifa' il campo vuoto fra il riempirlo e il tocco: allora si riscrive.
  const prima = await p.evaluate(() => (window.dailyRecords || []).length);
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    await p.fill('#corsa-lampo', testo);
    await p.locator(`button[onclick="corsaLampo('${metodo}')"]`).first().click();
    try { await p.waitForFunction((n) => (window.dailyRecords || []).length > n, prima, { timeout: 1500 }); break; }
    catch (e) { if (tentativo === 2) throw new Error('la corsa da ' + testo + ' non si e\' registrata dal tasto'); }
  }
  await p.waitForTimeout(250);
};
const scheda = async (nome) => { await p.evaluate((n) => switchTab(n), nome); await p.waitForTimeout(200); };
const caso = async (titolo, fn) => {
  console.log('--- ' + titolo + ' ---');
  try { await fn(); }
  catch (e) { ko.push(titolo + ' (interrotto)'); console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0]); }
};

await caso('corsa senza campo, app chiusa, riaperta con la rete', async () => {
  await ini({ taxi_in_sospeso: registro('u1'), taxi_profilo: { nome: 'G', sigla: 'L 71' },
    __cloud: Object.assign(sulServer('u1', 'taxi_shifts', [turno]), sulServer('u1', 'taxi_records', [corsa('r1', 20)])) });
  await ricarica();
  c('in linea: la corsa del Mac c\'e\'', (await idsQui()) === 'r1', await idsQui());
  await p.evaluate(() => { window.__offline = true; });
  await corsaDalTasto('35,50');
  c('senza campo: la corsa e\' sul telefono', (await importiQui()).includes(35.5), await importiQui());
  c('e il registro la ricorda', nVoci(await reg()) === 1, (await reg()).per);
  c('sul server non e\' ancora arrivata', !(await importiServer('u1')).includes(35.5));
  await ricarica();   // iOS chiude l'app, si riapre col campo
  c('riaperta: la corsa resta sul telefono', (await importiQui()).includes(35.5) && (await importiQui()).includes(20), await importiQui());
  c('e arriva sul server', (await importiServer('u1')).includes(35.5), await importiServer('u1'));
  c('e il registro si svuota', nVoci(await reg()) === 0, (await reg()).per);
});

await caso('cancellazione senza campo che non risorge', async () => {
  await p.evaluate(() => { window.__offline = true; });
  await scheda('giornata'); await p.evaluate(() => setVistaGiornata('giornate')); await p.waitForTimeout(200);
  await p.locator(`button[onclick="apriModificaRecord('r1')"]`).first().click();
  await p.waitForTimeout(150);
  await p.locator(`button[onclick="deleteRecord('r1')"]`).first().click();
  await p.waitForTimeout(250);
  c('Elimina: sparita dal telefono', !(await idsQui()).split(',').includes('r1'), await idsQui());
  const r = await reg();
  c('e segnata come cancellata', r.per.taxi_records && /^d/.test(r.per.taxi_records.r1 || ''), r.per);
  await ricarica();
  c('riaperta con la rete: non risorge', !(await idsQui()).split(',').includes('r1'), await idsQui());
  c('e sparisce anche dal server', !(await idsServer('u1')).split(',').includes('r1'), await idsServer('u1'));
});

await caso('riaperta ancora senza campo, poi torna la rete', async () => {
  await p.evaluate(() => { window.__offline = true; });
  await corsaDalTasto('9');
  await p.evaluate(() => { localStorage.__offline = '1'; });
  await ricarica();
  c('riaperta senza campo: la corsa resta (l\'elenco vuoto della cache non la cancella)', (await importiQui()).includes(9), await importiQui());
  await p.evaluate(() => window.__tornaRete()); await p.waitForTimeout(500);
  c('torna la rete: resta e arriva', (await importiQui()).includes(9) && (await importiServer('u1')).includes(9), await importiServer('u1'));
});

await caso('scrittura rifiutata dal server', async () => {
  await ini({ taxi_in_sospeso: registro('u1'), __cloud: sulServer('u1', 'taxi_shifts', [turno]) });
  await ricarica();
  avvisi.length = 0;
  await p.evaluate(() => { localStorage.__rifiuta = '1'; });
  await corsaDalTasto('12,50');
  await p.waitForTimeout(300);
  await corsaDalTasto('13,50', 'POS');
  await p.waitForTimeout(300);
  c('rifiutate: restano sul telefono', (await importiQui()).includes(12.5) && (await importiQui()).includes(13.5), await importiQui());
  c('e restano nel registro', Object.keys((await reg()).per.taxi_records || {}).length === 2, (await reg()).per);
  const sulRifiuto = avvisi.filter(t => /Cloud/.test(t) && /(accettato|fallit)/i.test(t));
  c('un avviso solo, non uno per corsa', sulRifiuto.length === 1, sulRifiuto);
  await p.evaluate(() => { localStorage.removeItem('__rifiuta'); window.dispatchEvent(new Event('online')); });
  await p.waitForTimeout(500);
  const s = await importiServer('u1');
  c('su «online» ripartono da sole e arrivano', s.includes(12.5) && s.includes(13.5), s);
  c('e il registro si svuota', nVoci(await reg()) === 0, (await reg()).per);
});

await caso('migrazione di 1000 righe interrotta dopo 400', async () => {
  const recs = []; for (let i = 0; i < 1000; i++) recs.push({ id: 'm' + i, data: '2026-0' + (1 + i % 9) + '-1' + (i % 9), tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: i + 1 });
  // __passano = 1 su taxi_records: passa il primo blocco, gli altri restano appesi (l'app si chiude)
  await ini({ taxi_in_sospeso: registro('u1'), taxi_records: recs, __passano: '1', __passanoSu: 'taxi_records' });
  await ricarica(); await p.waitForTimeout(300);
  const primo = (await idsServer('u1')).split(',').filter(Boolean).length;
  c('sul server solo il primo blocco (400)', primo === 400, primo);
  c('le altre 600 restano segnate', Object.keys((await reg()).per.taxi_records || {}).length === 600, Object.keys((await reg()).per.taxi_records || {}).length);
  await p.evaluate(() => localStorage.removeItem('__passano'));
  await ricarica(); await p.waitForTimeout(700);
  const qui = await p.evaluate(() => dailyRecords.length);
  c('riaperta: il telefono non si accorcia (1000)', qui === 1000, qui);
  const lassu = (await idsServer('u1')).split(',').filter(Boolean).length;
  c('e il resto arriva (1000 sul server)', lassu === 1000, lassu);
  const somma = await p.evaluate(() => dailyRecords.reduce((a, r) => a + r.importo, 0));
  c('la somma degli incassi e\' quella di partenza (500.500)', somma === 500500, somma);
  c('registro vuoto', nVoci(await reg()) === 0, nVoci(await reg()));
});

await caso('salvataggio in blocco (ripristino) senza campo', async () => {
  await ini({ taxi_in_sospeso: registro('u1'), __cloud: sulServer('u1', 'taxi_records', [{ id: 'r0', data: '2026-10-01', importo: 1, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS' }]) });
  await ricarica();
  await p.evaluate(() => { window.__offline = true; bulkSave([{ id: 'k1', data: '2026-10-02', importo: 2, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS' }], [{ id: 'kt', data: '2026-10-02' }]); });
  await p.waitForTimeout(300);
  await ricarica();
  const cl = await cloud();
  c('riaperta: le righe del ripristino restano sul telefono', (await idsQui()) === 'k1,r0', await idsQui());
  c('e arrivano sul server (movimento e turno)', !!cl[B + 'u1/taxi_records/k1'] && !!cl[B + 'u1/taxi_shifts/kt']);
});

await caso('cartella vuota dalla cache: non migra e non copre il Mac', async () => {
  await ini({ taxi_in_sospeso: registro('u1'), taxi_note: [{ id: 'n1', data: '2026-10-29', testo: 'vecchia' }], __offline: '1',
    __cloud: { [B + 'u1/taxi_note/n1']: { data: '2026-10-29', testo: 'dal mac' } } });
  await ricarica();
  c('l\'elenco vuoto della cache non svuota il telefono', (await p.evaluate(() => note.map(n => n.testo))).join() === 'vecchia');
  c('e non mette niente in coda per il server', (await p.evaluate(() => window.__inCoda())) === 0, await p.evaluate(() => window.__inCoda()));
  await p.evaluate(() => window.__tornaRete()); await p.waitForTimeout(500);
  const cl = await cloud();
  c('torna la rete: sul server resta la nota del Mac', cl[B + 'u1/taxi_note/n1'].testo === 'dal mac', cl[B + 'u1/taxi_note/n1']);
  c('e il telefono prende quella', (await p.evaluate(() => note.map(n => n.testo))).join() === 'dal mac');
});

await caso('profilo: un campo cambiato qui senza campo, uno sul Mac', async () => {
  const prof = { nome: 'G', cognome: 'X', licenza: '', sigla: 'S', colore: '', piva: '', logo: '' };
  await ini({ taxi_in_sospeso: registro('u1'), taxi_profilo: prof, __cloud: { [B + 'u1/profilo/dati']: prof } });
  await ricarica();
  await p.evaluate(() => { window.__offline = true; });
  await scheda('cloud');
  await p.fill('#prof-sigla', 'L 71');
  await p.locator('button[onclick="salvaProfiloDalModulo()"]').first().click();
  await p.waitForTimeout(250);
  const r = await reg();
  c('del profilo si segna solo la sigla', Object.keys(r.per.profilo || {}).join() === 'sigla', r.per);
  // intanto, sul Mac, si cambia il cognome
  await p.evaluate((k) => { const o = JSON.parse(localStorage.__cloud); o[k].cognome = 'Y'; localStorage.__cloud = JSON.stringify(o); }, B + 'u1/profilo/dati');
  await ricarica();
  await scheda('cloud');
  const video = await p.evaluate(() => ({ sigla: document.getElementById('prof-sigla').value, cognome: document.getElementById('prof-cognome').value }));
  c('a video: la sigla del telefono e il cognome del Mac', video.sigla === 'L 71' && video.cognome === 'Y', video);
  const lassu = (await cloud())[B + 'u1/profilo/dati'];
  c('sul server: tutti e due', lassu.sigla === 'L 71' && lassu.cognome === 'Y', lassu);
  c('il documento ha gli stessi campi di prima', Object.keys(lassu).sort().join() === 'cognome,colore,licenza,logo,nome,piva,sigla', Object.keys(lassu));
  c('scritto in unione (merge), non sostituito', await p.evaluate(() => window.__scritture.some(x => x[1].endsWith('profilo/dati') && x[2] === 'merge')));
  c('registro vuoto', nVoci(await reg()) === 0, (await reg()).per);
});

await caso('cambio di account', async () => {
  await ini({ __uid: 'u1', taxi_in_sospeso: registro('u1'), taxi_shifts: [turno], taxi_records: [corsa('a', 1), corsa('b', 2)],
    __cloud: Object.assign(sulServer('u1', 'taxi_shifts', [turno]), sulServer('u1', 'taxi_records', [corsa('a', 1), corsa('b', 2)]), sulServer('u2', 'taxi_records', [corsa('z', 9)])) });
  dialoghi.length = 0;
  await ricarica();
  c('stesso account alla riapertura: nessuna domanda', dialoghi.length === 0, dialoghi);
  // esco, batto una corsa, rientro con lo stesso: parte senza domande
  await scheda('cloud');
  avvisi.length = 0;
  await p.locator('button[onclick="esciDalCloud()"]').first().click(); await p.waitForTimeout(300);
  await corsaDalTasto('3');
  await scheda('cloud');
  c('fuori dal Cloud: la corsa resta segnata', nVoci(await reg()) === 1, (await reg()).per);
  c('e non parte', !(await importiServer('u1')).includes(3));
  await p.evaluate(() => { localStorage.__prossimo = 'u1'; });
  await p.locator('button[onclick="entraConGoogle()"]').first().click(); await p.waitForTimeout(500);
  c('rientro con lo stesso account: nessuna domanda, e la corsa parte', dialoghi.length === 0 && (await importiServer('u1')).includes(3), { dialoghi, server: await importiServer('u1') });
  const u1Prima = await idsServer('u1');
  // esco, batto un'altra corsa, entro con u2 e dico Annulla
  await scheda('cloud');
  await p.locator('button[onclick="esciDalCloud()"]').first().click(); await p.waitForTimeout(300);
  await corsaDalTasto('4');
  const quiPrima = await idsQui();
  await scheda('cloud');
  risposta = false; dialoghi.length = 0; avvisi.length = 0;
  await p.evaluate(() => { localStorage.__prossimo = 'u2'; });
  await p.locator('button[onclick="entraConGoogle()"]').first().click(); await p.waitForTimeout(500);
  console.log('    la domanda: ' + JSON.stringify(dialoghi[0] || null));
  c('altro account: chiede, una volta', dialoghi.length === 1, dialoghi);
  const dom = dialoghi[0] || '';
  c('la domanda dice chi e\' entrato e cosa c\'e\' qui', dom.includes('Sei entrato con u2@esempio.it') && dom.includes('4 movimenti e 1 turno, e 1 modifica non ancora inviata'), dom);
  c('e cosa fanno OK e Annulla', dom.includes('OK: li porto anche in u2@esempio.it') && dom.includes('Annulla: esco da u2@esempio.it e non tocco niente'), dom);
  c('la domanda, parola per parola', dom === 'Sei entrato con u2@esempio.it. Su questo telefono ci sono già 4 movimenti e 1 turno, e 1 modifica non ancora inviata di un altro account o mai caricati.\n\n'
    + 'OK: li porto anche in u2@esempio.it, insieme a quello che c\'è già.\nAnnulla: esco da u2@esempio.it e non tocco niente.', dom);
  let r = await reg();
  c('Annulla: si esce dal Cloud', !(await p.evaluate(() => window.isCloudSyncing)) && (await p.evaluate(() => localStorage.__uid)) === '');
  c('Annulla: il registro resta di u1, con la corsa in attesa', r.uid === 'u1' && nVoci(r) === 1, r);
  c('Annulla: niente toccato (telefono, u1, u2)', (await idsQui()) === quiPrima && (await idsServer('u2')) === 'z' && (await idsServer('u1')) === u1Prima,
    { qui: await idsQui(), u1: await idsServer('u1'), u2: await idsServer('u2') });
  c('Annulla: l\'avviso dice come fare', avvisi.some(t => t.includes('Per usare u2@esempio.it con i suoi dati') && /backup/.test(t) && /azzera/.test(t) && /rientra/.test(t)), avvisi);
  c('Annulla: l\'avviso, parola per parola (con l\'«Attenzione» su quello che passa da solo)', avvisi.includes('Per usare u2@esempio.it con i suoi dati: scarica un backup, azzera movimenti e turni da «Gestione → Backup e impostazioni» e rientra. '
    + 'Attenzione: note, scadenze, vetture, versamenti, voci di budget, la tua scheda e le impostazioni fiscali di questo telefono, entrando, vanno in u2@esempio.it dove lì non ce ne sono ancora.'), avvisi);
  dialoghi.length = 0; await ricarica();
  c('riaperta dopo Annulla: nessuna domanda', dialoghi.length === 0, dialoghi);
  // di nuovo u2, e questa volta OK
  risposta = true;
  await scheda('cloud');
  await p.locator('button[onclick="entraConGoogle()"]').first().click(); await p.waitForTimeout(700);
  r = await reg();
  c('OK: chiede e adotta u2', dialoghi.length === 1 && r.uid === 'u2', { dialoghi, uid: r.uid });
  const tutti = quiPrima.split(',').concat('z').sort().join(',');
  c('OK: in u2 ci sono i suoi e quelli del telefono', (await idsServer('u2')) === tutti, await idsServer('u2'));
  c('OK: e il telefono li ha tutti', (await idsQui()) === tutti, await idsQui());
  c('OK: il vecchio account u1 non si tocca', (await idsServer('u1')) === u1Prima, await idsServer('u1'));
  c('OK: registro vuoto alla fine', nVoci(r) === 0, r.per);
});

await caso('telefono che arriva dalla v175 (sessione ripresa, nessun registro)', async () => {
  await ini({ __uid: 'u1', taxi_records: [corsa('a', 1), corsa('b', 2)], __cloud: sulServer('u1', 'taxi_records', [corsa('a', 1), corsa('b', 2)]) });
  dialoghi.length = 0;
  await ricarica();
  const r = await reg();
  c('nessuna domanda', dialoghi.length === 0, dialoghi);
  c('l\'account si adotta e non si segna niente', r.uid === 'u1' && nVoci(r) === 0, r);
  c('il Cloud e\' attivo', await p.evaluate(() => !!window.isCloudSyncing));
  c('i dati sono quelli di prima', (await idsQui()) === 'a,b' && (await idsServer('u1')) === 'a,b');
});

await caso('chi non ha mai fatto l\'accesso', async () => {
  await ini({ __uid: '', taxi_shifts: [turno], taxi_records: [corsa('a', 1)] });
  dialoghi.length = 0;
  await ricarica();
  await corsaDalTasto('7');
  await scheda('giornata'); await p.evaluate(() => setVistaGiornata('giornate')); await p.waitForTimeout(150);
  await p.locator(`button[onclick="apriModificaRecord('a')"]`).first().click(); await p.waitForTimeout(150);
  await p.locator(`button[onclick="deleteRecord('a')"]`).first().click(); await p.waitForTimeout(250);
  const r = await reg();
  c('corsa battuta e corsa cancellata: zero voci nel registro', nVoci(r) === 0 && !r.uid, r);
  c('la corsa c\'e\' e quella cancellata no', (await importiQui()).join() === '7', await importiQui());
  await scheda('cloud');
  c('nella scheda Cloud nessuna riga «in attesa»', await p.evaluate(() => !document.getElementById('cloud-in-attesa')));
  c('nessuna domanda', dialoghi.filter(d => d.includes('Sei entrato')).length === 0, dialoghi);
});

await caso('la riga «in attesa» nella scheda Cloud', async () => {
  await ini({ __uid: 'u1', taxi_in_sospeso: registro('u1'), taxi_shifts: [turno], __cloud: sulServer('u1', 'taxi_shifts', [turno]) });
  await ricarica();
  await scheda('cloud');
  c('niente in attesa: nessuna riga', await p.evaluate(() => !document.getElementById('cloud-in-attesa')));
  await p.evaluate(() => { window.__offline = true; });
  await corsaDalTasto('10'); await corsaDalTasto('11'); await corsaDalTasto('12');
  await scheda('cloud');
  const t = await p.evaluate(() => (document.getElementById('cloud-in-attesa') || {}).textContent || null);
  c('tre corse senza campo: «3 modifiche in attesa di invio al Cloud (dal 30/10)»', t === '3 modifiche in attesa di invio al Cloud (dal 30/10)', t);
  await p.evaluate(() => window.__tornaRete()); await p.waitForTimeout(600);
  c('arrivate: la riga sparisce da sola, senza cambiare scheda', await p.evaluate(() => !document.getElementById('cloud-in-attesa')));
  await p.locator('button[onclick="esciDalCloud()"]').first().click(); await p.waitForTimeout(300);
  await corsaDalTasto('13');
  await scheda('cloud');
  const t2 = await p.evaluate(() => (document.getElementById('cloud-in-attesa') || {}).textContent || null);
  c('da fuori dal Cloud: «1 modifica ... partirà quando rientri»', t2 === '1 modifica in attesa di invio al Cloud (dal 30/10): partirà quando rientri', t2);
  for (const w of [320, 390]) {
    await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(100);
    const m = await p.evaluate(() => { const e = document.getElementById('cloud-in-attesa'); const q = e.getBoundingClientRect(); return { sw: e.scrollWidth, cw: e.clientWidth, destra: q.right, larga: innerWidth }; });
    c('a ' + w + ' px la riga sta nella scheda', m.sw <= m.cw + 1 && m.destra <= m.larga, m);
  }
  await p.setViewportSize({ width: 390, height: 900 });
});

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') : 'nessuno'));
await b.close();
