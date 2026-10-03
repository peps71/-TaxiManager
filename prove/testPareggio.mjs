// IL COSTO FISSO AL GIORNO E IL PAREGGIO
// Tre cose che devono reggere:
//  1. il costo del giorno e' budget + spese fuori budget + quota IRPEF;
//  2. l'etichetta segue il segno: «Sopra il pareggio» col piu' in verde,
//     «Sotto il pareggio» col meno in rosso. Prima diceva sempre «Sopra»,
//     anche con un numero negativo, ed era una contraddizione;
//  3. se nel budget c'e' gia' una voce che parla di IRPEF, l'app lo dice:
//     altrimenti la stessa tassa si conterebbe due volte.
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

const VERDE = 'rgb(21, 128, 61)';
const ROSSO = 'rgb(220, 38, 38)';
let ok = 0; const ko = [];
const c = (nome, vero) => { if (vero) ok++; else ko.push(nome); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 1400 }, locale: 'it-IT' });
const erroriJS = [];
p.on('pageerror', e => erroriJS.push(e.message));
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

// Prepara un anno di lavoro e una giornata scelta. budgetAnno decide se la
// giornata chiude sopra o sotto il pareggio.
async function giornata(budgetAnno, incassoDelGiorno, nomeVoce) {
  return p.evaluate(({ budgetAnno, incassoDelGiorno, nomeVoce }) => {
    const rec = [], tur = [];
    for (let m = 1; m <= 9; m++) for (let g = 1; g <= 22; g++) {
      const d = `2026-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
      tur.push({ id:`t${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:170 });
      for (let k = 0; k < 5; k++) rec.push({ id:`e${m}${g}${k}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:['Contanti','POS','App/Nexi','Conto','Contanti'][k], importo:14+k*3, ora:'10:00' });
    }
    const g = '2026-10-02';
    tur.push({ id:'tx', data:g, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true, kmTot:170 });
    rec.push({ id:'x1', data:g, tipo:'ENTRATA', categoria:'Corsa', metodo:'Contanti', importo:incassoDelGiorno, ora:'09:00' });
    window.vociFisse = [{ slug:'voce', nome:nomeVoce, importo:budgetAnno, unita:'anno', tipo:'scadenza', scadenza:'', dataInizio:'', dataFine:'' }];
    window.dailyRecords = rec; window.shifts = tur; window.scadenze = []; window.veicoli = [];
    window.annoScelto = '2026'; window.incassoVisibile = true;
    window.versioneDati = (window.versioneDati || 0) + 1;
    window.dashPeriodo = 'giorno'; setDashGiorno(g); switchTab('dashboard');
    const q = quotaDelGiorno(g);
    return { budget:q.budget, altre:q.altre, irpef:q.irpef, quota:q.quota, irpefAnno:q.irpefAnno, giorni:giorniDellAnno('2026') };
  }, { budgetAnno, incassoDelGiorno, nomeVoce });
}

function lettura() {
  return p.evaluate(() => {
    const t = [...document.querySelectorAll('p')].find(x => /Costo fisso al giorno/i.test(x.textContent || ''));
    if (!t) return null;
    const scheda = t.closest('div');
    const cifra = [...scheda.querySelectorAll('p')].find(x => /^[+−]/.test((x.textContent || '').trim()));
    return {
      testo: scheda.innerText,
      segnata: cifra ? cifra.textContent.trim() : '',
      colore: cifra ? getComputedStyle(cifra).color : ''
    };
  });
}

// --- giornata sotto il pareggio ---
const q1 = await giornata(26000, 51.90, 'Radio taxi');
const l1 = await lettura();
c('la scheda si chiama «Costo fisso al giorno»', !!l1 && /COSTO FISSO AL GIORNO/i.test(l1.testo));
c('il costo e\' budget + spese fuori budget + IRPEF', Math.abs((q1.budget + q1.altre + q1.irpef) - q1.quota) < 0.005);
c('la quota IRPEF e\' quella dell\'anno divisa per i giorni', Math.abs(q1.irpef * q1.giorni - q1.irpefAnno) < 0.01);
c('la riga dei pezzi mostra l\'IRPEF stimata', /IRPEF stimata/.test(l1.testo));
c('sotto il pareggio l\'etichetta dice «Sotto»', /SOTTO IL PAREGGIO/i.test(l1.testo) && !/SOPRA IL PAREGGIO/i.test(l1.testo));
c('sotto il pareggio la cifra porta il meno', l1.segnata.startsWith('−'));
c('sotto il pareggio la cifra e\' rossa', l1.colore === ROSSO);

// --- giornata sopra il pareggio ---
await giornata(600, 180, 'Radio taxi');
const l2 = await lettura();
c('sopra il pareggio l\'etichetta dice «Sopra»', /SOPRA IL PAREGGIO/i.test(l2.testo) && !/SOTTO IL PAREGGIO/i.test(l2.testo));
c('sopra il pareggio la cifra porta il piu\'', l2.segnata.startsWith('+'));
c('sopra il pareggio la cifra e\' verde', l2.colore === VERDE);

// --- una voce di budget che parla gia' di IRPEF ---
await giornata(600, 180, 'IRPEF e acconti');
const l3 = await lettura();
c('con una voce IRPEF a budget l\'app avvisa del doppio conteggio', /contando due volte/i.test(l3.testo));
await giornata(600, 180, 'Radio taxi');
const l4 = await lettura();
c('senza voce IRPEF a budget non avvisa', !/contando due volte/i.test(l4.testo));

await b.close();
console.log(`  ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
if (erroriJS.length) console.log('  *** errori JS: ' + erroriJS.join(' · '));
else console.log('  errori JS: nessuno');
