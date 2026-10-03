// Una voce di budget con la sua scadenza deve comparire fra le scadenze
// senza essere scritta due volte, e spuntarsi da sola quando paghi.
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

const ANNO = await p.evaluate(() => oggiISO().slice(0,4));
const apparecchia = (spese) => p.evaluate(({ spese, anno }) => {
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['assicurazione-auto','bollo-tasse-auto','carburante']));
  window.vociFisse = [
    { slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'scadenza', scadenza:`${anno}-10-10`, dataInizio:'', dataFine:'' },
    { slug:'bollo', nome:'Bollo auto',         importo:300,  unita:'anno', tipo:'scadenza', scadenza:`${anno}-04-30`, dataInizio:'', dataFine:'' },
    { slug:'banca', nome:'Spese banca',        importo:18,   unita:'mese', tipo:'scadenza', scadenza:`${anno}-01-31`, dataInizio:'', dataFine:'' },
    { slug:'carb',  nome:'Carburante',         importo:14000,unita:'anno', tipo:'consumo',  scadenza:`${anno}-06-01`, dataInizio:'', dataFine:'' }
  ];
  window.scadenze = [{ id:'s1', nome:'Revisione', data:`${anno}-07-15`, cadenza:'2anni', ancora:`${anno}-07-15` }];
  window.dailyRecords = spese.map((x,i)=>Object.assign({id:'u'+i, tipo:'USCITA', metodo:'Bonifico'}, x));
  window.shifts = []; window.annoScelto = anno;
  window.versioneDati = (window.versioneDati||0)+1;
  window.activeTab = 'scadenze'; renderContent();
}, { spese, anno: ANNO });

// 1. senza pagamenti: le due voci annuali compaiono, la mensile e quella a consumo no
await apparecchia([]);
let r = await p.evaluate(a => calendarioScadenze(a).map(v => `${v.nome}|${v.data}|${v.dalBudget?'budget':'scadenza'}|${v.fatta?'fatta':'da fare'}`), ANNO);
prova(`il calendario ha 3 righe (${r.length})`, r.length === 3, JSON.stringify(r));
prova('l\'assicurazione compare dal budget', r.some(x => x.startsWith('Assicurazione auto|') && x.includes('|budget|da fare')), JSON.stringify(r));
prova('il bollo compare dal budget', r.some(x => x.startsWith('Bollo auto|') && x.includes('|budget|')), JSON.stringify(r));
prova('la revisione resta una scadenza normale', r.some(x => x.startsWith('Revisione|') && x.includes('|scadenza|')), JSON.stringify(r));
prova('la voce mensile NON diventa una scadenza', !r.some(x => x.startsWith('Spese banca')), JSON.stringify(r));
prova('e nemmeno quella a consumo', !r.some(x => x.startsWith('Carburante')), JSON.stringify(r));

// 2. registro il pagamento dell'assicurazione: si spunta da sola
await apparecchia([{ data: `${ANNO}-10-08`, categoria:'Assicurazione auto', importo:1500 }]);
r = await p.evaluate(a => calendarioScadenze(a).map(v => `${v.nome}|${v.fatta?'fatta':'da fare'}`), ANNO);
prova('pagata due giorni prima: l\'assicurazione risulta fatta', r.includes('Assicurazione auto|fatta'), JSON.stringify(r));
prova('e il bollo resta da fare', r.includes('Bollo auto|da fare'), JSON.stringify(r));

// 3. un pagamento troppo lontano dalla scadenza non la spunta
await apparecchia([{ data: `${ANNO}-01-15`, categoria:'Assicurazione auto', importo:1500 }]);
r = await p.evaluate(a => calendarioScadenze(a).map(v => `${v.nome}|${v.fatta?'fatta':'da fare'}`), ANNO);
prova('un pagamento di gennaio non spunta la scadenza di ottobre', r.includes('Assicurazione auto|da fare'), JSON.stringify(r));

// 4. e a video: la riga dice «dal budget» e non si puo' eliminare
await apparecchia([]);
await p.waitForTimeout(300);
const video = await p.evaluate(() => {
  const t2 = document.getElementById('main-container').innerText;
  const html = document.getElementById('main-container').innerHTML;
  return { testo: t2, eliminaBudget: /deleteScadenza\('budget:/.test(html), spunta: /spuntaOccorrenza\('budget:/.test(html) };
});
prova('la riga dice «dal budget»', /DAL BUDGET/i.test(video.testo), video.testo.slice(0,160));
prova('non si puo\' eliminare da qui', !video.eliminaBudget);
prova('e non si puo\' spuntare a mano', !video.spunta);

// 5. la prossima scadenza tiene conto anche di quelle del budget
const st = await p.evaluate(() => { const x = statoScadenze(); return { prossima: x.prossima && x.prossima.nome, nVicine: (x.vicine||[]).length }; });
prova(`statoScadenze vede anche quelle del budget (prossima: ${st.prossima})`, !!st.prossima, JSON.stringify(st));

console.log(`\n  ${t && !errori.length ? 'TUTTO BENE' : 'QUALCOSA NON TORNA'} · errori JS: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await b.close();
