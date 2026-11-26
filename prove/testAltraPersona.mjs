// I TURNI DI UN'ALTRA PERSONA: GENERALI E FACOLTATIVI (v185)
// Fino alla v184 il calendario segnava per tutti i turni «di tua moglie»,
// coi quattro nomi fissi Mattina, Pomeriggio, Notte, Riposo. Dalla v185 sono
// i turni di un'altra persona col nome scelto nella scheda del titolare,
// accesi solo se servono, coi turni che si rinominano, si aggiungono (fino
// a 8) e si colorano. I giorni restano nello stesso archivio di prima
// (taxi_famiglia, campo «moglie»). Qui si prova quello che, sbagliato,
// fa perdere dati o li mostra storti:
//   1. la MIGRAZIONE di chi li usava gia': con almeno un giorno segnato e
//      nessuna scelta fatta, accesi col nome «Moglie» e i quattro turni di
//      sempre, l'anno di adesso, solo sul disco (non si spedisce), una volta
//      sola; chi non li usava resta com'era byte per byte; una scelta gia'
//      fatta (anche «spenta») non si tocca; i giorni che arrivano dal Cloud
//      dopo la fanno partire lo stesso; un dispositivo rimasto indietro non
//      copre la scelta che sta sul Cloud;
//   2. l'opzione SPENTA: segni, legenda e tasti spariscono ma i giorni
//      restano sul disco identici e tornano riaccendendo; l'avvenimento si
//      segna sempre, anche senza i turni;
//   3. l'interfaccia a 320, 390 e 1280 px, di giorno e al buio, con otto
//      turni e un nome di 30 caratteri: niente sborda, campi a 16 px (se no
//      Safari ingrandisce), tasti alti 44, la sigla si legge sul suo colore
//      (contrasto 4,5, misurato sul colore vero);
//   4. il modulo dai tasti veri: interruttore, nome, sigla e colore con
//      l'anteprima, «+ Turno» fino a 8, «×», «Rimetti i turni predefiniti»
//      che chiede prima (detto no, niente cambia), due turni con lo stesso
//      nome (anche solo a parte le maiuscole) o un turno senza nome che
//      bloccano il salvataggio; salvare la scheda senza toccare la sezione
//      non scrive la configurazione;
//   5. un turno RINOMINATO o tolto: il giorno resta, con l'iniziale su
//      grigio, il nome intero nel title e per VoiceOver, la riga «Segnato
//      «X»...» e il tasto «Togli il turno»; rimesso il nome torna il colore;
//   6. nome della persona, nomi e sigle dei turni con dentro del codice
//      (<img onerror>, <svg onload>, apici, virgolette): restano testo
//      dappertutto (griglia, legenda, tasti, modulo, domanda) e i tasti
//      salvano il nome esatto;
//   7. una configurazione STORTA dal backup (dal tasto vero) e dal Cloud
//      finto: si ripulisce; un backup vecchio senza i campi lascia la scelta
//      di adesso;
//   8. la DOMANDA DI INIZIO ANNO, con l'orologio al 3 gennaio 2027: su Oggi
//      e sul Calendario, le quattro risposte, l'utente nuovo e il profilo
//      senza anno che non ricevono domande, e la risposta data sul telefono
//      che vale anche sul Mac (Firestore finto di prove/_finto, mai quello
//      vero).
// Ogni caso gira dentro una protezione: sulla v184 (65b8f46), dove queste
// funzioni non ci sono, segna «***» invece di morire al primo errore.
// Chromium non e' Safari: l'interruttore e il menu dei colori disegnati da
// iOS, il carattere di sistema e VoiceOver vanno visti sull'iPhone vero.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const FINTO = join(RADICE, 'prove/_finto') + '/';
const FOTO = process.env.FOTO || join(tmpdir(), 'testAltraPersona');
mkdirSync(FOTO, { recursive: true });
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
  console.log(`  ${c ? 'ok  ' : '*** '}${testo}${d && !c ? '  (' + d.slice(0, 500) + ')' : ''}${c ? '' : ' ***'}`);
};
const caso = async (titolo, fn) => {
  console.log('\n' + titolo);
  try { await fn(); }
  catch (e) { guai++; console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0] + ' ***'); }
};

const b = await chromium.launch();
const U = 'artifacts/taximanager-2026/users/u1/';
const REGISTRO = { v: 1, uid: 'u1', n: 0, dal: null, per: {} };
const NOVEMBRE = '2026-11-26T10:00:00+01:00';
const GENNAIO = '2027-01-03T09:00:00+01:00';
const PROF = { nome: 'Giuseppe', cognome: 'Rossi', licenza: '57', sigla: '', colore: '', piva: '', logo: '' };
const PREDEFINITI = [{ nome: 'Mattina', sigla: 'M', colore: 'celeste' }, { nome: 'Pomeriggio', sigla: 'P', colore: 'arancio' },
                     { nome: 'Notte', sigla: 'N', colore: 'indaco' }, { nome: 'Riposo', sigla: 'R', colore: 'verde' }];
const OTTO = PREDEFINITI.concat([{ nome: 'Spezzato lungo', sigla: 'S', colore: 'blu' }, { nome: 'Ferie', sigla: 'F', colore: 'acqua' },
                                 { nome: 'Corso', sigla: 'C', colore: 'rosa' }, { nome: 'Malattia', sigla: 'X', colore: 'grigio' }]);
const GIORNI = [{ id: '2026-11-02', data: '2026-11-02', moglie: 'Mattina', avvenimento: '' },
                { id: '2026-11-03', data: '2026-11-03', moglie: 'Notte', avvenimento: 'cena' },
                { id: '2026-11-05', data: '2026-11-05', moglie: '', avvenimento: 'dentista' }];
const conPersona = (persona, anno = '2026', resto = {}) => Object.assign({}, PROF, { altraPersona: persona, altraPersonaAnno: anno }, resto);

// Una pagina, senza Cloud (la rete e' tutta chiusa) o col Firestore finto.
const pagina = async (opz = {}) => {
  const ctx = await b.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true,
    viewport: { width: opz.w || 390, height: opz.h || 900 }, colorScheme: opz.scuro ? 'dark' : 'light' });
  await ctx.route(/^https?:\/\//, r => r.abort());
  if (opz.cloud) for (const [n, f] of [['firebase-app.js', 'app.js'], ['firebase-auth.js', 'auth.js'], ['firebase-firestore.js', 'firestore.js']])
    await ctx.route('**/firebasejs/11.6.1/' + n, r => r.fulfill({ contentType: 'application/javascript', body: readFileSync(FINTO + f, 'utf8') }));
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(opz.ora || NOVEMBRE));
  p.errori = []; p.on('pageerror', e => p.errori.push(e.message));
  p.dialoghi = []; p.risposta = true;
  p.on('dialog', d => { p.dialoghi.push(d.message()); p.risposta ? d.accept() : d.dismiss(); });
  await p.goto(APP);
  return p;
};
const ini = async (p, chiavi, attesa = 300) => {
  await p.evaluate((o) => {
    localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si');
    Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
  }, chiavi);
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.waitForTimeout(attesa);
};
const pronto = async (p) => {
  await p.goto(APP);
  await p.waitForFunction(() => window.moduloFirebaseVivo === true && window.__authFatto === true, null, { timeout: 15000 });
  await p.waitForTimeout(700);
};
const chiudi = (...pp) => Promise.all(pp.map(p => p.context().close()));
const disco = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
const profiloSulDisco = async (p) => JSON.parse((await disco(p, 'taxi_profilo')) || 'null');
const inPartenza = (p) => p.evaluate(() => Object.keys((JSON.parse(localStorage.taxi_in_sospeso || '{}').per || {}).profilo || {}).sort());
const cfg = (p) => p.evaluate(() => configPersona());

const calendario = async (p, mese = '2026-11') => {
  await p.evaluate((m) => { window.meseCalendario = m; switchTab('giornata'); setVistaGiornata('calendario'); }, mese);
  await p.waitForTimeout(200);
};
const casella = (p, iso) => p.locator(`#main-container button[onclick="toccaGiornoCalendario('${iso}')"]`).first();
const apriGiorno = async (p, iso) => {
  await calendario(p, iso.slice(0, 7));
  if (await p.evaluate(() => window.giornoCalendarioAperto) !== iso) { await casella(p, iso).click(); await p.waitForTimeout(150); }
};
const statoCasella = (p, iso) => p.evaluate((iso) => {
  const e = [...document.querySelectorAll('#main-container .grid-cols-7 button')].find(x => (x.getAttribute('onclick') || '').includes(`'${iso}'`));
  if (!e) return null;
  const s = e.querySelector('.segno-famiglia.a-sinistra'), st = e.querySelector('.segno-famiglia.a-destra');
  return { title: e.getAttribute('title'), sigla: s ? s.textContent : null, etichetta: s ? s.getAttribute('aria-label') : null,
           classi: s ? s.className : null, stella: st ? st.textContent : null };
}, iso);
const quadro = (p) => p.evaluate(() => {
  const mc = document.getElementById('main-container');
  const titoli = [...mc.querySelectorAll('p')].map(x => x.textContent.trim());
  return { segni: mc.querySelectorAll('.segno-famiglia.a-sinistra').length, stelle: mc.querySelectorAll('.segno-famiglia.a-destra').length,
           tasti: [...mc.querySelectorAll('[id^="fam-moglie-"]')].filter(x => x.id !== 'fam-moglie-titolo').map(x => x.id),
           titoloTurni: (document.getElementById('fam-moglie-titolo') || {}).textContent || null,
           campo: !!document.getElementById('fam-avvenimento'),
           sezione: titoli.includes('Famiglia e impegni') ? 'Famiglia e impegni' : titoli.includes('Impegni') ? 'Impegni' : null,
           legenda: [...mc.querySelectorAll('.border-t.border-gray-100')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).find(t => t.includes('avvenimento')) || '' };
});
const gestione = async (p) => { await p.evaluate(() => switchTab('cloud')); await p.waitForTimeout(200); };
const salvaScheda = async (p) => { await p.click('button:has-text("Salva la scheda")'); await p.waitForTimeout(200); };
const toast = (p) => p.evaluate(() => (document.getElementById('toast-text') || {}).textContent || '');
const oggi = async (p) => { await p.evaluate(() => { ricordaVista('giornate'); switchTab('giornata'); }); await p.waitForTimeout(200); };
const domanda = (p) => p.evaluate(() => { const e = [...document.querySelectorAll('#main-container p')].find(x => x.textContent.trim().startsWith('Nuovo anno')); return e ? e.textContent.trim() : null; });

// ------------------------------------------------------------------
await caso('1. LA MIGRAZIONE DI CHI LI USAVA GIA\'', async () => {
  const p = await pagina();
  await ini(p, { taxi_profilo: PROF, taxi_famiglia: GIORNI, taxi_in_sospeso: REGISTRO });
  const c = await cfg(p);
  ok(JSON.stringify(c) === JSON.stringify({ attivo: true, nome: 'Moglie', turni: PREDEFINITI }), 'con giorni segnati e nessuna scelta: accesi, «Moglie», i quattro turni di sempre', c);
  const d = await profiloSulDisco(p);
  ok(d && JSON.stringify(d.altraPersona) === JSON.stringify(c) && d.altraPersonaAnno === '2026', 'scritta sul disco, con l\'anno di adesso (2026)', d);
  ok(['nome', 'cognome', 'licenza'].every(k => d[k] === PROF[k]), 'il resto della scheda non cambia', d);
  ok(!(await inPartenza(p)).some(k => k.startsWith('altraPersona')), 'solo su questo disco: non va fra i campi da spedire al Cloud', await inPartenza(p));
  const prima = await disco(p, 'taxi_profilo');
  ok(await p.evaluate(() => migraAltraPersona() === false), 'una seconda volta non fa niente');
  await p.goto(APP); await p.waitForTimeout(300); await cfg(p);
  ok((await disco(p, 'taxi_profilo')) === prima, 'riaperta l\'app, il profilo e\' identico byte per byte (si fa una volta sola)');
  ok((await disco(p, 'taxi_famiglia')) === JSON.stringify(GIORNI), 'e i giorni non si toccano');
  await oggi(p);
  ok((await domanda(p)) === null, 'nessuna domanda di inizio anno quest\'anno');
  await calendario(p);
  const s = await statoCasella(p, '2026-11-03');
  ok(s && s.sigla === 'N' && s.etichetta === 'Moglie Notte' && s.title === 'Moglie: Notte, avvenimento: cena' && s.classi.includes('bg-indigo-600'),
    'nel calendario i segni di prima: «N» indaco, «Moglie Notte», title col nome', s);
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);

  // Chi non li usava: solo avvenimenti, o niente. Il profilo resta com'era.
  for (const [titolo, giorni] of [['solo avvenimenti', [GIORNI[2]]], ['nessun giorno', []]]) {
    await ini(p, { taxi_profilo: PROF, taxi_famiglia: giorni, taxi_in_sospeso: REGISTRO });
    const c2 = await cfg(p);
    ok(c2.attivo === false && (await disco(p, 'taxi_profilo')) === JSON.stringify(PROF), `${titolo}: spenti, e il profilo sul disco resta byte per byte`, [c2, await disco(p, 'taxi_profilo')]);
  }
  // Una scelta gia' fatta, anche spenta, non si tocca
  const spenta = conPersona({ attivo: false, nome: 'Anna', turni: [{ nome: 'Scuola', sigla: 'S', colore: 'rosa' }] });
  await ini(p, { taxi_profilo: spenta, taxi_famiglia: GIORNI, taxi_in_sospeso: REGISTRO });
  const c3 = await cfg(p);
  ok(c3.attivo === false && c3.nome === 'Anna' && (await disco(p, 'taxi_profilo')) === JSON.stringify(spenta), 'scelta gia\' fatta «spenta», coi giorni: resta spenta, niente migrazione', c3);
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await chiudi(p);

  // I giorni arrivano dal Cloud dopo l'avvio (un Mac appena collegato)
  const M = await pagina({ cloud: true });
  await ini(M, { __uid: 'u1', taxi_profilo: PROF, taxi_in_sospeso: REGISTRO }, 0);
  await pronto(M);
  ok((await cfg(M)).attivo === false, 'Mac collegato senza giorni: spenti');
  await M.evaluate(([U, G]) => { const s = JSON.parse(localStorage.__cloud || '{}'); G.forEach(g => s[U + 'taxi_famiglia/' + g.id] = g); localStorage.__cloud = JSON.stringify(s); window.__tornaRete(); }, [U, GIORNI]);
  await M.waitForTimeout(600);
  await calendario(M);
  const c4 = await cfg(M);
  ok(c4.attivo && c4.nome === 'Moglie' && (await statoCasella(M, '2026-11-02')).sigla === 'M', 'arrivati i giorni dal Cloud, la migrazione parte lo stesso e i segni si vedono', c4);

  // Un terzo dispositivo coi giorni vecchi: vince la scelta del Cloud
  const T = await pagina({ cloud: true });
  const sCloud = await M.evaluate(([U, P]) => { const s = JSON.parse(localStorage.__cloud || '{}');
    s[U + 'profilo/dati'] = Object.assign({}, P, { altraPersona: { attivo: false, nome: 'Maria', turni: [{ nome: 'Scuola', sigla: 'S', colore: 'rosa' }] }, altraPersonaAnno: '2026' });
    return JSON.stringify(s); }, [U, PROF]);
  await ini(T, { __uid: 'u1', __cloud: sCloud, taxi_famiglia: GIORNI, taxi_profilo: PROF, taxi_in_sospeso: REGISTRO }, 0);
  await pronto(T);
  const c5 = await cfg(T);
  const srv = await T.evaluate((k) => JSON.parse(localStorage.__cloud)[k], U + 'profilo/dati');
  ok(!c5.attivo && c5.nome === 'Maria' && srv.altraPersona.nome === 'Maria' && srv.altraPersona.attivo === false,
    'un dispositivo rimasto indietro coi giorni vecchi: vince il Cloud, la migrazione non lo copre', [c5, srv.altraPersona]);
  ok(M.errori.length === 0 && T.errori.length === 0, 'nessun errore JS', [M.errori, T.errori]);
  await chiudi(M, T);
});

// ------------------------------------------------------------------
await caso('2. L\'OPZIONE SPENTA: I GIORNI RESTANO, L\'AVVENIMENTO SEMPRE', async () => {
  const p = await pagina();
  await ini(p, { taxi_profilo: conPersona({ attivo: true, nome: 'Maria', turni: PREDEFINITI }), taxi_famiglia: GIORNI, taxi_in_sospeso: REGISTRO });
  await apriGiorno(p, '2026-11-03');
  const acceso = await quadro(p);
  ok(acceso.segni === 2 && acceso.stelle === 2 && acceso.tasti.join(',') === 'fam-moglie-M,fam-moglie-P,fam-moglie-N,fam-moglie-R' && acceso.titoloTurni === 'Turno di Maria' && acceso.sezione === 'Famiglia e impegni',
    'accesa: due lettere, due stelline, quattro tasti, «Turno di Maria», «Famiglia e impegni»', acceso);
  ok(acceso.legenda.includes('Maria: M mattina') && acceso.legenda.includes('R riposo'), 'la legenda spiega le lettere col nome davanti', acceso.legenda);
  const giorniPrima = await disco(p, 'taxi_famiglia');

  // Spenta dal modulo, dai tasti veri
  await gestione(p);
  await p.uncheck('#prof-persona-attivo'); await p.waitForTimeout(100);
  ok(await p.locator('#prof-persona-nome').count() === 0, 'tolta la spunta, nome e turni si nascondono');
  ok(await p.locator('text=I giorni già segnati non si cancellano').count() === 1, 'e una riga dice che i giorni segnati non si cancellano');
  await salvaScheda(p);
  ok((await cfg(p)).attivo === false, 'salvata: spenta');
  ok((await inPartenza(p)).includes('altraPersona'), 'e la scelta parte per il Cloud', await inPartenza(p));
  ok((await disco(p, 'taxi_famiglia')) === giorniPrima, 'i giorni sul disco restano identici, byte per byte');
  await apriGiorno(p, '2026-11-03');
  const spento = await quadro(p);
  ok(spento.segni === 0 && spento.tasti.length === 0 && spento.titoloTurni === null, 'spenta: nella griglia niente lettere, nella giornata niente tasti dei turni', spento);
  ok(spento.stelle === 2 && spento.campo && spento.sezione === 'Impegni', 'le stelline e il campo dell\'avvenimento restano, la sezione si chiama «Impegni»', spento);
  ok(!/Maria|mattina|riposo/.test(spento.legenda) && spento.legenda.includes('avvenimento'), 'la legenda non spiega piu\' le lettere, ma la stellina si', spento.legenda);
  const s2 = await statoCasella(p, '2026-11-02');
  ok(s2 && s2.title === null && s2.sigla === null, 'un giorno con solo il turno: la casella e\' pulita, senza title', s2);
  ok((await statoCasella(p, '2026-11-03')).title === 'avvenimento: cena', 'un giorno con turno e avvenimento: il title dice solo l\'avvenimento', await statoCasella(p, '2026-11-03'));

  // L'avvenimento si segna anche cosi', dai tasti
  await casella(p, '2026-11-12').click(); await p.waitForTimeout(150);
  await p.fill('#fam-avvenimento', 'colloquio a scuola');
  await p.locator('#main-container button', { hasText: /^Salva$/ }).first().click(); await p.waitForTimeout(150);
  ok((await p.evaluate(() => giornoFamiglia('2026-11-12'))).avvenimento === 'colloquio a scuola' && (await statoCasella(p, '2026-11-12')).stella === '★',
    'con l\'opzione spenta l\'avvenimento si salva dal tasto e la stellina compare');
  ok(JSON.parse(await disco(p, 'taxi_famiglia')).filter(x => x.moglie).map(x => x.id + ':' + x.moglie).join(',') === '2026-11-02:Mattina,2026-11-03:Notte',
    'e i turni segnati prima sono ancora tutti sul disco');

  // Riaccesa: tornano
  await gestione(p);
  await p.check('#prof-persona-attivo'); await p.waitForTimeout(100);
  ok((await p.inputValue('#prof-persona-nome')) === 'Maria', 'riaccesa nel modulo: il nome di prima c\'e\' ancora');
  await salvaScheda(p);
  await apriGiorno(p, '2026-11-03');
  const riacceso = await quadro(p);
  ok(riacceso.segni === 2 && riacceso.tasti.length === 4 && (await statoCasella(p, '2026-11-02')).sigla === 'M', 'riaccesa: i segni di prima tornano, coi tasti', riacceso);
  ok((await p.getAttribute('#fam-moglie-N', 'aria-pressed')) === 'true', 'e il giorno aperto ha di nuovo «Notte» premuto');
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await chiudi(p);
});

// ------------------------------------------------------------------
// Otto turni (il massimo), un nome di 30 caratteri, un giorno con un turno
// che nella scheda non c'e' piu'.
const NOME30 = 'Maria Antonietta Rossi Bianchi';
const GIORNI8 = OTTO.map((t, i) => ({ id: '2026-11-' + String(10 + i), data: '2026-11-' + String(10 + i), moglie: t.nome, avvenimento: i % 2 ? 'visita' : '' }))
  .concat([{ id: '2026-11-20', data: '2026-11-20', moglie: 'Vecchio turno', avvenimento: '' }]);
const contrasto = () => {
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  return (e) => { const st = getComputedStyle(e); const a = L(rgb(st.color)), q = L(rgb(st.backgroundColor)); return +((Math.max(a, q) + .05) / (Math.min(a, q) + .05)).toFixed(2); };
};
for (const scuro of [false, true]) for (const w of [320, 390, 1280]) {
  await caso(`3. INTERFACCIA CON OTTO TURNI, ${w} px ${scuro ? 'al buio' : 'di giorno'}`, async () => {
    const p = await pagina({ w, scuro });
    await ini(p, { taxi_profilo: conPersona({ attivo: true, nome: NOME30, turni: OTTO }), taxi_famiglia: GIORNI8, taxi_in_sospeso: REGISTRO });
    await apriGiorno(p, '2026-11-20');
    await p.screenshot({ path: join(FOTO, `calendario-${w}-${scuro ? 'scuro' : 'chiaro'}.png`), fullPage: true });
    const q = await quadro(p);
    ok(q.segni === 9 && q.tasti.length === 8, 'nove lettere nella griglia, otto tasti nella giornata', q);
    ok(q.legenda.includes(NOME30 + ':') && OTTO.every(t => q.legenda.includes(t.sigla + ' ' + t.nome.toLocaleLowerCase('it-IT'))), 'la legenda ha il nome intero e tutti gli otto turni', q.legenda);
    const m = await p.evaluate((f) => {
      const cr = eval(f)();
      const W = document.documentElement.clientWidth;
      const mc = document.getElementById('main-container');
      return {
        sbordo: document.documentElement.scrollWidth - innerWidth,
        fuori: [...mc.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map(e => e.tagName + '.' + String(e.className).slice(0, 40)).slice(0, 5),
        bassi: [...mc.querySelectorAll('[id^="fam-moglie-"]:not(#fam-moglie-titolo)')].concat([...mc.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Togli il turno'))
          .filter(e => e.getBoundingClientRect().height < 44).map(e => e.id || e.textContent.trim()),
        tagliati: [...mc.querySelectorAll('.nome-turno-persona')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map(e => e.textContent.slice(0, 30)),
        contrasti: [...mc.querySelectorAll('.pastiglia-famiglia')].map(e => e.textContent.trim() + ' ' + cr(e)).filter(x => parseFloat(x.split(' ').pop()) < 4.5)
      };
    }, contrasto.toString());
    ok(m.sbordo <= 0 && m.fuori.length === 0, 'calendario: niente esce dallo schermo', m);
    ok(m.bassi.length === 0, 'i tasti dei turni e «Togli il turno» alti almeno 44 px', m.bassi);
    ok(m.tagliati.length === 0, 'nomi dei turni e della persona non tagliati', m.tagliati);
    ok(m.contrasti.length === 0, 'ogni sigla si legge sul suo colore (contrasto 4,5 o piu\', anche il grigio del turno tolto)', m.contrasti);

    await gestione(p);
    await p.setViewportSize({ width: w, height: 2600 });
    await p.evaluate(() => document.getElementById('prof-persona').scrollIntoView({ block: 'start' }));
    await p.screenshot({ path: join(FOTO, `modulo-${w}-${scuro ? 'scuro' : 'chiaro'}.png`) });
    const mm = await p.evaluate(() => {
      const s = document.getElementById('prof-persona');
      const W = document.documentElement.clientWidth;
      return {
        righe: document.querySelectorAll('[id^="prof-persona-turno-"]').length,
        piu: [...s.querySelectorAll('button')].some(x => x.textContent.trim() === '+ Turno'),
        massimo: s.textContent.includes('Al massimo 8 turni.'),
        sbordo: document.documentElement.scrollWidth - innerWidth,
        fuori: [...s.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map(e => e.tagName + '#' + e.id).slice(0, 5),
        piccoli: [...s.querySelectorAll('input:not([type=checkbox]), select')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id + ' ' + getComputedStyle(e).fontSize),
        bassi: [...s.querySelectorAll('button, input:not([type=checkbox]), select, label[for="prof-persona-attivo"]')].filter(e => e.getBoundingClientRect().height < 44).map(e => (e.id || e.textContent.trim().slice(0, 20)) + ' ' + Math.round(e.getBoundingClientRect().height)),
        stretti: [...s.querySelectorAll('button[aria-label^="Togli il turno"]')].filter(e => e.getBoundingClientRect().width < 44).length
      };
    });
    ok(mm.righe === 8 && !mm.piu && mm.massimo, 'modulo: otto righe, niente «+ Turno», «Al massimo 8 turni.»', mm);
    ok(mm.sbordo <= 0 && mm.fuori.length === 0, 'modulo: niente esce dallo schermo', mm.fuori);
    ok(mm.piccoli.length === 0, 'campi del modulo a 16 px o piu\' (Safari non ingrandisce)', mm.piccoli);
    ok(mm.bassi.length === 0 && mm.stretti === 0, 'tasti, campi e interruttore alti almeno 44 px, «×» largo 44', mm);
    ok(p.errori.length === 0, 'nessun errore JS', p.errori);
    await chiudi(p);
  });
}

// ------------------------------------------------------------------
await caso('4. IL MODULO DAI TASTI VERI', async () => {
  const p = await pagina();
  // L'anno e' quello scorso: salvare la sezione vale come risposta per quest'anno
  await ini(p, { taxi_profilo: Object.assign({}, PROF, { altraPersonaAnno: '2025' }), taxi_in_sospeso: REGISTRO });
  // Salvare la scheda senza toccare la sezione non scrive la configurazione
  await gestione(p);
  ok(await p.locator('text=Turni di un\'altra persona (facoltativo)').count() === 1, 'in Gestione c\'e\' la sezione «Turni di un\'altra persona (facoltativo)»');
  ok(!(await p.isChecked('#prof-persona-attivo')) && await p.locator('#prof-persona-nome').count() === 0, 'per chi non l\'ha mai scelta: spenta, senza campi');
  await p.fill('#prof-cognome', 'Verdi'); await salvaScheda(p);
  const d0 = await profiloSulDisco(p);
  ok(d0.cognome === 'Verdi' && !('altraPersona' in d0) && !(await inPartenza(p)).includes('altraPersona'),
    'cambiato il cognome e salvato: la configurazione non si scrive e non parte (un dispositivo indietro non copre il Cloud)', [d0, await inPartenza(p)]);
  ok(d0.altraPersonaAnno === '2025', 'e nemmeno l\'anno della risposta cambia', d0.altraPersonaAnno);

  await p.check('#prof-persona-attivo'); await p.waitForTimeout(100);
  ok((await p.evaluate(() => document.activeElement.id)) === 'prof-persona-attivo', 'acceso l\'interruttore: il fuoco resta li\'');
  ok((await p.evaluate(() => [0, 1, 2, 3].map(i => document.getElementById('prof-persona-turno-' + i).value).join(','))) === 'Mattina,Pomeriggio,Notte,Riposo', 'si parte dai quattro turni predefiniti');
  await p.fill('#prof-persona-nome', 'Luca');
  await p.fill('#prof-persona-turno-0', 'Scuola');
  // Il campo prende due lettere (la tastiera dell'iPhone con le
  // maiuscole automatiche ne mette volentieri una in piu'): si tiene la prima.
  await p.fill('#prof-persona-sigla-0', 'kz');
  ok((await p.getAttribute('#prof-persona-sigla-0', 'maxlength')) === '2' && (await p.inputValue('#prof-persona-sigla-0')) === 'kz', 'la sigla accetta due lettere nel campo');
  await p.selectOption('#prof-persona-colore-0', 'rosa');
  const ant = await p.evaluate(() => { const e = document.getElementById('prof-persona-anteprima-0'); return { t: e.textContent, c: e.className }; });
  ok(ant.t === 'K' && ant.c.includes('bg-rose-500'), 'l\'anteprima segue sigla (maiuscola) e colore mentre si scrive', ant);
  // + Turno fino a otto
  for (let i = 4; i < 8; i++) {
    await p.click('button:has-text("+ Turno")'); await p.waitForTimeout(80);
    ok((await p.evaluate(() => document.activeElement.id)) === 'prof-persona-turno-' + i, `+ Turno: nasce la riga ${i + 1} col fuoco sul nome`);
    await p.fill('#prof-persona-turno-' + i, 'Extra ' + i);
  }
  ok(await p.locator('button:has-text("+ Turno")').count() === 0 && await p.locator('text=Al massimo 8 turni.').count() === 1, 'arrivati a otto, «+ Turno» sparisce');
  ok((await p.inputValue('#prof-persona-nome')) === 'Luca' && (await p.inputValue('#prof-persona-turno-0')) === 'Scuola' && (await p.inputValue('#prof-persona-sigla-0')) === 'kz',
    'e quello che si era scritto prima resta dopo i ridisegni');
  const colori = await p.evaluate(() => [4, 5, 6, 7].map(i => document.getElementById('prof-persona-colore-' + i).value));
  ok(new Set(colori).size === 4, 'i turni nuovi nascono con colori diversi', colori);
  await p.click('[aria-label="Togli il turno «Riposo»"]'); await p.waitForTimeout(80);
  await p.click('[aria-label="Togli il turno «Extra 7»"]'); await p.waitForTimeout(80);
  ok((await p.evaluate(() => [...document.querySelectorAll('[id^="prof-persona-turno-"]')].map(x => x.value).join(','))) === 'Scuola,Pomeriggio,Notte,Extra 4,Extra 5,Extra 6',
    '«×» toglie la riga giusta', await p.evaluate(() => [...document.querySelectorAll('[id^="prof-persona-turno-"]')].map(x => x.value)));
  // Due nomi uguali: non si salva
  await p.fill('#prof-persona-turno-4', 'Notte');
  const primaDoppi = await disco(p, 'taxi_profilo');
  await salvaScheda(p);
  ok((await toast(p)).startsWith('Due turni hanno lo stesso nome') && (await disco(p, 'taxi_profilo')) === primaDoppi, 'due turni «Notte»: non si salva, e lo dice', await toast(p));
  ok((await p.inputValue('#prof-persona-turno-4')) === 'Notte' && (await p.inputValue('#prof-persona-nome')) === 'Luca', 'e il modulo resta com\'era scritto, da correggere');
  // Uguali a parte le maiuscole: nella legenda escono identici, bloccano anche loro
  await p.fill('#prof-persona-turno-4', 'nOTTE');
  await p.evaluate(() => { document.getElementById('toast-text').textContent = ''; });
  await salvaScheda(p);
  ok((await toast(p)).startsWith('Due turni hanno lo stesso nome') && (await disco(p, 'taxi_profilo')) === primaDoppi, '«Notte» e «nOTTE»: doppioni anche loro, non si salva', await toast(p));
  // Una riga lasciata senza nome non sparisce in silenzio
  await p.fill('#prof-persona-turno-4', '   ');
  await p.evaluate(() => { document.getElementById('toast-text').textContent = ''; });
  await salvaScheda(p);
  ok((await toast(p)) === 'Un turno non ha il nome: scrivilo, oppure toglilo con ×.' && (await disco(p, 'taxi_profilo')) === primaDoppi, 'un turno col nome vuoto (o di soli spazi): non si salva, e lo dice', await toast(p));
  ok((await p.evaluate(() => document.querySelectorAll('[id^="prof-persona-turno-"]').length)) === 6, 'e la riga vuota resta li\', da scrivere o togliere');
  await p.fill('#prof-persona-turno-4', 'Piscina'); await p.fill('#prof-persona-sigla-4', '');
  await salvaScheda(p);
  const c = await cfg(p);
  ok(JSON.stringify(c) === JSON.stringify({ attivo: true, nome: 'Luca', turni: [
      { nome: 'Scuola', sigla: 'K', colore: 'rosa' }, { nome: 'Pomeriggio', sigla: 'P', colore: 'arancio' }, { nome: 'Notte', sigla: 'N', colore: 'indaco' },
      { nome: 'Extra 4', sigla: 'E', colore: colori[0] }, { nome: 'Piscina', sigla: 'P', colore: colori[1] }, { nome: 'Extra 6', sigla: 'E', colore: colori[2] }] }),
    'salvata come scritta; la sigla vuota diventa l\'iniziale', c);
  const partono = await inPartenza(p);
  ok(['altraPersona', 'altraPersonaAnno'].every(k => partono.includes(k)) && (await profiloSulDisco(p)).altraPersonaAnno === '2026', 'configurazione e anno (2026: vale come risposta) partono per il Cloud', partono);
  // Due turni con la stessa sigla: i tasti hanno id diversi
  await apriGiorno(p, '2026-11-26');
  const ids = (await quadro(p)).tasti;
  ok(ids.join(',') === 'fam-moglie-K,fam-moglie-n1,fam-moglie-N,fam-moglie-n3,fam-moglie-n4,fam-moglie-n5' && new Set(ids).size === 6, 'sigle doppie: tasti per posizione, nessun id doppio', ids);
  await p.click('#fam-moglie-n4'); await p.waitForTimeout(120);
  ok((await p.evaluate(() => giornoFamiglia('2026-11-26').moglie)) === 'Piscina' && (await p.getAttribute('#fam-moglie-n4', 'aria-pressed')) === 'true', 'toccato «Piscina»: salvato e premuto quello');
  // Rimetti i turni predefiniti: chiede prima, perche' i giorni dei turni
  // che spariscono diventano grigi. Detto no, niente cambia.
  await gestione(p);
  const elencoModulo = () => p.evaluate(() => [...document.querySelectorAll('[id^="prof-persona-turno-"]')].map(x => x.value).join(','));
  const primaRimetti = await elencoModulo();
  p.dialoghi.length = 0; p.risposta = false;
  await p.click('#prof-persona-predefiniti'); await p.waitForTimeout(100);
  ok(p.dialoghi.length === 1 && p.dialoghi[0].startsWith('Rimettere i turni predefiniti?'), '«Rimetti i turni predefiniti» chiede conferma', p.dialoghi);
  ok((await elencoModulo()) === primaRimetti, 'detto no: i turni nel modulo restano quelli', await elencoModulo());
  p.risposta = true;
  await p.click('#prof-persona-predefiniti'); await p.waitForTimeout(100);
  ok((await elencoModulo()) === 'Mattina,Pomeriggio,Notte,Riposo', 'detto si\': tornano i quattro', await elencoModulo());
  p.dialoghi.length = 0;
  await p.click('#prof-persona-predefiniti'); await p.waitForTimeout(100);
  ok(p.dialoghi.length === 0 && (await elencoModulo()) === 'Mattina,Pomeriggio,Notte,Riposo', 'gia\' predefiniti: non chiede niente', p.dialoghi);
  ok((await cfg(p)).turni.length === 6, 'ma finche\' non si salva la scheda vale quella di prima');
  await salvaScheda(p);
  ok(JSON.stringify((await cfg(p)).turni) === JSON.stringify(PREDEFINITI), 'salvata: i quattro predefiniti');
  ok((await p.evaluate(() => giornoFamiglia('2026-11-26').moglie)) === 'Piscina', 'e il giorno segnato «Piscina» c\'e\' ancora');
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await chiudi(p);
});

// ------------------------------------------------------------------
await caso('5. UN TURNO RINOMINATO O TOLTO: IL GIORNO RESTA, SU GRIGIO', async () => {
  const p = await pagina();
  await ini(p, { taxi_profilo: conPersona({ attivo: true, nome: 'Maria', turni: PREDEFINITI }), taxi_famiglia: GIORNI, taxi_in_sospeso: REGISTRO });
  await gestione(p);
  await p.fill('#prof-persona-turno-2', 'Notturno');
  await salvaScheda(p);
  ok((await p.evaluate(() => giornoFamiglia('2026-11-03').moglie)) === 'Notte', 'rinominato «Notte» in «Notturno»: il giorno sul disco dice ancora «Notte»');
  await apriGiorno(p, '2026-11-03');
  const s = await statoCasella(p, '2026-11-03');
  ok(s && s.sigla === 'N' && s.classi.includes('bg-gray-400') && !s.classi.includes('bg-indigo-600'), 'nella griglia l\'iniziale «N» su grigio', s);
  ok(s.etichetta === 'Maria Notte' && s.title === 'Maria: Notte, avvenimento: cena', 'il nome intero per VoiceOver e nel title', s);
  ok(await p.locator('text=Segnato «Notte», un turno che nella scheda non c\'è più.').count() === 1, 'nella giornata la riga «Segnato «Notte», un turno che nella scheda non c\'è più.»');
  ok((await p.evaluate(() => [...document.querySelectorAll('[id^="fam-moglie-"][aria-pressed="true"]')].length)) === 0, 'e nessun tasto risulta premuto');
  await p.screenshot({ path: join(FOTO, 'rinominato-390.png'), fullPage: true });
  // Rimesso il nome di prima, il colore torna
  await gestione(p);
  await p.fill('#prof-persona-turno-2', 'Notte'); await salvaScheda(p);
  await apriGiorno(p, '2026-11-03');
  ok((await statoCasella(p, '2026-11-03')).classi.includes('bg-indigo-600') && await p.locator('text=Togli il turno').count() === 0, 'rimesso «Notte»: torna indaco, la riga sparisce');
  // Tolto il turno con «×»
  await gestione(p);
  await p.click('[aria-label="Togli il turno «Mattina»"]'); await salvaScheda(p);
  await apriGiorno(p, '2026-11-02');
  const s2 = await statoCasella(p, '2026-11-02');
  ok(s2.sigla === 'M' && s2.classi.includes('bg-gray-400') && s2.title === 'Maria: Mattina', 'tolto «Mattina» dalla scheda: il 2 resta, «M» su grigio', s2);
  await p.click('button:has-text("Togli il turno")'); await p.waitForTimeout(150);
  ok(!JSON.parse(await disco(p, 'taxi_famiglia')).some(x => x.id === '2026-11-02') && (await statoCasella(p, '2026-11-02')).sigla === null,
    '«Togli il turno»: il giorno se ne va dal disco e la casella torna pulita');
  ok(JSON.parse(await disco(p, 'taxi_famiglia')).map(x => x.id).join(',') === '2026-11-03,2026-11-05', 'gli altri giorni restano');
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await chiudi(p);
});

// ------------------------------------------------------------------
// Nomi scelti dall'utente, quindi testo qualsiasi: niente deve diventare HTML
// ne' uscire dagli apici dei gestori onclick.
const NOME_X = '<img src=x onerror=__p=1>"\'&';
const TURNI_X = [{ nome: '<svg onload=__t=1>', sigla: '<', colore: 'celeste' },
                 { nome: '"><b>x</b>', sigla: '"', colore: 'arancio' },
                 { nome: "a');__t=2;//", sigla: "'", colore: 'indaco' },
                 { nome: '${__t=3}&amp;', sigla: '&', colore: 'verde' }];
await caso('6. NOMI CON DENTRO DEL CODICE: RESTANO TESTO', async () => {
  const p = await pagina({ ora: GENNAIO });
  await ini(p, { taxi_profilo: conPersona({ attivo: true, nome: NOME_X, turni: TURNI_X }, '2026'), taxi_in_sospeso: REGISTRO });
  await oggi(p);
  ok((await domanda(p)) === `Nuovo anno: segni ancora i turni di ${NOME_X}?`, 'la domanda di gennaio dice il nome tale e quale', await domanda(p));
  await calendario(p, '2027-01');
  await casella(p, '2027-01-04').click(); await p.waitForTimeout(150);
  const q = await quadro(p);
  ok(q.titoloTurni === 'Turno di ' + NOME_X, '«Turno di ...» col nome come testo', q.titoloTurni);
  ok(q.tasti.join(',') === 'fam-moglie-n0,fam-moglie-n1,fam-moglie-n2,fam-moglie-n3', 'sigle non alfanumeriche: id per posizione', q.tasti);
  const etichette = await p.evaluate(() => [0, 1, 2, 3].map(i => document.getElementById('fam-moglie-n' + i).textContent.replace(/\s+/g, ' ').trim()));
  ok(JSON.stringify(etichette) === JSON.stringify(TURNI_X.map(t => t.sigla + ' ' + t.nome)), 'i tasti dicono sigla e nome tali e quali', etichette);
  for (let i = 0; i < 4; i++) {
    const g = '2027-01-0' + (4 + i);
    await apriGiorno(p, g);
    await p.click('#fam-moglie-n' + i); await p.waitForTimeout(120);
    ok((await p.evaluate((g) => giornoFamiglia(g).moglie, g)) === TURNI_X[i].nome, `il tasto «${TURNI_X[i].nome}» salva il nome esatto`);
    const s = await statoCasella(p, g);
    ok(s && s.sigla === TURNI_X[i].sigla && s.etichetta === NOME_X + ' ' + TURNI_X[i].nome && s.title === NOME_X + ': ' + TURNI_X[i].nome,
      '  e nella griglia sigla, aria-label e title sono testo', s);
  }
  ok(q.legenda.includes(NOME_X + ': ' + TURNI_X[0].sigla + ' ' + TURNI_X[0].nome), 'la legenda ha nome e turni come testo', q.legenda);
  await gestione(p);
  const valori = await p.evaluate(() => ({ nome: document.getElementById('prof-persona-nome').value,
    turni: [0, 1, 2, 3].map(i => [document.getElementById('prof-persona-turno-' + i).value, document.getElementById('prof-persona-sigla-' + i).value]) }));
  ok(valori.nome === NOME_X && JSON.stringify(valori.turni) === JSON.stringify(TURNI_X.map(t => [t.nome, t.sigla])), 'nel modulo i campi hanno i valori esatti', valori);
  ok(await p.locator('[aria-label="Togli il turno «<svg onload=__t=1>»"]').count() === 1, 'e il «×» ha l\'etichetta col nome come testo');
  // Salvato di nuovo dal modulo, resta identico
  await p.fill('#prof-persona-nome', NOME_X.slice(0, 30)); await salvaScheda(p);
  ok(JSON.stringify((await cfg(p)).turni) === JSON.stringify(TURNI_X.map(t => ({ nome: t.nome, sigla: t.sigla, colore: t.colore }))), 'risalvata la scheda: turni identici');
  const bucato = await p.evaluate(() => ({ p: window.__p, t: window.__t, img: document.querySelectorAll('img[src="x"]').length, svg: [...document.querySelectorAll('svg[onload]')].length, b: [...document.querySelectorAll('#main-container b')].filter(x => x.textContent === 'x').length }));
  ok(bucato.p === undefined && bucato.t === undefined && !bucato.img && !bucato.svg && !bucato.b, 'niente eseguito, nessun elemento nato dai nomi', bucato);
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await chiudi(p);
});

// ------------------------------------------------------------------
const CAMPO = 'input[onchange="importBackup(event)"]';
await caso('7. CONFIGURAZIONE STORTA DAL BACKUP E DAL CLOUD', async () => {
  const p = await pagina();
  const giusta = conPersona({ attivo: true, nome: 'Maria', turni: [{ nome: 'Scuola', sigla: 'S', colore: 'rosa' }] });
  await ini(p, { taxi_profilo: giusta, taxi_in_sospeso: REGISTRO });
  await gestione(p);
  const carica = async (oggetto) => {
    await p.setInputFiles(CAMPO, { name: 'TaxiManager_Backup_2026-11-20.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oggetto)) });
    await p.waitForTimeout(700);
  };
  const base = { versione: 3, date: '2026-11-20T10:00:00.000Z', records: [], shifts: [] };
  // Un backup vecchio senza i campi: la scelta di adesso resta
  await carica(Object.assign({}, base, { profilo: PROF }));
  ok(JSON.stringify((await profiloSulDisco(p)).altraPersona) === JSON.stringify(giusta.altraPersona) && (await profiloSulDisco(p)).altraPersonaAnno === '2026',
    'un backup vecchio senza i campi nuovi: la configurazione di adesso resta identica', await profiloSulDisco(p));
  // Storto in ogni modo
  const molti = Array.from({ length: 12 }, (_, i) => ({ nome: 'T' + i, sigla: 'ab', colore: 'celeste' }));
  await carica(Object.assign({}, base, { profilo: Object.assign({}, PROF, { altraPersonaAnno: '20x6', altraPersona: {
    attivo: 'true', nome: 'x'.repeat(50), turni: [{ nome: '  A  ', sigla: '', colore: 'viola' }, { nome: 'A', sigla: 'Q' }, 5, null, [], { nome: '' }, { nome: 'y'.repeat(21) }, { nome: 7 }].concat(molti) } }) }));
  const c = await cfg(p);
  ok(c.attivo === false, '«attivo» scritto come testo: non vale come acceso', c.attivo);
  ok(c.nome === 'x'.repeat(30), 'il nome si taglia a 30', c.nome.length);
  ok(c.turni.length === 8 && JSON.stringify(c.turni[0]) === JSON.stringify({ nome: 'A', sigla: 'A', colore: 'celeste' }),
    'turni: spazi tolti, colore sconosciuto sostituito, doppioni, vuoti, non oggetti e oltre 20 caratteri scartati, al massimo 8', c.turni);
  ok(c.turni.slice(1).every((t, i) => t.nome === 'T' + i && t.sigla === 'A'), 'la sigla di due lettere diventa una sola, maiuscola', c.turni);
  ok((await profiloSulDisco(p)).altraPersonaAnno === '2026', 'l\'anno «20x6» non entra', (await profiloSulDisco(p)).altraPersonaAnno);
  // Non un oggetto: non entra, resta quello di adesso
  const prima = JSON.stringify((await profiloSulDisco(p)).altraPersona);
  for (const v of ['acceso', 5, [{ nome: 'A' }], null]) {
    await carica(Object.assign({}, base, { profilo: Object.assign({}, PROF, { altraPersona: v }) }));
    ok(JSON.stringify((await profiloSulDisco(p)).altraPersona) === prima, `altraPersona = ${JSON.stringify(v)} nel backup: si tiene quella di adesso`);
  }
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await chiudi(p);

  // Dal Cloud finto: la scheda scritta storta (a mano, o da una versione futura)
  const A = await pagina({ cloud: true });
  await ini(A, { __uid: 'u1', taxi_profilo: PROF, taxi_famiglia: GIORNI, taxi_in_sospeso: REGISTRO }, 0);
  await pronto(A);
  for (const [storta, attesa, titolo] of [
    [{ attivo: true, nome: 7, turni: 'x' }, { attivo: true, nome: '', turni: PREDEFINITI }, 'nome numero e turni testo'],
    [{ attivo: true, nome: '<b>Ann</b>', turni: [{ nome: 'Notte', sigla: '<', colore: 'nero' }, { nome: 'Notte', sigla: 'Z' }] }, { attivo: true, nome: '<b>Ann</b>', turni: [{ nome: 'Notte', sigla: '<', colore: 'celeste' }] }, 'doppioni e colore sconosciuto']]) {
    await A.evaluate(([k, v]) => { const s = JSON.parse(localStorage.__cloud); s[k] = Object.assign({}, s[k], { altraPersona: v }); localStorage.__cloud = JSON.stringify(s); window.__tornaRete(); }, [U + 'profilo/dati', storta]);
    await A.waitForTimeout(600);
    const ca = await cfg(A);
    ok(JSON.stringify(ca) === JSON.stringify(attesa), `dal Cloud, ${titolo}: si legge ripulita`, ca);
    await apriGiorno(A, '2026-11-03');
    const q = await quadro(A);
    ok(q.titoloTurni === 'Turno ' + (attesa.nome ? 'di ' + attesa.nome : 'dell\'altra persona') && q.tasti.length === attesa.turni.length, '  e il calendario si disegna con quella', q);
    ok(!/undefined|NaN|\[object/.test(await A.evaluate(() => document.getElementById('main-container').innerText)) && !(await A.evaluate(() => document.querySelectorAll('#main-container b').length)),
      '  senza «undefined», «[object» ne\' HTML nato dal nome');
  }
  ok(A.errori.length === 0, 'nessun errore JS', A.errori);
  await chiudi(A);
});

// ------------------------------------------------------------------
await caso('8. LA DOMANDA DI INIZIO ANNO (3 gennaio 2027)', async () => {
  const p = await pagina({ ora: GENNAIO });
  const accesa = conPersona({ attivo: true, nome: 'Maria', turni: PREDEFINITI }, '2026');
  // Accesa: «Sì»
  await ini(p, { taxi_profilo: accesa, taxi_famiglia: GIORNI, taxi_in_sospeso: REGISTRO });
  await oggi(p);
  ok((await domanda(p)) === 'Nuovo anno: segni ancora i turni di Maria?', 'su Oggi: «Nuovo anno: segni ancora i turni di Maria?»', await domanda(p));
  await p.screenshot({ path: join(FOTO, 'domanda-accesa-390.png') });
  const tasti = await p.evaluate(() => [...document.querySelectorAll('button[onclick^="rispostaAnnoPersona"]')].map(x => x.textContent.trim() + ' ' + Math.round(x.getBoundingClientRect().height)));
  ok(tasti.length === 2 && tasti[0].startsWith('Sì ') && tasti[1].startsWith('No, toglili '), 'due risposte: «Sì» e «No, toglili»', tasti);
  await calendario(p, '2027-01');
  ok((await domanda(p)) === 'Nuovo anno: segni ancora i turni di Maria?', 'la stessa domanda sul Calendario');
  await p.click('button[onclick="rispostaAnnoPersona(true)"]'); await p.waitForTimeout(150);
  let d = await profiloSulDisco(p);
  ok(d.altraPersona.attivo === true && d.altraPersonaAnno === '2027' && (await domanda(p)) === null, '«Sì»: resta accesa, anno 2027, la domanda se ne va', d);
  ok((await inPartenza(p)).includes('altraPersonaAnno'), 'e la risposta parte per il Cloud', await inPartenza(p));
  await p.goto(APP); await p.waitForTimeout(300); await oggi(p);
  ok((await domanda(p)) === null, 'riaperta l\'app: non chiede piu\'');

  // Accesa: «No, toglili»
  await ini(p, { taxi_profilo: accesa, taxi_famiglia: GIORNI, taxi_in_sospeso: REGISTRO });
  await oggi(p);
  await p.click('text=No, toglili'); await p.waitForTimeout(150);
  d = await profiloSulDisco(p);
  ok(d.altraPersona.attivo === false && d.altraPersona.nome === 'Maria' && d.altraPersonaAnno === '2027', '«No, toglili»: spenta, il nome resta, anno 2027', d);
  ok((await disco(p, 'taxi_famiglia')) === JSON.stringify(GIORNI), 'e i giorni restano sul disco byte per byte');
  const partite = await inPartenza(p);
  ok((await domanda(p)) === null && ['altraPersona', 'altraPersonaAnno'].every(k => partite.includes(k)), 'la domanda se ne va e la scelta parte per il Cloud', partite);

  // Spenta: «No» e «Sì, attivala»
  const spenta = Object.assign({}, PROF, { altraPersonaAnno: '2026' });
  await ini(p, { taxi_profilo: spenta, taxi_in_sospeso: REGISTRO });
  await calendario(p, '2027-01');
  ok((await domanda(p)) === 'Nuovo anno: vuoi segnare nel calendario i turni di un\'altra persona?', 'spenta: «vuoi segnare nel calendario i turni di un\'altra persona?»', await domanda(p));
  await p.screenshot({ path: join(FOTO, 'domanda-spenta-390.png') });
  await p.click('button[onclick="rispostaAnnoPersona(false)"]'); await p.waitForTimeout(150);
  d = await profiloSulDisco(p);
  ok(d.altraPersonaAnno === '2027' && !('altraPersona' in d) && (await cfg(p)).attivo === false && (await domanda(p)) === null, '«No»: resta spenta, anno 2027, niente domanda', d);
  await ini(p, { taxi_profilo: spenta, taxi_in_sospeso: REGISTRO });
  await oggi(p);
  await p.click('text=Sì, attivala'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ tab: window.activeTab, fuoco: document.activeElement.id, anno: window.profilo.altraPersonaAnno }));
  ok(r.tab === 'cloud' && r.fuoco === 'prof-persona-nome' && (await cfg(p)).attivo && r.anno === '2027', '«Sì, attivala»: accesa, in Gestione col fuoco sul nome', r);

  // L'anno uguale a quello di adesso, o la scheda non compilata: niente
  await ini(p, { taxi_profilo: conPersona({ attivo: true, nome: 'Maria', turni: PREDEFINITI }, '2027'), taxi_in_sospeso: REGISTRO });
  await oggi(p);
  ok((await domanda(p)) === null, 'anno gia\' 2027: nessuna domanda');
  // Profilo vecchio senza anno: si scrive l'anno, solo qui, e non si chiede
  await ini(p, { taxi_profilo: PROF, taxi_in_sospeso: REGISTRO });
  await oggi(p);
  ok((await domanda(p)) === null && (await profiloSulDisco(p)).altraPersonaAnno === '2027', 'profilo vecchio senza anno: niente domanda, anno 2027 sul disco');
  ok(!(await inPartenza(p)).includes('altraPersonaAnno'), 'e quell\'anno non parte per il Cloud (lo scrive ogni dispositivo da se\')', await inPartenza(p));
  // Utente nuovo: compila la scheda dal benvenuto, nessuna domanda
  await ini(p, { taxi_in_sospeso: REGISTRO });
  await oggi(p);
  ok((await domanda(p)) === null, 'utente nuovo, scheda vuota: nessuna domanda');
  ok(await p.locator('#prof-persona-attivo').count() === 1 && !(await p.isChecked('#prof-persona-attivo')), 'nel benvenuto c\'e\' la sezione, spenta');
  await p.fill('#prof-nome', 'Anna'); await p.click('text=Salva e prosegui'); await p.waitForTimeout(200);
  d = await profiloSulDisco(p);
  ok(d.nome === 'Anna' && d.altraPersonaAnno === '2027' && !('altraPersona' in d) && (await domanda(p)) === null, 'salvata la scheda: anno 2027, opzione mai scelta, nessuna domanda', d);
  ok(p.errori.length === 0, 'nessun errore JS', p.errori);
  await chiudi(p);

  // La risposta data sul telefono vale anche sul Mac (Firestore finto)
  const A = await pagina({ cloud: true, ora: GENNAIO }), M = await pagina({ cloud: true, ora: GENNAIO });
  await ini(A, { __uid: 'u1', taxi_profilo: accesa, taxi_famiglia: GIORNI, taxi_in_sospeso: REGISTRO }, 0);
  await pronto(A);
  const s0 = await A.evaluate(() => localStorage.__cloud);
  await ini(M, { __uid: 'u1', __cloud: s0, taxi_in_sospeso: REGISTRO }, 0);
  await pronto(M);
  await oggi(M);
  ok((await domanda(M)) === 'Nuovo anno: segni ancora i turni di Maria?', 'il Mac, col profilo dal Cloud, chiede anche lui', await domanda(M));
  await oggi(A);
  await A.click('text=No, toglili'); await A.waitForTimeout(700);
  const srv = await A.evaluate((k) => JSON.parse(localStorage.__cloud)[k], U + 'profilo/dati');
  ok(srv && srv.altraPersonaAnno === '2027' && srv.altraPersona.attivo === false, 'risposto sul telefono: sul server anno 2027 e opzione spenta', srv);
  const s1 = await A.evaluate(() => localStorage.__cloud);
  await M.evaluate((s) => { localStorage.__cloud = s; window.__tornaRete(); }, s1); await M.waitForTimeout(700);
  await oggi(M);
  ok((await domanda(M)) === null && (await cfg(M)).attivo === false && (await M.evaluate(() => window.profilo.altraPersonaAnno)) === '2027',
    'sul Mac la domanda se ne va da sola e l\'opzione e\' spenta anche li\'', await domanda(M));
  ok(A.errori.length === 0 && M.errori.length === 0, 'nessun errore JS', [A.errori, M.errori]);
  await chiudi(A, M);
});

await b.close();
console.log(`\n${passati} controlli passati` + (guai ? `  *** ${guai} FALLITI ***` : ', tutto a posto'));
process.exit(guai ? 1 : 0);
