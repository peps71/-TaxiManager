// IL TURNO DI NOTTE: DOPO MEZZANOTTE E COL CAMBIO D'ORA
// Due difetti dei turni che scavalcano la mezzanotte, corretti nella fase 3
// della v176:
//  9. (0965f2a) Con l'app aperta dalle 19 del 20 le corse delle 2 di notte
//     finivano sul 20; ma RIAPRENDOLA alle 2 (iOS l'aveva chiusa, o il
//     telefono si era spento) la scheda partiva dal 21: la corsa finiva su
//     un giorno senza turno, «turno non registrato», €/h «—», e il turno
//     del 20 restava senza la sua corsa. Lo stesso col giorno scelto tolto
//     (la «x» del filtro) e con «L'una» (13-01) alle 00:30. Ora una regola
//     sola: se c'e' un turno in corso cominciato ieri il giorno di lavoro e'
//     il suo. Alle 8 del mattino, turno finito, il registro e' chiuso.
// 10. (a8af8a6) Segnando «La notte» dal calendario le ore si contavano
//     sulla data vera: la notte del cambio d'ora valeva 13 ore il 24
//     ottobre 2026 e 11 il 28 marzo, mentre lo stesso turno dal modulo ne
//     segnava 12. Le ore di un turno a orario fisso sono quelle del
//     contratto: 12, da tutte e due le strade.
// Orologio e fuso fermi (Europe/Rome), e si usano i tasti veri.
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
  else { ko.push(nome); console.log('  *** ' + nome + (dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio).slice(0, 300) : '')); }
};
const erroriJS = [];
const b = await chromium.launch();

// salvato: il giorno ricordato dalla scheda Giornate (null = mai scelto,
// '' = filtro tolto con la «x»).
async function apri(ora, turni, salvato = null, aperta = false) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  const p = await ctx.newPage();
  // aperta: l'orologio di Playwright parte da «ora» e si fa avanzare a mano
  // (l'app resta aperta mentre passa la mezzanotte).
  if (aperta) await p.clock.install({ time: new Date(ora) });
  else await p.clock.setFixedTime(new Date(ora));
  p.on('pageerror', e => erroriJS.push(String(e.message || e)));
  p.on('dialog', d => d.accept());
  await p.goto(APP);
  await p.evaluate(({ turni, salvato }) => {
    localStorage.clear(); localStorage.setItem('taxi_voci_fisse_avviato', 'si');
    localStorage.setItem('taxi_shifts', JSON.stringify(turni));
    if (salvato !== null) localStorage.setItem('taxi_giorno_giornate', salvato);
  }, { turni, salvato });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); });
  await p.waitForTimeout(250);
  return { p, ctx };
}
const caso = async (titolo, fn) => {
  console.log('--- ' + titolo + ' ---');
  try { await fn(); }
  catch (e) { ko.push(titolo + ' (interrotto)'); console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0]); }
};
const NOTTE = [{ id: 'tn', data: '2026-10-20', turno: 'La notte', inizio: '19:00', fine: '07:00', ore: 12, lavorato: true }];
const UNA = [{ id: 'tu', data: '2026-10-20', turno: "L'una", inizio: '13:00', fine: '01:00', ore: 12, lavorato: true }];

// La corsa dal tasto vero: dove va a finire, e cosa dice la scheda.
async function corsaRiaprendo(titolo, ora, turni, salvato) {
  await caso(titolo, async () => {
    const { p, ctx } = await apri(ora, turni, salvato);
    const campo = await p.locator('#corsa-lampo').count();
    c('il registro e\' aperto: c\'e\' il campo della corsa', campo === 1, campo);
    if (campo) {
      await p.fill('#corsa-lampo', '15');
      await p.click("button[onclick=\"corsaLampo('POS')\"]");
      await p.waitForTimeout(250);
      const data = await p.evaluate(() => (window.dailyRecords.find(r => r.tipo === 'ENTRATA') || {}).data);
      c('la corsa va sul 20 ottobre, il giorno del turno', data === '2026-10-20', data);
      const t = await p.evaluate(() => document.getElementById('main-container').innerText);
      c('e la scheda non dice «turno non registrato»', !/turno non registrato/i.test(t), (t.match(/.{0,40}turno non registrato.{0,20}/i) || [])[0]);
    }
    await ctx.close();
  });
}
await corsaRiaprendo('9. «La notte» 19-07 del 20, app riaperta alle 02:00 del 21, nessun giorno scelto', '2026-10-21T02:00:00+02:00', NOTTE, null);
await corsaRiaprendo('9. la stessa, col giorno scelto tolto dalla «x»', '2026-10-21T02:00:00+02:00', NOTTE, '');
await corsaRiaprendo('9. «L\'una» 13-01 del 20, riaperta alle 00:30 del 21', '2026-10-21T00:30:00+02:00', UNA, null);

await caso('9. alle 08:00 del 21 il turno di notte e\' finito: registro chiuso', async () => {
  const { p, ctx } = await apri('2026-10-21T08:00:00+02:00', NOTTE, null);
  const campo = await p.locator('#corsa-lampo').count();
  c('nessun campo della corsa', campo === 0, campo);
  c('e la scheda e\' sul 21', (await p.evaluate(() => typeof giornoGiornate === 'function' ? giornoGiornate() : null)) === '2026-10-21', await p.evaluate(() => typeof giornoGiornate === 'function' ? giornoGiornate() : null));
  await ctx.close();
});

await caso('9. e un turno normale di giorno non cambia: «Le otto» alle 12 del 20', async () => {
  const { p, ctx } = await apri('2026-10-20T12:00:00+02:00', [{ id: 't8', data: '2026-10-20', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true }], null);
  await p.fill('#corsa-lampo', '15'); await p.click("button[onclick=\"corsaLampo('POS')\"]"); await p.waitForTimeout(250);
  c('la corsa va sul 20', (await p.evaluate(() => (window.dailyRecords[0] || {}).data)) === '2026-10-20');
  await ctx.close();
});

await caso('9. Capodanno: «La notte» del 31/12 ancora viva all\'1:30 dell\'1/1', async () => {
  // Il giorno di lavoro non attraversa mai l'anno (ae1f262): l'anno fiscale
  // si conta per cassa, e la corsa dell'1/1 sul 31/12 finiva fuori dal
  // registro del 2026 che si sta guardando - non la si vedeva e la si
  // ribatteva. Va sull'1/1, e si vede.
  const { p, ctx } = await apri('2026-01-01T01:30:00+01:00', [{ id: 't1', data: '2025-12-31', turno: 'La notte', inizio: '19:00', fine: '07:00', ore: 12, lavorato: true }], null);
  const stato = await p.evaluate(() => ({ anno: typeof annoAttivo === 'function' ? annoAttivo() : null, campo: !!document.getElementById('corsa-lampo') }));
  c('l\'anno guardato e\' il 2026, e il registro e\' aperto', stato.anno === '2026' && stato.campo, stato);
  if (stato.campo) {
    await p.fill('#corsa-lampo', '20');
    await p.click("button[onclick=\"corsaLampo('Contanti')\"]");
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => dailyRecords.map(x => x.data + ' ' + x.importo).join());
    c('la corsa va sull\'1/1/2026', r === '2026-01-01 20', r);
    const testo = await p.evaluate(() => document.getElementById('main-container').innerText.replace(/[\u00a0\u202f]/g, ' '));
    c('e si vede nella giornata (20,00 €)', testo.includes('20,00 €'), testo.slice(0, 300));
    await p.evaluate(() => switchTab('dashboard')); await p.waitForTimeout(300);
    const cruscotto = await p.evaluate(() => document.getElementById('main-container').innerText.replace(/[\u00a0\u202f]/g, ' '));
    c('e nel cruscotto del 2026', cruscotto.includes('20,00'), cruscotto.slice(0, 300));
  }
  await ctx.close();
});

await caso('9. Capodanno con l\'app RIMASTA APERTA dalle 23:00 del 31/12', async () => {
  // L'app aperta alle 23 sul 31/12 2025 (anno guardato 2025); a mezzanotte
  // non si ridisegna da sola. Fino a 9eac94a la corsa veloce dell'1:30
  // finiva sul 31/12 o su un giorno che la scheda del 2025 non mostrava; da
  // 463b623 (giornoAnnoNuovo / passaAllAnnoNuovo) va sull'1/1/2026, la
  // scheda passa al 2026 col giorno di oggi, e il messaggio lo dice.
  const { p, ctx } = await apri('2025-12-31T23:00:00+01:00', [{ id: 't1', data: '2025-12-31', turno: 'La notte', inizio: '19:00', fine: '07:00', ore: 12, lavorato: true }], null, true);
  await p.clock.runFor(500);
  const alle23 = await p.evaluate(() => ({ anno: annoAttivo(), giorno: giornoGiornate() }));
  c('alle 23:00 si guarda il 2025, giorno 31/12', alle23.anno === '2025' && alle23.giorno === '2025-12-31', alle23);
  await p.clock.runFor(2.5 * 3600 * 1000);     // 01:30 dell'1/1/2026, app mai chiusa
  await p.fill('#corsa-lampo', '20');
  await p.click("button[onclick=\"corsaLampo('Contanti')\"]");
  await p.clock.runFor(400);
  const d = await p.evaluate(() => ({ rec: dailyRecords.map(x => x.data + ' ' + x.importo).join(), anno: annoAttivo(), giorno: giornoGiornate(),
    toast: (document.getElementById('toast-text') || {}).textContent || '', testo: document.getElementById('main-container').innerText.replace(/[\u00a0\u202f]/g, ' ') }));
  console.log('    il messaggio: ' + JSON.stringify(d.toast));
  c('la corsa va sull\'1/1/2026', d.rec === '2026-01-01 20', d.rec);
  c('la scheda passa al 2026, sul giorno di oggi', d.anno === '2026' && d.giorno === '2026-01-01', { anno: d.anno, giorno: d.giorno });
  c('il messaggio comincia con «Anno nuovo: la corsa va sul 01/01/2026.»', d.toast.startsWith('Anno nuovo: la corsa va sul 01/01/2026.'), d.toast);
  c('e la riga si vede (20,00 €)', d.testo.includes('20,00 €'), d.testo.slice(0, 300));
  await ctx.close();
});

await caso('un giorno dell\'anno vecchio scelto a mano, senza turno vivo, resta quello scelto', async () => {
  // La regola di Capodanno vale solo col turno vivo cominciato nell'anno
  // vecchio: chi il 2 gennaio torna a scrivere una corsa dimenticata del
  // 20 dicembre deve ritrovarla sul 20 dicembre, nel 2025.
  const { p, ctx } = await apri('2026-01-02T12:00:00+01:00', [{ id: 't20', data: '2025-12-20', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true }], null);
  await p.evaluate(() => { cambiaAnno('2025'); switchTab('giornata'); setVistaGiornata('giornate'); applyFilterGiornoGiornate('2025-12-20'); sbloccaGiornata('2025-12-20'); });
  await p.waitForTimeout(300);
  c('il registro del 20/12 e\' aperto (sbloccato a mano)', (await p.locator('#corsa-lampo').count()) === 1);
  await p.fill('#corsa-lampo', '33');
  await p.click("button[onclick=\"corsaLampo('POS')\"]");
  await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({ rec: dailyRecords.map(x => x.data + ' ' + x.importo).join(), anno: annoAttivo(), giorno: giornoGiornate(), toast: (document.getElementById('toast-text') || {}).textContent || '' }));
  c('la corsa va sul 20/12/2025', d.rec === '2025-12-20 33', d.rec);
  c('e la scheda resta sul 2025, giorno 20/12, senza «Anno nuovo»', d.anno === '2025' && d.giorno === '2025-12-20' && !d.toast.startsWith('Anno nuovo'), d);
  await ctx.close();
});

// 10: dal calendario, con i tasti della giornata aperta
async function segnaDalCalendario(ora, iso, tipo) {
  const { p, ctx } = await apri(ora, [], null);
  await p.evaluate(() => setVistaGiornata('calendario')); await p.waitForTimeout(250);
  await p.locator(`button[onclick="toccaGiornoCalendario('${iso}')"]`).first().click(); await p.waitForTimeout(250);
  await p.locator(`button[onclick="segnaTurnoLavoro('${iso}', '${tipo}')"]`).first().click(); await p.waitForTimeout(250);
  const t = await p.evaluate((iso) => (window.shifts.find(x => x.data === iso) || {}), iso);
  await ctx.close();
  return t;
}
await caso('10. «La notte» segnata dal calendario la notte del cambio d\'ora', async () => {
  const ott = await segnaDalCalendario('2026-10-20T12:00:00+02:00', '2026-10-24', 'notte');
  c('sabato 24 ottobre 2026 (si torna all\'ora solare): 12 ore, non 13', ott.ore === 12 && ott.inizio === '19:00' && ott.fine === '07:00', ott);
  const mar = await segnaDalCalendario('2026-03-20T12:00:00+01:00', '2026-03-28', 'notte');
  c('sabato 28 marzo 2026 (si passa all\'ora legale): 12 ore, non 11', mar.ore === 12, mar);
  const solita = await segnaDalCalendario('2026-03-20T12:00:00+01:00', '2026-03-10', 'notte');
  c('una notte qualsiasi resta 12', solita.ore === 12, solita);
  const una = await segnaDalCalendario('2026-10-20T12:00:00+02:00', '2026-10-24', 'una');
  c('«L\'una» del 24 ottobre resta 12', una.ore === 12, una);
});

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') : 'nessuno'));
await b.close();
