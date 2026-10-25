// Giro completo di tutte le schermate con dei dati veri in pancia:
// serve a vedere se qualcosa esplode o se una schermata resta vuota.
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
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.goto(U);
await p.waitForFunction(() => typeof window.switchTab === 'function');
await p.evaluate(() => {
  const rec = [], tur = [];
  for (let m = 1; m <= 10; m++) for (const g of [5, 12, 19, 26]) {
    const d = `2026-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    tur.push({ id:'t'+m+g, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180 });
    const met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
    for (let c = 0; c < 5; c++) rec.push({ id:`e${m}${g}${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:met[c], importo: 20+c*9, ora:'10:0'+c });
    rec.push({ id:`u${m}${g}`, data:d, tipo:'USCITA', categoria:'Carburante', metodo: g===5?'Contanti':'Carta Carburante', importo: 60, fattura: g!==5 });
  }
  window.dailyRecords = rec; window.shifts = tur;
  window.scadenze = [{ id:'s1', nome:'Bollo Auto', data:'2026-10-31', cadenza:'anno', ancora:'2026-10-31' }];
  window.annoScelto = '2026';
});
const schede = ['giornata','dashboard','altro','uscite','categorie','scadenze','auto','rendimento','report','cloud'];
for (const t of schede) {
  await p.evaluate(x => switchTab(x), t);
  await p.waitForTimeout(350);
  const r = await p.evaluate(() => {
    const m = document.getElementById('main-container');
    return { testo: (m.innerText || '').trim().length, alto: m.scrollHeight };
  });
  console.log(`  ${t.padEnd(11)} ${String(r.testo).padStart(6)} caratteri · ${r.alto}px` + (r.testo < 40 ? '  *** VUOTA ***' : ''));
}
// e il calendario
await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('calendario'); });
await p.waitForTimeout(400);
console.log('  calendario   ' + (await p.evaluate(() => document.getElementById('main-container').innerText.length)) + ' caratteri');
console.log('\nerrori JS:', errori.length ? errori : 'nessuno');
await b.close();
