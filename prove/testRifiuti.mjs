// LE RIGHE CHE IL CLOUD RIFIUTA: QUALI SI FERMANO, COME SI SMONTA UN BLOCCO
// La seconda revisione della v176 (83d26c3, 673ccd0, dab09e4, f881306) ha
// stretto la regola delle righe «ferme» ('!' nel registro):
//  - si ferma solo una riga rifiutata con un codice «della riga»
//    (invalid-argument e simili) o che non si riesce a preparare. Prima
//    contava come colpa della riga anche un codice qualsiasi (internal,
//    unknown, not-found, already-exists) se nello stesso giro qualcos'altro
//    passava: un guasto passeggero del server lasciava la riga sul telefono
//    per sempre. Ora quei codici vanno all'attesa crescente;
//  - le ferme ripartono a ogni accesso (e con window.riprovaFerme);
//  - una cancellazione ferma ha il suo testo («riprova più tardi»): una
//    cancellazione non si «corregge»;
//  - un blocco rifiutato si smonta riga per riga solo per un no della riga,
//    e le righe partono UNA ALLA VOLTA, un blocco smontato dopo l'altro:
//    tre blocchi rifiutati facevano partire 1.200 commit tutti insieme
//    contro un server gia' in difficolta'. Al primo no che non e' della
//    riga lo smontaggio si ferma. Il blocco di prova dopo un no a tutto non
//    si smonta e non ferma nessuno;
//  - la forma delle righe (liste dentro liste) si controlla solo per un
//    blocco gia' rifiutato prima di partire: 900 righe buone sono tre
//    writeBatch, non 900; una riga storta si ferma e le altre partono in
//    un blocco solo; un campo storto del profilo non ferma gli altri;
//  - col disco pieno, dentro il Cloud con un registro di un altro account,
//    le scritture vanno dritte sull'account entrato e non finiscono nel
//    registro dell'altro; fuori dal Cloud si segna per l'account ricordato.
// Col Firestore finto di prove/_finto/ (leve __codiceId, __blocchi,
// __maxSingoli, __nBatch): il Cloud vero non si tocca mai.
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
const U = B + 'u1/';
const b = await chromium.launch();
const erroriJS = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
await ctx.route(/^https?:\/\//, r => r.abort());
for (const [n, f] of [['firebase-app.js', 'app.js'], ['firebase-auth.js', 'auth.js'], ['firebase-firestore.js', 'firestore.js']])
  await ctx.route('**/firebasejs/11.6.1/' + n, r => r.fulfill({ contentType: 'application/javascript', body: readFileSync(join(FINTO, f), 'utf8') }));
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date('2026-10-30T12:00:00+01:00'));
p.on('pageerror', e => erroriJS.push(String(e.message || e)));
p.on('dialog', d => d.accept());
// Il disco pieno: localStorage.__pieni = 'taxi_in_sospeso' fa rifiutare quelle chiavi.
await p.addInitScript(() => {
  const vero = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    const pieni = (Storage.prototype.getItem.call(this, '__pieni') || '').split(',');
    if (pieni.includes(k)) throw new DOMException('quota', 'QuotaExceededError');
    return vero.call(this, k, v);
  };
});

const ricarica = async () => {
  await p.goto(APP);
  await p.waitForFunction(() => window.moduloFirebaseVivo === true && window.__authFatto === true, null, { timeout: 15000 });
  await p.waitForTimeout(700);
};
const cloud = () => p.evaluate(() => JSON.parse(localStorage.__cloud || '{}'));
const reg = () => p.evaluate(() => { try { const r = JSON.parse(localStorage.taxi_in_sospeso || 'null'); return r && r.per ? r : { uid: null, per: {} }; } catch (e) { return { uid: null, per: {} }; } });
// Il disco si prepara da una pagina senza l'app: nessun timer ci riscrive sopra.
const VUOTA = 'file://' + join(RADICE, 'prove', 'LEGGIMI.md');
const ini = async (o) => { await p.goto(VUOTA); return p.evaluate((o) => {
  localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
}, o); };
const rec = (id, importo, extra) => Object.assign({ id, data: '2026-10-12', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo }, extra || {});
const regU1 = (per) => ({ v: 1, uid: 'u1', n: 9999, dal: '2026-10-29T10:00:00.000Z', per });
const srv = { [U + 'taxi_records/r0']: rec('r0', 1) };
const molte = (n, pre) => { const a = []; for (let i = 0; i < n; i++) a.push(rec(pre + i, i)); return a; };
const voci = (el) => Object.fromEntries(el.map((x, i) => [x.id, 's' + (i + 1)]));
const blocchi = () => p.evaluate(() => (window.__blocchi || []).filter(x => String(x[2]).startsWith('taxi_records/')));
const attesa = () => p.evaluate(() => typeof statoSpedizione === 'function' ? statoSpedizione().attesa : null);
const caso = async (titolo, fn) => {
  console.log('--- ' + titolo + ' ---');
  try { await fn(); }
  catch (e) { ko.push(titolo + ' (interrotto)'); console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0]); }
};

// ------------------------------------------------------------------ 14
await caso('un codice che non e\' della riga non ferma: va all\'attesa', async () => {
  await ini({ taxi_records: [rec('r0', 1), rec('b1', 1), rec('b2', 2), rec('b3', 3)],
    taxi_in_sospeso: regU1({ taxi_records: { b1: 's1', b2: 's2', b3: 's3' } }), __cloud: srv, __codiceId: 'b2:internal' });
  await ricarica();
  const cl = await cloud(); const r = await reg();
  c('internal: il blocco non si smonta, aspettano tutte e tre', !cl[U + 'taxi_records/b1'] && !cl[U + 'taxi_records/b3'] && ['b1', 'b2', 'b3'].every(id => /^s\d+$/.test((r.per.taxi_records || {})[id] || '')), r.per);
  c('e parte l\'attesa crescente (30 s)', (await attesa()) === 30000, await attesa());
  await p.evaluate(() => { localStorage.removeItem('__codiceId'); return inviaSospesi({ forza: true }); }); await p.waitForTimeout(300);
  c('passato il guasto, arrivano tutte', !!(await cloud())[U + 'taxi_records/b2'] && !Object.keys((await reg()).per).length, (await reg()).per);
  for (const codice of ['unknown', 'not-found', 'already-exists', 'unavailable', 'permission-denied']) {
    await ini({ taxi_records: [rec('r0', 1), rec('b1', 1), rec('b2', 2)],
      taxi_in_sospeso: regU1({ taxi_records: { b1: 's1', b2: 's2' } }), __cloud: srv, __codiceId: 'b2:' + codice });
    await ricarica();
    const r2 = await reg(); const bl = await blocchi();
    c(codice + ': non ferma, non smonta (un tentativo solo), aspetta',
      (r2.per.taxi_records || {}).b2 === 's2' && !(await cloud())[U + 'taxi_records/b2'] && (await attesa()) === 30000 && bl.length === 1, { reg: r2.per, bl, attesa: await attesa() });
  }
});

await caso('invalid-argument ferma la riga, e all\'accesso riparte', async () => {
  await ini({ taxi_records: [rec('r0', 1), rec('b1', 1), rec('b2', 2)],
    taxi_in_sospeso: regU1({ taxi_records: { b1: 's1', b2: 's2' } }), __cloud: srv, __codiceId: 'b2:invalid-argument' });
  await ricarica();
  c('ferma: «s2!»', ((await reg()).per.taxi_records || {}).b2 === 's2!', (await reg()).per);
  c('e l\'altra arriva', !!(await cloud())[U + 'taxi_records/b1']);
  await p.evaluate(() => localStorage.removeItem('__codiceId'));
  await ricarica();
  c('riaperta: la ferma riparte da sola e arriva', !!(await cloud())[U + 'taxi_records/b2'] && !Object.keys((await reg()).per).length, (await reg()).per);
  await ini({ taxi_records: [rec('r0', 1), rec('b1', 1)], taxi_in_sospeso: regU1({ taxi_records: { b1: 's1' } }), __cloud: srv, __codiceId: 'b1:invalid-argument' });
  await ricarica();
  c('ferma di nuovo', ((await reg()).per.taxi_records || {}).b1 === 's1!');
  const rip = await p.evaluate(async () => { localStorage.removeItem('__codiceId'); const x = window.riprovaFerme(); await new Promise(r => setTimeout(r, 300)); return x; });
  c('window.riprovaFerme(): true, e la riga arriva', rip === true && !!(await cloud())[U + 'taxi_records/b1'] && !Object.keys((await reg()).per).length, rip);
  c('senza ferme: false', (await p.evaluate(() => window.riprovaFerme())) === false);
});

await caso('il testo delle ferme nella scheda Cloud', async () => {
  await ini({ taxi_records: [rec('r0', 1)], __cloud: Object.assign({}, srv, { [U + 'taxi_records/z1']: rec('z1', 3) }),
    taxi_in_sospeso: regU1({ taxi_records: { z1: 'd1' } }), __codiceId: 'z1:invalid-argument' });
  await ricarica();
  const t = await p.evaluate(() => testoSospesi(true));
  c('una cancellazione ferma: «1 cancellazione che il Cloud non accetta: un movimento; riprova più tardi»', t === '1 cancellazione che il Cloud non accetta: un movimento; riprova più tardi', t);
  await p.evaluate(() => { const r = leggiSospesi(); r.per.taxi_records.q1 = 's5!'; r.per.taxi_note = { n1: 'd6!', n2: 'd7!' }; localStorage.setItem('taxi_in_sospeso', JSON.stringify(r)); });
  const t2 = await p.evaluate(() => testoSospesi(true));
  c('scritte e cancellazioni ferme dette a parte', t2 === '1 modifica che il Cloud non accetta: un movimento. Sul telefono resta; se la correggi riparte · 3 cancellazioni che il Cloud non accetta: un movimento, una nota, una nota; riprova più tardi', t2);
  await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(250);
  c('e la scheda Cloud lo mostra', ((await p.evaluate(() => (document.getElementById('cloud-in-attesa') || {}).textContent || ''))).includes('riprova più tardi'));
});

// ------------------------------------------------------------------ 15
await caso('tre blocchi con una riga colpevole ciascuno: smontati in fila', async () => {
  const m = molte(1000, 'm');
  await ini({ taxi_records: [rec('r0', 1), ...m], taxi_in_sospeso: regU1({ taxi_records: voci(m) }), __cloud: srv,
    __codiceId: 'm5:invalid-argument,m405:invalid-argument,m805:invalid-argument' });
  await p.goto(APP);
  await p.waitForFunction(() => window.leggiSospesi && (!leggiSospesi().per.taxi_records || Object.values(leggiSospesi().per.taxi_records).every(v => v.endsWith('!'))), null, { timeout: 90000 });
  const bl = await blocchi(); const r = await reg();
  c('tre blocchi, poi le 1000 righe una per una', bl.filter(x => x[0] > 1).length === 3 && bl.filter(x => x[0] === 1).length === 1000, { grossi: bl.filter(x => x[0] > 1).length, singoli: bl.filter(x => x[0] === 1).length });
  c('mai due righe da sole in volo insieme', (await p.evaluate(() => window.__maxSingoli)) === 1, await p.evaluate(() => window.__maxSingoli));
  const lassu = Object.keys(await cloud()).filter(k => k.includes('/taxi_records/m')).length;
  c('le tre colpevoli ferme, le altre 997 arrivate', Object.keys(r.per.taxi_records).sort().join() === 'm405,m5,m805' && lassu === 997, { ferme: Object.keys(r.per.taxi_records), lassu });
});

await caso('il blocco di prova dopo un no a tutto non si smonta', async () => {
  const n = molte(600, 'n');
  await ini({ taxi_records: [rec('r0', 1), ...n], taxi_in_sospeso: regU1({ taxi_records: voci(n) }), __cloud: srv, __rifiuta: '1' });
  await ricarica();
  c('no a tutto: solo prova', (await p.evaluate(() => statoSpedizione().soloProva)) === true);
  await p.evaluate(() => { localStorage.removeItem('__rifiuta'); localStorage.setItem('__codiceId', 'n3:invalid-argument'); window.__blocchi = []; return inviaSospesi({ forza: true }); });
  await p.waitForTimeout(400);
  const bl = await blocchi(); const st = await p.evaluate(() => statoSpedizione());
  c('la prova: un blocco da 400, non smontato', bl.length === 1 && bl[0][0] === 400, bl);
  c('nessuna riga ferma', !(await p.evaluate(() => elencoFerme().length)));
  c('la prova e\' finita (il server c\'e\'), e si aspetta', st.soloProva === false && st.attesa > 0, st);
  await p.evaluate(() => { window.__blocchi = []; return inviaSospesi({ forza: true }); });
  await p.waitForFunction(() => Object.values(leggiSospesi().per.taxi_records || {}).every(v => v.endsWith('!')), null, { timeout: 30000 });
  const r = await reg();
  c('il giro dopo: smontato, la colpevole ferma, il resto (599) arriva', Object.keys(r.per.taxi_records).join() === 'n3' && Object.keys(await cloud()).filter(k => k.includes('/taxi_records/n')).length === 599, r.per);
});

await caso('durante lo smontaggio un no che non e\' della riga lo ferma', async () => {
  const x = molte(5, 'x');
  await ini({ taxi_records: [rec('r0', 1), ...x], taxi_in_sospeso: regU1({ taxi_records: voci(x) }), __cloud: srv,
    __codiceId: 'x1:invalid-argument,x2:unavailable' });
  await ricarica();
  const bl = await blocchi(); const r = await reg(); const v = r.per.taxi_records || {};
  c('x0 passa, x1 ferma, x2 aspetta, x3 e x4 non tentate (4 bussate)', bl.length === 4 && !!(await cloud())[U + 'taxi_records/x0'] && /!$/.test(v.x1 || '') && /^s\d+$/.test(v.x2 || '') && /^s\d+$/.test(v.x3 || '') && /^s\d+$/.test(v.x4 || ''), { bl, v });
  c('e parte l\'attesa', (await attesa()) > 0, await attesa());
});

// ------------------------------------------------------------------ 16
await caso('la forma si controlla solo per un blocco rifiutato prima di partire', async () => {
  const m = molte(900, 'm');
  await ini({ taxi_records: [rec('r0', 1), ...m], taxi_in_sospeso: regU1({ taxi_records: voci(m) }), __cloud: Object.assign({}, srv, { [U + 'profilo/dati']: { nome: 'X' }, [U + 'impostazioni/fiscali']: { inpsPerc: 26 } }) });
  await ricarica();
  c('le 900 arrivano all\'apertura', Object.keys(await cloud()).filter(k => k.includes('/taxi_records/m')).length === 900);
  // e si rispediscono tutte: una seconda tornata, misurata
  await p.evaluate(() => { const v = {}; dailyRecords.forEach((x, i) => { if (x.id !== 'r0') v[x.id] = 's' + (20000 + i); }); localStorage.setItem('taxi_in_sospeso', JSON.stringify({ v: 1, uid: 'u1', n: 30000, dal: null, per: { taxi_records: v } })); window.__nBatch = 0; });
  await p.evaluate(() => inviaSospesi({ forza: true })); await p.waitForTimeout(400);
  const nb = await p.evaluate(() => window.__nBatch);
  console.log('    writeBatch per 900 righe: ' + nb);
  c('900 righe buone: tre writeBatch, non uno per riga', nb === 3 && !Object.keys((await reg()).per).length, nb);
  await ini({ taxi_records: [rec('r0', 1), rec('b1', 1), rec('b2', 2, { x: [[1]] }), rec('b3', 3)],
    taxi_in_sospeso: regU1({ taxi_records: { b1: 's1', b2: 's2', b3: 's3' } }), __cloud: srv });
  await ricarica();
  const bl = await blocchi(); const r = await reg(); const cl = await cloud();
  c('una riga storta: ferma prima di partire, le altre arrivano', (r.per.taxi_records || {}).b2 === 's2!' && Object.keys(r.per.taxi_records || {}).length === 1 && !!cl[U + 'taxi_records/b1'] && !!cl[U + 'taxi_records/b3'], r.per);
  c('sul server un blocco solo da due, niente smontaggio', bl.length === 1 && bl[0][0] === 2, bl);
  await ini({ taxi_records: [rec('r0', 1)], taxi_profilo: { nome: 'Mario', cognome: 'Rossi', strano: [[1, 2]] },
    taxi_in_sospeso: regU1({ profilo: { nome: 's1', cognome: 's2', strano: 's3' } }), __cloud: srv });
  await ricarica();
  const r2 = await reg(); const pr = (await cloud())[U + 'profilo/dati'] || {};
  c('profilo: i campi buoni arrivano, quello storto resta fermo', pr.nome === 'Mario' && pr.cognome === 'Rossi' && pr.strano === undefined && (r2.per.profilo || {}).strano === 's3!' && Object.keys(r2.per.profilo || {}).length === 1, { pr, reg: r2.per });
});

// ------------------------------------------------------------------ 17 B e C
await caso('disco pieno, dentro con un account mentre il registro e\' di un altro', async () => {
  const corsa = (id, imp) => ({ id, data: '2026-10-30', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: imp });
  const su = async (uid, col) => Object.keys(await cloud()).filter(k => k.startsWith(B + uid + '/' + (col || 'taxi_records') + '/')).map(k => k.split('/').pop()).sort().join();
  // Sessione ripresa con u2, il registro ricorda u1 (vuoto), il disco non accetta il registro:
  // si entra senza domanda ma il registro resta di u1.
  await ini({ __uid: 'u2', taxi_in_sospeso: { v: 1, uid: 'u1', n: 0, dal: null, per: {} }, __cloud: { [B + 'u2/taxi_records/z']: corsa('z', 9) }, __pieni: 'taxi_in_sospeso' });
  await ricarica();
  c('dentro con u2, e il registro e\' ancora di u1', (await p.evaluate(() => !!window.isCloudSyncing)) && (await reg()).uid === 'u1', await reg());
  await p.evaluate(() => localStorage.removeItem('__pieni'));
  await p.evaluate((x) => saveRecordToCloud(x), corsa('b1', 3)); await p.waitForTimeout(200);
  await p.evaluate(() => salvaElencoSulCloud('taxi_note', [{ id: 'n1', testo: 'x', data: '2026-10-01' }])); await p.waitForTimeout(200);
  await p.evaluate(() => saveScadenzaToCloud({ id: 's1', nome: 'Bollo', data: '2026-11-01' })); await p.waitForTimeout(200);
  await p.evaluate(() => deleteVersamentoFromCloud('v9')); await p.waitForTimeout(200);
  await p.evaluate((x) => bulkSave([x], []), corsa('b2', 4)); await p.waitForTimeout(200);
  await p.evaluate(() => salvaProfilo({ nome: 'Utente B' })); await p.waitForTimeout(300);
  const r = await reg();
  c('liberato il disco: niente finisce nel registro di u1', r.uid === 'u1' && !Object.keys(r.per).length, r);
  c('tutto arriva dritto su u2 (corse, nota, scadenza, profilo)', (await su('u2')) === 'b1,b2,z' && (await su('u2', 'taxi_note')) === 'n1' && (await su('u2', 'taxi_scadenze')) === 's1' && ((await cloud())[B + 'u2/profilo/dati'] || {}).nome === 'Utente B',
    { rec: await su('u2'), note: await su('u2', 'taxi_note'), sc: await su('u2', 'taxi_scadenze') });
  c('e niente su u1', !Object.keys(await cloud()).some(k => k.startsWith(B + 'u1/')));
  await p.evaluate(() => esciDalCloud()); await p.waitForTimeout(250);
  await p.evaluate((x) => saveRecordToCloud(x), corsa('f1', 3)); await p.waitForTimeout(150);
  c('fuori dal Cloud: la corsa si segna per l\'account ricordato (u1)', !!((await reg()).per.taxi_records || {}).f1 && (await reg()).uid === 'u1', await reg());
});

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') : 'nessuno'));
await b.close();
