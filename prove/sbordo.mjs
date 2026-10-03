// Cerca testo tagliato e sbordi orizzontali su piu' larghezze, su tutte le
// schermate. I testi accorciati apposta con i puntini non contano.
// Le prove girano da dove sta il repository, non da un percorso fisso: cosi'
// funzionano anche su un'altra macchina. Il motore del browser si cerca dove
// e' installato, oppure lo si dice con PLAYWRIGHT=/percorso/index.mjs.
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
const b = await chromium.launch();
const U = APP;
for (const w of [320, 375, 390, 768, 820, 1024, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, locale: 'it-IT' });
  await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.goto(U);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(() => {
    const rec = [], tur = [];
    for (let g = 1; g <= 28; g++) {
      const d = `2026-10-${String(g).padStart(2,'0')}`;
      tur.push({ id:'t'+g, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180 });
      for (let c = 0; c < 6; c++) rec.push({ id:`e${g}_${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:['Contanti','POS','Satispay','App/Nexi','Conto','Contanti'][c], importo: 28.75+c*7, ora:'1'+c+':00' });
      rec.push({ id:`u${g}`, data:d, tipo:'USCITA', categoria:'Carburante', metodo:'Carta Carburante', importo: 55, fattura:true });
    }
    window.dailyRecords = rec; window.shifts = tur; window.annoScelto = '2026';
  });
  const schede = ['dashboard','giornata','uscite','auto','scadenze','rendimento','categorie','report','cloud'];
  const problemi = [];
  for (const t of schede) {
    await p.evaluate(x => { switchTab(x); }, t);
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const doc = document.documentElement;
      const sbordo = doc.scrollWidth - doc.clientWidth;
      let tagliati = 0; const nomi = [];
      document.querySelectorAll('div, p, span, td, button').forEach(el => {
        const st = getComputedStyle(el);
        if (st.textOverflow === 'ellipsis') return;
        if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2) {
          tagliati++; if (nomi.length < 4) nomi.push((el.textContent || '').trim().slice(0, 40));
        }
      });
      return { sbordo, tagliati, nomi };
    });
    if (r.sbordo > 0 || r.tagliati > 0) problemi.push(`    ${t}: sbordo ${r.sbordo}px · tagliati ${r.tagliati} → ${r.nomi.map(x => '«'+x+'»').join(', ')}`);
  }
  console.log(`${w}px — ${problemi.length ? 'DA GUARDARE\n' + problemi.join('\n') : 'niente fuori posto'}`);
  await p.close();
}
await b.close();
