// LA GRAFICA DELLA v158, MISURATA
// Tre cose cambiate, tre modi di controllarle:
//   1. il comando premuto si muove          -> si preme col mouse e si guarda
//   2. la sotto-scheda aperta si vede tutta -> si misura dove sta
//   3. le misure stanno in scala            -> si legge quanto vengono grandi
// Nessuna delle tre si vede in uno specchio del testo: il testo non cambia.
// Se non si misurano qui, non le controlla nessuno.
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

await b.close();
console.log(`\n  ${guai === 0 ? 'tutto a posto' : guai + ' controlli falliti'}`);
process.exit(guai ? 1 : 0);
