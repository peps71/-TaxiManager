// COERENZA, TERZO GIRO
// coerenza.mjs e coerenza2.mjs guardano i conti dell'anno e il report. Qui si
// guarda tutto quello che e' stato costruito dopo: il costo della giornata con
// dentro l'IRPEF, il budget fuso col conguaglio, i corrispettivi, il segno
// «da verificare».
// Il criterio e' sempre lo stesso: un'identita' che deve valere SEMPRE. Se due
// strade portano allo stesso numero, devono portarci davvero.
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

const ANNO = String(new Date().getFullYear());
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 900 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
p.on('dialog', d => d.accept());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

// Un archivio vero: due anni, metodi misti, spese dentro e fuori budget,
// un pagamento di una voce a budget, un paio di corse segnate da verificare.
await p.evaluate((anno) => {
  const prec = String(Number(anno) - 1);
  const rec = [], tur = [];
  const met = ['Contanti', 'POS', 'Satispay', 'App/Nexi', 'Conto'];
  [prec, anno].forEach(a => {
    for (let m = 1; m <= 12; m++) for (let g = 1; g <= 26; g++) {
      const d = `${a}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
      if (d > oggiISO()) continue;
      if (g % 7 === 0) continue;
      tur.push({ id: `t${a}${m}${g}`, data: d, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 170 });
      for (let k = 0; k < 6; k++)
        rec.push({ id: `e${a}${m}${g}${k}`, data: d, tipo: 'ENTRATA', categoria: 'Corsa',
                   metodo: met[(g + k) % 5], importo: 13 + ((g * 3 + k * 7) % 44), ora: '10:00' });
      if (g % 4 === 0) rec.push({ id: `u${a}${m}${g}`, data: d, tipo: 'USCITA', categoria: 'Carburante', metodo: 'Bonifico', importo: 61 });
      if (g % 9 === 0) rec.push({ id: `v${a}${m}${g}`, data: d, tipo: 'USCITA', categoria: 'Lavaggio', metodo: 'Contanti', importo: 18 });
      if (m === 5 && g === 12) rec.push({ id: `b${a}`, data: d, tipo: 'USCITA', categoria: 'Radio taxi', metodo: 'Bonifico', importo: 3151.08 });
      if (m === 3 && g === 8) rec.push({ id: `f${a}`, data: d, tipo: 'USCITA', categoria: 'Costi fissi - Voce sparita', metodo: 'Bonifico', importo: 240 });
    }
  });
  rec[10].daVerificare = true; rec[400].daVerificare = true;
  window.vociFisse = [
    { slug: 'radio', nome: 'Radio taxi',    importo: 3151.08, unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' },
    { slug: 'assic', nome: 'Assicurazione', importo: 1387,    unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' },
    { slug: 'fin',   nome: 'Finanziamento', importo: 797,     unita: 'mese', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' }
  ];
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['carburante']));
  window.dailyRecords = rec; window.shifts = tur; window.scadenze = []; window.veicoli = [];
  window.annoScelto = anno; window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
}, ANNO);

const d = await p.evaluate((anno) => {
  const giorniAnno = giorniDellAnno(anno);
  const oggi = oggiISO();
  const g = oggi.slice(0, 4) === anno ? oggi : `${anno}-06-15`;
  const usciteDelGiorno = (window.dailyRecords || []).filter(r => r.tipo === 'USCITA' && r.data === g);
  const cg = costoGiornata(g, usciteDelGiorno);
  const q = quotaDelGiorno(g);
  const irp = irpefDelGiorno(g);
  const cong = conguaglioAnno(anno);
  const st = getStats();   // legge l'anno attivo, non prende argomenti
  const agg = aggrega(anno);
  const f = calcolaTasseOrdinario(Math.max(0, utileProiettato(anno)), anno);

  // tutti i mesi dell'anno, dai corrispettivi
  const mesi = [];
  for (let m = 1; m <= 12; m++) mesi.push(corrispettiviMese(`${anno}-${String(m).padStart(2, '0')}`));

  // la quota IRPEF dev'essere la stessa per ogni giorno dello stesso anno
  const quoteIrpef = ['01-15', '06-15', '11-15'].map(x => irpefDelGiorno(`${anno}-${x}`).quota);

  // le spese coperte dal budget, fino a oggi: devono finire tutte in una riga
  // del conguaglio, una sola volta
  let coperteFinoAOggi = 0;
  (window.dailyRecords || []).forEach(r => {
    if (r.tipo !== 'USCITA') return;
    const dd = String(r.data || '');
    if (dd.slice(0, 4) !== anno) return;
    if (dd > cong.a) return;
    if (copertaDalBudget(r)) coperteFinoAOggi += parseFloat(r.importo || 0) || 0;
  });

  // un giorno in cui e' stata pagata una voce a budget: quella spesa NON deve
  // pesare su quel giorno (e' la regola della v109)
  const gRata = (window.dailyRecords || []).find(r => r.id === 'b' + anno);
  const usciteRata = (window.dailyRecords || []).filter(r => r.tipo === 'USCITA' && r.data === (gRata || {}).data);
  const cgRata = gRata ? costoGiornata(gRata.data, usciteRata) : null;

  const sommaVoci = elencoVociFisse()
    .reduce((t, v) => t + budgetVocePeriodo(v, `${anno}-01-01`, `${anno}-12-31`).totale, 0);

  return {
    anno, giorniAnno, g,
    cg: { budget: cg.budget, fuoriBudget: cg.fuoriBudget, irpef: cg.irpef, totale: cg.totale, vere: cg.vere },
    q: { budget: q.budget, altre: q.altre, irpef: q.irpef, quota: q.quota, spese: q.spese },
    irp: { quota: irp.quota, anno: irp.anno, irpef: irp.irpef, addizionali: irp.addizionali, utile: irp.utile },
    quoteIrpef,
    fisc: { irpef: f.irpef, addizionali: f.addizionali, inps: f.contributiInps, tot: f.tasseTot, imponibile: f.imponibileIrpef },
    utileProiettato: utileProiettato(anno), utileFiscale: utileFiscaleAnno(anno),
    cong: {
      budget: cong.budget, speso: cong.speso, differenza: cong.differenza, maturato: cong.maturato,
      sommaBudgetRighe: cong.righe.reduce((t, r) => t + r.budget, 0),
      sommaSpesoRighe: cong.righe.reduce((t, r) => t + r.speso, 0),
      sommaMovimenti: cong.righe.reduce((t, r) => t + r.voci.reduce((x, m) => x + (parseFloat(m.importo) || 0), 0), 0),
      nRighe: cong.righe.length
    },
    coperteFinoAOggi,
    budgetAnno: budgetAnno(anno), sommaVoci,
    cgRata: cgRata ? { budget: cgRata.budget, fuoriBudget: cgRata.fuoriBudget, vere: cgRata.vere, pagateABudget: cgRata.pagateOggiABudget } : null,
    rataImporto: gRata ? gRata.importo : 0,
    st: { entrate: st.entrate, uscite: st.uscite, tasse: st.tasse, utileFiscale: st.utileFiscale, utileCassa: st.utileCassa,
          entrateTracciate: st.entrateTracciate, deducibili: st.deducibili, nonDeducibili: st.nonDeducibili },
    nCorseAnno: (window.dailyRecords || []).filter(r => r.tipo === 'ENTRATA' && String(r.data || '').slice(0, 4) === anno).length,
    agg: { incassi: agg.incassi, uscite: agg.uscite, carb: agg.carburante, man: agg.manutenzione, altro: agg.altroSpese,
           ded: agg.usciteDed },
    mesi: mesi.map(c => ({
      tot: c.totali.tot, n: c.totali.n, daVerificare: c.totali.daVerificare,
      sommaRighe: c.righe.reduce((t, r) => t + r.tot, 0),
      sommaColonne: c.righe.reduce((t, r) => t + METODI_CORRISPETTIVI.reduce((x, k) => x + r[k], 0), 0),
      sommaVerifica: c.righe.reduce((t, r) => t + r.daVerificare, 0),
      sommaVerificaMetodi: c.righe.reduce((t, r) => t + METODI_CORRISPETTIVI.reduce((x, k) => x + r.verifica[k], 0), 0)
    }))
  };
}, ANNO);

let ok = 0; const ko = [];
const E = 0.02;
const c = (nome, a, b2) => {
  const bene = Math.abs(a - b2) < E;
  if (bene) ok++; else ko.push(`${nome}: ${Number(a).toFixed(2)} contro ${Number(b2).toFixed(2)} (scarto ${(a - b2).toFixed(2)})`);
};
const v = (nome, bene) => { if (bene) ok++; else ko.push(nome); };

console.log(`  archivio: ${d.cong.nRighe} righe di conguaglio · utile proiettato ${d.utileProiettato.toFixed(2)} €\n`);

console.log('  --- il costo di una giornata ---');
c('costo = budget + spese del giorno + IRPEF', d.cg.totale, d.cg.budget + d.cg.fuoriBudget + d.cg.irpef);
c('la quota del mese = budget + media altre + IRPEF', d.q.quota, d.q.budget + d.q.altre + d.q.irpef);
c('la parte di sole spese esclude l\'IRPEF', d.q.spese, d.q.budget + d.q.altre);
c('il budget del giorno e\' lo stesso nelle due strade', d.cg.budget, d.q.budget);
c('la quota IRPEF e\' la stessa nelle due strade', d.cg.irpef, d.q.irpef);

console.log('  --- l\'IRPEF spalmata ---');
c('la quota per i giorni dell\'anno fa l\'IRPEF dell\'anno', d.irp.quota * d.giorniAnno, d.irp.anno);
c('l\'IRPEF dell\'anno = IRPEF a scaglioni + addizionali', d.irp.anno, d.irp.irpef + d.irp.addizionali);
c('e sono quelle calcolate sull\'utile proiettato', d.irp.irpef, d.fisc.irpef);
c('anche le addizionali', d.irp.addizionali, d.fisc.addizionali);
c('l\'utile su cui e\' calcolata e\' quello proiettato', d.irp.utile, Math.max(0, d.utileProiettato));
v('la proiezione non scende mai sotto l\'utile gia\' registrato', d.utileProiettato >= d.utileFiscale - E);
v('la quota IRPEF e\' identica in ogni giorno dell\'anno',
  Math.abs(d.quoteIrpef[0] - d.quoteIrpef[1]) < 0.0001 && Math.abs(d.quoteIrpef[1] - d.quoteIrpef[2]) < 0.0001);
c('i contributi INPS restano fuori dalla quota giornaliera', d.irp.anno, d.fisc.tot - d.fisc.inps);

console.log('  --- la rata a budget non casca sul giorno in cui la paghi ---');
v('quel giorno ha una spesa vera grossa', !!d.cgRata && d.cgRata.vere >= d.rataImporto - E);
c('ma fuori budget quel giorno non c\'e\' niente di quella rata', d.cgRata.fuoriBudget, d.cgRata.vere - d.rataImporto);
c('ed e\' dichiarata come pagata a budget', d.cgRata.pagateABudget, d.rataImporto);

console.log('  --- il budget e il conguaglio ---');
c('il budget dell\'anno = somma delle voci', d.budgetAnno, d.sommaVoci);
c('il budget del conguaglio = somma delle righe', d.cong.budget, d.cong.sommaBudgetRighe);
c('lo speso del conguaglio = somma delle righe', d.cong.speso, d.cong.sommaSpesoRighe);
c('lo speso delle righe = somma dei movimenti elencati', d.cong.sommaSpesoRighe, d.cong.sommaMovimenti);
c('la differenza = budget - speso', d.cong.differenza, d.cong.budget - d.cong.speso);
c('ogni spesa coperta dal budget finisce in una riga, una volta sola', d.cong.speso, d.coperteFinoAOggi);
v('il maturato non supera il budget', d.cong.maturato <= d.cong.budget + E);

console.log('  --- i corrispettivi, mese per mese ---');
d.mesi.forEach((m, i) => {
  const nome = `${String(i + 1).padStart(2, '0')}`;
  c(`${nome}: il totale = somma delle righe`, m.tot, m.sommaRighe);
  c(`${nome}: il totale = somma delle colonne metodo`, m.tot, m.sommaColonne);
  c(`${nome}: i segni del mese = somma per giorno`, m.daVerificare, m.sommaVerifica);
  c(`${nome}: i segni per giorno = somma per metodo`, m.sommaVerifica, m.sommaVerificaMetodi);
});
c('i dodici mesi fanno gli incassi dell\'anno', d.mesi.reduce((t, m) => t + m.tot, 0), d.st.entrate);
c('e contano tutte le corse dell\'anno, nessuna persa', d.mesi.reduce((t, m) => t + m.n, 0), d.nCorseAnno);
c('aggrega dice gli stessi incassi di getStats', d.agg.incassi, d.st.entrate);

console.log('  --- le uscite, da due strade ---');
c('getStats e aggrega dicono le stesse uscite', d.st.uscite, d.agg.uscite);
c('le tre categorie ricompongono le uscite', d.agg.uscite, d.agg.carb + d.agg.man + d.agg.altro);
c('deducibili + non deducibili = uscite', d.st.deducibili + d.st.nonDeducibili, d.st.uscite);
c('le deducibili di getStats e di aggrega coincidono', d.st.deducibili, d.agg.ded);

console.log('  --- le tasse ---');
c('il totale = INPS + IRPEF + addizionali', d.fisc.tot, d.fisc.inps + d.fisc.irpef + d.fisc.addizionali);
c('l\'imponibile IRPEF = utile - contributi', d.fisc.imponibile, Math.max(0, Math.max(0, d.utileProiettato) - d.fisc.inps));
c('l\'utile di cassa = incassi - uscite', d.st.utileCassa, d.st.entrate - d.st.uscite);

await b.close();
console.log(`\n  ${ko.length ? ko.length + ' INCOERENZE' : 'nessuna incoerenza'} · ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
console.log(erroriJS.length ? '  *** errori JS: ' + erroriJS.join(' · ') : '  errori JS: nessuno');
