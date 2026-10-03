// I CASI LIMITE
// Si passano tutte le schermate in situazioni scomode e si cerca a video
// quello che non deve mai comparire: NaN, Infinity, undefined, null.
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

const SCHEDE = ['giornata','dashboard','altro','uscite','categorie','scadenze','auto','rendimento','report','cloud'];
const VIETATE = /\bNaN\b|\bInfinity\b|\bundefined\b|\bnull\b|\[object Object\]|\bNegative\b/;

async function scenario(nome, prepara) {
  await p.evaluate(prepara);
  await p.waitForTimeout(150);
  const guai = [];
  for (const tab of SCHEDE) {
    for (const per of (tab === 'dashboard' ? ['giorno','mese','anno'] : [null])) {
      await p.evaluate(({ tab, per }) => {
        window.activeTab = tab;
        if (per) window.periodoDashScelto = per;
        renderContent();
      }, { tab, per });
      await p.waitForTimeout(90);
      const t = await p.evaluate(() => document.getElementById('main-container').innerText || '');
      if (t.trim().length < 20) guai.push(`${tab}${per?'/'+per:''}: schermata vuota`);
      const m = t.match(VIETATE);
      if (m) {
        const i = t.indexOf(m[0]);
        guai.push(`${tab}${per?'/'+per:''}: «${m[0]}» in «${t.slice(Math.max(0,i-45), i+35).replace(/\n/g,' ')}»`);
      }
    }
  }
  // e la vista calendario
  await p.evaluate(() => { window.activeTab='giornata'; setVistaGiornata('calendario'); renderContent(); });
  await p.waitForTimeout(150);
  const tc = await p.evaluate(() => document.getElementById('main-container').innerText || '');
  const mc = tc.match(VIETATE);
  if (mc) guai.push(`calendario: «${mc[0]}»`);
  await p.evaluate(() => setVistaGiornata('giornate'));
  console.log(`  ${guai.length ? '***' : 'ok '} ${nome}${guai.length ? '' : ''}`);
  guai.forEach(g => console.log(`        *** ${g}`));
  return guai.length;
}

const base = (extra) => new Function('extra', `
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  localStorage.setItem('taxi_profilo', JSON.stringify({nome:'Giuseppe'}));
  window.profilo = { nome:'Giuseppe' };
  window.dailyRecords = []; window.shifts = []; window.veicoli = []; window.scadenze = []; window.vociFisse = [];
  window.incassoVisibile = true;
  (${extra})();
  window.versioneDati = (window.versioneDati||0)+1;
  renderNav();
`);

let guai = 0;
guai += await scenario('archivio completamente vuoto', base(`() => { window.annoScelto = String(new Date().getFullYear()); }`));

guai += await scenario('un turno senza nessuna corsa (euro/ora con incasso zero)', base(`() => {
  const o = oggiISO();
  window.shifts = [{ id:'t1', data:o, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180 }];
  window.annoScelto = o.slice(0,4);
}`));

guai += await scenario('corse senza nessun turno (ore a zero)', base(`() => {
  const o = oggiISO();
  window.dailyRecords = [{ id:'e1', data:o, tipo:'ENTRATA', categoria:'Corsa', metodo:'POS', importo:30, ora:'10:00' }];
  window.annoScelto = o.slice(0,4);
}`));

guai += await scenario('tutti gli importi a zero', base(`() => {
  const o = oggiISO();
  window.dailyRecords = [
    { id:'e1', data:o, tipo:'ENTRATA', categoria:'Corsa', metodo:'POS', importo:0, ora:'10:00' },
    { id:'u1', data:o, tipo:'USCITA', categoria:'Carburante', metodo:'Bonifico', importo:0 }];
  window.shifts = [{ id:'t1', data:o, turno:'Le otto', inizio:'08:00', fine:'08:00', ore:0, lavorato:true, kmTot:0 }];
  window.annoScelto = o.slice(0,4);
}`));

guai += await scenario('anno bisestile 2028 (366 giorni)', base(`() => {
  window.dailyRecords = [
    { id:'e1', data:'2028-02-29', tipo:'ENTRATA', categoria:'Corsa', metodo:'POS', importo:40, ora:'10:00' },
    { id:'u1', data:'2028-02-29', tipo:'USCITA', categoria:'Carburante', metodo:'Bonifico', importo:60 }];
  window.shifts = [{ id:'t1', data:'2028-02-29', turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180 }];
  window.vociFisse = [{ slug:'a', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'scadenza', scadenza:'2028-02-29', dataInizio:'', dataFine:'' }];
  window.annoScelto = '2028'; window.dashGiorno = '2028-02-29'; window.dashMese = '2028-02';
}`));

guai += await scenario('a cavallo di capodanno', base(`() => {
  window.dailyRecords = [
    { id:'e1', data:'2025-12-31', tipo:'ENTRATA', categoria:'Corsa', metodo:'POS', importo:55, ora:'23:50' },
    { id:'e2', data:'2026-01-01', tipo:'ENTRATA', categoria:'Corsa', metodo:'Contanti', importo:45, ora:'00:10' }];
  window.shifts = [
    { id:'t1', data:'2025-12-31', turno:'Le otto', inizio:'20:00', fine:'04:00', ore:8, lavorato:true, kmTot:90 },
    { id:'t2', data:'2026-01-01', turno:'Le otto', inizio:'04:00', fine:'08:00', ore:4, lavorato:true, kmTot:40 }];
  window.scadenze = [{ id:'s1', nome:'Bollo', data:'2026-01-01', cadenza:'anno', ancora:'2026-01-01' }];
  window.annoScelto = '2026'; window.dashGiorno = '2026-01-01'; window.dashMese = '2026-01';
}`));

guai += await scenario("voce di budget a zero e una gia' scaduta", base(`() => {
  const o = oggiISO();
  window.vociFisse = [
    { slug:'z', nome:'Voce a zero', importo:0, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' },
    { slug:'f', nome:'Voce finita', importo:1200, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'2024-01-01', dataFine:'2024-12-31' },
    { slug:'c', nome:'Carburante', importo:0, unita:'anno', tipo:'consumo', scadenza:'', dataInizio:'', dataFine:'' }];
  window.dailyRecords = [{ id:'u1', data:o, tipo:'USCITA', categoria:'Carburante', metodo:'Bonifico', importo:70 }];
  window.annoScelto = o.slice(0,4);
}`));

guai += await scenario('testi con caratteri speciali e importi enormi', base(`() => {
  const o = oggiISO();
  window.dailyRecords = [
    { id:'e1', data:o, tipo:'ENTRATA', categoria:'Corsa «speciale» & <co>', metodo:'POS', importo:999999.99, ora:'10:00' },
    { id:'u1', data:o, tipo:'USCITA', categoria:"Carburante - l'ENI \\"grande\\"", nota:'<b>nota</b> & simboli', metodo:'Bonifico', importo:123456.78 }];
  window.shifts = [{ id:'t1', data:o, turno:'Turno «lungo»', inizio:'00:00', fine:'23:59', ore:23.98, lavorato:true, kmTot:999 }];
  window.veicoli = [{ id:'v1', modello:'Škoda «Octavia»', targa:"AB'123<CD>", anno:2021, kmIniziali:10000, prezzo:28000, inUso:true }];
  window.annoScelto = o.slice(0,4);
}`));

guai += await scenario("un solo riposo, nient'altro", base(`() => {
  const o = oggiISO();
  window.shifts = [{ id:'t1', data:o, turno:'Festivo', inizio:'', fine:'', ore:0, lavorato:false }];
  window.annoScelto = o.slice(0,4);
}`));

console.log(`\n  ${guai === 0 && !errori.length ? 'TUTTO BENE' : guai + ' PROBLEMI'} · errori JS: ${errori.length ? errori.slice(0,3).join(' | ') : 'nessuno'}`);
await b.close();
