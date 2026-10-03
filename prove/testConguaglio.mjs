// Una riga del conguaglio deve dire QUALI movimenti ci stanno dentro.
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
const p = await b.newPage({ viewport: { width: 390, height: 1600 }, locale: 'it-IT' });
p.on('dialog', d => d.accept());
const errori = []; p.on('pageerror', e => errori.push(String(e)));
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
let t = true;
const prova = (n, bene, extra) => { t &= bene; console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + (extra===undefined?'':extra) + ' ***'}`); };

await p.evaluate(() => {
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['tasse-e-contributi','radio-taxi']));
  window.vociFisse = [{ slug:'radio', nome:'Radio taxi', importo:3151.08, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }];
  window.dailyRecords = [
    { id:'r1', data:'2026-03-05', tipo:'USCITA', categoria:'Radio taxi', metodo:'Bonifico', importo:262.59 },
    { id:'r2', data:'2026-04-05', tipo:'USCITA', categoria:'Radio taxi', metodo:'Bonifico', importo:262.59 },
    // due vecchie righe «Costi fissi» che non corrispondono a nessuna voce
    { id:'fissi-2026-01', data:'2026-01-20', tipo:'USCITA', categoria:'Costi fissi - Vecchia voce sparita', metodo:'Bonifico', importo:1200, nota:'scritta da una versione precedente' },
    { id:'v2', data:'2026-05-16', tipo:'USCITA', categoria:'Costi fissi - Assicurazione infortuni', metodo:'Conto', importo:1045.50 }
  ];
  window.shifts = []; window.annoScelto = '2026';
  window.versioneDati = (window.versioneDati||0)+1;
  window.activeTab = 'categorie'; renderContent();
});

let r = await p.evaluate(() => {
  const c = conguaglioAnno('2026');
  const f = c.righe.find(x => x.extra);
  return { righe: c.righe.map(x => `${x.nome}:${x.movimenti}`), fuoriVoci: f ? f.voci.map(v => v.categoria) : null, chiave: f && f.chiave };
});
prova('la riga «fuori budget» raccoglie i 2 movimenti orfani', r.fuoriVoci && r.fuoriVoci.length === 2, JSON.stringify(r.righe));
prova('e si porta dietro quali sono', r.fuoriVoci && r.fuoriVoci.some(x => /Vecchia voce sparita/.test(x)), JSON.stringify(r.fuoriVoci));

// chiusa non si vedono, aperta sì
let testo = await p.evaluate(() => { const d = document.querySelector('details[ontoggle*="conguaglio"]'); if (d) d.open = true; return document.getElementById('main-container').innerText; });
prova('da chiusa la riga non mostra i movimenti', !/Vecchia voce sparita/.test(testo));

await p.evaluate(() => alternaDettaglioConguaglio('__fuori__'));
await p.waitForTimeout(300);
testo = await p.evaluate(() => { const d = document.querySelector('details[ontoggle*="conguaglio"]'); if (d) d.open = true; return document.getElementById('main-container').innerText; });
prova('aperta mostra «Costi fissi - Vecchia voce sparita»', /Vecchia voce sparita/.test(testo));
prova('mostra anche la data 20/01/2026', /20\/01\/2026/.test(testo), testo.slice(0,0));
prova('e spiega perché sono fuori budget', /non corrispondono a nessuna voce/i.test(testo));

// e una riga normale si apre ugualmente
await p.evaluate(() => alternaDettaglioConguaglio('radio taxi'));
await p.waitForTimeout(300);
r = await p.evaluate(() => {
  const d = document.querySelector('details[ontoggle*="conguaglio"]'); if (d) d.open = true;
  const txt = document.getElementById('main-container').innerText;
  return { apre: /05\/03\/2026/.test(txt), chiuso: !/Vecchia voce sparita/.test(txt) };
});
prova('aprendo «Radio taxi» si vedono le sue rate', r.apre);
prova('e la riga di prima si richiude (una alla volta)', r.chiuso);

// la provenienza: una scritta dall'app e una registrata a mano
await p.evaluate(() => alternaDettaglioConguaglio('__fuori__'));
await p.waitForTimeout(300);
testo = await p.evaluate(() => { const d = document.querySelector('details[ontoggle*="conguaglio"]'); if (d) d.open = true; return document.getElementById('main-container').innerText; });
prova('la riga scritta dall\'app porta il marchio «generata dall\'app»', /GENERATA DALL'APP/i.test(testo));
prova('quella battuta a mano porta «registrata da te»', /REGISTRATA DA TE/i.test(testo));
prova('e la spiegazione dice di non cancellare quelle vere', /non cancellarla/i.test(testo));

console.log(`\n  ${t && !errori.length ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'} · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
