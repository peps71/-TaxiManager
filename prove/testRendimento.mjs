// RENDIMENTO: LO STATO VUOTO E LE DATE STORTE
// Due difetti della scheda Rendimento, corretti nella fase 3 della v176
// (8a954f0):
//  7. senza turni la schermata diceva solo «Nessuna giornata lavorata»: chi
//     apriva l'app la prima volta non sapeva da dove cominciare. Ora dice
//     che i conti partono dal primo turno e ha un tasto che apre il
//     Calendario, dove i turni si segnano. Si tocca il tasto vero e si
//     guarda dove si arriva.
//  8. una data storta nell'archivio («2026-xx», arrivata da un backup
//     vecchio o scritta a mano) faceva cadere TUTTA la schermata nel conto
//     per giorno della settimana («Cannot read properties of undefined
//     (reading 'gg')»): la scheda restava vuota. Ora quella riga si salta.
//     E con le date buone i numeri devono restare quelli di prima: il
//     risultato di statsRendimento su un archivio fisso e' scritto qui
//     sotto, misurato sulla v175 (589628d) e identico sulla v176.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato: installalo o indicalo con PLAYWRIGHT=...'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

let ok = 0; const ko = [];
const c = (nome, vero, dettaglio) => {
  if (vero) { ok++; console.log('  ok  ' + nome); }
  else { ko.push(nome); console.log('  *** ' + nome + (dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio).slice(0, 400) : '')); }
};
const b = await chromium.launch();

// L'archivio fisso: nove mesi del 2026, quattro giorni al mese, un turno
// e una corsa per giorno; «Le otto» nei mesi dispari e «La notte» nei pari.
const STORTE = ['2026-xx', '2026', '2026-13-45', '2026-1-5', '2026-ab-cd', '2026-02-30'];
function archivio(conStorte) {
  const rec = [], tur = [];
  for (let m = 1; m <= 9; m++) for (const g of [3, 11, 17, 24]) {
    const d = `2026-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
    tur.push({ id: 't' + d, data: d, turno: m % 2 ? 'Le otto' : 'La notte', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true });
    rec.push({ id: 'e' + d, data: d, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 20 + m + g, ora: '10:00' });
  }
  if (conStorte) {
    for (const d of STORTE) rec.push({ id: 's' + d.replace(/[^0-9a-z]/g, ''), data: d, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 50, ora: '10:00' });
    tur.push({ id: 'tstorto', data: '2026-yy', turno: 'Le otto', ore: 12, lavorato: true });
  }
  return { rec, tur };
}
// statsRendimento sull'archivio senza date storte, misurato sulla v175.
const ATTESO = '{"listaTurni":[{"nome":"Le otto","gg":20,"tot":775,"ore":240,"perGg":38.75,"perOra":3.2291666666666665,"corseGg":1,"perCorsa":38.75},{"nome":"La notte","gg":16,"tot":620,"ore":192,"perGg":38.75,"perOra":3.2291666666666665,"corseGg":1,"perCorsa":38.75}],"perSettimana":[{"nome":"lunedì","gg":4,"tot":164,"perGg":41,"corseGg":1},{"nome":"martedì","gg":7,"tot":262,"perGg":37.42857142857143,"corseGg":1},{"nome":"mercoledì","gg":5,"tot":189,"perGg":37.8,"corseGg":1},{"nome":"giovedì","gg":4,"tot":168,"perGg":42,"corseGg":1},{"nome":"venerdì","gg":7,"tot":281,"perGg":40.142857142857146,"corseGg":1},{"nome":"sabato","gg":5,"tot":180,"perGg":36,"corseGg":1},{"nome":"domenica","gg":4,"tot":151,"perGg":37.75,"corseGg":1}],"giornoRecord":{"data":"2026-09-24","tot":53,"nCorse":1,"turno":"Le otto","ore":12},"giornoPeggiore":{"data":"2026-01-03","tot":24,"nCorse":1,"turno":"Le otto","ore":12},"giornateLavorate":36,"giorniLavorati":36}';

async function apri({ w = 390, tema = 'chiaro', dati = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  const p = await ctx.newPage();
  // 20 ottobre 2026: l'anno di esercizio e' il 2026
  await p.clock.setFixedTime(new Date('2026-10-20T12:00:00+02:00'));
  p.errori = []; p.on('pageerror', e => p.errori.push(String(e.message || e)));
  await p.goto(APP);
  await p.evaluate(({ tema, dati }) => {
    localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si'); localStorage.setItem('taxi_tema', tema);
    if (dati) { localStorage.setItem('taxi_records', JSON.stringify(dati.rec)); localStorage.setItem('taxi_shifts', JSON.stringify(dati.tur)); }
  }, { tema, dati });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.waitForTimeout(200);
  return { p, ctx };
}
// Gli spazi fissi fra cifra e € (Intl) diventano spazi normali.
const testo = (p) => p.evaluate(() => document.getElementById('main-container').innerText.replace(/[\u00a0\u202f]/g, ' '));
const caso = async (titolo, fn) => {
  console.log('--- ' + titolo + ' ---');
  try { await fn(); }
  catch (e) { ko.push(titolo + ' (interrotto)'); console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0]); }
};

for (const [w, tema] of [[320, 'chiaro'], [390, 'scuro']]) {
  await caso(`7. senza turni, a ${w} px ${tema}: dice da dove cominciare`, async () => {
    const { p, ctx } = await apri({ w, tema });
    await p.evaluate(() => switchTab('rendimento')); await p.waitForTimeout(250);
    const t = await testo(p);
    c('«Nessuna giornata lavorata nel 2026.»', t.includes('Nessuna giornata lavorata nel 2026.'), t.slice(0, 200));
    c('«I conti partono dal primo turno registrato.»', t.includes('I conti partono dal primo turno registrato.'), t.slice(0, 300));
    const tasto = p.locator('button[onclick="apriCalendario()"]', { hasText: 'Apri il Calendario' });
    c('c\'e\' il tasto «Apri il Calendario»', (await tasto.count()) === 1);
    if (await tasto.count()) {
      const q = await tasto.boundingBox();
      c('alto almeno 44 punti e dentro lo schermo', q.height >= 44 && q.x >= 0 && q.x + q.width <= w, q);
      await tasto.click(); await p.waitForTimeout(300);
      const dove = await p.evaluate(() => ({ scheda: window.activeTab, vista: window.vistaGiornata, frecce: !!document.querySelector('button[onclick="scorriMeseCalendario(-1)"]') }));
      c('toccato: si apre il Calendario delle Giornate', dove.scheda === 'giornata' && dove.vista === 'calendario' && dove.frecce, dove);
    }
    c('nessun errore JS', !p.errori.length, p.errori);
    await ctx.close();
  });
}

await caso('8. date storte nell\'archivio: la scheda si disegna lo stesso', async () => {
  const { p, ctx } = await apri({ w: 320, dati: archivio(true) });
  await p.evaluate(() => switchTab('rendimento')); await p.waitForTimeout(300);
  const t = await testo(p);
  c('nessun errore JS', !p.errori.length, p.errori);
  c('la scheda non e\' vuota: c\'e\' il conto per turno e per giorno della settimana', t.includes('Le otto') && t.includes('La notte') && /luned/i.test(t), t.slice(0, 300));
  c('nessun «NaN», «undefined», «Infinity» a video', !/NaN|undefined|Infinity/.test(t), (t.match(/.{0,30}(NaN|undefined|Infinity).{0,30}/) || [])[0]);
  const s = await p.evaluate(() => { try { return JSON.stringify(statsRendimento()); } catch (e) { return 'ERRORE ' + e.message; } });
  c('statsRendimento non cade', !s.startsWith('ERRORE') && !/NaN|null,"tot"|undefined/.test(s), s.slice(0, 200));
  const sett = JSON.parse(s.startsWith('ERRORE') ? '{"perSettimana":[]}' : s).perSettimana || [];
  console.log('    (con le date storte il lunedi\' conta ' + ((sett[0] || {}).gg) + ' giorni invece di 4: «2026-1-5» e «2026-02-30» passano per date vere)');
  await ctx.close();
});

await caso('8. con le date buone i numeri sono quelli di prima', async () => {
  const { p, ctx } = await apri({ w: 390, dati: archivio(false) });
  await p.evaluate(() => switchTab('rendimento')); await p.waitForTimeout(300);
  const s = await p.evaluate(() => JSON.stringify(statsRendimento()));
  c('statsRendimento identico, cifra per cifra, a quello della v175', s === ATTESO, s);
  const t = await testo(p);
  c('e a video «Le otto»: «3,23 €/ora · 38,75 € a giornata · 20 giorni», record 53,00 €', t.includes('3,23 €/ora · 38,75 € a giornata · 20 giorni') && t.includes('53,00 €'), t.slice(0, 400));
  c('nessun errore JS', !p.errori.length, p.errori);
  await ctx.close();
});

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
await b.close();
