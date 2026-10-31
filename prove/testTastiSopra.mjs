// I tasti del metodo stanno SOPRA l'importo (versione 178).
// Con la tastiera aperta il telefono porta il campo appena sopra di lei, e
// tutto quello che sta sotto il campo finisce coperto: sull'iPhone vero
// Contanti e POS sparivano dietro la tastiera. Lo scorrimento automatico
// della versione 176 qui in Chromium funziona, sull'iPhone no: per questo la
// prova non guarda dove scorre la pagina ma COME e' fatta la scheda. Se i
// tasti stanno sopra il campo, si vedono ogni volta che si vede il campo, su
// qualunque telefono, iPhone o Android. Vale per la corsa e per la spesa, e
// per la domanda sulla corsa sopra soglia, che sotto il campo sarebbe coperta.
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

let storte = 0;
const prova = (nome, bene, dettaglio = '') => {
  if (!bene) storte++;
  console.log(`  ${bene ? 'ok ' : '***'} ${nome}${dettaglio ? '  (' + dettaglio + ')' : ''}`);
};

const b = await chromium.launch();
// iPhone grande, Android tipico, iPhone SE: la tastiera lascia libero
// almeno ~300 punti anche sul piu' piccolo.
for (const [w, h, libero] of [[390, 844, 460], [360, 780, 440], [320, 568, 300]]) {
  console.log(`\n  ${w} x ${h}`);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true,
                                   locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await ctx.route(/^https?:\/\//, r => r.abort());
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', e => errori.push(String(e)));
  // un turno in corso, se no il registro e' chiuso e la scheda non c'e'
  await p.clock.setFixedTime(new Date('2026-03-11T12:00:00+01:00'));
  await p.addInitScript(() => {
    localStorage.setItem('taxi_shifts', JSON.stringify([{ id: 't1', data: '2026-03-11', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12 }]));
  });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(() => switchTab('giornata'));
  await p.waitForTimeout(300);

  const misura = (selScheda, idCampo, selAvviso) => p.evaluate(({ selScheda, idCampo, selAvviso }) => {
    const scheda = document.querySelector(selScheda);
    if (!scheda) return null;
    const campo = document.getElementById(idCampo).closest('div').getBoundingClientRect();
    const tasti = [...scheda.querySelectorAll('.tasto-metodo')].map(e => e.getBoundingClientRect());
    const avviso = selAvviso ? document.querySelector(selAvviso) : null;
    const nodoCampo = document.getElementById(idCampo);
    return {
      tasti: tasti.length,
      sopra: tasti.filter(t => t.bottom <= campo.top).length,
      serve: Math.round(campo.bottom - Math.min(...tasti.map(t => t.top))),
      // l'avviso nel documento sta DOPO i tasti e PRIMA del campo
      avvisoInMezzo: avviso ? !!(scheda.querySelector('.tasto-metodo').compareDocumentPosition(avviso) & Node.DOCUMENT_POSITION_FOLLOWING)
                               && !!(avviso.compareDocumentPosition(nodoCampo) & Node.DOCUMENT_POSITION_FOLLOWING) : null
    };
  }, { selScheda, idCampo, selAvviso });

  const c = await misura('[data-scheda-corsa]', 'corsa-lampo', '#corsa-lampo-avviso');
  prova('corsa: la scheda c\'e\'', !!c);
  if (c) {
    prova('corsa: i 4 tasti stanno sopra l\'importo', c.tasti === 4 && c.sopra === 4, `${c.sopra} su ${c.tasti}`);
    prova('corsa: tasti e importo stanno insieme sopra la tastiera', c.serve <= libero, `servono ${c.serve}, liberi ~${libero}`);
    prova('corsa: la domanda sopra soglia sta fra i tasti e l\'importo', c.avvisoInMezzo === true);
  }
  // la domanda vera, accesa: si vede sopra il campo
  await p.fill('#corsa-lampo', '2350');
  await p.evaluate(() => corsaLampo('Contanti'));
  const domanda = await p.evaluate(() => {
    const a = document.getElementById('corsa-lampo-avviso').getBoundingClientRect();
    const f = document.getElementById('corsa-lampo').closest('div').getBoundingClientRect();
    return { visibile: a.height > 0, sopra: a.bottom <= f.top };
  });
  prova('corsa: la domanda accesa compare sopra l\'importo', domanda.visibile && domanda.sopra);

  await p.evaluate(() => alternaSpesaLampo());
  await p.waitForTimeout(200);
  const sp = await p.evaluate(() => {
    const campo = document.getElementById('spesa-lampo');
    if (!campo) return null;
    const scheda = campo.closest('[data-non-coprire]');
    const r = campo.closest('div').getBoundingClientRect();
    const tasti = [...scheda.querySelectorAll('.tasto-metodo')].map(e => e.getBoundingClientRect());
    return { tasti: tasti.length, sopra: tasti.filter(t => t.bottom <= r.top).length };
  });
  prova('spesa: la scheda c\'e\'', !!sp);
  if (sp) prova('spesa: i 5 tasti stanno sopra l\'importo', sp.tasti === 5 && sp.sopra === 5, `${sp.sopra} su ${sp.tasti}`);
  prova('nessun errore JS', errori.length === 0, errori.join(' | '));
  await ctx.close();
}
await b.close();
console.log(`\n  ${storte === 0 ? 'TUTTO BENE' : storte + ' COSE NON TORNANO'}`);
process.exit(storte ? 1 : 0);
