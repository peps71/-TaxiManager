// IL GIRO DEI GIORNI
// Tutto il budget poggia su perOgniGiorno: se saltasse o ripetesse un giorno
// ai cambi dell'ora legale, i totali dell'anno sarebbero sbagliati e nessuno
// se ne accorgerebbe - le prove di coerenza userebbero tutte lo stesso giro.
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
// ora italiana: e' qui che l'ora legale si sposta
const p = await b.newPage({ locale: 'it-IT', timezoneId: 'Europe/Rome' });
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
let t = true;
const prova = (n, bene, extra) => { t &= bene; console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + (extra===undefined?'':extra) + ' ***'}`); };

const r = await p.evaluate(() => {
  const esito = {};
  // 1. un anno intero, giorno per giorno
  for (const anno of ['2024','2025','2026','2027','2028']) {
    const visti = [];
    perOgniGiorno(`${anno}-01-01`, `${anno}-12-31`, iso => visti.push(iso));
    const attesi = giorniDellAnno(anno);
    const unici = new Set(visti);
    esito[anno] = { quanti: visti.length, attesi, unici: unici.size,
                    primo: visti[0], ultimo: visti[visti.length-1],
                    buchi: (() => {
                      const manca = [];
                      for (let m=1;m<=12;m++) {
                        const ym = `${anno}-${String(m).padStart(2,'0')}`;
                        for (let g=1;g<=giorniDelMese(ym);g++) {
                          const iso = `${ym}-${String(g).padStart(2,'0')}`;
                          if (!unici.has(iso)) manca.push(iso);
                        }
                      }
                      return manca;
                    })() };
  }
  // 2. le due domeniche del cambio ora in Italia (2026: 29 marzo e 25 ottobre)
  const marzo = []; perOgniGiorno('2026-03-27', '2026-03-31', x => marzo.push(x));
  const ottobre = []; perOgniGiorno('2026-10-23', '2026-10-27', x => ottobre.push(x));
  // 3. un budget su un anno deve fare esattamente l'importo
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  window.dailyRecords = []; window.shifts = [];
  window.vociFisse = [{ slug:'x', nome:'Prova', importo:3650, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }];
  window.versioneDati = (window.versioneDati||0)+1;
  const budget2026 = budgetPeriodo('2026-01-01','2026-12-31');
  const budget2028 = budgetPeriodo('2028-01-01','2028-12-31');   // bisestile
  // 4. una voce mensile deve fare 12 rate in un anno
  window.vociFisse = [{ slug:'m', nome:'Mensile', importo:100, unita:'mese', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }];
  window.versioneDati = (window.versioneDati||0)+1;
  const mensile2026 = budgetPeriodo('2026-01-01','2026-12-31');
  return { esito, marzo, ottobre, budget2026, budget2028, mensile2026 };
});

for (const [anno, x] of Object.entries(r.esito)) {
  prova(`${anno}: ${x.quanti} giri su ${x.attesi} giorni, tutti diversi, dal ${x.primo} al ${x.ultimo}`,
        x.quanti === x.attesi && x.unici === x.attesi && x.buchi.length === 0 && x.primo === `${anno}-01-01` && x.ultimo === `${anno}-12-31`,
        `quanti ${x.quanti}, unici ${x.unici}, buchi ${JSON.stringify(x.buchi.slice(0,4))}`);
}
prova(`la domenica che l'ora va avanti (29/03/2026): ${r.marzo.join(' ')}`,
      JSON.stringify(r.marzo) === '["2026-03-27","2026-03-28","2026-03-29","2026-03-30","2026-03-31"]', r.marzo.join(' '));
prova(`la domenica che l'ora torna indietro (25/10/2026): ${r.ottobre.join(' ')}`,
      JSON.stringify(r.ottobre) === '["2026-10-23","2026-10-24","2026-10-25","2026-10-26","2026-10-27"]', r.ottobre.join(' '));
prova(`una voce da 3.650 € l'anno matura 3.650,00 nel 2026 (${r.budget2026.toFixed(2)})`, Math.abs(r.budget2026 - 3650) < 0.01, String(r.budget2026));
prova(`e 3.650,00 anche nel 2028 bisestile (${r.budget2028.toFixed(2)})`, Math.abs(r.budget2028 - 3650) < 0.01, String(r.budget2028));
prova(`una rata da 100 €/mese matura 1.200,00 in un anno (${r.mensile2026.toFixed(2)})`, Math.abs(r.mensile2026 - 1200) < 0.01, String(r.mensile2026));

console.log(`\n  ${t ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'}`);
await b.close();
