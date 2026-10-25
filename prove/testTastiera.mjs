// GIRARE L'APP CON IL TASTO TAB
// Chi non tocca lo schermo - un Mac, un tastierino sull'iPad - non vedeva
// niente: zero regole di focus, e 95 elementi con «outline-none» che spegne
// anche il contorno del browser. Premere Invio era tirare a indovinare.
// Qui si preme Tab per davvero, si guarda dove si e' finiti, e si MISURA se
// l'anello si vede contro il fondo su cui sta.
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

const AIUTI = `
window.__rgb = s => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
  const q = m[1].split(',').map(parseFloat); return { r:q[0], g:q[1], b:q[2], a:q.length>3?q[3]:1 }; };
window.__sopra = (f,d) => ({ r:f.r*f.a+d.r*(1-f.a), g:f.g*f.a+d.g*(1-f.a), b:f.b*f.a+d.b*(1-f.a), a:1 });
window.__luce = c => { const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
window.__contrasto = (a,b) => { const l1=window.__luce(a),l2=window.__luce(b);
  return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
// il fondo su cui l'anello viene disegnato: e' fuori dall'elemento, quindi
// quello del genitore
window.__fondoFuori = e => { let n = e.parentElement; const pila=[];
  while (n && n !== document.documentElement) { const c=window.__rgb(getComputedStyle(n).backgroundColor);
    if (c && c.a>0) { pila.push(c); if (c.a===1) break; } n=n.parentElement; }
  let giu = window.__rgb(getComputedStyle(document.documentElement).backgroundColor) || {r:255,g:255,b:255,a:1};
  for (let i=pila.length-1;i>=0;i--) giu = window.__sopra(pila[i], giu);
  return giu; };
window.__semina = function () {
  const rec=[], tur=[], met=['Contanti','POS','Satispay','App/Nexi','Conto'];
  const a=new Date().getFullYear();
  for (let m=1;m<=12;m++) for (let g=1;g<=26;g+=2) {
    const d=a+'-'+String(m).padStart(2,'0')+'-'+String(g).padStart(2,'0');
    tur.push({id:'t'+m+g,data:d,turno:'Le otto',inizio:'08:00',fine:'20:00',ore:12,lavorato:true,kmTot:170});
    for(let c=0;c<4;c++) rec.push({id:'e'+m+g+c,data:d,tipo:'ENTRATA',categoria:'Corsa',metodo:met[(g+c)%5],importo:15+c*6,ora:'10:00'});
  }
  window.dailyRecords=rec; window.shifts=tur;
  window.scadenze=[{id:'s1',nome:'Revisione',data:a+'-12-01',fatta:false}];
  window.veicoli=[]; window.vociFisse=[]; window.note=[]; window.versamenti=[];
  window.annoScelto=String(a); window.incassoVisibile=true;
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
  await p.evaluate(AIUTI);
  await p.evaluate(() => { window.__semina(); switchTab('dashboard'); renderContent(); });
  return p;
}

const b = await chromium.launch();

for (const scuro of [false, true]) {
  console.log(`\n--- ${scuro ? 'AL BUIO' : 'DI GIORNO'} ---`);
  const p = await apri(b, scuro);

  // si preme Tab sul serio e si guarda dove si finisce
  const giro = [];
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press('Tab');
    await p.waitForTimeout(40);          // :focus-visible si decide un attimo dopo
    const v = await p.evaluate(() => {
      let e = document.activeElement;
      if (!e || e === document.body) return null;
      // SE NON E' DAVVERO A FUOCO, NON C'E' NIENTE DA PRETENDERE
      // document.activeElement puo' restare puntato su un elemento che il
      // fuoco l'ha gia' perso - succede quando la schermata si ridisegna fra
      // una pressione di Tab e la misura. In quell'istante nessun anello deve
      // esserci, ed e' giusto cosi'. Al primo giro questa prova bocciava
      // l'app proprio per questo: l'ho verificato mettendo a fuoco lo stesso
      // campo a mano, e l'anello c'era.
      if (!e.matches(':focus')) return null;
      // UN ELEMENTO TRASPARENTE NON PUO' MOSTRARE NIENTE
      // Sopra la data scritta per esteso c'e' steso un campo data invisibile
      // (opacita' zero) che apre il calendario del telefono. L'anello suo non
      // si vedrebbe mai: sta sul riquadro che lo contiene. Qui si guarda
      // quello, che e' la cosa che l'occhio vede davvero.
      let suChi = e;
      if (parseFloat(getComputedStyle(e).opacity) < 0.1 && e.parentElement) suChi = e.parentElement;
      const st = getComputedStyle(suChi);
      const r = suChi.getBoundingClientRect();
      const anello = window.__rgb(st.outlineColor);
      const fondo = window.__fondoFuori(suChi);
      return {
        tag: e.tagName.toLowerCase() + (suChi !== e ? ' (anello sul riquadro)' : ''),
        // quando qualcosa non torna, serve sapere CHI si stava guardando
        dove: `${suChi.tagName.toLowerCase()}.${String(suChi.className || '').split(' ').slice(0,2).join('.')}`,
        nellaPagina: document.contains(suChi),
        opacita: getComputedStyle(e).opacity,
        testo: (e.textContent || e.value || '').trim().slice(0, 18),
        spessore: parseFloat(st.outlineWidth),
        stile: st.outlineStyle,
        contrasto: anello ? +window.__contrasto(window.__sopra(anello, fondo), fondo).toFixed(2) : 0,
        visibile: r.width > 2 && r.height > 2
      };
    });
    if (v && v.visibile) giro.push(v);
  }

  ok(giro.length >= 15, 'col tasto Tab si gira per l\'app', `${giro.length} comandi raggiunti`);

  const senzaAnello = giro.filter(x => !(x.spessore >= 2 && x.stile === 'solid'));
  ok(senzaAnello.length === 0, 'ogni comando raggiunto mostra l\'anello',
     senzaAnello.length ? senzaAnello.slice(0, 3).map(x => `${x.tag} «${x.testo}» su ${x.dove} → ${x.spessore}px ${x.stile}, opacita ${x.opacita}, nella pagina ${x.nellaPagina}`).join('\n        ')
                        : `${giro.length} su ${giro.length}, spessore ${giro[0].spessore}px`);

  const deboli = giro.filter(x => x.contrasto < 3);
  ok(deboli.length === 0, 'e l\'anello si vede contro il fondo su cui sta',
     deboli.length ? deboli.slice(0, 4).map(x => `${x.tag} «${x.testo}» ${x.contrasto}`).join(' | ')
                   : `il piu' debole sta a ${Math.min(...giro.map(x => x.contrasto)).toFixed(2)} (serve 3)`);
  await p.close();
}

// E col dito o col mouse l'anello NON deve comparire: su un telefono sarebbe
// un cerchio acceso attorno a ogni cosa toccata.
console.log('\n--- COL DITO NON DEVE COMPARIRE ---');
const p = await apri(b, false);
const tasto = p.locator('#main-container button').first();
await tasto.click();
const dopoIlDito = await p.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return { nessunFuoco: true };
  return { nessunFuoco: false, combacia: e.matches(':focus-visible'), spessore: parseFloat(getComputedStyle(e).outlineWidth) };
});
ok(dopoIlDito.nessunFuoco || !dopoIlDito.combacia,
   'cliccando col mouse l\'anello resta spento',
   dopoIlDito.nessunFuoco ? 'nessun elemento a fuoco' : `:focus-visible ${dopoIlDito.combacia}`);
await p.close();

await b.close();
console.log(`\n  ${guai === 0 ? 'tutto a posto' : guai + ' controlli falliti'}`);
process.exit(guai ? 1 : 0);
