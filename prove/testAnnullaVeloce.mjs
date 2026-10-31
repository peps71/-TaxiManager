// «ANNULLA» DOPO UNA CORSA O UNA SPESA VELOCI
// Il tasto del metodo salva al primo tocco: un POS battuto al posto dei
// Contanti, fino alla v175, si correggeva solo scendendo nel registro,
// aprendo la corsa e cancellandola. E il messaggio che compariva sopra i
// tasti, per tre secondi, si prendeva i tocchi: la corsa dopo non partiva.
// Dalla fase 3 della v176 (235d384):
//  - il messaggio ha per sei secondi un tasto «Annulla» da 44x44 che toglie
//    PROPRIO quel movimento (per identificativo, non «l'ultimo»), dalla
//    stessa strada del tasto Elimina: col Cloud la cancellazione passa dal
//    registro delle modifiche in attesa e arriva sul server;
//  - dopo, «Corsa annullata.» o «Spesa annullata.», e il fuoco torna nel
//    campo, pronto per la cifra giusta;
//  - il messaggio si lascia attraversare (pointer-events: none): un tocco
//    sul suo bordo arriva a quello che c'e' sotto; si tocca solo il tasto;
//  - le domande di cancellazione di movimenti e turni dicono la data come
//    11/03/2026, non 2026-03-11.
// Si usa dai tasti veri, a 320 e 390 px di giorno e al buio, e una volta
// col Firestore finto di prove/_finto/ (il Cloud vero non si tocca mai).
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
const erroriJS = [];
const b = await chromium.launch();
const B = 'artifacts/taximanager-2026/users/u1/';
const TURNO = { id: 'toggi', data: '2026-03-11', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true };

// conCloud: il Firestore finto al posto di quello di gstatic.com, col
// registro di u1 e il turno di oggi gia' sul server.
async function apri({ w = 390, tema = 'chiaro', conCloud = false, orologioFinto = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await ctx.route(/^https?:\/\//, r => r.abort());
  if (conCloud) for (const [n, f] of [['firebase-app.js', 'app.js'], ['firebase-auth.js', 'auth.js'], ['firebase-firestore.js', 'firestore.js']])
    await ctx.route('**/firebasejs/11.6.1/' + n, r => r.fulfill({ contentType: 'application/javascript', body: readFileSync(join(FINTO, f), 'utf8') }));
  const p = await ctx.newPage();
  // orologioFinto: l'orologio di Playwright governa anche i timer, e la
  // prova lo fa avanzare a mano (vedi la durata del messaggio).
  if (orologioFinto) await p.clock.install({ time: new Date('2026-03-11T12:00:00+01:00') });
  else await p.clock.setFixedTime(new Date('2026-03-11T12:00:00+01:00'));
  p.on('pageerror', e => erroriJS.push(String(e.message || e)));
  p.domande = []; p.risposta = true;
  p.on('dialog', d => { p.domande.push(d.message()); p.risposta ? d.accept() : d.dismiss(); });
  await p.goto(APP);
  await p.evaluate(({ tema, conCloud, TURNO, B }) => {
    localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si'); localStorage.setItem('taxi_tema', tema);
    localStorage.setItem('taxi_shifts', JSON.stringify([TURNO]));
    // una corsa di ieri che nessun Annulla deve toccare
    const ieri = { id: 'ieri', data: '2026-03-10', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 40, ora: '10:00' };
    localStorage.setItem('taxi_records', JSON.stringify([ieri]));
    if (conCloud) {
      localStorage.setItem('__uid', 'u1');
      localStorage.setItem('taxi_in_sospeso', JSON.stringify({ v: 1, uid: 'u1', n: 0, dal: null, per: {} }));
      localStorage.setItem('__cloud', JSON.stringify({ [B + 'taxi_shifts/toggi']: TURNO, [B + 'taxi_records/ieri']: ieri }));
    }
  }, { tema, conCloud, TURNO, B });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  if (conCloud) await p.waitForFunction(() => window.moduloFirebaseVivo === true && window.__authFatto === true, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); });
  await p.waitForTimeout(250);
  return { p, ctx };
}
const ids = (p) => p.evaluate(() => (window.dailyRecords || []).map(r => r.id + ':' + r.importo).sort().join(','));
const toast = (p) => p.evaluate(() => {
  const t = document.getElementById('toast'), a = document.getElementById('toast-annulla');
  const vis = (e) => !!e && !e.classList.contains('hidden') && e.getClientRects().length > 0;
  const q = a && a.getBoundingClientRect(), qt = t.getBoundingClientRect();
  // un punto del messaggio lontano dal tasto: a 6 punti dal bordo sinistro
  const sotto = document.elementFromPoint(qt.left + 6, qt.top + qt.height / 2);
  const testo = document.getElementById('toast-text');
  return { visibile: vis(t), testo: (testo || {}).textContent || '', tasto: vis(a) ? { l: Math.round(q.width), a: Math.round(q.height) } : null,
    pe: getComputedStyle(t).pointerEvents, bordoVaSotto: !!sotto && !sotto.closest('#toast'),
    // versione 180: dopo la corsa veloce solo il tasto, niente scritta ne' riquadro
    soloAnnulla: t.classList.contains('solo-annulla'),
    testoVisibile: !!testo && testo.getClientRects().length > 0,
    largoComeTasto: !!q && Math.abs(qt.width - q.width) < 2 && Math.abs(qt.height - q.height) < 2,
    etichetta: (a && a.getAttribute('aria-label')) || '' };
});
const caso = async (titolo, fn) => {
  console.log('--- ' + titolo + ' ---');
  try { await fn(); }
  catch (e) { ko.push(titolo + ' (interrotto)'); console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0]); }
};

for (const [w, tema] of [[320, 'chiaro'], [390, 'scuro']]) {
  await caso(`corsa e spesa veloci a ${w} px, ${tema}`, async () => {
    const { p, ctx } = await apri({ w, tema });
    // due corse: 10 e poi 12 (sbagliata). L'Annulla del messaggio della seconda toglie la seconda.
    await p.fill('#corsa-lampo', '10'); await p.click("button[onclick=\"corsaLampo('Contanti')\"]"); await p.waitForTimeout(200);
    await p.fill('#corsa-lampo', '12'); await p.click("button[onclick=\"corsaLampo('POS')\"]"); await p.waitForTimeout(200);
    const prima = await ids(p);
    const t = await toast(p);
    console.log('    il messaggio: ' + JSON.stringify(t.testo));
    c('dopo la corsa il messaggio ha il tasto «Annulla» da almeno 44x44', t.tasto && t.tasto.l >= 44 && t.tasto.a >= 44, t);
    c('il messaggio non prende i tocchi (pointer-events: none)', t.pe === 'none', t.pe);
    // versione 180, richiesta del titolare: dopo la corsa niente da leggere
    c('dopo la corsa nessuna scritta: solo il tasto, senza riquadro intorno', t.soloAnnulla && !t.testoVisibile && t.largoComeTasto, t);
    c('il tasto dice a VoiceOver quale corsa annulla', /12,00/.test(t.etichetta) && /POS/.test(t.etichetta), t.etichetta);
    const id12 = await p.evaluate(() => dailyRecords.find(r => r.importo === 12).id);
    await p.click('#toast-annulla', { timeout: 3000 }); await p.waitForTimeout(250);
    const dopo = await ids(p);
    c('Annulla toglie proprio la corsa da 12, e lascia quella da 10 e quella di ieri', !dopo.includes(id12 + ':') && dopo.includes(':10') && dopo.includes('ieri:40') && dopo.split(',').length === prima.split(',').length - 1, { prima, dopo });
    const t2 = await toast(p);
    c('poi dice «Corsa annullata.», senza un altro Annulla', t2.testo === 'Corsa annullata.' && !t2.tasto, t2);
    c('e il fuoco torna nel campo della corsa', (await p.evaluate(() => document.activeElement && document.activeElement.id)) === 'corsa-lampo');
    c('nessuna domanda: l\'Annulla non chiede conferma', p.domande.length === 0, p.domande);
    // la spesa veloce
    await p.locator('button[onclick="alternaSpesaLampo()"]').first().click(); await p.waitForTimeout(200);
    await p.fill('#spesa-lampo', '30'); await p.locator('button[onclick^="spesaLampo("]').first().click(); await p.waitForTimeout(200);
    const ts = await toast(p);
    c('dopo la spesa veloce c\'e\' l\'Annulla', !!ts.tasto && ts.tasto.l >= 44 && ts.tasto.a >= 44, ts);
    c('la spesa veloce tiene il suo messaggio scritto', !ts.soloAnnulla && ts.testoVisibile && ts.testo.length > 0, ts);
    c('e un tocco sul bordo del messaggio arriva a quello che c\'e\' sotto', ts.bordoVaSotto, ts);
    const conSpesa = await ids(p);
    await p.click('#toast-annulla', { timeout: 3000 }); await p.waitForTimeout(250);
    const t3 = await toast(p);
    c('la spesa se ne va, il resto no', (await ids(p)) === dopo && conSpesa !== dopo, { conSpesa, dopo: await ids(p) });
    c('«Spesa annullata.»', t3.testo === 'Spesa annullata.', t3);
    c('e il fuoco torna nel campo della spesa', (await p.evaluate(() => document.activeElement && document.activeElement.id)) === 'spesa-lampo');
    await ctx.close();
  });
}

await caso('quanto resta: la corsa 3 secondi (solo Annulla), la spesa 6', async () => {
  // Il tempo non si aspetta davvero: nel giro completo, con la macchina
  // carica, un timer poteva scattare tardi e la misura falliva per un motivo
  // che non c'entra. L'orologio di Playwright si ferma prima del tocco e si fa
  // avanzare a mano.
  // Versione 180: dopo la corsa veloce resta solo il tasto Annulla, per 3
  // secondi (richiesta del titolare); la spesa veloce tiene i suoi 6.
  const { p, ctx } = await apri({ orologioFinto: true });
  await p.clock.pauseAt(new Date('2026-03-11T12:05:00+01:00'));
  await p.fill('#corsa-lampo', '9'); await p.click("button[onclick=\"corsaLampo('Contanti')\"]");
  const a0 = await toast(p);
  await p.clock.runFor(2900);
  const a29 = await toast(p);
  await p.clock.runFor(200);
  const a31 = await toast(p);
  c('corsa, subito: solo il tasto Annulla', a0.visibile && !!a0.tasto && a0.soloAnnulla, a0);
  c('corsa, a 2,9 s c\'e\' ancora', a29.visibile && !!a29.tasto, a29);
  c('corsa, a 3,1 s se n\'e\' andato, e il tasto con lui', !a31.visibile && !a31.tasto, a31);
  // la spesa veloce: messaggio e Annulla per 6 secondi
  await p.locator('button[onclick="alternaSpesaLampo()"]').first().click();
  await p.clock.runFor(300);
  await p.fill('#spesa-lampo', '7'); await p.locator('button[onclick^="spesaLampo("]').first().click();
  await p.clock.runFor(5900);
  const s59 = await toast(p);
  await p.clock.runFor(200);
  const s61 = await toast(p);
  c('spesa, a 5,9 s messaggio e Annulla ci sono ancora', s59.visibile && !!s59.tasto && !s59.soloAnnulla, s59);
  c('spesa, a 6,1 s se n\'e\' andato', !s61.visibile && !s61.tasto, s61);
  // e un messaggio senza Annulla resta i suoi 3 secondi
  await p.evaluate(() => nascondiToast());
  await p.evaluate(() => showToast('prova'));
  await p.clock.runFor(2900);
  const b29 = await toast(p);
  await p.clock.runFor(200);
  const b31 = await toast(p);
  c('un messaggio senza Annulla: c\'e\' a 2,9 s, senza tasto, e non a 3,1 s', b29.visibile && !b29.tasto && !b31.visibile, { b29, b31 });
  await ctx.close();
});

await caso('le domande di cancellazione dicono la data come 10/03/2026', async () => {
  const { p, ctx } = await apri();
  p.risposta = false;
  await p.evaluate(() => applyFilterGiornoGiornate('2026-03-10')); await p.waitForTimeout(200);
  await p.locator(`button[onclick="apriModificaRecord('ieri')"]`).first().click(); await p.waitForTimeout(200);
  await p.locator(`button[onclick="deleteRecord('ieri')"]`).first().click(); await p.waitForTimeout(200);
  const dm = p.domande.find(d => d.startsWith('Elimino definitivamente')) || '';
  console.log('    movimento: ' + JSON.stringify(dm.split('\n')[0]));
  c('movimento: «... del 10/03/2026 ...»', dm.includes('del 10/03/2026') && !dm.includes('2026-03-10'), dm);
  p.domande.length = 0;
  await p.evaluate(() => deleteShift('toggi')); await p.waitForTimeout(150);
  const dt = p.domande.find(d => d.startsWith('Elimino definitivamente')) || '';
  console.log('    turno: ' + JSON.stringify(dt.split('\n')[0]));
  c('turno: «... del 11/03/2026 ...»', dt.includes('del 11/03/2026') && !dt.includes('2026-03-11'), dt);
  c('dicendo no resta tutto', (await ids(p)).includes('ieri:40') && (await p.evaluate(() => shifts.length)) === 1);
  await ctx.close();
});

await caso('col Cloud: l\'Annulla cancella anche sul server, dal registro', async () => {
  const { p, ctx } = await apri({ conCloud: true });
  await p.fill('#corsa-lampo', '15'); await p.click("button[onclick=\"corsaLampo('POS')\"]"); await p.waitForTimeout(400);
  const id = await p.evaluate(() => (dailyRecords.find(r => r.importo === 15) || {}).id);
  const lassu = () => p.evaluate(() => Object.keys(JSON.parse(localStorage.__cloud || '{}')).filter(k => k.includes('/taxi_records/')).map(k => k.split('/').pop()).sort().join(','));
  c('la corsa arriva sul server', (await lassu()).split(',').includes(String(id)), await lassu());
  // senza campo: la cancellazione resta segnata nel registro finche' non arriva
  await p.evaluate(() => { window.__offline = true; });
  await p.click('#toast-annulla', { timeout: 3000 }); await p.waitForTimeout(300);
  const segno = await p.evaluate((id) => { try { return ((JSON.parse(localStorage.taxi_in_sospeso).per || {}).taxi_records || {})[id] || null; } catch (e) { return null; } }, id);
  c('Annulla senza campo: la cancellazione e\' segnata nel registro (\'d\')', /^d\d+$/.test(segno || ''), segno);
  await p.evaluate(() => window.__tornaRete()); await p.waitForTimeout(500);
  c('torna la rete: sparita anche dal server, quella di ieri resta', !(await lassu()).split(',').includes(String(id)) && (await lassu()).includes('ieri'), await lassu());
  c('e una cancellazione sola, di quell\'id', (await p.evaluate((id) => window.__scritture.filter(s => s[0] === 'd').map(s => s[1].split('/').pop()), id)).join() === String(id),
    await p.evaluate(() => window.__scritture.filter(s => s[0] === 'd')));
  await ctx.close();
});

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') : 'nessuno'));
await b.close();
