// IL TESTO TRONCATO
// «truncate» taglia con i puntini: giusto per un nome lungo, sbagliato per una
// cifra. Un importo che si legge «−6.026,...» non e' un'informazione.
// Qui si cercano gli elementi il cui contenuto non ci sta: scrollWidth piu'
// largo di clientWidth. Il controllo di sbordo non li vede, perche' il testo
// non esce dal riquadro - ci sta dentro tagliato.
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
let guai = 0;
for (const larghezza of [320, 390, 768]) {
  const p = await b.newPage({ viewport: { width: larghezza, height: 1400 }, locale: 'it-IT' });
  p.on('dialog', d => d.accept());
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(() => {
    localStorage.setItem('taxi_voci_fisse_avviato','si');
    localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['carburante']));
    const rec = [], tur = [], met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
    // cifre grandi come quelle di un anno vero: e' li' che il testo si tronca
    for (const a of [2025, 2026]) for (let m=1;m<=12;m++) for (let g=1;g<=28;g++) {
      if (g%7===0) continue;
      const d = `${a}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
      if (d > oggiISO()) continue;
      tur.push({ id:`t${a}${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:175 });
      for (let c=0;c<6;c++) rec.push({ id:`e${a}${m}${g}${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:met[(g+c)%5], importo:13+((g*3+c*5)%42), ora:'10:00' });
      if (g%3===0) rec.push({ id:`u${a}${m}${g}`, data:d, tipo:'USCITA', categoria:'Carburante', metodo:'Bonifico', importo:62 });
    }
    window.vociFisse = [{ slug:'radio', nome:'Radio taxi', importo:3151.08, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }];
    window.dailyRecords = rec; window.shifts = tur; window.scadenze = []; window.veicoli = [];
    window.profilo = { nome:'Giuseppe', sigla:'Livorno 71' };
    localStorage.setItem('taxi_profilo', JSON.stringify(window.profilo));
    window.annoScelto = '2026'; window.incassoVisibile = true;
    window.versioneDati = (window.versioneDati||0)+1;
    renderNav();
  });
  const schede = [['giornata',null],['dashboard','giorno'],['dashboard','mese'],['dashboard','anno'],
                  ['uscite',null],['categorie',null],['scadenze',null],['auto',null],
                  ['rendimento',null],['report',null],['cloud',null],['altro',null]];
  for (const [tab, per] of schede) {
    await p.evaluate(({tab, per}) => { window.activeTab = tab; if (per) window.periodoDashScelto = per; renderContent(); }, {tab, per});
    await p.waitForTimeout(160);
    const trovati = await p.evaluate(() => {
      const fuori = [];
      document.querySelectorAll('#main-container *').forEach(e => {
        if (e.children.length) return;                      // solo le foglie
        const t = (e.textContent || '').trim();
        if (!t) return;
        if (e.scrollWidth <= e.clientWidth + 1) return;
        const quanto = e.scrollWidth - e.clientWidth;
        if (quanto < 3) return;
        // una cifra tagliata e' molto peggio di un nome tagliato
        const cifra = /\d[\d.,]*\s*€|€\s*\d|^\s*[−-]?\d[\d.,]*\s*$/.test(t);
        fuori.push({ testo: t.slice(0, 48), quanto, cifra });
      });
      return fuori;
    });
    trovati.forEach(x => {
      guai++;
      console.log(`  *** ${String(larghezza).padStart(4)}px ${tab}${per?'/'+per:''}  ${x.cifra ? 'CIFRA' : 'testo'} tagliato di ${x.quanto}px: «${x.testo}»`);
    });
  }
  await p.close();
}
console.log(`\n  ${guai === 0 ? 'niente di tagliato' : guai + ' elementi tagliati'}`);
await b.close();
