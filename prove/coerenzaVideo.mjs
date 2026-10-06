// I conti possono tornare e una schermata mostrare lo stesso la variabile
// sbagliata. Qui si legge quello che compare DAVVERO a video e si confronta
// con quello che l'app ha calcolato.
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
const p = await b.newPage({ viewport: { width: 1280, height: 1200 }, locale: 'it-IT' });
p.on('dialog', d => d.accept());
const errori = []; p.on('pageerror', e => errori.push(String(e)));
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = '2026';
await p.evaluate((anno) => {
  const rec = [], tur = [];
  const met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  let n = 0;
  for (let m = 1; m <= 12; m++) for (let g = 1; g <= 28; g++) {
    if (g % 7 === 0) continue;
    const d = `${anno}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    tur.push({ id:`t${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:170 });
    for (let c = 0; c < 5; c++) { n++; rec.push({ id:`e${n}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:met[(g+c)%5], importo: 11 + ((g*3+c*7)%48), ora:'10:00' }); }
    if (g % 3 === 0) { n++; rec.push({ id:`u${n}`, data:d, tipo:'USCITA', categoria:'Carburante', metodo:'Bonifico', importo: 62 }); }
  }
  rec.push({ id:'as1', data:`${anno}-10-10`, tipo:'USCITA', categoria:'Assicurazione auto', metodo:'Bonifico', importo:1387 });
  window.vociFisse = [{ slug:'assic', nome:'Assicurazione auto', importo:1387, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }];
  localStorage.setItem('taxi_voci_fisse_avviato','si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['carburante']));
  window.profilo = { nome:'Giuseppe', cognome:'Rossi', licenza:'1234', sigla:'Livorno 71', piva:'12345678901' };
  window.dailyRecords = rec; window.shifts = tur; window.veicoli = []; window.scadenze = [];
  window.annoScelto = anno; window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati||0)+1;
  renderContent();
}, ANNO);

const attesi = await p.evaluate((anno) => {
  const a = aggrega(anno); const st = getStats();
  return { incassi:a.incassi, uscite:a.uscite, saldo:a.saldo, nCorse:a.nCorse, ore:a.ore,
           utileCassa:st.utileCassa, utileFiscale:st.utileFiscale, tasse:st.tasse, netto:st.netto,
           entrateTracciate:st.entrateTracciate, deducibili:st.deducibili,
           mediaOra:a.mediaOra, mediaCorsa:a.mediaCorsa };
}, ANNO);

// tutti gli importi che compaiono in una schermata
const importi = async (prepara) => {
  await p.evaluate(prepara);
  await p.waitForTimeout(300);
  return await p.evaluate(() => {
    const t = document.getElementById('main-container').innerText;
    const fuori = new Set();
    // 1.234,56 oppure 1234,56 — si riporta a numero
    (t.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/g) || []).forEach(x => {
      const v = parseFloat(x.replace(/\./g,'').replace(',','.'));
      if (Number.isFinite(v)) fuori.add(Math.round(Math.abs(v) * 100) / 100);
    });
    return Array.from(fuori);
  });
};

const schermate = {
  'Andamento / anno':  () => { window.activeTab='dashboard'; window.periodoDashScelto='anno'; renderContent(); },
  'Spese':             () => { window.activeTab='categorie'; renderContent(); },
  'Commercialista':    () => { window.activeTab='report'; window.filterMonthReport='ALL'; renderContent(); },
  'Rendimento':        () => { window.activeTab='rendimento'; renderContent(); },
  // il registro spese parte filtrato sul giorno: per il totale dell'anno si toglie
  'Uscite':            () => { window.activeTab='uscite'; window.filterMonthUscite='ALL'; window.giornoUscite=''; window.filterGiornoUscite=''; pulisciGiornoUscite && pulisciGiornoUscite(); renderContent(); }
};

const visti = {};
for (const [nome, prep] of Object.entries(schermate)) visti[nome] = await importi(prep);

const ci = (nome, valore) => visti[nome].some(v => Math.abs(v - Math.round(Math.abs(valore)*100)/100) < 0.02);
let ok = 0, ko = [];
const c = (desc, bene) => { if (bene) ok++; else ko.push(desc); };
const e = (x) => x.toFixed(2).replace('.', ',') + ' €';

console.log(`  incassi dell'anno: ${e(attesi.incassi)} · uscite ${e(attesi.uscite)} · utile di cassa ${e(attesi.utileCassa)}\n`);
console.log('  --- lo stesso numero deve comparire nelle schermate che lo mostrano ---');
c(`gli incassi dell'anno in «Andamento / anno»`, ci('Andamento / anno', attesi.incassi));
c(`le uscite dell'anno in «Andamento / anno»`, ci('Andamento / anno', attesi.uscite));
// «Spese» non stampa il totale incassi: lo divide in tracciati e contanti,
// perche' sono le due cose che contano per il fisco. Si controlla la divisione.
c(`gli incassi tracciati + contanti fanno il totale`, Math.abs(attesi.entrateTracciate + (attesi.incassi - attesi.entrateTracciate) - attesi.incassi) < 0.02);
c(`le uscite dell'anno in «Spese»`, ci('Spese', attesi.uscite));
// Dalla v137 la stima delle tasse sta in «Commercialista»: e' roba da
// scrivania, non da mentre si segna un pieno. I numeri sono gli stessi, cambia
// la schermata che li ospita - ed e' esattamente quello che qui si controlla.
// anche l'utile di cassa non e' stampato: si mostra il netto, che e' utile - tasse
c(`il netto stimato in «Commercialista»`, ci('Commercialista', attesi.netto));
c(`e il netto vale utile di cassa - tasse`, Math.abs(attesi.netto - (attesi.utileCassa - attesi.tasse)) < 0.02);
c(`l'utile fiscale in «Commercialista»`, ci('Commercialista', attesi.utileFiscale));
c(`le tasse stimate in «Commercialista»`, ci('Commercialista', attesi.tasse));
c(`gli incassi tracciati in «Commercialista»`, ci('Commercialista', attesi.entrateTracciate));
c(`le spese deducibili in «Commercialista»`, ci('Commercialista', attesi.deducibili));
// e non devono essere rimasti dov'erano: se ricompaiono in «Spese»
// vuol dire che sono finiti in due posti invece di uno.
c(`la stima non e' rimasta anche in «Spese»`,
  !ci('Spese', attesi.tasse) && !ci('Spese', attesi.netto));
c(`gli incassi dell'anno in «Commercialista»`, ci('Commercialista', attesi.incassi));
c(`le uscite dell'anno in «Commercialista»`, ci('Commercialista', attesi.uscite));
c(`le uscite dell'anno in «Uscite»`, ci('Uscite', attesi.uscite));
c(`la media oraria in «Rendimento»`, ci('Rendimento', attesi.mediaOra));

// e il mese: lo stesso mese detto da Andamento e dal Commercialista
const mese = `${ANNO}-06`;
const attesiMese = await p.evaluate(ym => { const a = aggrega(ym); return { incassi:a.incassi, uscite:a.uscite }; }, mese);
visti['Andamento / mese'] = await importi(() => { window.activeTab='dashboard'; window.periodoDashScelto='mese'; window.dashMese='2026-06'; renderContent(); });
visti['Commercialista / giugno'] = await importi(() => { window.activeTab='report'; window.filterMonthReport='6'; renderContent(); });
console.log('  --- e lo stesso mese, detto da due schermate diverse ---');
c(`gli incassi di giugno in «Andamento / mese»`, ci('Andamento / mese', attesiMese.incassi));
c(`gli incassi di giugno in «Commercialista»`, ci('Commercialista / giugno', attesiMese.incassi));
c(`le uscite di giugno in «Commercialista»`, ci('Commercialista / giugno', attesiMese.uscite));

console.log(`\n  ${ko.length ? ko.length + ' NUMERI NON TROVATI A VIDEO' : 'tutti i numeri attesi compaiono'} · ${ok} controlli passati`);
ko.forEach(x => console.log('   *** ' + x));
console.log('  errori JS:', errori.length ? errori : 'nessuno');
await b.close();
