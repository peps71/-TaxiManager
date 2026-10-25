// L'indice dei pagamenti e' memorizzato: deve rifarsi quando registri una
// spesa per davvero, passando dalla strada normale dell'app.
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
const errori = []; p.on('pageerror', e => errori.push(String(e)));
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
const r = await p.evaluate(async () => {
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.vociFisse = [{ slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'bolletta', dataInizio:'', dataFine:'' }];
  window.dailyRecords = []; window.shifts = [];
  const g = '2026-06-10';
  const quota = () => quotaVoceReale(window.vociFisse[0], g, 30);
  const prima = quota();
  // la strada normale: la stessa che usa il tasto «Aggiungi spesa»
  await window.saveRecordToCloud({ id:'p1', data:g, tipo:'USCITA', categoria:'Assicurazione auto', metodo:'Bonifico', importo:1500 });
  const dopoUna = quota();
  // una seconda rata, sempre dalla strada normale
  await window.saveRecordToCloud({ id:'p2', data:'2026-12-10', tipo:'USCITA', categoria:'Assicurazione auto', metodo:'Bonifico', importo:300 });
  const dopoDue = quota();
  // e la cancellazione
  await window.deleteRecordFromCloud('p2');
  const dopoCancella = quota();
  return { prima, dopoUna, dopoDue, dopoCancella };
});
const prova = (n, visto, atteso) => {
  const bene = Math.abs(visto - atteso) < 0.015;
  console.log(`  ${bene ? 'ok ' : '***'} ${n.padEnd(48)} ${visto.toFixed(2)} (atteso ${atteso.toFixed(2)})${bene ? '' : '  *** SBAGLIATO ***'}`);
  return bene;
};
let t = true;
t &= prova('prima di pagare: la previsione', r.prima, 1387/365);
t &= prova('dopo «Aggiungi spesa» di 1.500', r.dopoUna, 1500/365);
t &= prova('dopo una seconda rata di 300', r.dopoDue, 1800/365);
t &= prova('dopo averla cancellata', r.dopoCancella, 1500/365);
console.log(`\n  ${t && !errori.length ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'} · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
