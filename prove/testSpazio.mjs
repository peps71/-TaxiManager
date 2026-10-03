// Archiviare un anno: prima il file, poi la cancellazione, e solo se confermi.
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
const ctx = await b.newContext({ locale: 'it-IT', acceptDownloads: true });
const p = await ctx.newPage();
const errori = []; p.on('pageerror', e => errori.push(String(e)));
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
const ANNO = new Date().getFullYear();
await p.evaluate(a => {
  const rec = [], tur = [];
  for (const y of [a-3, a-2, a-1, a]) for (let m = 1; m <= 6; m++) {
    const d = `${y}-${String(m).padStart(2,'0')}-10`;
    tur.push({ id:`t${y}${m}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180 });
    for (let c = 0; c < 4; c++) rec.push({ id:`e${y}${m}${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:'POS', importo:30, ora:'10:00' });
  }
  window.dailyRecords = rec; window.shifts = tur; window.annoScelto = String(a);
  localStorage.setItem('taxi_voci_fisse_avviato','si'); window.vociFisse = [];
}, ANNO);

const anni = await p.evaluate(() => anniArchiviabili().map(x => `${x.anno}:${x.movimenti}mov/${x.turni}tur${x.vecchio ? ' (archiviabile)' : ' (si tiene)'}`));
console.log('  anni visti:', anni.join(' · '));
const attesi = [`${ANNO-3}`, `${ANNO-2}`].every(a => anni.some(x => x.startsWith(a) && x.includes('archiviabile')))
            && [`${ANNO-1}`, `${ANNO}`].every(a => anni.some(x => x.startsWith(a) && x.includes('si tiene')));
console.log(`  ${attesi ? 'ok ' : '***'} i due anni in uso non si archiviano, i piu' vecchi sì`);

// 1) se NON confermo di avere il file, non deve cancellare niente
let risposte = [true, false];   // sì al primo confirm, no al secondo
p.on('dialog', async d => { await d[risposte.shift() ? 'accept' : 'dismiss'](); });
const scarico = p.waitForEvent('download', { timeout: 15000 });
await p.evaluate(a => archiviaAnno(String(a - 3)), ANNO);
const file = await scarico;
console.log(`  file scaricato: ${file.suggestedFilename()}`);
await p.waitForTimeout(2200);
const dopoNo = await p.evaluate(a => (window.dailyRecords || []).filter(r => String(r.data).startsWith(String(a-3))).length, ANNO);
console.log(`  ${dopoNo === 24 ? 'ok ' : '***'} dicendo «non ho il file» non cancella niente: restano ${dopoNo} movimenti`);

// 2) confermando, l'anno sparisce
risposte = [true, true];
const scarico2 = p.waitForEvent('download', { timeout: 15000 });
await p.evaluate(a => archiviaAnno(String(a - 3)), ANNO);
const f2 = await scarico2;
const flusso = await f2.createReadStream();
let testo = ''; for await (const c of flusso) testo += c;
const pacco = JSON.parse(testo);
await p.waitForTimeout(2500);
const r = await p.evaluate(a => ({
  restano: (window.dailyRecords || []).filter(x => String(x.data).startsWith(String(a-3))).length,
  turni: (window.shifts || []).filter(x => String(x.data).startsWith(String(a-3))).length,
  altri: (window.dailyRecords || []).length,
  suDisco: JSON.parse(localStorage.getItem('taxi_records') || '[]').filter(x => String(x.data).startsWith(String(a-3))).length
}), ANNO);
console.log(`  nel file: ${pacco.records.length} movimenti, ${pacco.shifts.length} turni, archivioAnno=${pacco.archivioAnno}`);
console.log(`  ${r.restano === 0 && r.turni === 0 ? 'ok ' : '***'} dopo la conferma l'anno è sparito dalla memoria (${r.restano} mov, ${r.turni} tur)`);
console.log(`  ${r.suDisco === 0 ? 'ok ' : '***'} ed è sparito anche dal disco (${r.suDisco} movimenti)`);
console.log(`  ${r.altri === 72 ? 'ok ' : '***'} gli altri tre anni sono intatti: ${r.altri} movimenti`);

// 3) il file si rimette con l'importazione di sempre
const rimesso = await p.evaluate(async (pacco) => { await applicaBackup(pacco); return (window.dailyRecords || []).length; }, pacco);
console.log(`  ${rimesso === 96 ? 'ok ' : '***'} rimettendo il file con «Importa backup» si torna a ${rimesso} movimenti`);
console.log('\n  errori JS:', errori.length ? errori : 'nessuno');
await b.close();
