// Riassegnare una spesa a una voce di budget: il nome lo riscrive l'app,
// tenendo il dettaglio, e da quel momento la spesa si aggancia.
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
const p = await b.newPage({ viewport: { width: 390, height: 1200 }, locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
let t = true;
const prova = (n, bene, extra) => { t &= bene; console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + (extra===undefined?'':extra) + ' ***'}`); };

await p.evaluate(() => {
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['costi-fissi']));
  window.vociFisse = [
    { slug:'tc', nome:'Tasse e Contributi', importo:4800, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' },
    { slug:'radio', nome:'Radio taxi', importo:3151.08, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }
  ];
  window.dailyRecords = [
    { id:'orf1', data:'2026-05-16', tipo:'USCITA', categoria:'Costi fissi - Assicurazione infortuni', metodo:'Conto', importo:1045.50 },
    { id:'orf2', data:'2026-01-20', tipo:'USCITA', categoria:'Costi fissi - Radio taxi', metodo:'Bonifico', importo:262.59 }
  ];
  window.shifts = []; window.annoScelto = '2026';
  window.versioneDati = (window.versioneDati||0)+1;
  window.activeTab = 'categorie'; renderContent();
});

let r = await p.evaluate(() => {
  const c = conguaglioAnno('2026');
  const f = c.righe.find(x => x.extra);
  return { fuori: f ? f.voci.length : 0, tcSpeso: (c.righe.find(x=>x.nome==='Tasse e Contributi')||{}).speso };
});
// «Costi fissi - Radio taxi» si aggancia gia' da sola: l'app toglie il
// prefisso «Costi fissi» e trova la voce «Radio taxi». L'orfana e' una sola.
prova(`prima: 1 spesa orfana, «Tasse e Contributi» ha speso ${r.tcSpeso}`, r.fuori === 1 && r.tcSpeso === 0, JSON.stringify(r));
const giaAgganciata = await p.evaluate(() => (conguaglioAnno('2026').righe.find(x=>x.nome==='Radio taxi')||{}).speso);
prova(`e «Costi fissi - Radio taxi» era gia' agganciata da sola (${giaAgganciata})`, Math.abs(giaAgganciata - 262.59) < 0.005, String(giaAgganciata));

// il menu c'e' nella riga aperta
await p.evaluate(() => { alternaDettaglioConguaglio('__fuori__'); });
await p.waitForTimeout(300);
const menu = await p.evaluate(() => {
  const d = document.querySelector('details[ontoggle*="conguaglio"]'); if (d) d.open = true;
  const s = document.getElementById('ass-orf1');
  return s ? Array.from(s.options).map(o => o.text) : null;
});
prova(`il menu elenca le voci di budget (${menu ? menu.join(' / ') : 'assente'})`,
      !!menu && menu.includes('Tasse e Contributi') && menu.includes('Radio taxi'), JSON.stringify(menu));

// assegno la prima a «Tasse e Contributi»
await p.evaluate(() => assegnaSpesaAVoce('orf1', 'tc'));
await p.waitForTimeout(400);
r = await p.evaluate(() => {
  const rec = window.dailyRecords.find(x => x.id === 'orf1');
  const c = conguaglioAnno('2026');
  const f = c.righe.find(x => x.extra);
  return { categoria: rec.categoria, importo: rec.importo, data: rec.data, metodo: rec.metodo,
           fuori: f ? f.voci.length : 0,
           tcSpeso: (c.righe.find(x=>x.nome==='Tasse e Contributi')||{}).speso,
           suDisco: (JSON.parse(localStorage.getItem('taxi_records')||'[]').find(x=>x.id==='orf1')||{}).categoria };
});
prova(`la categoria diventa «Tasse e Contributi - Assicurazione infortuni»`, r.categoria === 'Tasse e Contributi - Assicurazione infortuni', r.categoria);
prova('importo, data e metodo non si toccano', Math.abs(r.importo - 1045.50) < 0.005 && r.data === '2026-05-16' && r.metodo === 'Conto', JSON.stringify(r));
prova(`ora e\' agganciata: «Tasse e Contributi» ha speso ${r.tcSpeso}`, Math.abs(r.tcSpeso - 1045.50) < 0.005, String(r.tcSpeso));
prova(`e non resta piu' niente fuori budget (${r.fuori})`, r.fuori === 0, String(r.fuori));
prova('la modifica e\' finita su disco', r.suDisco === 'Tasse e Contributi - Assicurazione infortuni', String(r.suDisco));

// e riassegnando una gia' agganciata: il dettaglio e' il nome stesso della
// voce, quindi non lo si ripete
await p.evaluate(() => assegnaSpesaAVoce('orf2', 'radio'));
await p.waitForTimeout(400);
r = await p.evaluate(() => {
  const rec = window.dailyRecords.find(x => x.id === 'orf2');
  const c = conguaglioAnno('2026');
  return { categoria: rec.categoria, fuori: (c.righe.find(x=>x.extra)||{voci:[]}).voci.length,
           radioSpeso: (c.righe.find(x=>x.nome==='Radio taxi')||{}).speso };
});
prova(`«Costi fissi - Radio taxi» diventa «Radio taxi», senza ripetere`, r.categoria === 'Radio taxi', r.categoria);
prova(`e si aggancia a Radio taxi (${r.radioSpeso})`, Math.abs(r.radioSpeso - 262.59) < 0.005, String(r.radioSpeso));
prova('non resta piu\' niente fuori budget', r.fuori === 0, String(r.fuori));

console.log(`\n  ${t && !errori.length ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'} · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
