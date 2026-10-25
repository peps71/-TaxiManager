// UNA SOLA BASE IMPONIBILE
// La cifra su cui si stimano le tasse la chiedono quattro schermate diverse, e
// per quattro versioni l'hanno calcolata in quattro modi. Finche' le quattro
// copie dicono la stessa cosa non se ne accorge nessuno: il guaio arriva il
// giorno in cui se ne cambia una sola - ed e' successo, con i versamenti di
// contanti (versione 153).
//
// Adesso il conto si fa in un posto solo, baseImponibile(). Questa prova
// controlla che TUTTE le strade ci passino davvero, e lo fa con dati a caso:
// una divergenza si nasconde dietro i numeri tondi, non dietro quelli storti.
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
const vicino = (a, b) => Math.abs(a - b) < 0.005;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 1200 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = String(new Date().getFullYear());

// Dieci archivi diversi, ognuno con il suo seme: se una strada diverge dalle
// altre, con dieci tentativi si vede.
for (let giro = 0; giro < 10; giro++) {
  const r = await p.evaluate(({ anno, seme }) => {
    let s = seme;
    const caso = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const METODI = ['Contanti', 'POS', 'Satispay', 'App', 'Conto', 'Bonifico', ''];
    const rec = [], vers = [];
    for (let i = 0; i < 400; i++) {
      const mese = String(1 + Math.floor(caso() * 12)).padStart(2, '0');
      const gg = String(1 + Math.floor(caso() * 28)).padStart(2, '0');
      rec.push({ id: 'r' + i, data: `${anno}-${mese}-${gg}`,
        tipo: caso() < 0.7 ? 'ENTRATA' : 'USCITA', categoria: 'Corsa',
        metodo: METODI[Math.floor(caso() * METODI.length)],
        importo: Math.round(caso() * 20000) / 100 });
    }
    for (let i = 0; i < 15; i++) {
      const mese = String(1 + Math.floor(caso() * 12)).padStart(2, '0');
      vers.push({ id: 'v' + i, data: `${anno}-${mese}-15`, importo: Math.round(caso() * 50000) / 100 });
    }
    window.dailyRecords = rec; window.versamenti = vers;
    window.shifts = []; window.scadenze = []; window.veicoli = []; window.vociFisse = []; window.note = [];
    window.annoScelto = anno;
    window.versioneDati = (window.versioneDati || 0) + 1;

    const base = baseImponibile(anno);
    const perMese = [];
    for (let m = 1; m <= 12; m++) perMese.push(baseImponibile(`${anno}-${String(m).padStart(2, '0')}`));
    return {
      base: base.base,
      daGetStats: getStats().utileFiscale,
      daReport: getReportStats('ALL').utileFiscale,
      daUtileFiscaleAnno: utileFiscaleAnno(anno),
      // i dodici mesi, sommati, devono fare l'anno
      sommaMesi: perMese.reduce((t, x) => t + x.base, 0),
      // e le parti devono tornare col totale
      parti: base.tracciati + base.versamenti - base.deducibili,
      tracciatoTot: base.tracciatoTot - (base.tracciati + base.versamenti),
      // la proiezione non puo' mai essere sotto quello gia' registrato
      proiettato: utileProiettato(anno)
    };
  }, { anno: ANNO, seme: 1000 + giro * 7919 });

  c(`giro ${giro}: getStats dice la stessa base`, vicino(r.base, r.daGetStats));
  c(`giro ${giro}: il report dice la stessa base`, vicino(r.base, r.daReport));
  c(`giro ${giro}: utileFiscaleAnno dice la stessa base`, vicino(r.base, r.daUtileFiscaleAnno));
  c(`giro ${giro}: i dodici mesi sommati fanno l'anno`, vicino(r.base, r.sommaMesi));
  c(`giro ${giro}: le parti tornano col totale`, vicino(r.base, r.parti) && vicino(r.tracciatoTot, 0));
  c(`giro ${giro}: la proiezione non sta sotto quello gia' registrato`, r.proiettato >= r.base - 0.005);
  if (!vicino(r.base, r.daGetStats) || !vicino(r.base, r.daReport) || !vicino(r.base, r.daUtileFiscaleAnno))
    console.log(`    base ${r.base} · getStats ${r.daGetStats} · report ${r.daReport} · anno ${r.daUtileFiscaleAnno}`);
}

// E il taglio a una data: fino al 31 dicembre deve fare tutto l'anno.
const taglio = await p.evaluate((anno) => ({
  tutto: baseImponibile(anno).base,
  finoAFine: baseImponibile(anno, `${anno}-12-31`).base,
  finoAIeri: baseImponibile(anno, `${anno}-01-01`).base
}), ANNO);
c('tagliando al 31 dicembre esce tutto l\'anno', vicino(taglio.tutto, taglio.finoAFine));
c('tagliando al 1 gennaio esce molto meno', taglio.finoAIeri < taglio.tutto);

console.log(`${ok} controlli passati` + (ko.length ? `\n*** ${ko.length} FALLITI ***\n  - ` + ko.join('\n  - ') : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') + ' ***' : 'nessuno'));
await b.close();
