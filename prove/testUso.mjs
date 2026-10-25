// USARE L'APP DAVVERO, dai suoi pulsanti e dai suoi moduli.
// I conti possono tornare tutti e l'app rompersi appena la tocchi.
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
const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
await p.evaluate(() => {
  localStorage.setItem('taxi_profilo', JSON.stringify({ nome:'Giuseppe', sigla:'Livorno 71' }));
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.vociFisse = []; window.dailyRecords = []; window.shifts = [];
  window.profilo = { nome:'Giuseppe', sigla:'Livorno 71' };
  renderNav(); renderContent();
});
let t = true;
const prova = (n, bene, extra) => { t &= bene; console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + (extra===undefined?'':extra) + ' ***'}`); };
const stato = () => p.evaluate(() => ({
  corse: (window.dailyRecords||[]).filter(r=>r.tipo==='ENTRATA').length,
  spese: (window.dailyRecords||[]).filter(r=>r.tipo==='USCITA').length,
  turni: (window.shifts||[]).length,
  incassi: (window.dailyRecords||[]).filter(r=>r.tipo==='ENTRATA').reduce((a,r)=>a+(parseFloat(r.importo)||0),0),
  uscite: (window.dailyRecords||[]).filter(r=>r.tipo==='USCITA').reduce((a,r)=>a+(parseFloat(r.importo)||0),0),
  salvatiSuDisco: JSON.parse(localStorage.getItem('taxi_records')||'[]').length
}));
const OGGI = await p.evaluate(() => oggiISO());

// --- 1. registrare un turno dal modulo (sta nella vista Calendario) ---
await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('calendario'); window.showShiftForm = true; renderContent(); });
await p.waitForTimeout(400);
const campiTurno = await p.evaluate(() => Array.from(document.querySelectorAll('form input, form select')).map(x => x.id).filter(Boolean));
await p.evaluate((oggi) => {
  const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); } };
  set('sh-data', oggi); set('sh-inizio', '08:00'); set('sh-fine', '20:00');
  set('sh-ore', '12'); set('sh-kmini', '45000'); set('sh-kmfine', '45180');
  document.querySelector('form[onsubmit*="addShift"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}, OGGI);
await p.waitForTimeout(400);
let s = await stato();
prova(`turno registrato dal modulo (turni: ${s.turni})`, s.turni === 1, JSON.stringify(campiTurno));

// --- 2. registrare tre corse dal modulo ---
for (const [imp, met] of [['25,50','Contanti'], ['18','POS'], ['42,30','Satispay']]) {
  await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); window.showCorsaForm = true; renderContent(); });
  await p.waitForTimeout(250);
  await p.evaluate(({ imp, met, oggi }) => {
    document.getElementById('corsa-data').value = oggi;
    document.getElementById('corsa-imp').value = imp;
    const sel = document.getElementById('corsa-metodo');
    const opt = Array.from(sel.options).find(o => o.value === met || o.text.includes(met));
    if (opt) sel.value = opt.value;
    document.querySelector('form[onsubmit*="addCorsa"]').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
  }, { imp, met, oggi: OGGI });
  await p.waitForTimeout(300);
}
s = await stato();
prova(`tre corse registrate (${s.corse}) per ${s.incassi.toFixed(2)} €`, s.corse === 3 && Math.abs(s.incassi - 85.80) < 0.01, `${s.corse} corse, ${s.incassi}`);
prova('e sono finite anche su disco', s.salvatiSuDisco === 3, String(s.salvatiSuDisco));

// --- 3. una spesa dal modulo ---
await p.evaluate(() => { switchTab('uscite'); window.showUscitaForm = true; renderContent(); });
await p.waitForTimeout(350);
await p.evaluate((oggi) => {
  document.getElementById('uscita-data').value = oggi;
  document.getElementById('uscita-imp').value = '62,40';
  const sel = document.getElementById('uscita-cat-select');
  const opt = Array.from(sel.options).find(o => /carburante/i.test(o.text));
  if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', {bubbles:true})); }
  document.querySelector('form[onsubmit*="addUscita"]').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
}, OGGI);
await p.waitForTimeout(400);
s = await stato();
prova(`spesa registrata (${s.spese}) per ${s.uscite.toFixed(2)} €`, s.spese === 1 && Math.abs(s.uscite - 62.40) < 0.01, `${s.spese}, ${s.uscite}`);

// --- 4. la scheda di Oggi mostra quello che ho appena messo ---
await p.evaluate(oggi => { switchTab('giornata'); applyFilterGiornoGiornate(oggi); window.incassoVisibile = true; renderContent(); }, OGGI);
await p.waitForTimeout(400);
let video = await p.evaluate(() => document.getElementById('main-container').innerText);
prova('la scheda «Oggi» mostra 85,80 di incasso', /85,80/.test(video), video.slice(0,200));
prova('e mostra la spesa 62,40', /62,40/.test(video));

// --- 5. modificare l'importo di una corsa ---
const idCorsa = await p.evaluate(() => (window.dailyRecords||[]).find(r=>r.tipo==='ENTRATA').id);
await p.evaluate(id => { apriModificaRecord(id); renderContent(); }, idCorsa);
await p.waitForTimeout(350);
await p.evaluate(id => {
  const campo = document.getElementById('mv-imp-' + id);
  if (campo) campo.value = '30,00';
  salvaModificaRecord(id);
}, idCorsa);
await p.waitForTimeout(400);
s = await stato();
// l'elenco e' in ordine di data decrescente: il primo e' l'ultima registrata, 42,30
prova(`modifica 42,30 -> 30,00: incassi ${s.incassi.toFixed(2)} €`, Math.abs(s.incassi - 73.50) < 0.01, String(s.incassi));

// --- 6. cancellare una corsa ---
await p.evaluate(id => deleteRecord(id), idCorsa);
await p.waitForTimeout(400);
s = await stato();
prova(`cancellazione: restano ${s.corse} corse per ${s.incassi.toFixed(2)} €`, s.corse === 2 && Math.abs(s.incassi - 43.50) < 0.01, `${s.corse}/${s.incassi}`);
prova('e il disco segue', s.salvatiSuDisco === 3, String(s.salvatiSuDisco));

// --- 7. tutte le schermate reggono dopo le modifiche ---
const vuote = [];
for (const tab of ['giornata','dashboard','altro','uscite','categorie','scadenze','auto','rendimento','report','cloud']) {
  await p.evaluate(x => switchTab(x), tab);
  await p.waitForTimeout(200);
  const n = await p.evaluate(() => (document.getElementById('main-container').innerText||'').trim().length);
  if (n < 40) vuote.push(tab);
}
prova('nessuna schermata resta vuota dopo le modifiche', vuote.length === 0, vuote.join(', '));

console.log(`\n  ${t && !errori.length ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'} · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
