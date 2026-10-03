// Il confronto con l'anno scorso deve guardare lo STESSO TRATTO: a ottobre
// non si paragona un anno intero con dieci mesi.
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
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1200 }, locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
let t = true;
const prova = (n, bene, extra) => { t &= bene; console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + (extra===undefined?'':extra) + ' ***'}`); };

const r = await p.evaluate(() => {
  const oggi = oggiISO();
  const A = Number(oggi.slice(0,4));          // anno in corso
  const P = A - 1;                            // anno prima
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['corsa','carburante']));
  window.vociFisse = []; window.scadenze = []; window.veicoli = [];
  const rec = [], tur = [];
  let n = 0;
  // ogni giorno dei due anni, fino a oggi (e tutto l'anno prima):
  // quest'anno 110 € al giorno, l'anno scorso 100. Deve dire +10%.
  const giro = (anno, importo, fino) => {
    for (let m = 1; m <= 12; m++) for (let g = 1; g <= 28; g++) {
      const d = `${anno}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
      if (fino && d > fino) return;
      n++;
      rec.push({ id:'e'+n, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:'POS', importo, ora:'10:00' });
      tur.push({ id:'t'+n, data:d, turno:'Le otto', inizio:'08:00', fine:'18:00', ore:10, lavorato:true, kmTot:150 });
    }
  };
  giro(P, 100, null);
  giro(A, 110, oggi);
  window.dailyRecords = rec; window.shifts = tur;
  window.annoScelto = String(A); window.versioneDati = (window.versioneDati||0)+1;
  renderContent();

  const cAnno = confrontoAnnoPrima(String(A));
  const cMese = confrontoAnnoPrima(oggi.slice(0,7));
  // il confronto deve fermarsi a oggi da tutte e due le parti
  return { oggi, A, P, cAnno, cMese,
           annoPassato: confrontoAnnoPrima(String(P)) };
});

prova(`il confronto dell'anno in corso si ferma a oggi (${r.cAnno.a})`, r.cAnno.a === r.oggi, JSON.stringify([r.cAnno.da, r.cAnno.a]));
prova(`e dall'altra parte alla stessa data dell'anno prima (${r.cAnno.aPrima})`,
      r.cAnno.aPrima === `${r.P}${r.oggi.slice(4)}`, r.cAnno.aPrima);
prova(`stesso numero di corse nei due tratti (${r.cAnno.ora.nCorse} contro ${r.cAnno.prima.nCorse})`,
      r.cAnno.ora.nCorse === r.cAnno.prima.nCorse, `${r.cAnno.ora.nCorse}/${r.cAnno.prima.nCorse}`);
prova(`incassi +10,0% (visto ${r.cAnno.incassiPerc.toFixed(1)}%)`, Math.abs(r.cAnno.incassiPerc - 10) < 0.05, String(r.cAnno.incassiPerc));
prova(`corse invariate, 0,0% (visto ${r.cAnno.corsePerc.toFixed(1)}%)`, Math.abs(r.cAnno.corsePerc) < 0.05, String(r.cAnno.corsePerc));
prova(`anche l'euro/ora sale del 10% (${r.cAnno.perOraOra.toFixed(2)} contro ${r.cAnno.perOraPrima.toFixed(2)})`,
      Math.abs(r.cAnno.perOraOra / r.cAnno.perOraPrima - 1.1) < 0.002, `${r.cAnno.perOraOra}/${r.cAnno.perOraPrima}`);
prova(`il mese in corso si ferma a oggi (${r.cMese.a})`, r.cMese.a === r.oggi, r.cMese.a);
prova(`e l'etichetta lo dice («${r.cMese.etichetta}»)`, /dal 1/.test(r.cMese.etichetta), r.cMese.etichetta);
prova(`un anno gia' chiuso si confronta per intero («${r.annoPassato ? r.annoPassato.etichetta : 'assente'}»)`,
      !r.annoPassato || /tutto il/.test(r.annoPassato.etichetta), r.annoPassato && r.annoPassato.etichetta);

// e a video
const video = await p.evaluate(() => {
  window.activeTab = 'dashboard'; window.periodoDashScelto = 'anno'; renderContent();
  return document.getElementById('main-container').innerText;
});
prova('il riquadro compare in Andamento / anno', /Rispetto all'anno scorso/i.test(video));
prova('e mostra la variazione percentuale', /\+10,0%/.test(video), video.slice(video.indexOf('Rispetto'), video.indexOf('Rispetto')+260));

// senza l'anno prima non deve comparire niente
const senza = await p.evaluate(() => {
  window.dailyRecords = window.dailyRecords.filter(r => r.data.slice(0,4) === oggiISO().slice(0,4));
  window.versioneDati = (window.versioneDati||0)+1;
  renderContent();
  return { c: confrontoAnnoPrima(oggiISO().slice(0,4)), testo: document.getElementById('main-container').innerText };
});
prova('senza dati dell\'anno prima il riquadro non compare', senza.c === null && !/Rispetto all'anno scorso/i.test(senza.testo));

console.log(`\n  ${t && !errori.length ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'} · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
