// IL CALENDARIO DI FAMIGLIA: IL TURNO DELLA MOGLIE E GLI AVVENIMENTI
// Dalla d4badee..0c2f06e il calendario dei turni tiene, giorno per giorno,
// anche il turno di sua moglie (Mattina, Pomeriggio, Notte, Riposo) e un
// avvenimento personale di 200 caratteri al massimo. Non e' un conto, ma e'
// un dato suo: se si perde passando dal telefono al Mac, se un backup non lo
// riporta o se un backup vecchio lo cancella, e' lavoro buttato e
// appuntamenti dimenticati. Qui si prova:
//   1. i dati: cosa si accetta e cosa no, un campo alla volta, e un giorno
//      con tutti e due i campi vuoti che se ne va (non resta una riga vuota);
//   2. la sincronizzazione su DUE dispositivi col Firestore finto di
//      prove/_finto: scritto sul telefono arriva sul Mac e viceversa, la
//      cancellazione arriva anche lei, senza campo resta in attesa, l'app
//      chiusa e riaperta lo spedisce, e una cancellazione fatta senza campo
//      non risorge;
//   3. il ripristino col Cloud acceso e il cambio di account;
//   4. il backup DAI TASTI VERI: esce col calendario, rientra identico, la
//      domanda lo nomina; un backup vecchio senza calendario lascia quello
//      di adesso byte per byte; le righe storte si ripuliscono;
//   5. l'interfaccia dai tasti veri a 320, 390 e 1280 px, di giorno e di
//      notte: i segni nella griglia, la sezione «Famiglia» della giornata,
//      la bozza che sopravvive ai ridisegni dello stesso giorno (ma non
//      al cambio di giorno), un avvenimento con dentro del
//      codice che resta testo, e uno di 200 caratteri che non sborda.
// Dalla v185 i turni non sono piu' «della moglie» per tutti ma di
// un'altra persona, facoltativi e coi nomi scelti nella scheda (li prova
// testAltraPersona.mjs): qui il nome di un turno e' ogni testo da 1 a 20
// caratteri, e l'interfaccia gira con l'opzione accesa, nome «Moglie» e i
// quattro turni di sempre. L'archivio e il suo campo «moglie» non cambiano.
// Ogni caso gira dentro una protezione: sulla versione di prima (dove le
// funzioni non ci sono) segna «***» invece di morire al primo errore.
// Chromium non e' Safari: la tastiera vera, l'Invio «Fine» della tastiera
// dell'iPhone e lo zoom al tocco vanno visti sull'iPhone vero.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const FINTO = join(RADICE, 'prove/_finto') + '/';
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

let guai = 0, passati = 0;
const ok = (c, testo, dettaglio) => {
  if (c) passati++; else guai++;
  const d = dettaglio === undefined ? '' : (typeof dettaglio === 'string' ? dettaglio : JSON.stringify(dettaglio));
  console.log(`  ${c ? 'ok  ' : '*** '}${testo}${d && !c ? '  (' + d.slice(0, 400) + ')' : ''}${c ? '' : ' ***'}`);
};
const caso = async (titolo, fn) => {
  console.log('\n' + titolo);
  try { await fn(); }
  catch (e) { guai++; console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0] + ' ***'); }
};

const b = await chromium.launch();
const U = 'artifacts/taximanager-2026/users/';
const REGISTRO = { v: 1, uid: 'u1', n: 0, dal: null, per: {} };

// Una pagina senza Cloud: niente rete, Firebase non arriva, l'app va da sola.
const paginaSenzaCloud = async (opz = {}) => {
  const ctx = await b.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true, ...opz });
  await ctx.route(/^https?:\/\//, r => r.abort());
  const p = await ctx.newPage();
  p.errori = []; p.on('pageerror', e => p.errori.push(e.message));
  p.dialoghi = []; p.risposta = true;
  p.on('dialog', d => { p.dialoghi.push(d.message()); p.risposta ? d.accept() : d.dismiss(); });
  return p;
};
const iniziaCon = async (p, chiavi) => {
  await p.goto(APP);
  await p.evaluate((o) => {
    localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si');
    Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
  }, chiavi);
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.waitForTimeout(300);
};

// ------------------------------------------------------------------
await caso('1. I DATI: COSA SI ACCETTA, UN CAMPO ALLA VOLTA', async () => {
  const p = await paginaSenzaCloud();
  await iniziaCon(p, { taxi_in_sospeso: REGISTRO });
  const r = await p.evaluate(() => {
    const o = {};
    o.turni = JSON.stringify(window.TURNI_MOGLIE); o.congelati = Object.isFrozen(window.TURNI_MOGLIE);
    o.max = typeof AVVENIMENTO_MAX === 'number' ? AVVENIMENTO_MAX : null;
    o.vuoto = JSON.stringify(giornoFamiglia('2026-12-01'));
    o.rifiuti = [
      salvaGiornoFamiglia('2026-02-30', { moglie: 'Notte' }),      // giorno che non esiste
      // Dalla v185 i turni si rinominano: ogni nome da 1 a 20 caratteri e'
      // ammesso («notte», «Festivo» si'), e si rifiuta solo quello che un
      // nome di turno non puo' essere.
      salvaGiornoFamiglia('2026-12-01', { moglie: '   ' }),        // solo spazi: e' vuoto, ma non e' «togli»
      salvaGiornoFamiglia('2026-12-01', { moglie: 'x'.repeat(21) }), // oltre i 20 caratteri
      salvaGiornoFamiglia('2026-12-01', { moglie: 7 }),            // non e' testo
      salvaGiornoFamiglia('2026-12-01', { moglie: { nome: 'Notte' } }), // un oggetto
      salvaGiornoFamiglia('2026-12-01', { avvenimento: 5 }),       // non e' testo
      salvaGiornoFamiglia('2026-1-01', { moglie: 'Notte' }),       // data scritta male
      salvaGiornoFamiglia(20261201, { moglie: 'Notte' }),          // numero
      salvaGiornoFamiglia('2027-02-29', { moglie: 'Riposo' })      // 2027 non e' bisestile
    ];
    o.bisestile = salvaGiornoFamiglia('2028-02-29', { moglie: 'Riposo' });
    o.dopoRifiuti = (window.famiglia || []).map(x => x.id).join(',');
    // I nomi liberi: minuscolo, un turno nuovo, 20 caratteri esatti, spazi ai lati tolti
    o.liberi = [['notte', 'notte'], ['Festivo', 'Festivo'], ['y'.repeat(20), 'y'.repeat(20)], ['  Scuola  ', 'Scuola']]
      .map(([v, atteso], i) => { const d = '2026-12-1' + i; return salvaGiornoFamiglia(d, { moglie: v }) && giornoFamiglia(d).moglie === atteso; });
    ['2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13'].forEach(d => salvaGiornoFamiglia(d, { moglie: '' }));
    o.dopoLiberi = (window.famiglia || []).map(x => x.id).join(',');
    o.si1 = salvaGiornoFamiglia('2026-12-01', { moglie: 'Notte' });
    o.si2 = salvaGiornoFamiglia('2026-12-01', { avvenimento: '  compleanno di Anna  ' + 'x'.repeat(300) });
    o.g = giornoFamiglia('2026-12-01');
    o.disco = JSON.parse(localStorage.taxi_famiglia);
    o.reg1 = (JSON.parse(localStorage.taxi_in_sospeso).per || {}).taxi_famiglia || {};
    o.si3 = salvaGiornoFamiglia('2026-12-01', { moglie: '' });
    o.g2 = giornoFamiglia('2026-12-01');
    o.si4 = salvaGiornoFamiglia('2026-12-01', { avvenimento: '   ' });
    o.dopoCanc = JSON.parse(localStorage.taxi_famiglia).map(x => x.id);
    o.reg2 = (JSON.parse(localStorage.taxi_in_sospeso).per || {}).taxi_famiglia || {};
    o.valido = [giornoFamigliaValido('2026-11-05'), giornoFamigliaValido('2028-02-29'),
                giornoFamigliaValido('2026-02-30'), giornoFamigliaValido('2026-13-01'), giornoFamigliaValido('../x'), giornoFamigliaValido(null)];
    o.elenco = JSON.stringify(elencoFamiglia().map(x => x.id));
    window.famiglia.push({ id: '2026-12-05', data: '2026-12-05', moglie: { x: 1 }, avvenimento: ['a'] });
    o.storto = JSON.stringify(giornoFamiglia('2026-12-05'));
    // Non e' un conto: le cifre restano dove sono
    o.conti = JSON.stringify(getStats());
    return o;
  });
  ok(r.turni === '["Mattina","Pomeriggio","Notte","Riposo"]' && r.congelati, 'quattro turni della moglie, in ordine, che non si cambiano per sbaglio', r.turni);
  ok(r.max === 200, 'l\'avvenimento tiene al massimo 200 caratteri', r.max);
  ok(r.vuoto === '{"moglie":"","avvenimento":""}', 'un giorno mai toccato si legge vuoto', r.vuoto);
  ok(r.rifiuti.every(x => x === false), 'si rifiuta: 30 febbraio, turno di soli spazi, oltre 20 caratteri, numero o oggetto per turno, un numero per avvenimento, data storta, 29/02/2027', r.rifiuti);
  ok(r.bisestile === true, 'il 29 febbraio 2028 si', r.bisestile);
  ok(r.dopoRifiuti === '2028-02-29', 'e dai rifiuti non resta niente in archivio', r.dopoRifiuti);
  ok(r.liberi.every(x => x === true), 'i nomi di turno sono liberi: «notte», «Festivo», 20 caratteri esatti, «  Scuola  » che diventa «Scuola»', r.liberi);
  ok(r.dopoLiberi === '2028-02-29', 'e tolti di nuovo non lasciano righe', r.dopoLiberi);
  ok(r.si1 && r.si2 && r.g.moglie === 'Notte', 'turno e avvenimento si salvano un campo alla volta, l\'altro resta', r.g);
  ok(r.g.avvenimento.length === 200 && r.g.avvenimento.startsWith('compleanno di Anna'), 'l\'avvenimento si pulisce degli spazi e si taglia a 200', r.g.avvenimento.length);
  ok(r.disco.length === 2 && (r.disco.find(x => x.id === '2026-12-01') || {}).data === '2026-12-01', 'sul disco, un documento per giorno con id = data', r.disco);
  ok(/^s\d+$/.test(r.reg1['2026-12-01'] || ''), 'e il registro delle modifiche in attesa lo segna da spedire', r.reg1);
  ok(r.si3 && r.g2.moglie === '' && r.g2.avvenimento.startsWith('compleanno'), 'tolto il turno, l\'avvenimento resta', r.g2);
  ok(r.si4 && !r.dopoCanc.includes('2026-12-01'), 'tolti tutti e due i campi il giorno se ne va (niente riga vuota)', r.dopoCanc);
  ok(/^d\d+$/.test(r.reg2['2026-12-01'] || ''), 'e il registro lo segna come cancellazione', r.reg2);
  ok(JSON.stringify(r.valido) === '[true,true,false,false,false,false]', 'giornoFamigliaValido: date vere si (anche il 29/02/2028), 30 febbraio, mese 13, «../x» e null no', r.valido);
  ok(r.elenco === '["2028-02-29"]', 'elencoFamiglia dice cosa c\'e\'', r.elenco);
  ok(r.storto === '{"moglie":"","avvenimento":""}', 'una riga storta in memoria si legge vuota, senza errori', r.storto);
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await p.context().close();
});

// ------------------------------------------------------------------
// Due dispositivi col Firestore finto: ognuno il suo disco, e il «server»
// del secondo si allinea copiando quello del primo e svegliando gli ascolti.
const B = U + 'u1/taxi_famiglia/';
const dispositivo = async () => {
  const ctx = await b.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await ctx.route(/^https?:\/\//, r => r.abort());
  for (const [n, f] of [['firebase-app.js', 'app.js'], ['firebase-auth.js', 'auth.js'], ['firebase-firestore.js', 'firestore.js']])
    await ctx.route('**/firebasejs/11.6.1/' + n, r => r.fulfill({ contentType: 'application/javascript', body: readFileSync(FINTO + f, 'utf8') }));
  const p = await ctx.newPage();
  p.errori = []; p.on('pageerror', e => p.errori.push(e.message));
  p.dialoghi = []; p.on('dialog', d => { p.dialoghi.push(d.message()); d.accept(); });
  await p.goto(APP);
  return p;
};
const ini = (p, o) => p.evaluate((o) => {
  localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
}, o);
const ricarica = async (p) => {
  await p.goto(APP);
  await p.waitForFunction(() => window.moduloFirebaseVivo === true && window.__authFatto === true, null, { timeout: 15000 });
  await p.waitForTimeout(700);
};
const cloud = (p) => p.evaluate(() => JSON.parse(localStorage.__cloud || '{}'));
const sulServer = async (p) => Object.fromEntries(Object.entries(await cloud(p)).filter(([k]) => k.startsWith(B)).map(([k, v]) => [k.slice(B.length), v]));
const inAttesa = (p) => p.evaluate(() => (JSON.parse(localStorage.taxi_in_sospeso || '{}').per || {}).taxi_famiglia || {});
const allinea = async (da, a) => {
  const s = await da.evaluate(() => localStorage.__cloud || '{}');
  await a.evaluate((s) => { localStorage.__cloud = s; window.__tornaRete(); }, s);
  await a.waitForTimeout(500);
};

await caso('2. DUE DISPOSITIVI COL CLOUD FINTO: TELEFONO E MAC', async () => {
  const A = await dispositivo(), M = await dispositivo();
  // Il telefono ha un giorno segnato prima di entrare: sale sul Cloud vuoto.
  await ini(A, { __uid: 'u1', taxi_in_sospeso: REGISTRO, taxi_famiglia: [{ id: '2026-11-20', data: '2026-11-20', moglie: 'Mattina', avvenimento: '' }] });
  await ricarica(A);
  ok((await sulServer(A))['2026-11-20']?.moglie === 'Mattina', 'il giorno del telefono sale sul Cloud vuoto (non si perde)', await sulServer(A));
  ok(Object.keys(await inAttesa(A)).length === 0, 'e il registro delle attese si svuota', await inAttesa(A));
  await ini(M, { __uid: 'u1', taxi_in_sospeso: REGISTRO });
  await ricarica(M);
  await allinea(A, M);
  ok((await M.evaluate(() => giornoFamiglia('2026-11-20').moglie)) === 'Mattina', 'il Mac lo riceve');

  ok(await A.evaluate(() => salvaGiornoFamiglia('2026-11-27', { moglie: 'Notte', avvenimento: 'cena dai suoceri' })), 'sul telefono si segna il 27');
  await A.waitForTimeout(400);
  ok(JSON.stringify((await sulServer(A))['2026-11-27']) === JSON.stringify({ id: '2026-11-27', data: '2026-11-27', moglie: 'Notte', avvenimento: 'cena dai suoceri' }),
    'sul server il documento ha esattamente id, data, moglie, avvenimento', (await sulServer(A))['2026-11-27']);
  await allinea(A, M);
  ok(JSON.stringify(await M.evaluate(() => giornoFamiglia('2026-11-27'))) === '{"moglie":"Notte","avvenimento":"cena dai suoceri"}', 'e arriva sul Mac');
  ok((await M.evaluate(() => JSON.parse(localStorage.taxi_famiglia || '[]').map(x => x.id).join(','))) === '2026-11-20,2026-11-27', 'anche sul disco del Mac, in ordine di data');

  await M.evaluate(() => salvaGiornoFamiglia('2026-11-27', { moglie: 'Riposo' })); await M.waitForTimeout(400);
  await allinea(M, A);
  ok(JSON.stringify(await A.evaluate(() => giornoFamiglia('2026-11-27'))) === '{"moglie":"Riposo","avvenimento":"cena dai suoceri"}',
    'cambiato il turno dal Mac: il telefono ha Riposo e l\'avvenimento resta');

  await A.evaluate(() => salvaGiornoFamiglia('2026-11-27', { moglie: '', avvenimento: '' })); await A.waitForTimeout(400);
  ok(!('2026-11-27' in await sulServer(A)), 'svuotato il giorno sul telefono: dal server se ne va', Object.keys(await sulServer(A)));
  await allinea(A, M);
  ok((await M.evaluate(() => (window.famiglia || []).map(x => x.id).join(','))) === '2026-11-20', 'e sparisce anche dal Mac');
  // L'ultimo giorno: l'elenco vuoto dal server si applica, perche' il Cloud ha gia' accettato i dati
  await M.evaluate(() => salvaGiornoFamiglia('2026-11-20', { moglie: '' })); await M.waitForTimeout(400);
  await allinea(M, A);
  ok((await A.evaluate(() => (window.famiglia || []).length)) === 0 && Object.keys(await sulServer(A)).length === 0,
    'cancellato l\'ultimo giorno dal Mac, il telefono si svuota (non risorge)', await A.evaluate(() => window.famiglia));

  // Senza campo: il giorno resta in attesa, iOS chiude l'app, si riapre col campo
  await A.evaluate(() => { window.__offline = true; });
  await A.evaluate(() => salvaGiornoFamiglia('2026-12-03', { avvenimento: 'recita a scuola' })); await A.waitForTimeout(300);
  ok((await A.evaluate(() => giornoFamiglia('2026-12-03').avvenimento)) === 'recita a scuola', 'senza campo: sul telefono c\'e\'');
  ok(/^s\d+$/.test((await inAttesa(A))['2026-12-03'] || ''), 'e il registro lo ricorda da spedire', await inAttesa(A));
  ok(!('2026-12-03' in await sulServer(A)), 'sul server non ancora');
  await ricarica(A);
  ok((await sulServer(A))['2026-12-03']?.avvenimento === 'recita a scuola', 'riaperta l\'app col campo: arriva sul server', await sulServer(A));
  ok(Object.keys(await inAttesa(A)).length === 0, 'e il registro si svuota', await inAttesa(A));
  await allinea(A, M);
  ok((await M.evaluate(() => giornoFamiglia('2026-12-03').avvenimento)) === 'recita a scuola', 'e il Mac la vede');
  await A.evaluate(() => { window.__offline = true; });
  await A.evaluate(() => salvaGiornoFamiglia('2026-12-03', { avvenimento: '' })); await A.waitForTimeout(300);
  await ricarica(A);
  ok(!('2026-12-03' in await sulServer(A)) && (await A.evaluate(() => (window.famiglia || []).length)) === 0,
    'cancellato senza campo e riaperto: non risorge ne\' qui ne\' sul server', [await sulServer(A), await A.evaluate(() => window.famiglia)]);

  // Dal Cloud una riga storta (scritta a mano, o da una versione futura)
  await A.evaluate((k) => { const s = JSON.parse(localStorage.__cloud); s[k] = { data: '2026-12-09', moglie: 7, avvenimento: { a: 1 } }; localStorage.__cloud = JSON.stringify(s); window.__tornaRete(); }, B + '2026-12-09');
  await A.waitForTimeout(400);
  ok(JSON.stringify(await A.evaluate(() => giornoFamiglia('2026-12-09'))) === '{"moglie":"","avvenimento":""}', 'una riga storta dal Cloud si legge vuota');
  await A.evaluate(() => { window.meseCalendario = '2026-12'; switchTab('giornata'); setVistaGiornata('calendario'); });
  await A.waitForTimeout(200);
  ok(await A.evaluate(() => !/undefined|NaN|\[object/.test(document.getElementById('main-container').innerText)), 'e il calendario si disegna senza «undefined» ne\' «[object»');
  ok(!A.errori.length && !M.errori.length, 'nessun errore JS sui due dispositivi', [A.errori, M.errori]);
  await A.context().close(); await M.context().close();
});

// ------------------------------------------------------------------
await caso('3. RIPRISTINO COL CLOUD ACCESO E CAMBIO DI ACCOUNT', async () => {
  const p = await dispositivo();
  await ini(p, { __uid: 'u1', taxi_in_sospeso: REGISTRO });
  await ricarica(p);
  await p.evaluate(() => applicaBackup({ versione: 3, records: [], shifts: [], famiglia: [{ id: '2026-12-24', data: '2026-12-24', moglie: 'Riposo', avvenimento: 'Vigilia' }] }));
  await p.waitForTimeout(600);
  ok((await cloud(p))[U + 'u1/taxi_famiglia/2026-12-24']?.avvenimento === 'Vigilia', 'ripristinato un backup col Cloud acceso: il giorno sale sul server');
  // u2 ha gia' il 24 suo e una corsa (cosi' la domanda del cambio di account parte)
  await p.evaluate((U) => { const s = JSON.parse(localStorage.__cloud);
    s[U + 'u2/taxi_famiglia/2026-12-24'] = { id: '2026-12-24', data: '2026-12-24', moglie: 'Notte', avvenimento: 'di u2' };
    s[U + 'u2/taxi_records/z'] = { id: 'z', data: '2026-10-01', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 1 };
    localStorage.__cloud = JSON.stringify(s); }, U);
  await p.evaluate(() => { salvaGiornoFamiglia('2026-12-31', { avvenimento: 'cenone' });
    window.dailyRecords = [{ id: 'q', data: '2026-10-02', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 2 }]; scriviLocale('taxi_records', window.dailyRecords); });
  await p.waitForTimeout(400);
  // Esce e rientra con u2, dal tasto vero
  await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(200);
  await p.locator('button[onclick="esciDalCloud()"]').first().click().catch(() => p.evaluate(() => window.esciDalCloud && window.esciDalCloud()));
  await p.waitForTimeout(500);
  await p.evaluate(() => { localStorage.__prossimo = 'u2'; switchTab('cloud'); }); await p.waitForTimeout(200);
  await p.locator('button[onclick="entraConGoogle()"]').first().click();
  await p.waitForTimeout(1500);
  const cl = await cloud(p);
  ok(p.dialoghi.some(d => d.includes('Sei entrato con')), 'c\'e\' stata la domanda del cambio di account', p.dialoghi);
  ok(cl[U + 'u2/taxi_famiglia/2026-12-31']?.avvenimento === 'cenone', 'con OK il giorno nuovo del telefono va in u2', Object.keys(cl).filter(k => k.includes('famiglia')));
  ok(cl[U + 'u2/taxi_famiglia/2026-12-24']?.avvenimento === 'di u2', 'e sul giorno che u2 aveva gia\' vince u2', cl[U + 'u2/taxi_famiglia/2026-12-24']);
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await p.context().close();
});

// ------------------------------------------------------------------
const CAMPO = 'input[onchange="importBackup(event)"]';
await caso('4. IL BACKUP, DAI TASTI VERI', async () => {
  const p = await paginaSenzaCloud();
  const giorni = [{ id: '2026-11-02', data: '2026-11-02', moglie: 'Mattina', avvenimento: '' },
                  { id: '2026-11-03', data: '2026-11-03', moglie: '', avvenimento: 'dentista «alle 9» & \'poi\' <b>lavoro</b>' },
                  { id: '2026-11-04', data: '2026-11-04', moglie: 'Notte', avvenimento: 'z'.repeat(200) }];
  await iniziaCon(p, { taxi_in_sospeso: REGISTRO, taxi_famiglia: giorni,
    taxi_note: [{ id: 'n1', data: '2026-11-01', testo: 'nota', tipo: 'Altro' }],
    taxi_records: [{ id: 'r1', data: '2026-11-02', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 30 }] });
  await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(250);
  const scarica = async () => {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('button[onclick="exportBackup()"]')]);
    return JSON.parse(readFileSync(await dl.path(), 'utf8'));
  };
  const carica = async (oggetto) => {
    await p.setInputFiles(CAMPO, { name: 'TaxiManager_Backup_2026-11-20.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oggetto)) });
    await p.waitForTimeout(700);
  };
  const pacco = await scarica();
  ok(JSON.stringify(pacco.famiglia) === JSON.stringify(giorni), 'il backup scaricato porta il calendario, identico', pacco.famiglia);
  ok(pacco.versione === 3 && ['records', 'shifts', 'scadenze', 'veicoli', 'vociFisse', 'note', 'versamenti', 'impostazioniFiscali', 'profilo', 'date'].every(k => k in pacco),
    'il formato non cambia: versione 3 e le chiavi di prima ci sono tutte', Object.keys(pacco));

  // Rientra su un telefono che il calendario l'ha perso
  await iniziaCon(p, { taxi_in_sospeso: REGISTRO });
  await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(250);
  p.dialoghi.length = 0; p.risposta = true;
  await carica(pacco);
  const d = p.dialoghi[0] || '';
  console.log('    la domanda: ' + JSON.stringify(d.split('\n\n')[2] || d));
  ok(d.includes('\n\nAnche note, calendario di famiglia e impostazioni tornano come nel backup; quello che hai aggiunto dopo resta.\n\n'),
    'la domanda nomina il calendario di famiglia fra le altre categorie', d);
  ok(JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.taxi_famiglia || '[]'))) === JSON.stringify(giorni), 'detto si: rientra identico, sul disco');
  ok(JSON.stringify(await p.evaluate(() => [giornoFamiglia('2026-11-03'), giornoFamiglia('2026-11-04').avvenimento.length])) === JSON.stringify([{ moglie: '', avvenimento: giorni[1].avvenimento }, 200]),
    'e in memoria, con virgolette, «» e < > intatti');
  ok(Object.keys(await p.evaluate(() => (JSON.parse(localStorage.taxi_in_sospeso).per || {}).taxi_famiglia || {})).sort().join(',') === '2026-11-02,2026-11-03,2026-11-04',
    'e i giorni si segnano da spedire al Cloud');
  const ancora = await scarica();
  ok(JSON.stringify(ancora.famiglia) === JSON.stringify(pacco.famiglia), 'riscaricato, il backup dice lo stesso calendario (esce e rientra identico)');

  // Solo il calendario: la domanda lo dice con le sue parole. Dalla v185
  // il nome e' quello scelto nella scheda (non piu' «tua moglie» per
  // tutti); senza l'opzione accesa, o senza un nome, si dice il calendario.
  const soloCalendario = { versione: 3, date: '2026-11-20T10:00:00.000Z', records: [], shifts: [], famiglia: [giorni[0]] };
  const FRASE = (chi) => `\n\nAnche ${chi} tornano come nel backup; quello che hai aggiunto dopo resta.\n\n`;
  const PROF = { nome: 'Giuseppe', cognome: 'Rossi', licenza: '57', sigla: '', colore: '', piva: '', logo: '' };
  for (const [profilo, chi, titolo] of [
    [null, 'i giorni del calendario di famiglia', 'telefono senza scheda'],
    [Object.assign({}, PROF, { altraPersona: { attivo: true, nome: 'Maria', turni: [{ nome: 'Mattina', sigla: 'M', colore: 'celeste' }] }, altraPersonaAnno: '2026' }), 'i turni di Maria e gli avvenimenti', 'turni accesi col nome «Maria»'],
    [Object.assign({}, PROF, { altraPersona: { attivo: false, nome: 'Maria', turni: [] }, altraPersonaAnno: '2026' }), 'i giorni del calendario di famiglia', 'turni spenti'],
    [Object.assign({}, PROF, { altraPersona: { attivo: true, nome: '', turni: [] }, altraPersonaAnno: '2026' }), 'i giorni del calendario di famiglia', 'turni accesi senza nome']]) {
    await iniziaCon(p, Object.assign({ taxi_in_sospeso: REGISTRO }, profilo ? { taxi_profilo: profilo } : {}));
    await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(250);
    p.dialoghi.length = 0;
    await carica(soloCalendario);
    ok((p.dialoghi[0] || '').includes(FRASE(chi)), `un backup col solo calendario, ${titolo}: «Anche ${chi} tornano...»`, p.dialoghi[0]);
    ok(!/tua moglie/.test(p.dialoghi[0] || ''), '  e «tua moglie» non c\'e\' piu\'');
    ok((await p.evaluate(() => giornoFamiglia('2026-11-02').moglie)) === 'Mattina', '  e non si scarta perche\' non ha movimenti');
  }

  // Un backup vecchio, senza «famiglia»: il calendario di adesso resta byte per byte
  await iniziaCon(p, { taxi_in_sospeso: REGISTRO, taxi_famiglia: giorni });
  await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(250);
  const vecchio = JSON.parse(JSON.stringify(pacco)); delete vecchio.famiglia;
  const prima = await p.evaluate(() => localStorage.taxi_famiglia);
  p.dialoghi.length = 0;
  await carica(vecchio);
  ok(p.dialoghi.length === 1 && !/famiglia|tua moglie/.test(p.dialoghi[0]), 'backup vecchio: la domanda non nomina il calendario', p.dialoghi);
  ok((await p.evaluate(() => localStorage.taxi_famiglia)) === prima, 'e il calendario di adesso resta identico, byte per byte');
  ok((await p.evaluate(() => (window.dailyRecords || []).map(x => x.id).join(','))) === 'r1', 'mentre il resto del backup rientra come sempre');

  // Righe storte nel file
  await iniziaCon(p, { taxi_in_sospeso: REGISTRO, taxi_famiglia: [giorni[1]] });
  await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(250);
  const storto = { versione: 3, date: '2026-11-20T10:00:00.000Z', records: [], shifts: [], famiglia: [
    null, 5, 'x', [], { id: '2026-02-30', moglie: 'Notte' }, { id: '../x', moglie: 'Notte' }, { id: 20261104, moglie: 'Notte' },
    { id: '2026-11-05', data: '1999-01-01', moglie: 'notte', avvenimento: '  gita  ' },
    { id: '2026-11-06', moglie: { a: 1 }, avvenimento: ['x'] },
    { id: '2026-11-07', moglie: 'Pomeriggio', avvenimento: 'y'.repeat(500) },
    { id: '2026-11-08', moglie: 'w'.repeat(21), avvenimento: '' },
    { id: '2026-11-09', moglie: '  Ferie  ', avvenimento: 5 },
    { id: '2026-11-02', data: '2026-11-02', moglie: 'Notte', avvenimento: '' }] };
  p.dialoghi.length = 0;
  await carica(storto);
  const dopo = await p.evaluate(() => JSON.parse(localStorage.taxi_famiglia || '[]'));
  const ord = (l) => JSON.stringify(l.map(x => Object.fromEntries(Object.entries(x).sort())));
  ok(ord(dopo) === ord([
      { id: '2026-11-02', data: '2026-11-02', moglie: 'Notte', avvenimento: '' },
      giorni[1],
      { id: '2026-11-05', data: '2026-11-05', moglie: 'notte', avvenimento: 'gita' },
      { id: '2026-11-07', data: '2026-11-07', moglie: 'Pomeriggio', avvenimento: 'y'.repeat(200) },
      { id: '2026-11-09', data: '2026-11-09', moglie: 'Ferie', avvenimento: '' }]),
    'righe storte: fuori id falsi, date impossibili, «../x», campi non testo, turno oltre 20 caratteri; la data segue l\'id, un turno qualsiasi («notte») resta, gli spazi ai lati si tolgono, l\'avvenimento si taglia a 200; il giorno di adesso che il backup non ha resta', dopo);
  ok(await p.evaluate(() => (window.famiglia || []).every(x => giornoFamigliaValido(x.id) && x.data === x.id && typeof x.moglie === 'string' && x.moglie === x.moglie.trim() && x.moglie.length <= 20 && typeof x.avvenimento === 'string' && x.avvenimento.length <= 200 && (x.moglie || x.avvenimento))),
    'e ogni giorno rimasto e\' una riga buona');
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await p.context().close();
});

// ------------------------------------------------------------------
// 5. L'interfaccia, dai tasti veri. Il 10 novembre 2026 e' un martedi'.
const GIORNO = '2026-11-10';
const LUNGO = 'Matrimonio di Marco e Giulia a Pinerolo, poi cena tutti insieme fino a tardi dal ristorante sulla collina, ' +
              'ritorno a casa con la macchina di suo fratello e la mattina dopo colazione dai nonni di lei, alle dieci.';
// 199 caratteri e un punto: finisse con uno spazio, la pulizia lo toglierebbe
const DUECENTO = (LUNGO + ' ' + LUNGO).slice(0, 199) + '.';
const INIEZIONE = '<img src=x onerror="window.__bucato=1"> " onmouseover="window.__bucato=2" \' ${alert(1)}';
const apriCalendario = async (larghezza, scuro) => {
  const p = await paginaSenzaCloud({ viewport: { width: larghezza, height: 900 }, colorScheme: scuro ? 'dark' : 'light' });
  // Dalla v185 i turni dell'altra persona sono facoltativi: qui accesi, col
  // nome «Moglie» e i quattro turni di sempre (quello che la migrazione da'
  // a chi li usava gia'). L'anno e' quello di adesso: niente domanda.
  await iniziaCon(p, { taxi_profilo: { nome: 'Giuseppe', cognome: 'Rossi', licenza: '57', sigla: '', colore: '', piva: '', logo: '',
    altraPersona: { attivo: true, nome: 'Moglie', turni: [{ nome: 'Mattina', sigla: 'M', colore: 'celeste' }, { nome: 'Pomeriggio', sigla: 'P', colore: 'arancio' },
      { nome: 'Notte', sigla: 'N', colore: 'indaco' }, { nome: 'Riposo', sigla: 'R', colore: 'verde' }] },
    altraPersonaAnno: String(new Date().getFullYear()) } });
  await p.evaluate(() => { window.meseCalendario = '2026-11'; switchTab('giornata'); setVistaGiornata('calendario'); });
  await p.waitForTimeout(200);
  return p;
};
const casella = (p, iso) => p.locator(`#main-container button[onclick="toccaGiornoCalendario('${iso}')"]`).first();
const statoCasella = (p, iso) => p.evaluate((iso) => {
  const e = [...document.querySelectorAll('#main-container .grid-cols-7 button')].find(x => (x.getAttribute('onclick') || '').includes(`'${iso}'`));
  if (!e) return null;
  const s = e.querySelector('.segno-famiglia.a-sinistra'), st = e.querySelector('.segno-famiglia.a-destra');
  return { title: e.getAttribute('title'), sinistra: s ? s.textContent : null, etichetta: s ? s.getAttribute('aria-label') : null, stella: st ? st.textContent : null };
}, iso);
const premuti = (p) => p.evaluate(() => ['M', 'P', 'N', 'R'].map(l => { const e = document.getElementById('fam-moglie-' + l); return e ? l + ':' + e.getAttribute('aria-pressed') : l + ':manca'; }).join(' '));

for (const scuro of [false, true]) for (const w of [320, 390, 1280]) {
  await caso(`5. INTERFACCIA, ${w} px ${scuro ? 'al buio' : 'di giorno'}`, async () => {
    const p = await apriCalendario(w, scuro);
    ok((await p.evaluate(() => document.documentElement.getAttribute('data-tema') || '')) === (scuro ? 'scuro' : '') ||
       (!scuro && (await p.evaluate(() => document.documentElement.getAttribute('data-tema'))) !== 'scuro'), scuro ? 'il tema e\' scuro' : 'il tema e\' chiaro');
    await casella(p, GIORNO).click();
    await p.waitForTimeout(150);
    ok(await p.locator('#fam-moglie-N').count() === 1 && await p.locator('#fam-avvenimento').count() === 1, 'aperta la giornata c\'e\' la sezione «Famiglia», coi quattro turni e il campo');
    const titoli = await p.evaluate(() => ({ sezione: [...document.querySelectorAll('#main-container p')].some(x => x.textContent.trim() === 'Famiglia e impegni'),
      turno: (document.getElementById('fam-moglie-titolo') || {}).textContent }));
    ok(titoli.sezione && titoli.turno === 'Turno di Moglie', 'la sezione si chiama «Famiglia e impegni» e i turni «Turno di Moglie»', titoli);
    ok((await premuti(p)) === 'M:false P:false N:false R:false', 'nessun turno premuto all\'inizio', await premuti(p));

    // Il turno della moglie, dal tasto
    await p.click('#fam-moglie-N'); await p.waitForTimeout(120);
    ok((await premuti(p)) === 'M:false P:false N:true R:false', 'toccato «Notte»: premuto quello solo', await premuti(p));
    ok((await p.evaluate((g) => giornoFamiglia(g).moglie, GIORNO)) === 'Notte', 'e salvato');
    let c = await statoCasella(p, GIORNO);
    ok(c && c.sinistra === 'N' && c.etichetta === 'Moglie Notte' && c.title === 'Moglie: Notte', 'nella griglia la pastiglia «N» col suo nome, e il title della casella', c);
    await p.click('#fam-moglie-P'); await p.waitForTimeout(120);
    ok((await premuti(p)) === 'M:false P:true N:false R:false' && (await statoCasella(p, GIORNO)).sinistra === 'P', 'toccato «Pomeriggio»: cambia', await premuti(p));
    await p.click('#fam-moglie-P'); await p.waitForTimeout(120);
    ok((await premuti(p)) === 'M:false P:false N:false R:false' && (await statoCasella(p, GIORNO)).sinistra === null, 'ritoccato lo stesso: si toglie, e la pastiglia sparisce');
    ok((await p.evaluate(() => localStorage.taxi_famiglia || '[]')) === '[]', 'e il giorno, vuoto, non resta sul disco');

    // L'avvenimento: la bozza resta se intanto si tocca un turno (ridisegno)
    await p.fill('#fam-avvenimento', INIEZIONE);
    await p.click('#fam-moglie-R'); await p.waitForTimeout(120);
    ok((await p.inputValue('#fam-avvenimento')) === INIEZIONE, 'scritto l\'avvenimento e toccato «Riposo»: quello che si scriveva resta nel campo');
    ok((await p.evaluate((g) => giornoFamiglia(g).avvenimento, GIORNO)) === '', 'ma non e\' salvato finche\' non lo si salva');
    await p.press('#fam-avvenimento', 'Enter'); await p.waitForTimeout(150);
    ok((await p.evaluate((g) => giornoFamiglia(g).avvenimento, GIORNO)) === INIEZIONE.trim(), 'Invio nel campo salva');
    ok(await p.evaluate(() => !document.querySelector('#main-container img[src="x"]') && !window.__bucato), 'il codice nell\'avvenimento resta testo: nessuna immagine nata, niente eseguito');
    const riga = await p.evaluate(() => { const e = document.querySelector('#main-container .testo-avvenimento'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
    ok(riga === ('★ Avvenimento: ' + INIEZIONE.trim()).replace(/\s+/g, ' '), 'in cima alla giornata «★ Avvenimento: ...», scritto tale e quale', riga);
    c = await statoCasella(p, GIORNO);
    ok(c && c.stella === '★' && c.sinistra === 'R' && c.title === 'Moglie: Riposo, avvenimento: ' + INIEZIONE.trim(), 'nella griglia la stellina e la «R», e il title col testo intero (virgolette comprese)', c);
    // il title con le virgolette non apre attributi nuovi
    ok(await p.evaluate(() => ![...document.querySelectorAll('#main-container [onmouseover]')].length), 'le virgolette del testo non aprono attributi nella casella');

    // Il tasto «Salva» con un avvenimento di 200 caratteri, e il campo che piu' di 200 non ne prende
    await p.fill('#fam-avvenimento', DUECENTO + 'OLTRE');
    ok((await p.inputValue('#fam-avvenimento')).length === 200, 'il campo non prende piu\' di 200 caratteri', (await p.inputValue('#fam-avvenimento')).length);
    await p.locator('#main-container button', { hasText: /^Salva$/ }).first().click(); await p.waitForTimeout(150);
    ok((await p.evaluate((g) => giornoFamiglia(g).avvenimento, GIORNO)) === DUECENTO, 'il tasto «Salva» salva i 200 caratteri');
    await p.waitForTimeout(300);
    const misure = await p.evaluate(() => {
      const pan = document.querySelector('#main-container .testo-avvenimento');
      const box = pan && pan.closest('.rounded-2xl');
      const r = pan.getBoundingClientRect(), rb = box.getBoundingClientRect();
      const tagliati = [];
      box.querySelectorAll('*').forEach(e => {
        if (e.children.length || !(e.textContent || '').trim()) return;
        if (e.classList.contains('truncate')) return;
        if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') tagliati.push(e.textContent.trim().slice(0, 30));
      });
      const fuori = [...box.querySelectorAll('*')].filter(e => { const q = e.getBoundingClientRect(); return q.width && (q.right > rb.right + 1 || q.left < rb.left - 1); }).map(e => e.tagName + '.' + e.className.toString().slice(0, 30));
      const campo = document.getElementById('fam-avvenimento');
      return { pagina: document.documentElement.scrollWidth - innerWidth, riga: [r.left - rb.left, rb.right - r.right],
               dentro: r.left >= rb.left && r.right <= rb.right + 0.5, pieno: pan.textContent.includes(window.giornoFamiglia('2026-11-10').avvenimento),
               tagliati, fuori, corpo: parseFloat(getComputedStyle(campo).fontSize), max: campo.maxLength,
               tasti: ['M', 'P', 'N', 'R'].map(l => Math.round(document.getElementById('fam-moglie-' + l).getBoundingClientRect().height)),
               salva: Math.round([...document.querySelectorAll('#main-container button')].find(x => x.textContent.trim() === 'Salva').getBoundingClientRect().height),
               togli: Math.round(([...document.querySelectorAll('#main-container button')].find(x => x.textContent.trim() === 'Togli l\'avvenimento') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height) };
    });
    ok(misure.pagina <= 0, 'con 200 caratteri la pagina non sborda di lato', misure.pagina);
    ok(misure.dentro && misure.pieno, 'la riga dell\'avvenimento sta dentro la giornata e si legge tutta (va a capo, non si taglia)', misure.riga);
    ok(misure.fuori.length === 0, 'niente esce dalla giornata aperta', misure.fuori);
    ok(misure.tagliati.length === 0, 'nessun testo tagliato nella giornata', misure.tagliati);
    ok(misure.corpo >= 16 && misure.max === 200, 'il campo e\' a 16 px o piu\' (Safari non ingrandisce) e ha maxlength 200', misure);
    ok(misure.tasti.every(h => h >= 44) && misure.salva >= 44 && misure.togli >= 44, 'turni, «Salva» e «Togli l\'avvenimento» alti almeno 44 px', misure);

    // Leggibilita': la pastiglia e la stellina sul loro fondo, e la riga gialla
    const contrasti = await p.evaluate(() => {
      const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
      const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      const cr = e => { const st = getComputedStyle(e); const a = L(rgb(st.color)), b = L(rgb(st.backgroundColor)); return +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2); };
      return [...document.querySelectorAll('#main-container .segno-famiglia, #main-container .testo-avvenimento')].map(e => e.textContent.trim().slice(0, 12) + ' ' + cr(e));
    });
    ok(contrasti.length >= 3 && contrasti.every(x => parseFloat(x.split(' ').pop()) >= 4.5), 'segni e riga dell\'avvenimento si leggono (contrasto 4,5 o piu\')', contrasti);

    // Togli l'avvenimento, poi togli il turno: il giorno se ne va
    await p.locator('#main-container button', { hasText: 'Togli l\'avvenimento' }).first().click(); await p.waitForTimeout(150);
    c = await statoCasella(p, GIORNO);
    ok((await p.evaluate((g) => giornoFamiglia(g).avvenimento, GIORNO)) === '' && c.stella === null && c.sinistra === 'R' && c.title === 'Moglie: Riposo',
      '«Togli l\'avvenimento»: via la stellina, il turno resta', c);
    ok(await p.locator('#main-container .testo-avvenimento').count() === 0 && (await p.inputValue('#fam-avvenimento')) === '', 'e via anche la riga in cima, col campo vuoto');
    await p.click('#fam-moglie-R'); await p.waitForTimeout(120);
    c = await statoCasella(p, GIORNO);
    ok(c.title === null && c.sinistra === null && (await p.evaluate(() => localStorage.taxi_famiglia)) === '[]', 'ritoccato «Riposo»: la casella torna pulita e sul disco non resta niente', c);

    // La bozza vale per il giorno su cui la si scrive: aperto un altro giorno
    // e tornati, il campo riparte da quello che e' salvato (vuoto). Se no un
    // testo lasciato a meta' il 10 ricompariva sul 10 giorni dopo, e un
    // «Salva» distratto lo segnava.
    await p.fill('#fam-avvenimento', 'bozza lasciata a meta\'');
    await casella(p, '2026-11-12').click(); await p.waitForTimeout(150);
    const sul12 = await p.inputValue('#fam-avvenimento');
    await casella(p, GIORNO).click(); await p.waitForTimeout(150);
    const tornato = await p.inputValue('#fam-avvenimento');
    ok(sul12 === '' && tornato === '' && (await p.evaluate((g) => giornoFamiglia(g).avvenimento, GIORNO)) === '',
      'scritto senza salvare e aperto un altro giorno: li\' il campo e\' vuoto, e tornando la bozza non c\'e\' piu\'', { sul12, tornato });

    // Tutto il mese segnato, con avvenimenti lunghi: la griglia non sborda e i giorni si leggono
    const griglia = await p.evaluate((lungo) => {
      for (let g = 1; g <= 30; g++) { const d = '2026-11-' + String(g).padStart(2, '0'); salvaGiornoFamiglia(d, { moglie: TURNI_MOGLIE[g % 4], avvenimento: lungo }); }
      window.shifts = [{ id: 't1', data: '2026-11-11', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 170 }];
      window.dailyRecords = [{ id: 'e1', data: '2026-11-11', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 1234, ora: '10:00' }];
      window.versioneDati = (window.versioneDati || 0) + 1;
      renderContent();
      const celle = [...document.querySelectorAll('#main-container .grid-cols-7 button')];
      const sovrapposti = celle.filter(e => {
        const s = e.querySelector('.segno-famiglia.a-sinistra'), st = e.querySelector('.segno-famiglia.a-destra');
        const n = [...e.querySelectorAll('span')].find(x => /^\d+$/.test(x.textContent.trim()));
        const r = e.getBoundingClientRect();
        const fuoriCella = [s, st].some(x => { const q = x.getBoundingClientRect(); return q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5; });
        const q1 = s.getBoundingClientRect(), q2 = st.getBoundingClientRect();
        // Del numero conta l'inchiostro, non la scatola: la riga e' piu' alta
        // delle cifre, e i segni stanno apposta nello spazio sopra le cifre
        // (vedi il commento di .segno-famiglia). La cima delle cifre si
        // calcola dalla linea di base e dall'altezza vera dei caratteri.
        const sn = getComputedStyle(n), qb = n.getBoundingClientRect();
        const cx = document.createElement('canvas').getContext('2d');
        cx.font = `${sn.fontWeight} ${sn.fontSize} ${sn.fontFamily}`;
        const m = cx.measureText(n.textContent.trim());
        const alta = parseFloat(sn.lineHeight) || parseFloat(sn.fontSize);
        const base = qb.top + (alta - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
        const qn = { left: qb.left + (qb.width - m.width) / 2, right: qb.left + (qb.width + m.width) / 2,
                     top: base - m.actualBoundingBoxAscent, bottom: base + m.actualBoundingBoxDescent };
        const tocca = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        return fuoriCella || tocca(q1, q2) || tocca(q1, qn) || tocca(q2, qn);
      }).map(e => e.getAttribute('onclick').slice(-6, -2));
      return { celle: celle.length, pastiglie: document.querySelectorAll('#main-container .segno-famiglia.a-sinistra').length,
               stelle: document.querySelectorAll('#main-container .segno-famiglia.a-destra').length,
               sbordo: document.documentElement.scrollWidth - innerWidth, sovrapposti };
    }, LUNGO.slice(0, 200));
    ok(griglia.pastiglie === 30 && griglia.stelle === 30, 'tutto il mese segnato: 30 pastiglie e 30 stelline', griglia);
    ok(griglia.sbordo <= 0, 'la pagina non sborda', griglia.sbordo);
    ok(griglia.sovrapposti.length === 0, 'pastiglia, stellina e cifre del giorno non si coprono e restano nella casella (anche con ore e incasso)', griglia.sovrapposti);
    ok(!/undefined|NaN|\[object/.test(await p.evaluate(() => document.getElementById('main-container').innerText)), 'a video niente «undefined», «NaN», «[object»');
    ok(p.errori.length === 0, 'nessun errore JS', p.errori);
    await p.context().close();
  });
}

await b.close();
console.log(`\n${passati} controlli passati` + (guai ? `  *** ${guai} FALLITI ***` : ', tutto a posto'));
process.exit(guai ? 1 : 0);
