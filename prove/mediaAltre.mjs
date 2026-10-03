// mediaAltreSpese: somma e divisore devono guardare la stessa finestra.
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
const r = await p.evaluate(() => {
  const oggi = oggiISO();                     // 2026-10-02
  const ym = oggi.slice(0, 7);
  const gg = giorniDelMese(ym);
  window.vociFisse = []; localStorage.setItem('taxi_voci_fisse_avviato','si');
  // 10 pieni da 62 €: 1 e 2 ottobre (passati), gli altri 8 nel resto del mese
  const rec = [];
  [1,2,5,8,11,14,17,20,23,26].forEach((g,i) => rec.push({
    id:'u'+i, data:`${ym}-${String(g).padStart(2,'0')}`, tipo:'USCITA',
    categoria:'Carburante', metodo:'Bonifico', importo:62 }));
  window.dailyRecords = rec; window.shifts = [];
  window.versioneDati = (window.versioneDati||0)+1;
  const m = mediaAltreSpese(ym);
  const passate = rec.filter(x => x.data <= oggi).reduce((t,x)=>t+x.importo,0);
  const tutte = rec.reduce((t,x)=>t+x.importo,0);
  return { oggi, ym, gg, m, passate, tutte, giorniTrascorsi: Number(oggi.slice(8,10)) };
});
const e = (x) => x.toFixed(2).replace('.', ',');
console.log(`  oggi ${r.oggi} · il mese ha ${r.gg} giorni, ne sono passati ${r.giorniTrascorsi}`);
console.log(`  spese del mese registrate FINO A OGGI:  ${e(r.passate)} (2 pieni)`);
console.log(`  spese del mese registrate IN TUTTO:     ${e(r.tutte)} (10 pieni, 8 con data futura)`);
console.log(`\n  mediaAltreSpese dice:`);
console.log(`    somma usata:   ${e(r.m.altre)}`);
console.log(`    divisore:      ${r.m.giorni} giorni`);
console.log(`    media:         ${e(r.m.quota)} al giorno`);
console.log(`\n  la media onesta sarebbe ${e(r.passate / r.giorniTrascorsi)} (${e(r.passate)} / ${r.giorniTrascorsi})`);
const sbagliata = Math.abs(r.m.altre - r.tutte) < 0.01 && r.m.giorni < 10;
console.log(`\n  ${sbagliata ? '*** INCOERENTE: la somma guarda tutto il mese, il divisore solo i giorni passati ***' : 'coerente'}`);
await b.close();
