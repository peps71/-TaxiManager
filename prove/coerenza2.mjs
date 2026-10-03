// SECONDO GIRO DI COERENZA
// getReportStats rifa' da capo l'aggregazione che fa gia' aggregaCalcola:
// due strade per lo stesso numero, e vanno confrontate. Piu' le auto e il
// rendimento, che la prima tornata non aveva toccato.
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
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = '2026';
const d = await p.evaluate((anno) => {
  const rec = [], tur = [];
  const met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  const cat = ['Carburante','Lavaggio','Manutenzione','Parcheggio / Pedaggio','Ristoro','Assicurazione','Bollo / Tasse auto'];
  const metS = ['Contanti','Bonifico','Carta Carburante','Conto'];
  let n = 0, km = 42000;
  for (let m = 1; m <= 12; m++) for (let g = 1; g <= 28; g++) {
    if (g % 7 === 0) continue;
    const dd = `${anno}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    const kmG = 150 + (g % 50);
    tur.push({ id:`t${m}${g}`, data:dd, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:11 + (g%3), lavorato:true, kmTot:kmG, kmIni:km, kmFine:km+kmG });
    km += kmG;
    for (let c = 0; c < 4 + (g%3); c++) { n++; rec.push({ id:`e${n}`, data:dd, tipo:'ENTRATA', categoria:'Corsa', metodo:met[(g+c)%5], importo: 12+((g*3+c*5)%44), ora:'10:00' }); }
    if (g % 3 === 0) { n++; rec.push({ id:`u${n}`, data:dd, tipo:'USCITA', categoria:cat[(g+m)%7], metodo:metS[(g+m)%4], importo: 20+((g*7)%80) }); }
  }
  window.dailyRecords = rec; window.shifts = tur;
  window.veicoli = [{ id:'v1', modello:'Skoda Octavia', targa:'AB123CD', inUso:true,
                      dataAcquisto:`${anno}-01-01`, kmAcquisto:42000, prezzoAcquisto:28000, valoreStimato:19000 }];
  window.vociFisse = []; localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.scadenze = []; window.annoScelto = anno;
  window.versioneDati = (window.versioneDati||0)+1;
  renderContent();

  const a = aggrega(anno);
  const rep = getReportStats('ALL');
  const st = getStats();
  const sv = statsVeicolo(window.veicoli[0]);
  // e il report mese per mese deve ricomporre l'anno
  let rm = { incassi:0, uscite:0, corse:0, km:0, ore:0, carburante:0, manutenzione:0, altro:0,
             pos:0, contanti:0, satispay:0, app:0, conto:0 };
  for (let m = 1; m <= 12; m++) {
    const x = getReportStats(String(m));
    rm.incassi += x.incassiTot; rm.uscite += x.usciteTot; rm.corse += x.countCorse;
    rm.km += x.kmTot; rm.ore += x.oreTot;
    rm.carburante += x.carburante; rm.manutenzione += x.manutenzione; rm.altro += x.altro;
    rm.pos += x.pos; rm.contanti += x.contanti; rm.satispay += x.satispay; rm.app += x.app; rm.conto += x.conto;
  }
  return { a: { incassi:a.incassi, uscite:a.uscite, nCorse:a.nCorse, ore:a.ore,
                contanti:a.contanti, pos:a.pos, satispay:a.satispay, app:a.app, conto:a.conto,
                carburante:a.carburante, manutenzione:a.manutenzione, altroSpese:a.altroSpese },
           rep, st, sv, rm,
           kmGrezzi: tur.reduce((t,x)=>t+x.kmTot,0),
           oreGrezze: tur.reduce((t,x)=>t+x.ore,0) };
}, ANNO);

let ok = 0, ko = [];
const c = (n, x, y) => { Math.abs(x - y) < 0.02 ? ok++ : ko.push(`${n}: ${x.toFixed(2)} contro ${y.toFixed(2)}`); };

console.log('  --- il report del commercialista contro il resto dell\'app ---');
c('incassi: report contro aggrega', d.rep.incassiTot, d.a.incassi);
c('uscite: report contro aggrega', d.rep.usciteTot, d.a.uscite);
c('corse: report contro aggrega', d.rep.countCorse, d.a.nCorse);
c('ore: report contro aggrega', d.rep.oreTot, d.a.ore);
c('contanti: report contro aggrega', d.rep.contanti, d.a.contanti);
c('POS: report contro aggrega', d.rep.pos, d.a.pos);
c('Satispay: report contro aggrega', d.rep.satispay, d.a.satispay);
c('App: report contro aggrega', d.rep.app, d.a.app);
c('Conto: report contro aggrega', d.rep.conto, d.a.conto);
c('carburante: report contro aggrega', d.rep.carburante, d.a.carburante);
c('manutenzione: report contro aggrega', d.rep.manutenzione, d.a.manutenzione);
c('altre spese: report contro aggrega', d.rep.altro, d.a.altroSpese);
c('utile fiscale: report contro getStats', d.rep.utileFiscale, d.st.utileFiscale);
c('utile di cassa: report contro getStats', d.rep.utileLordo, d.st.utileCassa);
c('tasse: report contro getStats', d.rep.stimaTasse, d.st.tasse);
c('netto: report contro getStats', d.rep.nettoStimato, d.st.netto);

console.log('  --- il report mese per mese deve ricomporre l\'anno ---');
c('incassi: 12 mesi contro ALL', d.rm.incassi, d.rep.incassiTot);
c('uscite: 12 mesi contro ALL', d.rm.uscite, d.rep.usciteTot);
c('corse: 12 mesi contro ALL', d.rm.corse, d.rep.countCorse);
c('km: 12 mesi contro ALL', d.rm.km, d.rep.kmTot);
c('ore: 12 mesi contro ALL', d.rm.ore, d.rep.oreTot);
c('carburante: 12 mesi contro ALL', d.rm.carburante, d.rep.carburante);
c('manutenzione: 12 mesi contro ALL', d.rm.manutenzione, d.rep.manutenzione);
c('altre: 12 mesi contro ALL', d.rm.altro, d.rep.altro);
c('metodi: 12 mesi contro ALL', d.rm.pos+d.rm.contanti+d.rm.satispay+d.rm.app+d.rm.conto, d.rep.incassiTot);

console.log('  --- km, ore e le medie ---');
c('km del report contro la somma dei turni', d.rep.kmTot, d.kmGrezzi);
c('ore del report contro la somma dei turni', d.rep.oreTot, d.oreGrezze);
c('euro/ora = incassi / ore', d.rep.mediaOra, d.rep.incassiTot / d.rep.oreTot);
c('euro/km = incassi / km', d.rep.mediaKm, d.rep.incassiTot / d.rep.kmTot);
c('costo/km = uscite / km', d.rep.costoKm, d.rep.usciteTot / d.rep.kmTot);
c('carburante + manutenzione + altre = uscite', d.rep.carburante + d.rep.manutenzione + d.rep.altro, d.rep.usciteTot);

console.log('  --- la vettura ---');
c('km percorsi = finali - acquisto', d.sv.kmPercorsi, d.sv.kmFinali - d.sv.kmAcq);
c('perdita = prezzo - valore stimato', d.sv.perdita, d.sv.prezzoAcq - d.sv.valoreFinale);
c('costo totale = perdita + spese', d.sv.costoTot, d.sv.perdita + d.sv.speseTot);
c('costo/km = perdita/km + spese/km', d.sv.costoKm, d.sv.perditaKm + d.sv.speseKm);
c('le categorie sommano alle spese della vettura', d.sv.categorie.reduce((t,x)=>t+x.totale,0), d.sv.speseTot);
c('spese/km = spese / km percorsi', d.sv.speseKm, d.sv.speseTot / d.sv.kmPercorsi);

console.log(`\n  ${ko.length ? ko.length + ' INCOERENZE' : 'nessuna incoerenza'} · ${ok} controlli passati`);
ko.forEach(x => console.log('   *** ' + x));
console.log('  errori JS:', errori.length ? errori : 'nessuno');
await b.close();
