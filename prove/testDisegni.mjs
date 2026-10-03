// Sei pacchetti dal Cloud devono dare UN disegno, non sei.
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
const p = await b.newPage({ locale: 'it-IT' });
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
const r = await p.evaluate(async () => {
  // un archivio vero, cosi' il disegno costa qualcosa
  const rec = [], met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  for (const a of [2024,2025,2026]) for (let m=1;m<=12;m++) for (let g=1;g<=28;g++) {
    const d = `${a}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    for (let c=0;c<9;c++) rec.push({ id:`e${a}${m}${g}${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:met[c%5], importo:12+c*7, ora:'10:00' });
  }
  window.dailyRecords = rec; window.shifts = []; window.annoScelto = '2026';
  window.activeTab = 'dashboard';

  // conto i disegni veri
  let n = 0;
  const vero = window.renderContent;
  window.renderContent = function () { n++; return vero.apply(this, arguments); };

  // i sei pacchetti arrivano uno dietro l'altro, come fa Firestore all'accesso
  const t0 = performance.now();
  for (let i = 0; i < 6; i++) window.renderDifferito();
  await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
  const accodato = { disegni: n, ms: performance.now() - t0 };

  // e per confronto: sei disegni chiesti a mano, come prima
  n = 0;
  const t1 = performance.now();
  for (let i = 0; i < 6; i++) { window.renderNav(); window.renderContent(); }
  const diretto = { disegni: n, ms: performance.now() - t1 };

  window.renderContent = vero;
  return { accodato, diretto, movimenti: rec.length };
});
console.log(`  archivio: ${r.movimenti} movimenti`);
console.log(`  sei pacchetti accodati : ${r.accodato.disegni} disegno/i in ${r.accodato.ms.toFixed(0)} ms  ${r.accodato.disegni === 1 ? 'ok' : '*** dovrebbe essere 1 ***'}`);
console.log(`  come prima (uno a uno) : ${r.diretto.disegni} disegni in ${r.diretto.ms.toFixed(0)} ms`);
console.log(`  risparmio: ${(r.diretto.ms - r.accodato.ms).toFixed(0)} ms all'accesso`);
await b.close();
