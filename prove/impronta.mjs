// L'HTML esatto di ogni schermata, con dati fissi: si salva prima di un
// rimaneggiamento e si confronta dopo. Se un byte cambia, lo vedo.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato'); process.exit(2); }
const { chromium } = await import(DOVE_PW);
import fs from 'node:fs';
const dove = process.argv[2];
if (!dove) { console.error('uso: node impronta.mjs <file di uscita>'); process.exit(1); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
await p.evaluate(() => {
  const rec = [], tur = [], met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  const cat = ['Carburante','Lavaggio','Manutenzione','Parcheggio','Ristoro','Assicurazione'];
  for (const a of [2025, 2026]) for (let m = 1; m <= 12; m++) for (const g of [3, 11, 19, 27]) {
    const d = `${a}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    tur.push({ id:`t${a}${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:180, veicolo:'v1' });
    for (let c = 0; c < 5; c++) rec.push({ id:`e${a}${m}${g}${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:met[c], importo:14+c*8, ora:'1'+c+':00' });
    rec.push({ id:`u${a}${m}${g}`, data:d, tipo:'USCITA', categoria:cat[g%6], metodo: g===3?'Contanti':'Bonifico', importo:35+g, fattura:g!==3, veicolo:'v1' });
  }
  window.dailyRecords = rec; window.shifts = tur;
  window.scadenze = [
    { id:'s1', nome:'Bollo Auto',    data:'2026-10-31', cadenza:'anno', ancora:'2026-10-31' },
    { id:'s2', nome:'Assicurazione', data:'2026-06-15', cadenza:'anno', ancora:'2026-06-15' },
    { id:'s3', nome:'Revisione',     data:'2025-04-02', cadenza:'2anni', ancora:'2025-04-02' }
  ];
  window.veicoli = [{ id:'v1', modello:'Skoda Octavia', targa:'AB123CD', anno:2021, kmIniziali:10000, prezzo:28000, inUso:true }];
  window.vociFisse = [
    { slug:'finanziamento', nome:'Finanziamento licenza', importo:797, unita:'mese', dataInizio:'', dataFine:'' },
    { slug:'radiotaxi', nome:'Radio taxi', importo:10.5, unita:'giorno', dataInizio:'', dataFine:'' },
    { slug:'assic-auto', nome:'Assicurazione auto', importo:1825, unita:'anno', dataInizio:'', dataFine:'' }
  ];
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.profilo = { nome:'Giuseppe', cognome:'Rossi', licenza:'1234', sigla:'Torino 57', piva:'12345678901', coloreTurno:'giallo' };
  window.annoScelto = '2026';
  window.incassoVisibile = true;
});
const pezzi = [];
const schede = ['giornata','dashboard','altro','uscite','categorie','scadenze','auto','rendimento','report','cloud'];
for (const t of schede) {
  await p.evaluate(x => { window.activeTab = x; renderContent(); }, t);
  await p.waitForTimeout(120);
  const h = await p.evaluate(() => document.getElementById('main-container').innerHTML);
  pezzi.push(`===== SCHEDA ${t} =====\n${h}`);
}
// e i tre periodi di Andamento, e il calendario
for (const per of ['giorno','mese','anno']) {
  await p.evaluate(x => { window.activeTab = 'dashboard'; window.periodoDashScelto = x; renderContent(); }, per);
  await p.waitForTimeout(120);
  const h = await p.evaluate(() => document.getElementById('main-container').innerHTML);
  pezzi.push(`===== DASHBOARD/${per} =====\n${h}`);
}
await p.evaluate(() => { window.activeTab = 'giornata'; setVistaGiornata('calendario'); });
await p.waitForTimeout(200);
pezzi.push('===== CALENDARIO =====\n' + await p.evaluate(() => document.getElementById('main-container').innerHTML));
// la navigazione
pezzi.push('===== NAV =====\n' + await p.evaluate(() => document.getElementById('nav-container').innerHTML));
pezzi.push('===== BARRA BASSO =====\n' + await p.evaluate(() => document.getElementById('barra-basso').innerHTML));
fs.writeFileSync(dove, pezzi.join('\n\n'));
console.log(`impronta scritta: ${dove} · ${(fs.statSync(dove).size/1024).toFixed(0)} KB · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
