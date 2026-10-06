// IL BUDGET DEVE RESTARE COMPATTO
// Con dieci voci la sezione era alta 2181 px su un telefono: tre paragrafi di
// spiegazione sempre aperti e una scheda col bordo per ogni voce. Si scorreva
// mezzo minuto per arrivare al conguaglio.
// Qui si misura: la sezione intera e l'altezza di una riga. Non e' una prova
// di stile, e' una prova di quanta pagina occupa - la cosa che si e' rotta.
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

// Tetti larghi: servono a cogliere «la sezione e' esplosa di nuovo», non a
// inchiodare il disegno al pixel.
// Dalla v134 la sezione porta anche i conti del conguaglio, quindi la riga e'
// piu' alta di quando mostrava solo la previsione: il tetto segue. Il confronto
// che conta e' con le DUE sezioni di prima, che insieme facevano 2644px.
const TETTO_SEZIONE = 2000;
const TETTO_RIGA = 110;

let ok = 0; const ko = [];
const c = (nome, vero) => { if (vero) ok++; else ko.push(nome); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
p.on('dialog', d => d.accept());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = String(new Date().getFullYear());
await p.evaluate((anno) => {
  const nomi = ['Radio taxi', 'Assicurazione', 'Bollo auto', 'Commercialista', 'Finanziamento licenza',
                'Tasse e Contributi', 'Carburante', 'Manutenzione', 'Spese banca', 'Telefono'];
  const importi = [3151, 1500, 420, 1200, 2400, 4800, 6500, 900, 180, 360];
  window.vociFisse = nomi.map((n, i) => ({ slug: 'v' + i, nome: n, importo: importi[i], unita: 'anno',
                                           tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' }));
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['carburante']));
  localStorage.setItem('taxi_apri_budget', '1');
  window.dailyRecords = []; window.shifts = []; window.scadenze = []; window.veicoli = [];
  window.annoScelto = anno; window.versioneDati = 1;
  switchTab('categorie'); renderContent();
}, ANNO);
await p.waitForTimeout(600);

const m = await p.evaluate(() => {
  const det = [...document.querySelectorAll('details')].find(d => /Budget dei costi fissi/.test(d.innerText));
  if (!det) return null;
  const righe = [...det.querySelectorAll('.divide-y > div')];
  return {
    sezione: Math.round(det.getBoundingClientRect().height),
    nRighe: righe.length,
    rigaMax: righe.length ? Math.max(...righe.map(r => Math.round(r.getBoundingClientRect().height))) : null,
    tastoInserisci: /Inserisci una voce di budget/i.test(det.innerText),
    titoloElenco: /Le voci del \d{4}/i.test(det.innerText),
    // La fusione: i numeri del conguaglio devono stare in questa sezione...
    portaIConti: /budget\s/i.test(det.innerText) && /speso\s/i.test(det.innerText),
    // ...e non deve esistere piu' una seconda sezione che dice le stesse cose.
    sezioniBudget: [...document.querySelectorAll('details')]
        .filter(d => /Budget dei costi fissi|Conguaglio \d{4}/.test(d.innerText)).length,
    // Le spiegazioni lunghe non devono stare aperte: solo dentro il pieghevole.
    spiegaChiusa: ![...det.querySelectorAll('details')].some(d => d.open && /base minima del calcolo/i.test(d.innerText)),
    // innerText non legge dentro un <details> chiuso: per sapere che il testo
    // c'e' ancora serve textContent, per sapere che NON si vede serve innerText.
    spiegaPresente: /base minima del calcolo/i.test(det.textContent),
    spiegaNonVisibile: !/base minima del calcolo/i.test(det.innerText)
  };
});

c('la sezione del budget c\'è', !!m);
c(`dieci voci stanno in meno di ${TETTO_SEZIONE}px (viste ${m && m.sezione}px)`, !!m && m.sezione < TETTO_SEZIONE);
c('tutte e dieci le voci sono in elenco', !!m && m.nRighe === 10);
c(`una riga sta sotto i ${TETTO_RIGA}px (vista ${m && m.rigaMax}px)`, !!m && m.rigaMax < TETTO_RIGA);
c('c\'è il tasto per inserire una voce', !!m && m.tastoInserisci);
c('l\'elenco si chiama «Le voci del <anno>»', !!m && m.titoloElenco);
c('la sezione porta i conti del conguaglio', !!m && m.portaIConti);
c('e la sezione del budget e\' una sola', !!m && m.sezioniBudget === 1);
c('le spiegazioni lunghe esistono ancora', !!m && m.spiegaPresente);
c('ma stanno nel pieghevole, chiuso', !!m && m.spiegaChiusa && m.spiegaNonVisibile);

// --- inserire, modificare, eliminare dai tasti veri ---
await p.evaluate(() => aggiungiVoceFissa());
await p.waitForTimeout(350);
await p.evaluate(() => {
  const slug = window.voceFissaInModifica;
  document.getElementById('cf-nome-' + slug).value = 'Lavaggio';
  document.getElementById('cf-imp-' + slug).value = '240';
  document.getElementById('cf-unita-' + slug).value = 'anno';
  chiudiVoceFissa();
});
await p.waitForTimeout(400);
const dopoIns = await p.evaluate(() => (window.vociFisse || []).map(v => v.nome));
c('la voce inserita entra nel budget', dopoIns.includes('Lavaggio'));

const slugNuovo = await p.evaluate(() => ((window.vociFisse || []).find(v => v.nome === 'Lavaggio') || {}).slug);
await p.evaluate((s) => apriVoceFissa(s), slugNuovo);
await p.waitForTimeout(300);
await p.evaluate((s) => { document.getElementById('cf-imp-' + s).value = '300'; chiudiVoceFissa(); }, slugNuovo);
await p.waitForTimeout(400);
const dopoMod = await p.evaluate((s) => ((window.vociFisse || []).find(v => v.slug === s) || {}).importo, slugNuovo);
c('la modifica si salva', dopoMod === 300);

await p.evaluate((s) => eliminaVoceFissa(s), slugNuovo);
await p.waitForTimeout(400);
const dopoDel = await p.evaluate(() => (window.vociFisse || []).map(v => v.nome));
c('l\'eliminazione la toglie', !dopoDel.includes('Lavaggio') && dopoDel.length === 10);

// --- i tre colori delle cifre, sempre gli stessi ---
// budget blu, speso rosso se qualcosa e' uscito e grigio se no, differenza
// verde se avanza e rossa se sfora. Si guarda il colore calcolato, non la
// classe scritta nel markup: e' quello che l'occhio vede davvero.
const BLU = 'rgb(67, 56, 202)', ROSSO = 'rgb(220, 38, 38)', VERDE = 'rgb(21, 128, 61)';
await p.evaluate((anno) => {
  window.vociFisse = [
    { slug: 'a', nome: 'Mai pagata',   importo: 1200, unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' },
    { slug: 'b', nome: 'Sotto budget', importo: 1000, unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' },
    { slug: 'c', nome: 'Sforata',      importo:  500, unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' }
  ];
  window.dailyRecords = [
    { id: 's2', data: `${anno}-02-11`, tipo: 'USCITA', categoria: 'Sotto budget', metodo: 'Bonifico', importo: 200 },
    { id: 's3', data: `${anno}-02-12`, tipo: 'USCITA', categoria: 'Sforata',      metodo: 'Bonifico', importo: 508 }
  ];
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
}, ANNO);
await p.waitForTimeout(500);

const col = await p.evaluate(() => {
  const det = [...document.querySelectorAll('details')].find(d => /Budget dei costi fissi/.test(d.innerText));
  return [...det.querySelectorAll('.divide-y > div')].map(r => {
    const cifre = [...r.querySelectorAll('span')]
      .filter(x => x.children.length === 0 && /^(budget |speso |[+\u2212-]?\d)/.test(x.textContent.trim()));
    const dato = (pre) => {
      const e = cifre.find(x => x.textContent.trim().startsWith(pre));
      return e ? { colore: getComputedStyle(e).color, peso: getComputedStyle(e).fontWeight } : null;
    };
    const diff = cifre[cifre.length - 1];
    return {
      voce: r.innerText.split('\n')[0],
      budget: dato('budget'),
      speso: dato('speso'),
      differenza: diff ? { testo: diff.textContent.trim(), colore: getComputedStyle(diff).color, peso: getComputedStyle(diff).fontWeight } : null
    };
  });
});
const voce = (n) => col.find(x => x.voce.startsWith(n));
const grassetto = (x) => !!x && Number(x.peso) >= 700;

c('il budget e\' blu su tutte le voci', col.length === 3 && col.every(x => x.budget && x.budget.colore === BLU));
c('e in grassetto', col.every(x => grassetto(x.budget)));
c('speso resta grigio se non e\' uscito niente',
  !!voce('Mai pagata') && voce('Mai pagata').speso.colore !== ROSSO);
c('speso diventa rosso appena qualcosa esce',
  !!voce('Sotto budget') && voce('Sotto budget').speso.colore === ROSSO);
c('e in grassetto', col.every(x => grassetto(x.speso)));
c('la differenza e\' verde quando avanza',
  !!voce('Sotto budget') && voce('Sotto budget').differenza.colore === VERDE);
c('ed e\' rossa quando sfora',
  !!voce('Sforata') && voce('Sforata').differenza.colore === ROSSO);
c('anche la differenza e\' in grassetto', col.every(x => grassetto(x.differenza)));

await b.close();
console.log(`  ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
console.log(erroriJS.length ? '  *** errori JS: ' + erroriJS.join(' · ') : '  errori JS: nessuno');
