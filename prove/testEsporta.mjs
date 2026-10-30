// I FILE CHE ESCONO DALL'APP: IL CSV E IL NOME DEL BACKUP
// Due difetti diversi, tutti e due nei file che si danno ad altri:
//   - il CSV dei movimenti va al commercialista e finisce in Excel o Numbers.
//     Una nota o una categoria che comincia con «=», «+», «-» o «@» li' viene
//     presa per una formula (e una formula in un file che gira fra uffici puo'
//     fare danni veri). L'apostrofo davanti la lascia testo. Gli importi no:
//     devono restare numeri, se no il foglio non li somma;
//   - il nome del backup e del file delle foto prendeva la data da
//     toISOString(), cioe' dall'ora di Greenwich: dopo mezzanotte in Italia il
//     file del primo gennaio usciva datato 31 dicembre dell'anno prima, e
//     cercando «il backup di stamattina» non lo si trovava.
// Orologio fermo al 1° gennaio 2027, mezzanotte e mezza ora di Roma (a
// Greenwich e' ancora il 31 dicembre 2026). I file si scaricano dai tasti
// veri della scheda Cloud e si leggono per davvero.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

let guai = 0;
const ok = (c, testo, dettaglio) => {
  if (!c) guai++;
  console.log(`  ${c ? 'ok  ' : '*** '}${testo}${dettaglio ? '  (' + dettaglio + ')' : ''}${c ? '' : ' ***'}`);
};

const ORA_FISSA = new Date('2027-01-01T00:30:00+01:00');
const GIORNO = '2027-01-01';
const mov = (id, tipo, categoria, nota, metodo, importo) =>
  ({ id, data: GIORNO, tipo, categoria, nota, metodo, importo, ora: '00:15' });
const RIGHE = [
  mov('m1', 'ENTRATA', '=SOMMA(A1:A9)', '', 'Contanti', 20),
  mov('m2', 'ENTRATA', 'Corsa', '+39 333 1234567', 'POS', 18.5),
  mov('m3', 'USCITA', '-sconto officina', '@cliente', 'Bonifico', 62.4),
  mov('m4', 'USCITA', 'Carburante', '\tcol tabulatore', 'Contanti', 0),
  mov('m5', 'ENTRATA', 'Aeroporto; Caselle', 'normale, con la virgola', 'Satispay', 45),
  mov('m6', 'USCITA', 'Pedaggio', 'a-b=c non in testa', 'Contanti', 7.1)
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true });
await p.clock.setFixedTime(ORA_FISSA);
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.evaluate((righe) => {
  localStorage.clear();
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_records', JSON.stringify(righe));
}, RIGHE);
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
ok(await p.evaluate(() => oggiISO()) === GIORNO, `per l'app oggi e' il ${GIORNO}`);
ok(await p.evaluate(() => new Date().toISOString().slice(0, 10)) === '2026-12-31', 'mentre a Greenwich e\' ancora il 31 dicembre');
await p.evaluate(() => { switchTab('cloud'); });
await p.waitForTimeout(250);

const scarica = async (selettore) => {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click(selettore)]);
  return { nome: dl.suggestedFilename(), testo: readFileSync(await dl.path(), 'utf8') };
};

// ------------------------------------------------------------------
console.log('\n1. IL CSV PER IL COMMERCIALISTA');
// ------------------------------------------------------------------
const csv = await scarica('button[onclick="exportCSV()"]');
ok(csv.nome === 'TaxiManager_Movimenti_2027.csv', 'il nome dice l\'anno giusto', csv.nome);
// Le celle sono fra virgolette e separate da «;»; le virgolette dentro si
// raddoppiano. Qui si rileggono per davvero.
const leggiCsv = (t) => t.replace(/^﻿/, '').split('\r\n').map(r => {
  const celle = []; let i = 0;
  while (i < r.length) {
    if (r[i] !== '"') { celle.push(null); break; }
    let j = i + 1, v = '';
    while (j < r.length) {
      if (r[j] === '"' && r[j + 1] === '"') { v += '"'; j += 2; continue; }
      if (r[j] === '"') break;
      v += r[j++];
    }
    celle.push(v); i = j + 2;   // chiusa e «;»
  }
  return celle;
});
const tabella = leggiCsv(csv.testo);
ok(JSON.stringify(tabella[0]) === JSON.stringify(['Data', 'Ora', 'Tipo', 'Categoria', 'Note', 'Metodo', 'Importo (EUR)']), 'l\'intestazione e\' quella di sempre', JSON.stringify(tabella[0]));
const riga = (cat) => tabella.find(r => r[3] === cat || r[3] === "'" + cat || r[3] === cat.replace(/;/g, ','));
const attese = [
  ['=SOMMA(A1:A9)', "'=SOMMA(A1:A9)", '', '20,00'],
  ['Corsa', 'Corsa', "'+39 333 1234567", '18,50'],
  ['-sconto officina', "'-sconto officina", "'@cliente", '62,40'],
  ['Carburante', 'Carburante', "'\tcol tabulatore", '0,00'],
  ['Aeroporto; Caselle', 'Aeroporto, Caselle', 'normale, con la virgola', '45,00'],
  ['Pedaggio', 'Pedaggio', 'a-b=c non in testa', '7,10']
];
for (const [cat, attesaCat, attesaNota, attesoImporto] of attese) {
  const r = riga(cat);
  ok(!!r, `c'e' la riga «${cat}»`);
  if (!r) continue;
  ok(r[3] === attesaCat, `categoria «${cat}» esce ${JSON.stringify(attesaCat)}`, JSON.stringify(r[3]));
  ok(r[4] === attesaNota, `nota ${JSON.stringify(attesaNota)}`, JSON.stringify(r[4]));
  ok(r[6] === attesoImporto, `importo ${attesoImporto}, senza apostrofo: resta un numero`, JSON.stringify(r[6]));
  ok(r[0] === GIORNO && r[1] === '00:15', 'data e ora come sono', JSON.stringify(r.slice(0, 2)));
}
ok(!tabella.slice(1).some(r => r[6] && r[6].startsWith("'")), 'nessun importo con l\'apostrofo');
ok(tabella.length === RIGHE.length + 1, `${RIGHE.length} righe piu' l'intestazione`, String(tabella.length));
// La somma degli importi del file e' quella dell'archivio: l'apostrofo non
// deve aver toccato nessun numero.
const somma = tabella.slice(1).reduce((t, r) => t + parseFloat(r[6].replace(',', '.')), 0);
ok(Math.abs(somma - RIGHE.reduce((t, r) => t + r.importo, 0)) < 0.001, 'la somma degli importi del file torna', somma.toFixed(2));

// ------------------------------------------------------------------
console.log('\n2. IL NOME DEL BACKUP CON IL GIORNO ITALIANO');
// ------------------------------------------------------------------
const bk = await scarica('button[onclick="exportBackup()"]');
ok(bk.nome === `TaxiManager_Backup_${GIORNO}.json`, `il backup delle 00:30 del primo gennaio si chiama ..._${GIORNO}.json`, bk.nome);
let pacco = null;
try { pacco = JSON.parse(bk.testo); } catch (e) { /* sotto */ }
ok(!!pacco && Array.isArray(pacco.records) && pacco.records.length === RIGHE.length, 'e dentro ci sono i movimenti', pacco ? String(pacco.records.length) : 'non si legge');

// Il file delle foto: si mette una foto dal suo tasto vero, poi si scarica.
const jpeg = 'data:image/jpeg;base64,' + Buffer.from('finta foto').toString('base64');
await p.setInputFiles('input[onchange="importFoto(event)"]', { name: 'TaxiManager_Foto.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ versione: 1, tipo: 'foto', foto: [{ id: 'f1', jpeg }] })) });
await p.waitForFunction(() => fotoTutte().then(v => v.length === 1), null, { timeout: 10000 });
await p.evaluate(() => { switchTab('cloud'); renderContent(); });
await p.waitForTimeout(400);
if (await p.locator('button[onclick="exportFoto()"]').count()) {
  const ft = await scarica('button[onclick="exportFoto()"]');
  ok(ft.nome === `TaxiManager_Foto_${GIORNO}.json`, `il file delle foto si chiama ..._${GIORNO}.json`, ft.nome);
} else {
  ok(false, 'il tasto per scaricare le foto c\'e\'');
}

await b.close();
ok(errori.length === 0, 'nessun errore JS', errori.join(' | '));
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
