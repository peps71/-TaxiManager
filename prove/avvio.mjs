// Quanto costa l'avvio e quante volte si ridisegna tutto
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
// metto tre anni di dati in localStorage, come un telefono vero
await p.evaluate(() => {
  const rec = [], tur = [];
  const met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  for (const anno of [2024, 2025, 2026]) for (let m = 1; m <= 12; m++) for (let g = 1; g <= 28; g++) {
    const d = `${anno}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    tur.push({ id:`t${anno}${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180 });
    for (let c = 0; c < 9; c++) rec.push({ id:`e${anno}${m}${g}${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:met[c%5], importo:12+c*7, ora:'10:00' });
    rec.push({ id:`u${anno}${m}${g}`, data:d, tipo:'USCITA', categoria:'Carburante', metodo:'Bonifico', importo:60 });
  }
  localStorage.setItem('taxi_records', JSON.stringify(rec));
  localStorage.setItem('taxi_shifts', JSON.stringify(tur));
});
// riapro contando i disegni
await p.addInitScript(() => {
  window.__disegni = 0;
  const vero = Object.getOwnPropertyDescriptor(window, 'renderContent');
  let f = null;
  Object.defineProperty(window, 'renderContent', {
    configurable: true,
    get() { return f ? function () { window.__disegni++; return f.apply(this, arguments); } : undefined; },
    set(v) { f = v; }
  });
});
const t0 = Date.now();
await p.goto(APP);
await p.waitForFunction(() => document.getElementById('main-container') && document.getElementById('main-container').innerText.length > 50);
const pronta = Date.now() - t0;
await p.waitForTimeout(1200);
const m = await p.evaluate(() => ({
  disegni: window.__disegni,
  movimenti: (window.dailyRecords || []).length,
  tempi: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { dcl: Math.round(n.domContentLoadedEventEnd), fine: Math.round(n.loadEventEnd) } : null; })(),
  heap: performance.memory ? (performance.memory.usedJSHeapSize/1048576).toFixed(1) + ' MB' : '?'
}));
console.log(`  app usabile dopo ${pronta} ms (${m.movimenti} movimenti letti dal disco)`);
console.log(`  DOMContentLoaded ${m.tempi.dcl} ms · load ${m.tempi.fine} ms`);
console.log(`  disegni completi durante l'avvio: ${m.disegni}`);
console.log(`  memoria: ${m.heap}`);
// e il costo di registrare UNA corsa
const una = await p.evaluate(async () => {
  const a = performance.now();
  await window.saveRecordToCloud({ id: 'nuova1', data: '2026-03-10', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 42 });
  const salva = performance.now() - a;
  const b2 = performance.now(); renderContent(); const dis = performance.now() - b2;
  return { salva, dis };
});
console.log(`\n  registrare una corsa: ${una.salva.toFixed(0)} ms per salvare + ${una.dis.toFixed(0)} ms per ridisegnare`);
await b.close();
