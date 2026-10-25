// LA GRAFICA DELLA v158, MISURATA
// Tre cose cambiate, tre modi di controllarle:
//   1. il comando premuto si muove          -> si preme col mouse e si guarda
//   2. la sotto-scheda aperta si vede tutta -> si misura dove sta
//   3. le misure stanno in scala            -> si legge quanto vengono grandi
// Nessuna delle tre si vede in uno specchio del testo: il testo non cambia.
// Se non si misurano qui, non le controlla nessuno.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

let guai = 0;
const ok = (c, testo, dettaglio) => {
  if (!c) guai++;
  console.log(`  ${c ? 'ok  ' : '*** '}${testo}${dettaglio ? '  (' + dettaglio + ')' : ''}${c ? '' : ' ***'}`);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'it-IT' });
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

// ------------------------------------------------------------------
console.log('\n1. IL COMANDO PREMUTO SI MUOVE');
// ------------------------------------------------------------------
await p.evaluate(() => { switchTab('altro'); renderContent(); });
await p.waitForTimeout(120);

const primoTasto = p.locator('#main-container button').first();
const fermo = await primoTasto.evaluate(e => getComputedStyle(e).transform);
const box = await primoTasto.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.waitForTimeout(140);   // la transizione dura 90ms
const premuto = await primoTasto.evaluate(e => ({
  trasformazione: getComputedStyle(e).transform,
  filtro: getComputedStyle(e).filter
}));
await p.mouse.up();
await p.waitForTimeout(140);
const rilasciato = await primoTasto.evaluate(e => getComputedStyle(e).transform);

ok(fermo === 'none' || fermo === 'matrix(1, 0, 0, 1, 0, 0)',
   'da fermo il tasto non e\' trasformato', fermo);
ok(premuto.trasformazione !== fermo && /matrix\(0\.9/.test(premuto.trasformazione),
   'premuto si stringe', premuto.trasformazione);
ok(/brightness/.test(premuto.filtro),
   'premuto si scurisce', premuto.filtro);
ok(rilasciato === fermo,
   'rilasciato torna com\'era', rilasciato);

const attesa = await primoTasto.evaluate(e => getComputedStyle(e).touchAction);
ok(attesa === 'manipulation',
   'niente mezzo secondo di attesa prima che il comando parta', attesa);

// un comando spento non deve dire «preso»
const spenti = await p.evaluate(() => {
  const b = document.createElement('button');
  b.disabled = true; b.textContent = 'spento';
  document.getElementById('main-container').appendChild(b);
  // :active non si puo' simulare da qui: si legge la regola nel foglio
  let regola = null;
  for (const foglio of document.styleSheets) {
    let regole; try { regole = foglio.cssRules; } catch (e) { continue; }
    for (const r of regole) if (r.selectorText && r.selectorText.includes('button:active')) regola = r.selectorText;
  }
  b.remove();
  return regola;
});
ok(spenti && spenti.includes(':not(:disabled)'),
   'un tasto spento non reagisce al tocco', spenti || 'regola non trovata');

// ------------------------------------------------------------------
console.log('\n2. LA SOTTO-SCHEDA APERTA SI VEDE TUTTA');
// ------------------------------------------------------------------
for (const scheda of ['categorie', 'scadenze', 'auto', 'rendimento', 'report', 'versamenti', 'note', 'cloud']) {
  const r = await p.evaluate((s) => {
    switchTab(s); renderContent();
    const attiva = document.querySelector('[data-scheda-attiva]');
    if (!attiva) return { assente: true };
    const fila = attiva.closest('[data-schede-scorrevoli]');
    const q = attiva.getBoundingClientRect();
    const f = fila.getBoundingClientRect();
    return {
      etichetta: attiva.textContent.trim(),
      fuoriSinistra: Math.round(f.left - q.left),
      fuoriDestra: Math.round(q.right - f.right),
      scorrevole: fila.scrollWidth > fila.clientWidth + 1
    };
  }, scheda);
  if (r.assente) { ok(false, `${scheda}: nessuna linguetta attiva`); continue; }
  const dentro = r.fuoriSinistra <= 1 && r.fuoriDestra <= 1;
  ok(dentro, `${scheda}: «${r.etichetta}» tutta in vista`,
     dentro ? (r.scorrevole ? 'fila piu\' larga dello schermo' : 'ci sta tutta')
            : `sborda ${Math.max(r.fuoriSinistra, r.fuoriDestra)}px`);
}

// Sullo schermo grande: dove la fila ci sta tutta non si deve spostare di un
// pixel - centrare qualcosa che e' gia' tutto in vista e' solo un sobbalzo.
// La fila intera chiede 1004px: a 1280 lo spazio per il contenuto e' 960 e
// quindi scorre ancora per davvero, a 1600 ci sta. Si provano tutti e due.
for (const larghezza of [1280, 1600]) {
  const grande = await b.newPage({ viewport: { width: larghezza, height: 900 }, locale: 'it-IT' });
  grande.on('dialog', d => d.accept());
  await grande.goto(APP);
  await grande.waitForFunction(() => typeof window.switchTab === 'function');
  const r = await grande.evaluate(() => {
    switchTab('report'); renderContent();
    const attiva = document.querySelector('[data-scheda-attiva]');
    const fila = attiva && attiva.closest('[data-schede-scorrevoli]');
    if (!fila) return null;
    const q = attiva.getBoundingClientRect(), f = fila.getBoundingClientRect();
    return { scorrimento: fila.scrollLeft,
             ciSta: fila.scrollWidth <= fila.clientWidth + 1,
             fuori: Math.max(Math.round(f.left - q.left), Math.round(q.right - f.right)) };
  });
  await grande.close();
  if (!r) { ok(false, `${larghezza}px: nessuna linguetta attiva`); continue; }
  ok(r.fuori <= 1, `${larghezza}px: la linguetta aperta si vede tutta`, `sborda ${r.fuori}px`);
  if (r.ciSta) ok(r.scorrimento === 0, `${larghezza}px: la fila ci sta tutta e non si sposta`,
                  'scorrimento ' + r.scorrimento);
  else ok(true, `${larghezza}px: la fila non ci sta nemmeno qui, giusto spostarla`,
          'scorrimento ' + r.scorrimento);
}

// ------------------------------------------------------------------
console.log('\n3. LE MISURE STANNO IN SCALA');
// ------------------------------------------------------------------
const misure = await p.evaluate(() => {
  const prova = (classi) => {
    const e = document.createElement('div');
    e.className = classi; e.textContent = 'x';
    document.body.appendChild(e);
    const s = getComputedStyle(e);
    const r = { corpo: s.fontSize, interlinea: s.lineHeight, angolo: s.borderTopLeftRadius };
    e.remove(); return r;
  };
  return {
    xs: prova('text-xs'),
    xsMaiuscolo: prova('text-xs uppercase'),
    sm: prova('text-sm'),
    etichetta: prova('etichetta'),
    angoli: ['rounded-sm','rounded-md','rounded-lg','rounded-xl','rounded-2xl'].map(c => prova(c).angolo)
  };
});
ok(misure.xs.corpo === '13px', 'il corpo piccolo e\' 13px', misure.xs.corpo);
ok(misure.sm.corpo === '15px', 'il corpo medio e\' 15px', misure.sm.corpo);
ok(misure.xsMaiuscolo.corpo === misure.etichetta.corpo,
   'le etichettine maiuscole hanno tutte la stessa misura',
   `scritte a mano ${misure.xsMaiuscolo.corpo}, classe .etichetta ${misure.etichetta.corpo}`);
ok(parseFloat(misure.xsMaiuscolo.corpo) < parseFloat(misure.xs.corpo),
   'il cartellino e\' piu\' piccolo di quello che annuncia',
   `${misure.xsMaiuscolo.corpo} contro ${misure.xs.corpo}`);
ok(parseFloat(misure.xs.interlinea) > parseFloat(misure.xs.corpo) * 1.2,
   'l\'interlinea e\' salita insieme al carattere', misure.xs.interlinea);

const angoli = misure.angoli.map(a => parseFloat(a));
ok(angoli.join(' ') === '3 8 10 14 20', 'gli angoli sono la scala prevista', misure.angoli.join(' · '));
let inScala = true;
for (let i = 2; i < angoli.length; i++) {
  const passo = angoli[i] / angoli[i-1];
  if (passo < 1.25 || passo > 1.6) inScala = false;
}
ok(inScala, 'ogni gradino e\' circa una volta e mezza il precedente',
   angoli.slice(1).map((a,i)=> i ? (a/angoli[i]).toFixed(2) : '').filter(Boolean).join(' · '));

// ------------------------------------------------------------------
console.log('\n4. IL COLORE STA NELLA BARRETTA, NON NEL FONDO');
// ------------------------------------------------------------------
// Prima della v159 c'erano 39 riquadri grossi con il fondo colorato, su sette
// tinte: ognuno diceva «guarda me» e nessuno veniva letto per primo.
// Ventinove sono diventati bianchi con una barretta. I dieci che restano
// stanno qui sotto UNO PER UNO, con il motivo: il colore li' sta facendo un
// lavoro, non decorazione. Se ne compare un undicesimo, questa prova lo dice.
const sorgente = readFileSync(join(RADICE, 'index.html'), 'utf8');
const AMMESSI = [
  ['bg-yellow-100 p-3 rounded-xl',        'riga del prospetto che aspetta un controllo'],
  ["'bg-gray-50' : 'bg-yellow-100'",      'riga del prospetto che aspetta un controllo'],
  ['bg-indigo-50/70 rounded-xl p-3',      'le caselle piccole dentro la spiegazione del costo'],
  ['p-3 bg-green-50 space-y-2',           'una corsa aperta in modifica: il verde dice che e\' un incasso'],
  ['p-3 bg-red-50 space-y-2',             'una spesa aperta in modifica: il rosso dice che e\' un\'uscita'],
  ['text-gray-500 bg-yellow-50',          'la fascia in fondo al prospetto'],
  ['bg-white hover:bg-yellow-50',         'un tasto bianco che si scalda sotto il dito'],
  ["'border-green-200 bg-green-50'",      'la voce piu\' caro dell\'elenco, in cima'],
  ['bg-red-50 hover:bg-red-100',          'un tasto che cancella: il rosso e\' il senso del tasto']
];
const righe = sorgente.split('\n');
const tinta = /bg-(yellow|red|indigo|green|purple|blue|orange|stone|pink|amber)-(50|100)(\/\d+)?\b/;
// Cos'e' «un riquadro» e cosa no: l'imbottitura. p-3 e oltre e' una scheda;
// px-4 con py-2 e' una casella di totali (ce n'era una cosi', ed era
// sfuggita al primo giro perche' il setaccio guardava solo py-3). Un tasto
// «Elimina» sta a px-3 py-2 e resta fuori: li' il rosso e' il senso del
// tasto, non decorazione.
const grosso = /\bp-[3-8]\b|\bpy-[3-8]\b|(?=.*\bpx-[4-8]\b).*\bpy-2\b/;
const intrusi = [];
righe.forEach((r, i) => {
  if (r.length > 50000) return;                       // il foglio di stile
  for (const m of r.matchAll(/class="([^"]*)"/g)) {
    const c = m[1];
    if (!tinta.test(c) || !grosso.test(c)) continue;
    if (AMMESSI.some(([pezzo]) => c.includes(pezzo))) continue;
    intrusi.push(`riga ${i + 1}: ${c.slice(0, 90)}`);
  }
});
ok(intrusi.length === 0, 'nessun riquadro grosso col fondo colorato fuori elenco',
   intrusi.length ? intrusi.join(' | ') : `${AMMESSI.length} motivi dichiarati`);

// La barretta c'e' davvero, su ogni riquadro, e non e' il colore di riserva.
// Senza dati meta' di questi riquadri non si disegna nemmeno - l'avviso delle
// scadenze, le schede del rendimento - e la guardia girerebbe a vuoto.
await p.evaluate(() => {
  const rec = [], tur = [], met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  const anno = new Date().getFullYear();
  for (const a of [anno - 1, anno]) for (let m = 1; m <= 12; m++) for (let g = 1; g <= 26; g += 2) {
    const d = `${a}-${String(m).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
    tur.push({ id:`t${a}${m}${g}`, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00',
               ore:12, lavorato:true, kmTot:170 });
    for (let c = 0; c < 5; c++)
      rec.push({ id:`e${a}${m}${g}${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa',
                 metodo:met[(g+c)%5], importo:14+((g*3+c*7)%40), ora:'10:00' });
    if (g % 5 === 1) rec.push({ id:`u${a}${m}${g}`, data:d, tipo:'USCITA',
                                categoria:'Carburante', metodo:'Bonifico', importo:58 });
  }
  window.dailyRecords = rec; window.shifts = tur;
  window.versamenti = [{ id:'v1', data:`${anno}-03-15`, importo:900, dove:'Banca' }];
  window.scadenze = [{ id:'s1', nome:'Revisione', data:`${anno}-01-10`, fatta:false }];
  window.veicoli = [{ id:'ve1', targa:'AB123CD', modello:'Octavia',
                      dataAcquisto:`${anno-1}-01-10`, prezzoAcquisto:28000, kmAcquisto:0, uscita:'in-uso' }];
  window.vociFisse = [{ slug:'radio', nome:'Radio taxi', importo:3151.08, unita:'anno',
                        tipo:'scadenza', scadenza:`${anno-1}-10-10`, dataInizio:'', dataFine:'' }];
  window.annoScelto = String(anno); window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
});
const barrette = await p.evaluate(() => {
  const fuori = [];
  let visti = 0;
  for (const s of ['dashboard','giornata','uscite','categorie','scadenze','auto',
                   'rendimento','report','versamenti','note','cloud','altro']) {
    switchTab(s); renderContent();
    document.querySelectorAll('.riquadro-tinto').forEach(e => {
      visti++;
      const st = getComputedStyle(e);
      const tinta = st.getPropertyValue('--tinta').trim();
      if (!tinta) fuori.push(`${s}: riquadro senza tinta`);
      else if (!st.boxShadow.includes('inset')) fuori.push(`${s}: barretta assente (${st.boxShadow})`);
      // bianco su bianco si deve comunque distinguere: il filo deve esserci
      else if (st.borderTopWidth === '0px') fuori.push(`${s}: senza filo`);
    });
  }
  return { visti, fuori };
});
ok(barrette.visti > 0, 'i riquadri con la barretta si disegnano', `${barrette.visti} visti`);
ok(barrette.fuori.length === 0, 'ognuno ha la sua tinta, la barretta e il filo',
   barrette.fuori.length ? barrette.fuori.slice(0, 3).join(' | ') : 'tutti a posto');

// In stampa l'ombra sparisce: la barretta deve rifarsi bordo, o il foglio
// per il commercialista esce senza colore.
await p.emulateMedia({ media: 'print' });
const inStampa = await p.evaluate(() => {
  switchTab('report'); renderContent();
  const e = document.querySelector('.riquadro-tinto');
  if (!e) return null;
  const st = getComputedStyle(e);
  return { ombra: st.boxShadow, bordo: st.borderLeftWidth, colore: st.borderLeftColor };
});
await p.emulateMedia({ media: 'screen' });
ok(inStampa && inStampa.ombra === 'none' && parseFloat(inStampa.bordo) >= 3,
   'sulla carta la barretta diventa un bordo, che si stampa',
   inStampa ? `bordo ${inStampa.bordo} ${inStampa.colore}` : 'nessun riquadro in stampa');

await b.close();
console.log(`\n  ${guai === 0 ? 'tutto a posto' : guai + ' controlli falliti'}`);
process.exit(guai ? 1 : 0);
