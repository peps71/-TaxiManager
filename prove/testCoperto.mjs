// Coperto vuol dire: il totale. Gli altri importi della scheda restano in chiaro.
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
const U = APP;
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.goto(U);
await p.waitForFunction(() => typeof window.switchTab === 'function');
const A = new Date().getFullYear();
const G = `${A}-03-10`;
await p.evaluate(({ a, g }) => {
  window.vociFisse = []; localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.dailyRecords = [
    { id:'r1', data:g, tipo:'ENTRATA', categoria:'Corsa', metodo:'POS', importo:120, ora:'10:00' },
    { id:'r2', data:g, tipo:'ENTRATA', categoria:'Corsa', metodo:'Contanti', importo:80, ora:'11:00' },
    { id:'s1', data:g, tipo:'USCITA', categoria:'Carburante', metodo:'Bonifico', importo:50 }
  ];
  window.shifts = [{ id:'t1', data:g, turno:'Le otto', inizio:'08:00', fine:'16:00', ore:8, lavorato:true, kmTot:100 }];
  window.annoScelto = String(a);
}, { a: A, g: G });

const leggi = async () => await p.evaluate(() => document.getElementById('main-container').innerText);
const prova = (nome, bene) => { console.log(`  ${bene ? 'ok ' : '***'} ${nome}${bene ? '' : '  *** SBAGLIATO ***'}`); return bene; };
let tutto = true;

for (const [scheda, vai] of [['Oggi', g => { switchTab('giornata'); applyFilterGiornoGiornate(g); }],
                             ['Andamento', g => { switchTab('dashboard'); cambiaPeriodoDash('giorno'); setDashGiorno(g); }]]) {
  await p.evaluate(vai, G);
  await p.waitForTimeout(400);
  const t = await leggi();
  const asterischi = (t.match(/∗/g) || []).length;
  tutto &= prova(`${scheda}: il totale e' coperto (5 asterischi, trovati ${asterischi})`, asterischi === 5);
  tutto &= prova(`${scheda}: 200,00 non si legge`, !/200,00/.test(t));
  // Le caselle accanto al totale si leggono per etichetta, non per importo:
  // quanto valgono dipende dal modello dei costi (dalla v126 la prima casella
  // porta il costo pieno della giornata, non le sole spese), mentre quello che
  // questa prova deve garantire e' che NON siano coperte.
  const caselle = await p.evaluate(() => {
    const out = {};
    document.querySelectorAll('#main-container p').forEach(l => {
      const k = (l.innerText || '').trim().toUpperCase();
      if (!/^(SPESE|COSTO GIORNO|TI RESTA|A CORSA|ALL'ORA)$/.test(k)) return;
      if (l.nextElementSibling) out[k] = l.nextElementSibling.innerText.trim();
    });
    return out;
  });
  const inChiaro = (nomi) => {
    const k = nomi.find(n => caselle[n] !== undefined);
    return k !== undefined && /\d/.test(caselle[k]) && !/∗/.test(caselle[k]);
  };
  tutto &= prova(`${scheda}: la casella del costo in chiaro (${caselle['COSTO GIORNO'] || caselle['SPESE'] || '?'})`, inChiaro(['COSTO GIORNO', 'SPESE']));
  tutto &= prova(`${scheda}: Ti resta in chiaro (${caselle['TI RESTA'] || '?'})`, inChiaro(['TI RESTA']));
  tutto &= prova(`${scheda}: la terza casella in chiaro (${caselle['A CORSA'] || caselle["ALL'ORA"] || '?'})`, inChiaro(['A CORSA', "ALL'ORA"]));
  // e scoperto si legge tutto
  await p.evaluate(() => alternaIncassoVisibile());
  await p.waitForTimeout(350);
  const t2 = await leggi();
  tutto &= prova(`${scheda}: con l'occhio aperto il totale si legge (200,00)`, /200,00/.test(t2) && !/∗/.test(t2));
  await p.evaluate(() => alternaIncassoVisibile());
  await p.waitForTimeout(300);
}
console.log('\nerrori JS:', errori.length ? errori : 'nessuno');
console.log(tutto && !errori.length ? '\nTUTTO BENE' : '\nQUALCOSA NON TORNA');
await b.close();
