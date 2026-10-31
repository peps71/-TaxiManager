// IL CAMBIO DI ACCOUNT, COL CLOUD FINTO E DAI TASTI VERI
// Le modifiche in attesa del Cloud appartengono a un account: il registro
// 'taxi_in_sospeso' ricorda di chi sono. La prima versione della v176
// (fino a c5b8761) sbagliava in quattro modi, tutti corretti nella
// revisione (2e6c6c0):
//  - B3: un telefono MAI collegato, con dei dati, al primo accesso
//    chiedeva «li porto anche in ...?». Nella v175 si entrava e basta, e
//    il Cloud vinceva: ora di nuovo cosi'.
//  - B3: entrando con un ALTRO account e dicendo OK, ogni riga del telefono
//    ripartiva verso il nuovo account con la versione del telefono, anche
//    quelle che il nuovo account aveva gia' (e magari aveva corretto dal
//    Mac): la correzione del Mac si perdeva. Ora le righe diventano
//    «candidati» ('c') e al primo elenco VERO dal server partono solo quelle
//    che lassu' non ci sono.
//  - B2: adottando l'altro account partivano anche le cancellazioni ('d')
//    del vecchio, e il profilo, le impostazioni fiscali e le voci di budget:
//    nel nuovo account sparivano righe sue e il nome, la partita IVA e le
//    aliquote diventavano quelle dell'altro. E le cancellazioni contavano
//    nella domanda.
//  - S5: chi seguiva il consiglio della domanda (azzera il telefono e
//    rientra con B) azzerava fuori dal Cloud: le cancellazioni si segnavano,
//    e rientrando con B la domanda tornava e cancellava in B le righe con lo
//    stesso identificativo.
// Si usa l'app dai tasti («Entra con Google», «Cancella tutto»), con il
// Firestore finto di prove/_finto/: il Cloud vero non si tocca mai.
// Ogni caso sta in un recinto: se su una versione vecchia un tasto o una
// funzione non c'e', il caso si segna «***» e si passa al successivo.
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
// Nessuna richiesta esce davvero: passa solo il Firebase finto.
await ctx.route(/^https?:\/\//, r => r.abort());
for (const [n, f] of [['firebase-app.js', 'app.js'], ['firebase-auth.js', 'auth.js'], ['firebase-firestore.js', 'firestore.js']])
  await ctx.route('**/firebasejs/11.6.1/' + n, r => r.fulfill({ contentType: 'application/javascript', body: readFileSync(join(FINTO, f), 'utf8') }));
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date('2026-10-30T12:00:00+01:00'));
const erroriJS = []; p.on('pageerror', e => erroriJS.push(String(e.message || e)));
const dialoghi = []; let risposta = true;
p.on('dialog', d => { dialoghi.push(d.message()); risposta ? d.accept() : d.dismiss(); });
// Gli avvisi in basso (showToast) si annotano; e il disco pieno si simula:
// localStorage.__pieni = 'taxi_in_sospeso' fa rifiutare quella chiave.
const avvisi = [];
await p.exposeFunction('__avviso', (t) => avvisi.push(t));
await p.addInitScript(() => {
  const vero = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    const pieni = (Storage.prototype.getItem.call(this, '__pieni') || '').split(',');
    if (pieni.includes(k)) throw new DOMException('quota', 'QuotaExceededError');
    return vero.call(this, k, v);
  };
  const spia = () => { if (window.showToast && !window.showToast.__spia) { const v = window.showToast; window.showToast = function (t) { window.__avviso(String(t)); return v.apply(this, arguments); }; window.showToast.__spia = 1; } };
  document.addEventListener('DOMContentLoaded', spia); setInterval(spia, 20);
});
const ricarica = async () => {
  await p.goto(APP);
  await p.waitForFunction(() => window.moduloFirebaseVivo === true && window.__authFatto === true, null, { timeout: 15000 });
  await p.waitForTimeout(700);
};
const cloud = () => p.evaluate(() => JSON.parse(localStorage.__cloud || '{}'));
const reg = () => p.evaluate(() => { try { const r = JSON.parse(localStorage.taxi_in_sospeso || 'null'); return r && r.per ? r : { uid: null, per: {} }; } catch (e) { return { uid: null, per: {} }; } });
const nVoci = (r) => Object.values(r.per || {}).reduce((a, v) => a + Object.keys(v || {}).length, 0);
// Il disco si prepara da una pagina senza l'app (stesso file://, stesso
// localStorage): cosi' nessun timer dell'app ancora aperta ci riscrive sopra.
const VUOTA = 'file://' + join(RADICE, 'prove', 'LEGGIMI.md');
const ini = async (o) => { await p.goto(VUOTA); return p.evaluate((o) => {
  localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
}, o); };
const corsa = (id, imp) => ({ id, data: '2026-10-30', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: imp, ora: '09:00' });
const sulServer = (uid, archivio, elenco) => Object.fromEntries(elenco.map(x => [B + uid + '/' + archivio + '/' + x.id, x]));
const idsServer = async (uid) => Object.keys(await cloud()).filter(k => k.startsWith(B + uid + '/taxi_records/')).map(k => k.split('/').pop()).sort().join(',');
const idsQui = async () => (await p.evaluate(() => (window.dailyRecords || []).map(r => r.id).sort())).join(',');
const importoQui = (id) => p.evaluate((id) => ((window.dailyRecords || []).find(r => r.id === id) || {}).importo, id);
const scheda = async (nome) => { await p.evaluate((n) => switchTab(n), nome); await p.waitForTimeout(200); };
const entra = async (uid) => {
  await scheda('cloud');
  await p.evaluate((u) => { localStorage.__prossimo = u; }, uid);
  await p.locator('button[onclick="entraConGoogle()"]').first().click();
  await p.waitForTimeout(900);
};
// La prima apertura senza nessuna sessione, e si aspetta che l'accesso
// abbia risposto: se no l'app, entrata da sola col primo utente del finto,
// scriveva il suo registro DOPO che il caso aveva pulito il disco, e il
// telefono «mai collegato» si ritrovava un account ricordato (succedeva
// nel giro completo, dove la macchina e' piu' carica).
await p.goto(APP); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('__uid', ''); });
await ricarica();

// La domanda del cambio di account, com'e' scritta in accountDeciso.
const DOMANDA = (email, cosa, lasciate) => `Sei entrato con ${email}. Su questo telefono ci sono già ${cosa} di un altro account o mai caricati${lasciate || ''}.\n\n`
  + `OK: li porto anche in ${email}, insieme a quello che c'è già.\nAnnulla: esco da ${email} e non tocco niente.`;
const AVVISO_ANNULLA = (email) => `Per usare ${email} con i suoi dati: scarica un backup, azzera movimenti e turni da «Gestione → Backup e impostazioni» e rientra. `
  + `Attenzione: note, scadenze, vetture, versamenti, voci di budget, la tua scheda e le impostazioni fiscali di questo telefono, entrando, vanno in ${email} dove lì non ce ne sono ancora.`;
const caso = async (titolo, fn) => {
  console.log('--- ' + titolo + ' ---');
  try { await fn(); }
  catch (e) { ko.push(titolo + ' (interrotto)'); console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0]); }
};

await caso('B3: telefono mai collegato, con dei dati, primo accesso', async () => {
  // Il registro non c'e' (mai entrato), qui ci sono due corse; nell'account
  // la stessa corsa q e' stata corretta dal Mac a 50.
  await ini({ __uid: '', taxi_records: [corsa('q', 1), corsa('w', 2)], __cloud: sulServer('u3', 'taxi_records', [corsa('q', 50)]) });
  dialoghi.length = 0; risposta = true;
  await ricarica();
  c('aperta senza sessione: nessuna domanda', dialoghi.length === 0, dialoghi);
  await entra('u3');
  c('Entra con Google: nessuna domanda (come nella v175)', dialoghi.length === 0, dialoghi);
  c('l\'account si adotta', (await reg()).uid === 'u3', await reg());
  c('vince il Cloud: q resta 50 sul server', (await cloud())[B + 'u3/taxi_records/q'].importo === 50, (await cloud())[B + 'u3/taxi_records/q']);
  c('e il telefono prende 50', (await importoQui('q')) === 50, await importoQui('q'));
  c('niente in attesa alla fine', nVoci(await reg()) === 0, (await reg()).per);
  console.log('    (la corsa w, solo sul telefono: qui ' + ((await idsQui()).split(',').includes('w') ? 'c\'e\'' : 'non c\'e\'') + ', sul server ' + ((await idsServer('u3')).split(',').includes('w') ? 'c\'e\'' : 'non c\'e\'') + ' - come nella v175)');
});

await caso('B3: mai collegato, con dati, account vuoto: la migrazione li porta', async () => {
  await ini({ __uid: '', taxi_records: [corsa('q', 1), corsa('w', 2)] });
  dialoghi.length = 0; risposta = true;
  await ricarica();
  await entra('u4');
  c('nessuna domanda', dialoghi.length === 0, dialoghi);
  c('l\'account vuoto riceve le corse del telefono', (await idsServer('u4')) === 'q,w', await idsServer('u4'));
  c('e il telefono le tiene', (await idsQui()) === 'q,w', await idsQui());
});

await caso('B3+B2: account ricordato diverso, OK - partono solo le righe che mancano', async () => {
  // Il registro e' di u1: una corsa 'a' scritta qui e non partita, una
  // cancellazione 'k', il nome del profilo, un'aliquota, una voce di budget.
  // L'account u2 ha gia' 'a' (corretta a 100 dal Mac) e 'k', e il suo profilo.
  await ini({ __uid: '', taxi_records: [corsa('a', 1), corsa('e', 5)], taxi_profilo: { nome: 'Mario di A' },
    taxi_in_sospeso: { v: 1, uid: 'u1', n: 9, dal: '2026-10-29T10:00:00.000Z',
      per: { taxi_records: { k: 'd1', a: 's2' }, profilo: { nome: 's3' }, fiscali: { inpsPerc: 's4' }, taxi_voci_fisse: { radio: 's5' } } },
    __cloud: Object.assign(sulServer('u2', 'taxi_records', [corsa('a', 100), corsa('k', 7)]),
      { [B + 'u2/profilo/dati']: { nome: 'Utente B' }, [B + 'u2/impostazioni/fiscali']: { inpsPerc: 26 } }) });
  dialoghi.length = 0; risposta = true;
  await ricarica();
  c('aperta senza sessione: nessuna domanda', dialoghi.length === 0, dialoghi);
  await p.evaluate(() => { window.__scritture.length = 0; });
  await entra('u2');
  const dom = dialoghi[0] || '';
  console.log('    la domanda: ' + JSON.stringify(dom));
  c('chiede, una volta', dialoghi.length === 1, dialoghi);
  c('la domanda, parola per parola', dom === DOMANDA('u2@esempio.it', '2 movimenti e 0 turni, e 1 modifica non ancora inviata', ", e 4 modifiche per l'altro account, che con OK non partiranno"), dom);
  c('la cancellazione non conta fra quello che OK porta: «2 movimenti e 0 turni, e 1 modifica non ancora inviata»',
    dom.includes('2 movimenti e 0 turni, e 1 modifica non ancora inviata'), dom);
  // Da a75cc54 quello che OK lascia indietro (la cancellazione, il nome,
  // l'aliquota, la voce di budget dell'altro account) si dice a parte.
  c('e la domanda dice cosa resta indietro: «4 modifiche per l\'altro account, che con OK non partiranno»',
    dom.includes('4 modifiche per l\'altro account, che con OK non partiranno'), dom);
  const cl = await cloud();
  c('la riga che u2 ha gia\' vince dal server: a resta 100', cl[B + 'u2/taxi_records/a'] && cl[B + 'u2/taxi_records/a'].importo === 100, cl[B + 'u2/taxi_records/a']);
  c('e il telefono prende 100', (await importoQui('a')) === 100, await importoQui('a'));
  c('quella che u2 non ha arriva: e, 5', cl[B + 'u2/taxi_records/e'] && cl[B + 'u2/taxi_records/e'].importo === 5, cl[B + 'u2/taxi_records/e']);
  c('la cancellazione dell\'altro account non tocca u2: k resta', !!cl[B + 'u2/taxi_records/k'], await idsServer('u2'));
  c('il profilo di u2 resta il suo', cl[B + 'u2/profilo/dati'].nome === 'Utente B', cl[B + 'u2/profilo/dati']);
  c('e le sue impostazioni fiscali', cl[B + 'u2/impostazioni/fiscali'].inpsPerc === 26, cl[B + 'u2/impostazioni/fiscali']);
  const scr = await p.evaluate(() => window.__scritture.map(s => s[0] + ' ' + s[1].split('/').slice(4).join('/')));
  c('nessuna scrittura di profilo, fiscali o voci di budget', !scr.some(s => /profilo|fiscali|taxi_voci_fisse/.test(s)), scr);
  c('nessuna cancellazione partita', !scr.some(s => s[0] === 'd'), scr);
  c('su u2 una scrittura sola delle corse, quella di e', scr.filter(s => s.includes('taxi_records/')).join() === 's taxi_records/e', scr);
  c('il registro passa a u2 e alla fine e\' vuoto', (await reg()).uid === 'u2' && nVoci(await reg()) === 0, await reg());
  c('il vecchio account u1 non si tocca', (await idsServer('u1')) === '', await idsServer('u1'));
});

await caso('B3: i candidati restano se l\'app si chiude prima dell\'elenco del server', async () => {
  // Sessione ripresa con u2, il registro ricorda u1, senza campo.
  await ini({ __uid: 'u2', __offline: '1', taxi_records: [corsa('a', 1), corsa('e', 5)],
    taxi_in_sospeso: { v: 1, uid: 'u1', n: 1, dal: null, per: {} }, __cloud: sulServer('u2', 'taxi_records', [corsa('a', 100)]) });
  dialoghi.length = 0; risposta = true;
  await ricarica();
  c('chiede (account ricordato diverso, dati qui)', dialoghi.length === 1, dialoghi);
  const r = await reg();
  const tr = r.per.taxi_records || {};
  c('senza campo: le righe del telefono sono candidati \'c\' nel registro, sul disco', r.uid === 'u2' && /^c\d+$/.test(tr.a || '') && /^c\d+$/.test(tr.e || ''), r);
  const conta = await p.evaluate(() => typeof contaSospesi === 'function' ? contaSospesi() : null);
  c('e non contano fra le modifiche in attesa', conta === 0, conta);
  c('niente e\' partito', (await idsServer('u2')) === 'a' && (await cloud())[B + 'u2/taxi_records/a'].importo === 100, await idsServer('u2'));
  await p.evaluate(() => localStorage.removeItem('__offline'));
  dialoghi.length = 0;
  await ricarica();   // iOS chiude l'app, si riapre col campo
  const cl = await cloud();
  c('riaperta col campo: nessuna domanda', dialoghi.length === 0, dialoghi);
  c('decide il server: a resta 100', cl[B + 'u2/taxi_records/a'].importo === 100 && (await importoQui('a')) === 100, cl[B + 'u2/taxi_records/a']);
  c('e, che mancava, arriva', !!cl[B + 'u2/taxi_records/e'], await idsServer('u2'));
  c('registro vuoto', nVoci(await reg()) === 0, (await reg()).per);
});

await caso('S5: azzera da fuori dal Cloud, poi entra con un altro account', async () => {
  // Il consiglio della domanda: «scarica un backup, azzera movimenti e
  // turni e rientra». Il registro ricorda u1; in u2 ci sono r1 e r7.
  await ini({ __uid: '', taxi_records: [corsa('r1', 1), corsa('r2', 2)], taxi_in_sospeso: { v: 1, uid: 'u1', n: 1, dal: null, per: {} },
    __cloud: sulServer('u2', 'taxi_records', [corsa('r1', 1), corsa('r7', 7)]) });
  dialoghi.length = 0; risposta = true;
  await ricarica();
  await scheda('cloud');
  await p.locator('button[onclick="resetAllData()"]').first().click();
  await p.waitForTimeout(400);
  console.log('    la domanda: ' + JSON.stringify(dialoghi[0] || null));
  c('la domanda dice che si azzera solo il telefono', (dialoghi[0] || '').includes('solo su questo dispositivo'), dialoghi);
  c('azzerato: il telefono e\' vuoto', (await idsQui()) === '', await idsQui());
  c('fuori dal Cloud l\'azzeramento non segna niente', nVoci(await reg()) === 0, (await reg()).per);
  dialoghi.length = 0;
  await entra('u2');
  c('entrando con u2: nessuna domanda per le sole cancellazioni', dialoghi.filter(d => d.includes('Sei entrato')).length === 0, dialoghi);
  c('u2 adottato', (await reg()).uid === 'u2', await reg());
  c('in u2 non si cancella niente: r1 e r7 restano', (await idsServer('u2')) === 'r1,r7', await idsServer('u2'));
  c('e il telefono prende quelle di u2', (await idsQui()) === 'r1,r7', await idsQui());
});


await caso('il telefono senza movimenti ne\' turni: il resto passa da solo nell\'altro account', async () => {
  // E' quello che l'avviso dopo Annulla mette in guardia: azzerati movimenti
  // e turni, note, scadenze, vetture, versamenti, voci di budget, scheda e
  // impostazioni fiscali vanno nelle cartelle ancora vuote del nuovo account.
  await ini({ __uid: '', taxi_note: [{ id: 'n1', testo: 'nota di A', data: '2026-10-01' }], taxi_scadenze: [{ id: 's1', nome: 'Bollo di A', data: '2026-11-01' }],
    taxi_profilo: { nome: 'Mario di A' }, taxi_in_sospeso: { v: 1, uid: 'u1', n: 0, dal: null, per: {} },
    taxi_veicoli: [{ id: 'v1', targa: 'AA000AA' }], taxi_voci_fisse: [{ slug: 'radio', nome: 'Radio', importo: 50, frequenza: 'mensile' }],
    taxi_versamenti: [{ id: 'w1', data: '2026-06-30', importo: 100, tipo: 'irpef' }], taxi_fiscal_settings: { inpsPerc: 24.48 } });
  dialoghi.length = 0; risposta = true;
  await ricarica();
  await entra('u2');
  const cl = await cloud();
  const su = (col) => Object.keys(cl).filter(k => k.startsWith(B + 'u2/' + col + '/')).map(k => k.split('/').pop()).sort().join(',');
  c('nessuna domanda', dialoghi.length === 0, dialoghi);
  c('in u2 arrivano nota, scadenza, vettura, versamento, voce di budget', su('taxi_note') === 'n1' && su('taxi_scadenze') === 's1' && su('taxi_veicoli') === 'v1' && su('taxi_versamenti') === 'w1' && su('taxi_voci_fisse') !== '',
    { note: su('taxi_note'), sc: su('taxi_scadenze'), ve: su('taxi_veicoli'), vers: su('taxi_versamenti'), voci: su('taxi_voci_fisse') });
  c('e la scheda e le impostazioni fiscali', (cl[B + 'u2/profilo/dati'] || {}).nome === 'Mario di A' && !!cl[B + 'u2/impostazioni/fiscali'], { prof: cl[B + 'u2/profilo/dati'] });
});

await caso('solo modifiche dell\'altro account in attesa: si chiede, e lo si dice', async () => {
  const per = { taxi_records: { k: 'd1' }, profilo: { nome: 's2' }, taxi_voci_fisse: { radio: 's3' } };
  await ini({ __uid: '', taxi_in_sospeso: { v: 1, uid: 'u1', n: 3, dal: '2026-10-29T10:00:00.000Z', per }, __cloud: sulServer('u2', 'taxi_records', [corsa('k', 7)]) });
  dialoghi.length = 0; risposta = false; avvisi.length = 0;
  await ricarica();
  await entra('u2');
  console.log('    la domanda: ' + JSON.stringify(dialoghi[0] || null));
  c('chiede, una volta', dialoghi.length === 1, dialoghi);
  c('la domanda, parola per parola', dialoghi[0] === DOMANDA('u2@esempio.it', '0 movimenti e 0 turni', ", e 3 modifiche per l'altro account, che con OK non partiranno"), dialoghi[0]);
  const av = avvisi.find(t => t.startsWith('Per usare')) || '';
  console.log('    l\'avviso: ' + JSON.stringify(av));
  c('Annulla: l\'avviso, parola per parola', av === AVVISO_ANNULLA('u2@esempio.it'), av);
  c('Annulla: il registro di u1 resta intatto', JSON.stringify((await reg()).per) === JSON.stringify(per) && (await reg()).uid === 'u1', await reg());
  risposta = true; dialoghi.length = 0;
  await entra('u2');
  c('OK: u2 non perde k, e il registro passa a u2 vuoto', (await idsServer('u2')) === 'k' && (await reg()).uid === 'u2' && nVoci(await reg()) === 0, { u2: await idsServer('u2'), reg: await reg() });
});

await caso('una modifica sola per l\'altro account: al singolare', async () => {
  await ini({ __uid: '', taxi_records: [corsa('a', 1)], taxi_in_sospeso: { v: 1, uid: 'u1', n: 1, dal: null, per: { fiscali: { inpsPerc: 's1' } } } });
  dialoghi.length = 0; risposta = false;
  await ricarica();
  await entra('u2');
  c('«1 movimento e 0 turni ..., e 1 modifica per l\'altro account, che con OK non partirà.»',
    dialoghi[0] === DOMANDA('u2@esempio.it', '1 movimento e 0 turni', ", e 1 modifica per l'altro account, che con OK non partirà"), dialoghi[0]);
  await ini({ __uid: '', taxi_in_sospeso: { v: 1, uid: 'u1', n: 0, dal: null, per: {} } });
  dialoghi.length = 0; risposta = true;
  await ricarica();
  await entra('u2');
  c('niente qui e niente in attesa: nessuna domanda', dialoghi.length === 0 && (await reg()).uid === 'u2', dialoghi);
});

await caso('OK col disco pieno vale come Annulla', async () => {
  const per = { taxi_records: { a: 's1', k: 'd2' }, profilo: { nome: 's3' } };
  await ini({ __uid: 'u2', taxi_records: [corsa('a', 1), corsa('e', 5)], taxi_in_sospeso: { v: 1, uid: 'u1', n: 3, dal: '2026-10-29T10:00:00.000Z', per },
    __cloud: sulServer('u2', 'taxi_records', [corsa('z', 9)]), __pieni: 'taxi_in_sospeso' });
  dialoghi.length = 0; risposta = true; avvisi.length = 0;
  await ricarica();
  c('ha chiesto', dialoghi.length === 1, dialoghi);
  c('e, col registro che non si scrive, e\' uscito', (await p.evaluate(() => localStorage.__uid)) === '' && !(await p.evaluate(() => !!window.isCloudSyncing)));
  c('registro di u1 intatto', JSON.stringify((await reg()).per) === JSON.stringify(per) && (await reg()).uid === 'u1', await reg());
  c('niente toccato su u2 ne\' su u1', (await idsServer('u2')) === 'z' && (await idsServer('u1')) === '', { u2: await idsServer('u2'), u1: await idsServer('u1') });
  const av = avvisi.find(t => t.includes('Non sono entrato')) || '';
  c('l\'avviso, parola per parola', av === 'Non sono entrato in u2@esempio.it: il telefono non ha spazio per ricordarsi cosa portarci. Non ho toccato niente. Libera spazio da «Gestione → Backup e impostazioni → Spazio» e rientra.', av);
  await p.evaluate(() => localStorage.removeItem('__pieni'));
});

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') : 'nessuno'));
await b.close();
