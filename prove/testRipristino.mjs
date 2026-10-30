// PRIMA DI RIMETTERE UN BACKUP, SI DICE COSA SUCCEDE
// Il ripristino unisce per identificativo: una riga del backup che c'e'
// anche adesso prende il posto di quella di adesso, una che adesso non c'e'
// torna. Le correzioni fatte dopo il backup tornano quindi indietro, e le
// righe cancellate dopo ricompaiono - senza che nessuno l'avesse detto: un
// tocco sul file sbagliato e i conti di settimane tornavano vecchi.
// Qui si usa il tasto vero (il campo «Scegli un file di backup») e si guarda:
//   - la domanda c'e', comincia con «Il backup», finisce con «Continuare?», e
//     i conti che dice sono quelli giusti (righe nel backup, righe adesso,
//     quante tornerebbero com'erano), al plurale e al singolare;
//   - rispondendo no l'archivio resta identico, byte per byte, e lo si dice;
//   - rispondendo si' il ripristino e' quello di prima (unisce, non cancella);
//   - le impostazioni fiscali: rata, numero delle rate e minimale INPS
//     stavano nel backup ma non rientravano (su un telefono nuovo tornavano
//     i valori di fabbrica e cambiava il conto dei contributi); un backup
//     vecchio che non li ha lascia quelli di adesso;
//   - un file oltre BACKUP_FILE_MAX (50 MB) non si legge nemmeno: leggerlo
//     intero blocca il telefono. Non si puo' abbassare la soglia dalla prova
//     (e' una const del copione), quindi si usa un file vero: uno sparso da
//     60 MB, che sul disco non pesa niente, e uno valido di 50 MB esatti per
//     il bordo;
//   - le foto da file: un identificativo storto o una foto piu' pesante di
//     quelle che l'app produce si scartano.
// Le date con il fuso di casa (la domanda dice «del 01/03/2026»).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdtempSync, writeFileSync, openSync, ftruncateSync, closeSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

// L'archivio di adesso: cinque movimenti, due turni, impostazioni INPS
// diverse da quelle di fabbrica.
const corsa = (id, data, importo) => ({ id, data, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo, ora: '10:00' });
const turno = (id, data) => ({ id, data, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 180 });
const ADESSO = {
  records: [corsa('r1', '2026-02-10', 20), corsa('r2', '2026-02-11', 35), corsa('r3', '2026-02-12', 18),
            corsa('r4', '2026-03-02', 40), corsa('r5', '2026-03-03', 22)],
  shifts: [turno('s1', '2026-02-10'), turno('s2', '2026-03-02')],
  fiscali: { inpsPerc: 24, inpsRata: 1000, inpsNumeroRate: 4, inpsMinimale: 18000,
             addizionaliPerc: 2, sogliaForfettario: 85000, accantonamentoPerc: null }
};
// Il backup del primo marzo: r1 e r3 uguali, r2 corretta dopo (nel backup
// vale 30), r6 cancellata dopo, e una riga con l'id storto che il ripristino
// scarta. Turni: s1 uguale, s3 cancellato dopo.
const BACKUP = {
  versione: 3, date: '2026-03-01T10:00:00.000Z',
  records: [corsa('r1', '2026-02-10', 20), corsa('r2', '2026-02-11', 30), corsa('r3', '2026-02-12', 18),
            corsa('r6', '2026-02-20', 55), corsa("r'7", '2026-02-21', 99)],
  shifts: [turno('s1', '2026-02-10'), turno('s3', '2026-02-20')],
  scadenze: [], veicoli: [], vociFisse: [], note: [], versamenti: [],
  impostazioniFiscali: { inpsPerc: 24, inpsRata: 1234.56, inpsNumeroRate: 3, inpsMinimale: 19000.5,
                         addizionaliPerc: 2, sogliaForfettario: 85000, accantonamentoPerc: null },
  profilo: null
};

const b = await chromium.launch();
let risposta = 'accept';
let domande = [];
const errori = [];
async function apri() {
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await p.clock.setFixedTime(new Date('2026-03-11T12:00:00+01:00'));
  p.on('pageerror', e => errori.push(String(e)));
  p.on('dialog', d => { domande.push(d.message()); return risposta === 'accept' ? d.accept() : d.dismiss(); });
  await p.goto(APP);
  await p.evaluate((a) => {
    localStorage.clear();
    localStorage.setItem('taxi_voci_fisse_avviato', 'si');
    localStorage.setItem('taxi_records', JSON.stringify(a.records));
    localStorage.setItem('taxi_shifts', JSON.stringify(a.shifts));
    localStorage.setItem('taxi_fiscal_settings', JSON.stringify(a.fiscali));
  }, ADESSO);
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(() => { switchTab('cloud'); });
  await p.waitForTimeout(250);
  return p;
}
// Tutto quello che il ripristino puo' toccare, in memoria e su disco.
const fotografia = p => p.evaluate(() => JSON.stringify({
  rec: window.dailyRecords, tur: window.shifts, fis: window.fiscalSettings,
  disco: ['taxi_records', 'taxi_shifts', 'taxi_fiscal_settings', 'taxi_scadenze', 'taxi_veicoli', 'taxi_note']
    .map(k => localStorage.getItem(k))
}));
const toast = p => p.evaluate(() => (document.getElementById('toast-text') || {}).textContent || '');
const CAMPO = 'input[onchange="importBackup(event)"]';
const carica = async (p, oggetto, nome = 'TaxiManager_Backup_2026-03-01.json') => {
  await p.setInputFiles(CAMPO, { name: nome, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oggetto)) });
  await p.waitForTimeout(600);
};

// ------------------------------------------------------------------
console.log('\n1. LA DOMANDA DICE QUELLO CHE SUCCEDERA\'');
// ------------------------------------------------------------------
let p = await apri();
ok(await p.locator(CAMPO).count() === 1, 'il campo del backup c\'e\' nella scheda Cloud');
const prima = await fotografia(p);
domande = []; risposta = 'dismiss';
await carica(p, BACKUP);
const ATTESA = 'Il backup del 01/03/2026 contiene 4 movimenti e 2 turni. Adesso ne hai 5 e 2.\n\n'
  + 'Ripristinando, 2 movimenti e 1 turno cambiati o cancellati dopo quella data tornano com\'erano nel backup.\n\n'
  + 'Continuare?';
ok(domande.length === 1, 'scegliendo il file, una domanda', JSON.stringify(domande));
const d0 = domande[0] || '';
ok(d0.startsWith('Il backup'), 'comincia con «Il backup»', JSON.stringify(d0.slice(0, 40)));
ok(d0.endsWith('Continuare?'), 'finisce con «Continuare?»', JSON.stringify(d0.slice(-40)));
ok(/contiene 4 movimenti e 2 turni/.test(d0), 'conta le righe buone del backup (la riga con l\'id storto no)');
ok(/Adesso ne hai 5 e 2/.test(d0), 'e quelle di adesso');
ok(/2 movimenti e 1 turno cambiati o cancellati/.test(d0), 'e quante tornerebbero com\'erano (r2 corretta, r6 e s3 cancellati)');
ok(d0 === ATTESA, 'testo intero come previsto', JSON.stringify(d0));

console.log('\n2. RISPONDENDO NO NON CAMBIA NIENTE');
const dopoNo = await fotografia(p);
ok(dopoNo === prima, 'archivio identico, in memoria e su disco');
ok((await toast(p)) === 'Ripristino annullato: non ho cambiato niente.', 'e lo dice', JSON.stringify(await toast(p)));
// A video: la corsa corretta dopo il backup vale ancora 35.
await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); applyFilterGiornoGiornate('2026-02-11'); window.incassoVisibile = true; renderContent(); });
await p.waitForTimeout(300);
const video = await p.evaluate(() => document.getElementById('main-container').innerText);
ok(/35,00/.test(video) && !/30,00/.test(video), 'a video la corsa dell\'11 febbraio vale ancora 35,00', video.slice(0, 120).replace(/\n/g, ' '));

console.log('\n3. RISPONDENDO SI\' SI RIPRISTINA COME PRIMA');
await p.evaluate(() => { switchTab('cloud'); });
await p.waitForTimeout(200);
domande = []; risposta = 'accept';
await carica(p, BACKUP);
ok(domande.length === 1 && domande[0] === ATTESA, 'la stessa domanda', JSON.stringify(domande));
const dopoSi = await p.evaluate(() => ({
  rec: Object.fromEntries((window.dailyRecords || []).map(r => [r.id, r.importo])),
  tur: (window.shifts || []).map(t => t.id).sort(),
  fis: window.fiscalSettings,
  disco: JSON.parse(localStorage.getItem('taxi_fiscal_settings') || '{}')
}));
ok(dopoSi.rec.r2 === 30, 'r2 torna com\'era nel backup (30)', JSON.stringify(dopoSi.rec));
ok(dopoSi.rec.r6 === 55, 'r6 cancellata dopo il backup ricompare');
ok(dopoSi.rec.r4 === 40 && dopoSi.rec.r5 === 22, 'r4 e r5 nate dopo il backup restano: il ripristino non cancella');
ok(!("r'7" in dopoSi.rec), 'la riga con l\'id storto non entra');
ok(JSON.stringify(dopoSi.tur) === JSON.stringify(['s1', 's2', 's3']), 'i turni: s1, s2, s3', JSON.stringify(dopoSi.tur));
ok(dopoSi.fis.inpsRata === 1234.56, 'la rata INPS rientra dal backup', String(dopoSi.fis.inpsRata));
ok(dopoSi.fis.inpsNumeroRate === 3, 'il numero delle rate rientra', String(dopoSi.fis.inpsNumeroRate));
ok(dopoSi.fis.inpsMinimale === 19000.5, 'il minimale rientra', String(dopoSi.fis.inpsMinimale));
ok(dopoSi.disco.inpsRata === 1234.56 && dopoSi.disco.inpsNumeroRate === 3 && dopoSi.disco.inpsMinimale === 19000.5,
   'e sono salvate su disco', JSON.stringify(dopoSi.disco));
// Lette a video, nel modulo delle impostazioni della scheda Cloud.
await p.evaluate(() => { switchTab('cloud'); });
await p.waitForTimeout(250);
const campi = await p.evaluate(() => ({
  rata: (document.getElementById('set-inps-rata') || {}).value,
  rate: (document.getElementById('set-inps-rate') || {}).value,
  minimale: (document.getElementById('set-inps-minimale') || {}).value,
  attesaRata: importoScritto(1234.56), attesoMinimale: importoScritto(19000.5)
}));
ok(campi.rata === campi.attesaRata, `a video la rata e' ${campi.attesaRata}`, campi.rata);
ok(campi.rate === '3', 'a video le rate sono 3', campi.rate);
ok(campi.minimale === campi.attesoMinimale, `a video il minimale e' ${campi.attesoMinimale}`, campi.minimale);
// Rimettere lo stesso backup adesso non cambia niente, e la domanda lo dice.
domande = []; risposta = 'dismiss';
await carica(p, BACKUP);
ok(/nessun movimento e nessun turno di adesso cambia/.test(domande[0] || ''), 'rimettendolo subito: «nessun movimento e nessun turno di adesso cambia»', JSON.stringify(domande[0]));
await p.close();

// ------------------------------------------------------------------
console.log('\n4. UN BACKUP VECCHIO, SENZA I CAMPI INPS');
// ------------------------------------------------------------------
p = await apri();
domande = []; risposta = 'accept';
const vecchio = { records: [corsa('r1', '2026-02-10', 20)], shifts: [turno('s9', '2026-02-15')],
                  impostazioniFiscali: { inpsPerc: 25, addizionaliPerc: 2, sogliaForfettario: 85000 } };
await carica(p, vecchio);
const d1 = domande[0] || '';
ok(d1 === 'Il backup contiene 1 movimento e 1 turno. Adesso ne hai 5 e 2.\n\n'
        + 'Ripristinando, 1 turno cambiato o cancellato dopo il backup torna com\'era nel backup.\n\nContinuare?',
   'senza data e al singolare: «Il backup contiene 1 movimento e 1 turno», «dopo il backup», «torna com\'era»', JSON.stringify(d1));
const f = await p.evaluate(() => window.fiscalSettings);
ok(f.inpsPerc === 25, 'la percentuale che c\'e\' nel backup rientra', String(f.inpsPerc));
ok(f.inpsRata === 1000 && f.inpsNumeroRate === 4 && f.inpsMinimale === 18000,
   'rata, rate e minimale restano quelli di adesso (non quelli di fabbrica)', JSON.stringify(f));
// E senza nessuna impostazione nel file.
await carica(p, { records: [], shifts: [] });
const f2 = await p.evaluate(() => window.fiscalSettings);
ok(f2.inpsRata === 1000 && f2.inpsNumeroRate === 4 && f2.inpsMinimale === 18000, 'un backup senza impostazioni non le tocca', JSON.stringify(f2));
// Valori assurdi da un file confezionato male: fuori.
await carica(p, { records: [], shifts: [], impostazioniFiscali: { inpsRata: -5, inpsNumeroRate: 'tante', inpsMinimale: 1e12 } });
const f3 = await p.evaluate(() => window.fiscalSettings);
ok(f3.inpsRata === 1000 && f3.inpsNumeroRate === 4 && f3.inpsMinimale === 18000, 'rata negativa, rate in lettere, minimale assurdo: scartati', JSON.stringify(f3));
await p.close();

// ------------------------------------------------------------------
console.log('\n5. IL FILE TROPPO PESANTE NON SI LEGGE');
// ------------------------------------------------------------------
const cartella = mkdtempSync(join(tmpdir(), 'taxi-ripristino-'));
try {
  p = await apri();
  // Si contano le letture: un file scartato non deve nemmeno arrivare al FileReader.
  await p.evaluate(() => {
    window.__letture = 0;
    const Vero = window.FileReader;
    window.FileReader = function () { window.__letture++; return new Vero(); };
  });
  const grosso = join(cartella, 'enorme.json');
  const fd = openSync(grosso, 'w'); ftruncateSync(fd, 60 * 1024 * 1024); closeSync(fd);   // sparso: non occupa disco
  const primaG = await fotografia(p);
  domande = []; risposta = 'accept';
  await p.setInputFiles(CAMPO, grosso);
  await p.waitForTimeout(800);
  const t = await toast(p);
  ok(t === 'Il file pesa 60 MB: troppo per un backup di TaxiManager (al massimo 50 MB). Controlla di aver scelto il file giusto.',
     'un file da 60 MB: «Il file pesa 60 MB...»', JSON.stringify(t));
  ok(await p.evaluate(() => document.getElementById('toast').classList.contains('messaggio-avviso')), 'detto come avviso');
  ok(await p.evaluate(() => window.__letture) === 0, 'e il file non si legge nemmeno', String(await p.evaluate(() => window.__letture)));
  ok(domande.length === 0, 'nessuna domanda', JSON.stringify(domande));
  ok(await fotografia(p) === primaG, 'archivio identico');
  ok(await p.evaluate(s => document.querySelector(s).value, CAMPO) === '', 'il campo si svuota: lo stesso file si puo\' riscegliere');

  // Il bordo: un backup valido di 50 MB esatti si legge ancora.
  const giusto = join(cartella, 'al-limite.json');
  const testo = JSON.stringify({ records: [corsa('r8', '2026-02-25', 12)], shifts: [] });
  writeFileSync(giusto, testo + ' '.repeat(50 * 1024 * 1024 - Buffer.byteLength(testo)));
  domande = []; risposta = 'dismiss';
  await p.setInputFiles(CAMPO, giusto);
  await p.waitForFunction(() => window.__letture > 0, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.__letture) === 1, 'un backup di 50 MB esatti si legge', String(await p.evaluate(() => window.__letture)));
  ok(domande.length === 1 && /contiene 1 movimento e 0 turni/.test(domande[0]), 'e chiede conferma come gli altri', JSON.stringify(domande));
  await p.close();
} finally {
  rmSync(cartella, { recursive: true, force: true });
}

// ------------------------------------------------------------------
console.log('\n6. LE FOTO DA FILE: SOLO QUELLE NOSTRE');
// ------------------------------------------------------------------
p = await apri();
const CAMPO_FOTO = 'input[onchange="importFoto(event)"]';
const jpeg = 'data:image/jpeg;base64,' + Buffer.from('finta foto').toString('base64');
const quanteFoto = () => p.evaluate(() => fotoTutte().then(v => v.length));
for (const [nome, foto] of [
  ['id con l\'apice', { id: "f'1", jpeg }],
  ['id con un tag', { id: 'f<img src=x>', jpeg }],
  ['foto oltre il doppio del peso massimo', { id: 'fgrossa', jpeg: 'data:image/jpeg;base64,' + 'A'.repeat(260 * 1024 * 2 + 10) }]
]) {
  await p.setInputFiles(CAMPO_FOTO, { name: 'TaxiManager_Foto.json', mimeType: 'application/json',
                                      buffer: Buffer.from(JSON.stringify({ versione: 1, tipo: 'foto', foto: [foto] })) });
  await p.waitForTimeout(600);
  ok(await quanteFoto() === 0, `${nome}: scartata`, String(await quanteFoto()));
  ok((await toast(p)) === 'Nel file non c\'e\' nessuna foto valida.', '  e lo dice', JSON.stringify(await toast(p)));
}
await p.setInputFiles(CAMPO_FOTO, { name: 'TaxiManager_Foto.json', mimeType: 'application/json',
                                    buffer: Buffer.from(JSON.stringify({ versione: 1, tipo: 'foto', foto: [{ id: 'fbuona-1', jpeg }] })) });
await p.waitForFunction(() => fotoTutte().then(v => v.length === 1), null, { timeout: 10000 }).catch(() => {});
ok(await quanteFoto() === 1, 'una foto nostra entra', String(await quanteFoto()));
await p.close();

await b.close();
ok(errori.length === 0, 'nessun errore JS', errori.join(' | '));
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
