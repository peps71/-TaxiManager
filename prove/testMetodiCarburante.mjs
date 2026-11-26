// I metodi nuovi e il carburante al chilometro (versione 181).
//
// 1. «App / Voucher» si divide: le corse nuove si segnano WeTaxi, Buoni o
//    Aggiunta importi, dai tasti veri della corsa veloce. Ognuno ha il suo
//    mucchio nei conti, e per le tasse sono tutti incassi tracciati (come
//    App prima: la base imponibile non cambia). Le corse vecchie «App/Nexi»
//    restano nel mucchio App, col loro nome.
// 2. Il contachilometri scritto nella nota del rifornimento: i km fatti dal
//    pieno prima e il costo al km, sulla riga, in Andamento e nel Parco auto.
//    Una nota storta non sporca le medie. E le letture buone servono anche
//    alla manutenzione programmata, che prima vedeva solo i km dei turni.
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

let storte = 0;
const ok = (bene, nome, dettaglio = '') => {
  if (!bene) storte++;
  console.log(`  ${bene ? 'ok ' : '***'} ${nome}${dettaglio && !bene ? '  -> ' + dettaglio : ''}`);
};
const vicino = (a, b) => Math.abs(a - b) < 0.0005;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
                                 locale: 'it-IT', timezoneId: 'Europe/Rome' });
await ctx.route(/^https?:\/\//, r => r.abort());
const p = await ctx.newPage();
const errori = []; p.on('pageerror', e => errori.push(String(e)));
await p.clock.setFixedTime(new Date('2026-11-20T12:00:00+01:00'));
await p.addInitScript(() => {
  if (localStorage.getItem('__seminato')) return;
  localStorage.setItem('__seminato', '1');
  localStorage.setItem('taxi_shifts', JSON.stringify([{ id: 't1', data: '2026-11-20', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12 }]));
  localStorage.setItem('taxi_veicoli', JSON.stringify([{ id: 'v1', modello: 'Corolla', targa: 'AB123CD', dataAcquisto: '2025-01-01', kmAcquisto: '100000' }]));
  localStorage.setItem('taxi_records', JSON.stringify([
    { id: 'vecchia', data: '2026-11-03', tipo: 'ENTRATA', categoria: 'Corsa #1', metodo: 'App/Nexi', importo: 40 },
    { id: 'f1', data: '2026-11-02', tipo: 'USCITA', categoria: 'Carburante', metodo: 'POS', importo: 60, nota: 'km 152.340' },
    { id: 'f2', data: '2026-11-05', tipo: 'USCITA', categoria: 'Carburante', metodo: 'POS', importo: 30, nota: 'rabbocco 20 litri a 1,799' },
    { id: 'f3', data: '2026-11-08', tipo: 'USCITA', categoria: 'Carburante - Gasolio', metodo: 'Contanti', importo: 65, nota: '152.990 km, 45 litri' },
    { id: 'f4', data: '2026-11-12', tipo: 'USCITA', categoria: 'Carburante', metodo: 'POS', importo: 70, nota: '1529900' },
    { id: 'f5', data: '2026-11-15', tipo: 'USCITA', categoria: 'Carburante', metodo: 'POS', importo: 72, nota: 'contachilometri 153 610' }
  ]));
});
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
await p.waitForTimeout(500);

console.log('\n  A) i tre tasti nuovi della corsa veloce');
await p.evaluate(() => switchTab('giornata'));
await p.waitForTimeout(300);
const tasti = await p.evaluate(() => [...document.querySelectorAll('[data-scheda-corsa] .tasto-metodo')].map(t => t.textContent.trim()));
ok(JSON.stringify(tasti) === JSON.stringify(['Contanti', 'POS', 'Satispay', 'WeTaxi', 'Buoni', 'Aggiunta importi']),
   'sei tasti: Contanti, POS, Satispay, WeTaxi, Buoni, Aggiunta importi', JSON.stringify(tasti));
const imponibilePrima = await p.evaluate(() => { const st = getStats(); return st.entrateTracciateCorse; }).catch(() => null);
for (const [imp, met] of [['20', 'WeTaxi'], ['15', 'Buoni'], ['5', 'Aggiunta importi']]) {
  await p.fill('#corsa-lampo', imp);
  await p.click(`button[onclick="corsaLampo('${met}')"]`);
  await p.waitForTimeout(250);
}
const corse = await p.evaluate(() => dailyRecords.filter(r => r.tipo === 'ENTRATA').map(r => r.metodo + ':' + r.importo).sort());
ok(JSON.stringify(corse) === JSON.stringify(['Aggiunta importi:5', 'App/Nexi:40', 'Buoni:15', 'WeTaxi:20']),
   'le corse si salvano col loro metodo, la vecchia resta App/Nexi', JSON.stringify(corse));
const agg = await p.evaluate(() => { const a = aggrega('2026-11'); return { incassi: a.incassi, wetaxi: a.wetaxi, buoni: a.buoni, aggiunta: a.aggiunta, app: a.app,
  somma: a.contanti + a.pos + a.satispay + a.app + a.conto + a.wetaxi + a.buoni + a.aggiunta }; });
ok(agg.wetaxi === 20 && agg.buoni === 15 && agg.aggiunta === 5 && agg.app === 40, 'ognuno nel suo mucchio, App solo la vecchia', JSON.stringify(agg));
ok(agg.somma === agg.incassi, 'i mucchi sommano il totale degli incassi', JSON.stringify(agg));
const fam = await p.evaluate(() => ['WeTaxi', 'Buoni', 'Aggiunta importi', 'App/Nexi'].map(m => famigliaMetodo(m) + ':' + metodoTracciato(m)));
ok(JSON.stringify(fam) === JSON.stringify(['WeTaxi:true', 'Buoni:true', 'Aggiunta:true', 'App:true']),
   'per le tasse sono tutti tracciati, come App prima', JSON.stringify(fam));
const imponibileDopo = await p.evaluate(() => { const st = getStats(); return st.entrateTracciateCorse; }).catch(() => null);
if (imponibilePrima !== null && imponibileDopo !== null) {
  ok(vicino(imponibileDopo - imponibilePrima, 40), 'le tre corse entrano nella base tracciata: +40', `${imponibilePrima} -> ${imponibileDopo}`);
}
const modifica = await p.evaluate(() => opzioniMetodo('App/Nexi', 'ENTRATA'));
ok(/value="WeTaxi"/.test(modifica) && /value="Buoni"/.test(modifica) && /value="Aggiunta importi"/.test(modifica),
   'la modifica di una corsa offre i metodi nuovi');
ok(/value="App\/Nexi" selected>App \/ Voucher \(come l'avevi segnato\)/.test(modifica),
   'e una corsa vecchia tiene «App / Voucher», senza cambiare da sola', modifica.slice(-160));

console.log('\n  B) il contachilometri nella nota');
const note = await p.evaluate(() => ['km 152340', '152.340', '152 340 km', '45 litri', '1,799 €/l', 'pieno 2026 km 98765', '', null]
  .map(n => kmDallaNota(n)));
ok(JSON.stringify(note) === JSON.stringify([152340, 152340, 152340, null, null, 98765, null, null]),
   'legge «km 152340», «152.340», «152 340 km»; ignora litri e prezzo; preferisce il numero vicino a «km»', JSON.stringify(note));
const el = await p.evaluate(() => Object.fromEntries(rifornimentiCarburante().elenco.map(x => [x.id, x])));
ok(el.f1.problema === 'primo' && el.f1.kmFatti === null, 'il primo coi km non ha un costo: il conto parte dal prossimo');
ok(el.f3.kmFatti === 650 && el.f3.spesa === 95 && vicino(el.f3.euroKm, 95 / 650),
   'il rabbocco senza km entra nel pieno dopo: 95 € su 650 km', JSON.stringify(el.f3));
ok(el.f4.problema === 'troppi' && !el.f4.buono, 'una cifra in piu\' («1529900») e\' da controllare, non conta');
ok(el.f5.kmFatti === 620 && vicino(el.f5.euroKm, 72 / 620), 'e il pieno dopo riparte dall\'ultima lettura buona', JSON.stringify(el.f5));
const media = await p.evaluate(() => carburanteAlKm('2026-11-01', '2026-11-30'));
ok(media.km === 1270 && media.spesa === 167 && vicino(media.euroKm, 167 / 1270), 'la media del mese: 167 € su 1.270 km', JSON.stringify(media));
const kmMax = await p.evaluate(() => kmMassimoNelPeriodo('2025-01-01', '2026-11-30'));
ok(kmMax === 153610, 'la manutenzione vede il contachilometri delle note (senza la cifra storta)', String(kmMax));

console.log('\n  C) a video');
await p.evaluate(() => applyFilterGiornoGiornate('2026-11-08'));
await p.waitForTimeout(300);
let t = await p.evaluate(() => document.getElementById('main-container').innerText);
ok(/650 km dal pieno prima · 0,146 €\/km/.test(t), 'sulla riga del rifornimento: «650 km dal pieno prima · 0,146 €/km»');
await p.evaluate(() => applyFilterGiornoGiornate('2026-11-12'));
await p.waitForTimeout(300);
t = await p.evaluate(() => document.getElementById('main-container').innerText);
ok(/controlla la nota/.test(t), 'sulla riga storta: «controlla la nota»');
await p.evaluate(() => { switchTab('dashboard'); cambiaPeriodoDash('mese'); setDashMese('2026-11'); });
await p.waitForTimeout(400);
t = await p.evaluate(() => document.getElementById('main-container').innerText);
ok(/CARBURANTE AL CHILOMETRO[\s\S]*0,131 €\/km[\s\S]*1\.270 km/.test(t), 'in Andamento: la media del mese e dell\'anno');
await p.evaluate(() => switchTab('auto'));
await p.waitForTimeout(400);
t = await p.evaluate(() => document.getElementById('main-container').innerText);
ok(/Carburante: 0,131 €\/km/.test(t), 'nel Parco auto: il carburante al km della vettura');
ok(errori.length === 0, 'nessun errore JS', errori.join(' | '));

await b.close();
console.log(`\n  ${storte === 0 ? 'TUTTO BENE' : storte + ' COSE NON TORNANO'}`);
process.exit(storte ? 1 : 0);
