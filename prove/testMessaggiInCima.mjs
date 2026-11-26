// I messaggi stanno in cima (versione 184).
// Prima stavano in basso, sopra la barra di navigazione: aprendo l'app
// «Cloud attivo per…» copriva i tasti della corsa. Su richiesta del titolare
// adesso stanno in cima, anche il tasto «Annulla» dopo una corsa veloce, e la
// tastiera non li copre mai. Con l'area visibile spostata in giu' (Safari con
// la tastiera aperta) il messaggio la segue: si simula spostando visualViewport.
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
const ok = (bene, nome, dettaglio = '') => {
  if (!bene) storte++;
  console.log(`  ${bene ? 'ok ' : '***'} ${nome}${dettaglio && !bene ? '  -> ' + dettaglio : ''}`);
};

const b = await chromium.launch();
for (const [w, h] of [[320, 568], [390, 844], [1280, 800]]) {
  console.log(`\n  ${w} x ${h}`);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768,
                                   locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await ctx.route(/^https?:\/\//, r => r.abort());
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', e => errori.push(String(e)));
  await p.clock.setFixedTime(new Date('2026-03-11T12:00:00+01:00'));
  await p.addInitScript(() => {
    localStorage.setItem('taxi_shifts', JSON.stringify([{ id: 't1', data: '2026-03-11', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12 }]));
  });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(() => switchTab('giornata'));
  await p.waitForTimeout(300);

  const dove = () => p.evaluate(() => {
    const r = document.getElementById('toast').getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  await p.evaluate(() => showToast('Cloud attivo per prova@esempio.it'));
  await p.waitForTimeout(150);
  const m = await dove();
  ok(m.top >= 0 && m.top <= 40, 'un messaggio sta in cima allo schermo', JSON.stringify(m));

  if (w < 768) {
    await p.fill('#corsa-lampo', '12');
    await p.click("button[onclick=\"corsaLampo('Contanti')\"]");
    await p.waitForTimeout(150);
    const a = await dove();
    ok(a.top >= 0 && a.top <= 40, 'dopo la corsa anche «Annulla» sta in cima', JSON.stringify(a));
    // l'area visibile spostata in giu', come fa Safari con la tastiera aperta
    const spostato = await p.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, get: () => 250 });
      posizionaToast();
      const t = document.getElementById('toast');
      return Math.round(parseFloat(t.style.top));
    });
    ok(spostato === 262, 'con l\'area visibile spostata, il messaggio la segue (250 + 12)', String(spostato));
  }
  ok(errori.length === 0, 'nessun errore JS', errori.join(' | '));
  await ctx.close();
}
await b.close();
console.log(`\n  ${storte === 0 ? 'TUTTO BENE' : storte + ' COSE NON TORNANO'}`);
process.exit(storte ? 1 : 0);
