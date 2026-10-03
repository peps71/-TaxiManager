// Le tasse e i contributi registrati come spese devono potersi agganciare al
// budget, farsi proporre, e avere una scadenza.
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
const p = await b.newPage({ viewport: { width: 390, height: 1400 }, locale: 'it-IT' });
p.on('dialog', d => d.accept());
const errori = []; p.on('pageerror', e => errori.push(String(e)));
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
let t = true;
const prova = (n, bene, extra) => { t &= bene; console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + (extra === undefined ? '' : extra) + ' ***'}`); };

// le sue spese vere, come le ha scritte lui
const SPESE = [
  { data:'2026-06-30', categoria:'Tasse e Contributi - Camera di Commercio (Pago PA (pagato il 12/06))', importo:53 },
  { data:'2026-05-18', categoria:'Tasse e Contributi - INPS', importo:1130.34 },
  { data:'2026-02-16', categoria:'Tasse e Contributi - INPS 4 rata 2025', importo:1115.17 },
  { data:'2026-02-16', categoria:'Tasse e Contributi - INAIL 2025', importo:224.8 },
  { data:'2025-05-18', categoria:'Tasse e Contributi - INPS', importo:1100 },
  { data:'2025-02-16', categoria:'Tasse e Contributi - INAIL 2024', importo:220 }
];
const apparecchia = (voci) => p.evaluate(({ voci, spese }) => {
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  localStorage.removeItem('taxi_budget_proposte_no');
  window.vociFisse = voci;
  window.dailyRecords = spese.map((x, i) => Object.assign({ id:'u'+i, tipo:'USCITA', metodo:'Bonifico' }, x));
  window.shifts = []; window.annoScelto = '2026';
  window.versioneDati = (window.versioneDati||0)+1;
  window.activeTab = 'categorie'; renderContent();
}, { voci, spese: SPESE });

// 1) una voce chiamata come la FAMIGLIA aggancia tutto
await apparecchia([{ slug:'tc', nome:'Tasse e Contributi', importo:3000, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }]);
let r = await p.evaluate(() => pagamentiVoce(window.vociFisse[0]).length);
prova(`una voce «Tasse e Contributi» aggancia tutte e 6 le spese (viste ${r})`, r === 6, r);

// 2) una voce chiamata come il DETTAGLIO aggancia solo le sue
await apparecchia([{ slug:'inps', nome:'INPS', importo:4521.36, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }]);
r = await p.evaluate(() => pagamentiVoce(window.vociFisse[0]).map(x => x.importo));
prova(`una voce «INPS» aggancia solo le due INPS (viste ${JSON.stringify(r)})`, r.length === 2 && r.includes(1130.34) && r.includes(1100), JSON.stringify(r));

// 3) con tutte e due, comanda la piu' generale
await apparecchia([
  { slug:'tc', nome:'Tasse e Contributi', importo:3000, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' },
  { slug:'inps', nome:'INPS', importo:4521.36, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }
]);
r = await p.evaluate(() => ({ fam: pagamentiVoce(window.vociFisse[0]).length, det: pagamentiVoce(window.vociFisse[1]).length }));
prova(`con tutte e due, la famiglia prende tutto e il dettaglio niente (${r.fam}/${r.det})`, r.fam === 6 && r.det === 0, JSON.stringify(r));

// 4) senza nessuna voce, l'app le propone
await apparecchia([]);
r = await p.evaluate(() => ({
  testo: /Paghi queste cose, ma non sono nel budget/i.test(document.getElementById('main-container').innerText),
  proposte: proposteBudget().map(x => `${x.nome}=${x.importo}`)
}));
prova('senza voci, la proposta compare', r.testo);
prova(`e propone «Tasse e Contributi» con la media vera (${r.proposte.join(' · ')})`,
      r.proposte.some(x => x.startsWith('Tasse e Contributi=')), r.proposte.join(' · '));

// 5) accettandola, le spese si agganciano e la giornata pesa di piu'
const prima = await p.evaluate(() => budgetDelGiorno('2026-06-15'));
await p.evaluate(() => { const c = proposteBudget().find(x => x.nome === 'Tasse e Contributi'); aggiungiVoceDaProposta(c.chiave); });
await p.waitForTimeout(300);
r = await p.evaluate(() => ({
  voci: (window.vociFisse||[]).map(v => `${v.nome}=${v.importo}/${v.unita}/${v.tipo}`),
  agganciate: pagamentiVoce(window.vociFisse[0]).length,
  dopo: budgetDelGiorno('2026-06-15')
}));
prova(`la voce creata aggancia le spese (${r.agganciate} di 6)`, r.agganciate === 6, r.voci.join(' · '));
prova(`e la giornata passa da ${prima.toFixed(2)} a ${r.dopo.toFixed(2)}`, r.dopo > prima);

// 6) la scadenza fa maturare dal rinnovo al rinnovo
await apparecchia([{ slug:'assic', nome:'Assicurazione auto', importo:1460, unita:'anno', tipo:'scadenza', scadenza:'2025-10-10', dataInizio:'', dataFine:'' }]);
r = await p.evaluate(() => {
  const v = window.vociFisse[0];
  return { periodo: periodoDaScadenza(v, '2026-06-15'), avviso: avvisoScadenzaVoce(v) };
});
prova(`il periodo in corso parte dal 10/10/2025 (visto ${r.periodo.da})`, r.periodo.da === '2025-10-10', r.periodo.da);
prova(`e finisce il 09/10/2026 (visto ${r.periodo.ultimoGiorno})`, r.periodo.ultimoGiorno === '2026-10-09', r.periodo.ultimoGiorno);
prova(`l'avviso dice che scade il 10/10/2026 (visto ${r.avviso && r.avviso.data})`, r.avviso && r.avviso.data === '2026-10-10', JSON.stringify(r.avviso));

console.log(`\n  ${t && !errori.length ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'} · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
