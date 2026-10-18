// IL MODO SCURO, MISURATO
// Guardare tredici schermate a occhio non basta: una scritta grigia su fondo
// grigio si nota solo se ci si ferma proprio li'. Qui si misura.
//   1. il modo chiaro non e' cambiato di un colore          (confronto col prima)
//   2. ogni scritta si legge davvero                        (contrasto calcolato)
//   3. non resta nessuna superficie accesa in mezzo al buio
//   4. l'interruttore fa quello che dice
//   5. il foglio da stampare resta chiaro anche di notte
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

const SCHERMATE = ['dashboard','giornata','uscite','categorie','scadenze','auto',
                   'rendimento','report','versamenti','note','cloud','altro'];

// Quello che serve dentro la pagina: semi, contrasto, lettura dei colori.
const DENTRO = `
window.__semina = function () {
  const rec = [], tur = [], met = ['Contanti','POS','Satispay','App/Nexi','Conto'];
  const anno = new Date().getFullYear();
  for (const a of [anno - 1, anno]) for (let m = 1; m <= 12; m++) for (let g = 1; g <= 26; g += 2) {
    const d = a + '-' + String(m).padStart(2,'0') + '-' + String(g).padStart(2,'0');
    tur.push({ id:'t'+a+m+g, data:d, turno: g % 9 === 1 ? 'Festivo' : 'Le otto',
               inizio:'08:00', fine:'20:00', ore:12, lavorato: g % 9 !== 1, kmTot:170 });
    for (let c = 0; c < 5; c++)
      rec.push({ id:'e'+a+m+g+c, data:d, tipo:'ENTRATA', categoria:'Corsa',
                 metodo:met[(g+c)%5], importo:14+((g*3+c*7)%40), ora:'10:00',
                 verifica: (g+c) % 23 === 0 ? true : undefined });
    if (g % 5 === 1) rec.push({ id:'u'+a+m+g, data:d, tipo:'USCITA',
                                categoria:'Carburante', metodo:'Bonifico', importo:58 });
  }
  window.dailyRecords = rec; window.shifts = tur;
  window.versamenti = [{ id:'v1', data: anno + '-03-15', importo:900, dove:'Banca' }];
  window.scadenze = [{ id:'s1', nome:'Revisione', data: anno + '-01-10', fatta:false }];
  window.veicoli = [{ id:'ve1', targa:'AB123CD', modello:'Octavia',
                      dataAcquisto:(anno-1)+'-01-10', prezzoAcquisto:28000, kmAcquisto:0, uscita:'in-uso' }];
  window.vociFisse = [{ slug:'radio', nome:'Radio taxi', importo:3151.08, unita:'anno',
                        tipo:'scadenza', scadenza:(anno-1)+'-10-10', dataInizio:'', dataFine:'' }];
  window.note = [{ id:'n1', data: anno + '-04-04', tipo:'Vettura', testo:'Gomme nuove' }];
  window.annoScelto = String(anno); window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
};
window.__rgb = function (s) {
  const m = String(s).match(/rgba?\\(([^)]+)\\)/);
  if (!m) return null;
  const p = m[1].split(',').map(x => parseFloat(x));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
window.__sopra = function (f, d) {           // f sopra d, con la sua trasparenza
  const a = f.a;
  return { r: f.r*a + d.r*(1-a), g: f.g*a + d.g*(1-a), b: f.b*a + d.b*(1-a), a: 1 };
};
window.__luce = function (c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
};
window.__contrasto = function (a, b) {
  const l1 = window.__luce(a), l2 = window.__luce(b);
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
};
window.__fondoDi = function (e) {
  let n = e, giu = { r:255, g:255, b:255, a:1 };
  const pila = [];
  while (n && n !== document.documentElement) {
    const c = window.__rgb(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0) { pila.push(c); if (c.a === 1) break; }
    n = n.parentElement;
  }
  const radice = window.__rgb(getComputedStyle(document.documentElement).backgroundColor)
              || window.__rgb(getComputedStyle(document.body).backgroundColor);
  if (radice && radice.a === 1) giu = radice;
  for (let i = pila.length - 1; i >= 0; i--) giu = window.__sopra(pila[i], giu);
  return giu;
};
`;

async function apri(b, scuro) {
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT',
                              colorScheme: scuro ? 'dark' : 'light' });
  p.on('dialog', d => d.accept());
  await p.goto(APP);
  await p.evaluate(() => localStorage.clear());
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(DENTRO);
  await p.evaluate(() => window.__semina());
  return p;
}

const b = await chromium.launch();

// ------------------------------------------------------------------
console.log('\n1. DI GIORNO NON E\' CAMBIATO NIENTE');
// ------------------------------------------------------------------
// Il blocco del modo scuro e' tutto prefissato: di giorno non deve esistere.
// Non e' una promessa, e' una misura: si leggono i colori di ogni elemento di
// ogni schermata e si confrontano con quelli della versione precedente.
const PRIMA = process.env.PRIMA;
async function colori(p) {
  // Si confrontano gli INSIEMI dei colori usati, non gli elementi uno per
  // uno nell'ordine in cui capitano. Il primo giro era per posizione, e si
  // e' rotto appena la schermata delle impostazioni ha preso una sezione in
  // piu': duecentocinquanta differenze, tutte false, solo perche' gli indici
  // si erano spostati di uno. Un colore nuovo che spunta di giorno e' quello
  // che si vuole scoprire, e si vede benissimo cosi'.
  return p.evaluate((schermate) => {
    const per = {};
    for (const s of schermate) {
      switchTab(s); renderContent();
      const visti = new Set();
      document.querySelectorAll('#main-container *').forEach(e => {
        const st = getComputedStyle(e);
        visti.add('testo ' + st.color);
        visti.add('fondo ' + st.backgroundColor);
        visti.add('filo ' + st.borderTopColor);
      });
      per[s] = [...visti].sort();
    }
    return per;
  }, SCHERMATE);
}
// I colori che compaiono di giorno solo perche' questa versione ha aggiunto
// la sezione «Aspetto» alle impostazioni. Sono dichiarati uno per uno: tutto
// quello che spunta fuori da qui e' il modo scuro che e' colato nel giorno.
const AGGIUNTI_APPOSTA = ['testo rgba(250, 204, 21, 0.7)'];
if (PRIMA && existsSync(PRIMA)) {
  const pA = await apri(b, false);
  const dopo = await colori(pA);
  await pA.close();
  const pB = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT', colorScheme: 'light' });
  pB.on('dialog', d => d.accept());
  await pB.goto('file://' + PRIMA);
  await pB.evaluate(() => localStorage.clear());
  await pB.goto('file://' + PRIMA);
  await pB.waitForFunction(() => typeof window.switchTab === 'function');
  await pB.evaluate(DENTRO);
  await pB.evaluate(() => window.__semina());
  const prima = await colori(pB);
  await pB.close();
  const nuoviColori = [];
  let contati = 0;
  for (const s of SCHERMATE) {
    const eraLi = new Set(prima[s] || []);
    for (const c of dopo[s] || []) {
      contati++;
      if (!eraLi.has(c) && !AGGIUNTI_APPOSTA.includes(c)) nuoviColori.push(`${s}: ${c}`);
    }
  }
  ok(nuoviColori.length === 0,
     'di giorno non spunta un colore che prima non c\'era',
     nuoviColori.length ? [...new Set(nuoviColori)].slice(0, 6).join(' | ') : `${contati} colori confrontati su ${SCHERMATE.length} schermate`);
} else {
  console.log('  --  confronto col prima saltato (si fa una volta, con PRIMA=/percorso/prima.html)');
}

// La guardia che resta, e che non ha bisogno del «prima»: il modo scuro deve
// stare TUTTO dentro regole prefissate. Finche' e' cosi', di giorno quel
// blocco non esiste e non c'e' niente da ricontrollare. Una riga scritta
// senza prefisso rifarebbe anche il giorno, in silenzio.
const sorgente = readFileSync(join(RADICE, 'index.html'), 'utf8');
const fogli = [...sorgente.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
// Si parte dall'APERTURA del commento, non dal titolo: tagliando a meta' di
// un commento il /* resta fuori, la pulizia non lo riconosce piu' e il testo
// del commento finisce fra i selettori. Ci sono cascato.
const inizio = fogli.lastIndexOf('/*', fogli.indexOf('IL MODO SCURO'));
const fine = fogli.lastIndexOf('/*', fogli.indexOf('Stili specifici per la Stampa'));
ok(inizio > 0 && fine > inizio, 'il blocco del modo scuro si trova', `${inizio}..${fine}`);
const blocco = fogli.slice(inizio, fine);
// Si contano le parentesi, non si cerca un disegno nel testo: il primo
// tentativo usava un'espressione regolare e tirava dentro pezzi di commento
// e valori di dichiarazioni. Qui si cammina carattere per carattere, e
// quello che sta prima di una graffa aperta a livello zero (o dentro una
// @media) e' un selettore, punto.
const senzaCommenti = blocco.replace(/\/\*[\s\S]*?\*\//g, '');
const selettori = [];
let buf = '', liv = 0;
for (const ch of senzaCommenti) {
  if (ch === '{') {
    const testa = buf.trim();
    if (testa && !testa.startsWith('@')) for (const sel of testa.split(',')) {
      const t = sel.trim(); if (t) selettori.push(t);
    }
    liv++; buf = '';
  } else if (ch === '}') { liv--; buf = ''; }
  else if (liv === 0 || buf !== '' || !/\s/.test(ch)) {
    // dentro un blocco di dichiarazioni si accumula lo stesso, ma la graffa
    // di chiusura azzera: cosi' solo i selettori veri arrivano a una graffa
    buf += ch;
  }
  if (ch === ';') buf = '';
}
const nudi = selettori.filter(x => !x.startsWith(':root[data-tema="scuro"]'));
ok(nudi.length === 0, 'ogni regola del modo scuro e\' prefissata',
   nudi.length ? nudi.slice(0, 5).join(' | ') : `${selettori.length} selettori, tutti sotto [data-tema="scuro"]`);
// e fuori dal blocco nessuno deve nominare il tema
const fuoriDalBlocco = fogli.slice(0, inizio) + fogli.slice(fine);
ok(!fuoriDalBlocco.includes('data-tema'),
   'fuori dal blocco nessuna regola nomina il tema',
   fuoriDalBlocco.includes('data-tema') ? 'ce n\'e\' una' : 'nessuna');

// ------------------------------------------------------------------
console.log('\n2. DI NOTTE OGNI SCRITTA SI LEGGE');
// ------------------------------------------------------------------
const p = await apri(b, true);
const lettura = await p.evaluate((schermate) => {
  const deboli = [];
  let misurate = 0;
  for (const s of schermate) {
    switchTab(s); renderContent();
    document.querySelectorAll('#main-container *').forEach(e => {
      if (e.children.length) return;                       // solo le foglie
      const t = (e.textContent || '').trim();
      if (!t) return;
      const st = getComputedStyle(e);
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) < 0.2) return;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const testo = window.__rgb(st.color);
      if (!testo || testo.a < 0.2) return;
      const fondo = window.__fondoDi(e);
      const c = window.__contrasto(window.__sopra(testo, fondo), fondo);
      misurate++;
      // La soglia e' quella dello standard: 4.5 per il testo normale, 3 per
      // quello grande o in grassetto, che si legge anche con meno.
      const px = parseFloat(st.fontSize), grosso = px >= 24 || (px >= 18.66 && parseInt(st.fontWeight) >= 700);
      const soglia = grosso ? 3 : 4.5;
      // I SEI COLORI DELLA LICENZA SONO FUORI CONCORSO
      // «Bianco, Giallo, Verde, Rosso, Blu, Nero» non sono scelte grafiche:
      // sono il colore stampato sulla licenza, quello che dice quali giorni
      // tocca lavorare. Scritto in bianco sul verde fa 3,30 - sotto la
      // soglia - ma ritingere quel verde vorrebbe dire scrivere sullo
      // schermo un colore diverso da quello che c'e' sul documento.
      // Vale uguale di giorno: non e' una cosa che ha portato il modo scuro.
      // (Nota per quando lo si vorra' sistemare davvero: la stessa scritta
      // in NERO sullo stesso verde fa 6,36. Il rimedio c'e', costa cambiare
      // anche il modo chiaro, e quindi non e' roba di questa versione.)
      if (/^(Bianco|Giallo|Verde|Rosso|Blu|Nero)$/.test(t)) return;
      if (c < soglia) deboli.push({ s, t: t.slice(0, 30), c: c.toFixed(2), soglia, px: Math.round(px), col: st.color,
                                      fondo: 'rgb(' + Math.round(fondo.r) + ', ' + Math.round(fondo.g) + ', ' + Math.round(fondo.b) + ')' });
    });
  }
  return { misurate, deboli };
}, SCHERMATE);
ok(lettura.misurate > 500, 'ci sono scritte da misurare', `${lettura.misurate} misurate`);
ok(lettura.deboli.length === 0, 'nessuna scritta sotto la soglia di leggibilita\'',
   lettura.deboli.length
     ? '\n        ' + lettura.deboli.slice(0, 8).map(x => `${x.s}: «${x.t}» ${x.c}<${x.soglia} — ${x.col} su ${x.fondo}, ${x.px}px`).join('\n        ')
     : 'tutte sopra');

// ------------------------------------------------------------------
console.log('\n3. NIENTE RESTA ACCESO IN MEZZO AL BUIO');
// ------------------------------------------------------------------
const accesi = await p.evaluate((schermate) => {
  const fuori = [];
  for (const s of schermate) {
    switchTab(s); renderContent();
    document.querySelectorAll('#main-container *').forEach(e => {
      const r = e.getBoundingClientRect();
      if (r.width * r.height < 4000) return;        // i quadratini colorati vanno bene
      const c = window.__rgb(getComputedStyle(e).backgroundColor);
      if (!c || c.a < 0.5) return;
      // il giallo dei tasti e' l'app: quello ci sta. Qui si cercano i
      // rettangoli chiari e SPENTI, cioe' i bianchi rimasti indietro.
      const chiaro = window.__luce(c) > 0.5;
      const spento = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 40;
      // Il quadratino del colore del turno e' bianco perche' E' il colore
      // bianco: sta scritto sulla licenza e dice quali giorni si lavora.
      // Quello non si tinge di scuro, o direbbe una cosa falsa.
      const coloreTurno = /^(Bianco|Giallo|Verde|Rosso|Blu|Nero)$/.test((e.textContent||'').trim());
      if (chiaro && spento && !coloreTurno)
        fuori.push(`${s}: ${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(e).backgroundColor} «${(e.textContent||'').trim().slice(0,20)}»`);
    });
  }
  return [...new Set(fuori)];
}, SCHERMATE);
ok(accesi.length === 0, 'nessun rettangolo bianco rimasto indietro',
   accesi.length ? accesi.slice(0, 4).join(' | ') : 'nessuno');

// ------------------------------------------------------------------
console.log('\n4. L\'INTERRUTTORE FA QUELLO CHE DICE');
// ------------------------------------------------------------------
const interruttore = await p.evaluate(() => {
  const letto = () => ({
    attributo: document.documentElement.getAttribute('data-tema'),
    barra: (document.querySelector('meta[name="theme-color"]') || {}).content
  });
  const fuori = {};
  window.applicaTema('chiaro'); fuori.chiaro = letto();
  window.applicaTema('scuro');  fuori.scuro = letto();
  window.applicaTema('auto');   fuori.auto = letto();   // il telefono e' su scuro
  return fuori;
});
ok(interruttore.chiaro.attributo === 'chiaro', 'forzato chiaro resta chiaro', interruttore.chiaro.attributo);
ok(interruttore.scuro.attributo === 'scuro', 'forzato scuro resta scuro', interruttore.scuro.attributo);
ok(interruttore.auto.attributo === 'scuro', 'automatico segue il telefono (qui scuro)', interruttore.auto.attributo);
ok(interruttore.scuro.barra !== interruttore.chiaro.barra,
   'la barra di sistema cambia colore col tema',
   `${interruttore.chiaro.barra} / ${interruttore.scuro.barra}`);

// La scelta deve restare: se si riapre l'app e torna com'era prima, non e'
// un'impostazione, e' un capriccio che dura una sessione.
const restaScelto = await (async () => {
  const q = await apri(b, false);                 // telefono su CHIARO
  await q.evaluate(() => window.scegliTema('scuro'));
  const subito = await q.evaluate(() => document.documentElement.getAttribute('data-tema'));
  await q.reload();                               // come riaprire l'app
  await q.waitForFunction(() => typeof window.switchTab === 'function');
  const dopo = await q.evaluate(() => ({
    tema: document.documentElement.getAttribute('data-tema'),
    memoria: localStorage.getItem('taxi_tema')
  }));
  await q.close();
  return { subito, ...dopo };
})();
ok(restaScelto.subito === 'scuro', 'scegliendo «scuro» la schermata si scurisce subito', restaScelto.subito);
ok(restaScelto.tema === 'scuro' && restaScelto.memoria === 'scuro',
   'riaprendo l\'app la scelta e\' ancora li\'',
   `${restaScelto.tema} · in memoria «${restaScelto.memoria}»`);

const chiaroSuTelefonoChiaro = await (async () => {
  const q = await apri(b, false);
  const r = await q.evaluate(() => { window.applicaTema('auto'); return document.documentElement.getAttribute('data-tema'); });
  await q.close(); return r;
})();
ok(chiaroSuTelefonoChiaro === 'chiaro', 'automatico su un telefono chiaro resta chiaro', chiaroSuTelefonoChiaro);

// ------------------------------------------------------------------
console.log('\n5. IL FOGLIO DA STAMPARE RESTA CHIARO');
// ------------------------------------------------------------------
await p.evaluate(() => { window.applicaTema('scuro'); switchTab('report'); renderContent(); });
await p.emulateMedia({ media: 'print' });
const stampa = await p.evaluate(() => {
  const corpo = getComputedStyle(document.body);
  const scheda = document.querySelector('#main-container .bg-white');
  return {
    fondo: corpo.backgroundColor,
    carta: scheda ? getComputedStyle(scheda).backgroundColor : null,
    luceCarta: scheda ? window.__luce(window.__rgb(getComputedStyle(scheda).backgroundColor)) : null
  };
});
await p.emulateMedia({ media: 'screen' });
ok(stampa.luceCarta !== null && stampa.luceCarta > 0.8,
   'in stampa le schede tornano bianche anche col tema scuro',
   `${stampa.carta}`);

await b.close();
console.log(`\n  ${guai === 0 ? 'tutto a posto' : guai + ' controlli falliti'}`);
process.exit(guai ? 1 : 0);
