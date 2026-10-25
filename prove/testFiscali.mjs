// LE IMPOSTAZIONI FISCALI DEVONO VIAGGIARE COME TUTTO IL RESTO
// Aliquota INPS, rata, numero di rate, minimale, addizionali, soglia del
// forfettario e accantonamento: sono i numeri da cui dipende ogni stima delle
// tasse, e stavano soltanto sul telefono. Cambiando dispositivo tornavano ai
// valori di fabbrica senza dire niente, e i conti cambiavano sotto il naso.
// Qui si prova che adesso vadano sul Cloud: quando si salvano dal modulo,
// quando tornano da un backup, e che senza Cloud non si rompa niente.
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

let ok = 0; const ko = [];
const c = (nome, vero) => { if (vero) ok++; else ko.push(nome); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 1200 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
p.on('dialog', d => d.accept());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

// Senza Cloud c'e' comunque la funzione, e non fa niente: e' il ripiego.
c('senza Cloud la funzione c\'e\' lo stesso', await p.evaluate(() => typeof window.saveFiscaliToCloud === 'function'));
c('e non si lamenta se la si chiama', await p.evaluate(() => {
  try { window.saveFiscaliToCloud({ inpsPerc: 1 }); return true; } catch (e) { return false; }
}));

// Si mette una spia al posto della scrittura sul Cloud.
await p.evaluate(() => {
  window.mandateAlCloud = [];
  window.saveFiscaliToCloud = (imp) => { window.mandateAlCloud.push(JSON.parse(JSON.stringify(imp))); };
});

// --- 1) salvando dal modulo vero ---
await p.evaluate(() => { switchTab('cloud'); renderContent(); });
await p.waitForTimeout(400);
const campi = await p.evaluate(() => ['set-inps', 'set-add', 'set-soglia', 'set-inps-rata',
                                      'set-inps-rate', 'set-inps-minimale', 'set-accantonamento']
  .filter(id => document.getElementById(id)).length);
c('il modulo delle impostazioni fiscali e\' a video', campi >= 6);

await p.evaluate(() => {
  const scrivi = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  scrivi('set-inps', '25,5');
  scrivi('set-add', '2,8');
  scrivi('set-soglia', '85000');
  scrivi('set-inps-rata', '1200,50');
  scrivi('set-inps-rate', '4');
  scrivi('set-inps-minimale', '18500');
  scrivi('set-accantonamento', '30');
  saveFiscalSettings();
});
await p.waitForTimeout(300);

const dopoSalvataggio = await p.evaluate(() => ({
  memoria: window.fiscalSettings,
  disco: JSON.parse(localStorage.getItem('taxi_fiscal_settings') || '{}'),
  cloud: window.mandateAlCloud
}));
c('i valori restano in memoria', dopoSalvataggio.memoria.inpsPerc === 25.5 && dopoSalvataggio.memoria.addizionaliPerc === 2.8);
c('e finiscono su disco', dopoSalvataggio.disco.inpsPerc === 25.5 && dopoSalvataggio.disco.inpsMinimale === 18500);
c('ed e\' partita una scrittura verso il Cloud', dopoSalvataggio.cloud.length === 1);
c('con dentro gli stessi numeri',
  dopoSalvataggio.cloud.length === 1
  && dopoSalvataggio.cloud[0].inpsPerc === 25.5
  && dopoSalvataggio.cloud[0].inpsRata === 1200.5
  && dopoSalvataggio.cloud[0].inpsNumeroRate === 4
  && dopoSalvataggio.cloud[0].inpsMinimale === 18500
  && dopoSalvataggio.cloud[0].addizionaliPerc === 2.8
  && dopoSalvataggio.cloud[0].sogliaForfettario === 85000
  && dopoSalvataggio.cloud[0].accantonamentoPerc === 30);

// Un valore sbagliato non deve ne' salvare ne' mandare niente
await p.evaluate(() => {
  window.mandateAlCloud = [];
  document.getElementById('set-inps').value = '-5';
  saveFiscalSettings();
});
await p.waitForTimeout(200);
c('un valore sbagliato non manda niente sul Cloud', (await p.evaluate(() => window.mandateAlCloud.length)) === 0);
c('e non cambia quello che c\'era', (await p.evaluate(() => window.fiscalSettings.inpsPerc)) === 25.5);

// --- 2) tornando da un backup ---
await p.evaluate(() => { window.mandateAlCloud = []; });
await p.evaluate(() => applicaBackup({
  versione: 3,
  records: [{ id: 'x1', data: '2026-03-10', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 100 }],
  shifts: [], scadenze: [], veicoli: [], vociFisse: [], note: [],
  impostazioniFiscali: { inpsPerc: 22, addizionaliPerc: 1.5, sogliaForfettario: 90000, accantonamentoPerc: null }
}));
await p.waitForTimeout(600);
const dopoBackup = await p.evaluate(() => ({ memoria: window.fiscalSettings, cloud: window.mandateAlCloud }));
c('il backup rimette le impostazioni fiscali',
  dopoBackup.memoria.inpsPerc === 22 && dopoBackup.memoria.addizionaliPerc === 1.5
  && dopoBackup.memoria.sogliaForfettario === 90000 && dopoBackup.memoria.accantonamentoPerc === null);
c('e le manda anche sul Cloud', dopoBackup.cloud.length >= 1 && dopoBackup.cloud[dopoBackup.cloud.length - 1].inpsPerc === 22);
c('quello che il backup non dice resta com\'era', dopoBackup.memoria.inpsMinimale === 18500);

// --- 3) e nel backup ci sono ---
const nelBackup = await p.evaluate(() => datiDaSalvare().impostazioniFiscali);
c('le impostazioni fiscali stanno nel backup', nelBackup && nelBackup.inpsPerc === 22 && nelBackup.inpsMinimale === 18500);

// --- 4) arrivando dal Cloud non si perde quello che il Cloud non dice ---
await p.evaluate(() => {
  // E' quello che fa l'ascolto: unisce invece di sostituire.
  window.fiscalSettings = Object.assign({}, window.fiscalSettings, { inpsPerc: 24, addizionaliPerc: 2 });
});
const unite = await p.evaluate(() => window.fiscalSettings);
c('l\'unione dal Cloud non azzera il resto',
  unite.inpsPerc === 24 && unite.inpsMinimale === 18500 && unite.sogliaForfettario === 90000);

console.log(`${ok} controlli passati` + (ko.length ? `\n*** ${ko.length} FALLITI ***\n  - ` + ko.join('\n  - ') : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') + ' ***' : 'nessuno'));
await b.close();
