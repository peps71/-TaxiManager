// Un file di backup confezionato male non deve poter eseguire niente.
// Due difese: l'id si controlla all'importazione, e comunque passa da escJs.
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
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const r = await p.evaluate(async () => {
  window.__bucato = false;
  window.dailyRecords = []; window.shifts = [];
  localStorage.setItem('taxi_voci_fisse_avviato','si'); window.vociFisse = [];
  const cattivi = [
    { id: "1');window.__bucato=true;//", data: '2026-03-10', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 },
    { id: '2"><img src=x onerror="window.__bucato=true">', data: '2026-03-11', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 },
    { id: 'buono-3', data: '2026-03-12', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 }
  ];
  await applicaBackup({ records: cattivi, shifts: [] });
  const entrati = (window.dailyRecords || []).map(x => String(x.id));

  // seconda difesa: anche se un id cattivo arrivasse dal Cloud, disegnare
  // la riga non deve eseguirlo
  window.dailyRecords = [{ id: "9');window.__bucato=true;//", data: '2026-03-13', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10, ora: '10:00' }];
  switchTab('giornata'); applyFilterGiornoGiornate('2026-03-13');
  await new Promise(r2 => setTimeout(r2, 400));
  const html = document.getElementById('main-container').innerHTML;
  return {
    entrati,
    bucato: window.__bucato,
    // l'apice dell'id deve essere uscito scappato, non nudo
    apiceNudo: html.includes("deleteRecord('9');"),
    apiceScappato: html.includes("\\'") || html.includes('&#39;')
  };
});
const prova = (n, bene, extra) => console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + extra + ' ***'}`);
prova('i due id malformati sono stati scartati', r.entrati.length === 1 && r.entrati[0] === 'buono-3', JSON.stringify(r.entrati));
prova('niente e\' stato eseguito', r.bucato === false, 'CODICE ESEGUITO');
prova('nell\'HTML l\'apice esce scappato, non nudo', !r.apiceNudo, 'apice nudo nell\'onclick');
console.log('\n  errori JS:', errori.length ? errori : 'nessuno');
await b.close();
