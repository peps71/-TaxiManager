// IL TASTO «OGGI» NELLA SCHEDA GIORNATE
// Si va a controllare un giorno qualsiasi del mese con le frecce ‹ ›, e poi
// per tornare alla giornata di oggi tocca contare i giorni a rovescio o
// aprire il calendario. Serve un tasto che riporti a oggi in un colpo.
// Qui si misura quello che quel tasto deve fare, e - vale di piu' - i casi
// in cui NON deve comparire o non deve rompere niente: quando sei gia' su
// oggi non serve a nulla, a 320 punti la riga non deve stringere la data
// (era il difetto della v157), e su un anno di esercizio diverso oggi non
// appartiene a quell'anno: se il filtro si mettesse e basta, giornoGiornate()
// lo spegnerebbe un istante dopo e il tasto sembrerebbe non funzionare.
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

// Le giornate si seminano attorno a OGGI, non su una data fissa: una prova
// che vale solo nell'ottobre 2026 non e' una prova.
const SEMINA = `
  const oggi = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const anno = String(oggi.getFullYear());
  const rec = [], tur = [];
  for (let indietro = 0; indietro < 20; indietro++) {
    const d = new Date(oggi.getTime() - indietro * 86400000);
    if (String(d.getFullYear()) !== anno) continue;
    const g = iso(d);
    tur.push({ id: 't' + g, data: g, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 180 });
    for (let c = 0; c < 4; c++) rec.push({ id: 'e' + g + c, data: g, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'Contanti', importo: 28.5 + c * 6, ora: '1' + c + ':00' });
  }
  // una giornata nell'anno precedente, per la prova del cambio d'anno
  const scorso = String(oggi.getFullYear() - 1) + '-06-15';
  tur.push({ id: 'tvecchio', data: scorso, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 150 });
  rec.push({ id: 'evecchio', data: scorso, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'Contanti', importo: 42, ora: '10:00' });
  window.dailyRecords = rec; window.shifts = tur;
  window.annoScelto = anno;
  window.__oggi = iso(oggi);
`;

async function apri(larghezza, oraFissa) {
  const p = await b.newPage({ viewport: { width: larghezza, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  p.on('dialog', d => d.accept());
  // L'orologio si puo' fermare: serve per il turno di notte, che si puo'
  // vedere in corso solo di mattina. Si ferma prima di aprire la pagina,
  // altrimenti il copione in testa all'app ha gia' letto l'ora vera.
  if (oraFissa) await p.clock.setFixedTime(oraFissa);
  await p.goto(APP);
  await p.evaluate(() => localStorage.clear());
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(SEMINA);
  await p.evaluate(() => { switchTab('giornata'); });
  await p.waitForTimeout(250);
  return p;
}

// Il tasto si riconosce dal mestiere che fa, non da una classe: cosi' la
// prova regge anche se domani cambia il vestito.
const TROVA = `(() => {
  const t = Array.from(document.querySelectorAll('button'))
    .find(x => (x.getAttribute('onclick') || '').indexOf('vaiAOggiGiornate') === 0);
  if (!t) return null;
  const r = t.getBoundingClientRect();
  const s = getComputedStyle(t);
  return { testo: t.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height,
           visibile: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none',
           colore: s.color, sfondoCarta: getComputedStyle(t.closest('.eroe')).backgroundColor,
           titolo: t.getAttribute('title') || '', tipo: t.getAttribute('type') || '' };
})()`;

// ------------------------------------------------------------------
console.log('\n1. SU OGGI IL TASTO NON SERVE, E NON C\'E\'');
// ------------------------------------------------------------------
// L'app si apre sulla giornata di oggi: un tasto «Oggi» che porta dove sei
// gia' e' solo rumore in una riga che a 320 punti e' piena.
let p = await apri(390);
const partenza = await p.evaluate(() => ({ giorno: window.giornoGiornate(), oggi: window.__oggi }));
ok(partenza.giorno === partenza.oggi, 'l\'app si apre sulla giornata di oggi', partenza.giorno);
ok(await p.evaluate(TROVA) === null, 'e il tasto «Oggi» non c\'e\'');

// ------------------------------------------------------------------
console.log('\n2. TRE GIORNI INDIETRO: IL TASTO COMPARE E RIPORTA A OGGI');
// ------------------------------------------------------------------
await p.evaluate(() => { scorriGiornoGiornate(-1); scorriGiornoGiornate(-1); scorriGiornoGiornate(-1); });
await p.waitForTimeout(200);
const lontano = await p.evaluate(() => window.giornoGiornate());
ok(lontano !== partenza.oggi, 'tre frecce indietro portano via da oggi', lontano);
const tasto = await p.evaluate(TROVA);
ok(!!tasto, 'il tasto «Oggi» e\' comparso');
if (tasto) {
  ok(tasto.testo === 'Oggi', 'c\'e\' scritto «Oggi»', tasto.testo);
  ok(tasto.visibile, 'si vede', `${Math.round(tasto.w)}x${Math.round(tasto.h)}`);
  // La regola del dito: 44 punti di altezza. Non e' decorazione, e' la
  // regola che vale per ogni tasto dell'app.
  ok(tasto.h >= 44, 'e si prende con il dito', `alto ${Math.round(tasto.h)} punti`);
  ok(tasto.titolo.length > 0, 'ha la sua spiegazione', tasto.titolo);
}
await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button'))
    .find(x => (x.getAttribute('onclick') || '').indexOf('vaiAOggiGiornate') === 0);
  t.click();
});
await p.waitForTimeout(250);
const tornato = await p.evaluate(() => ({
  giorno: window.giornoGiornate(),
  oggi: window.__oggi,
  memoria: localStorage.getItem('taxi_giorno_giornate'),
  testata: (document.querySelector('.eroe') || {}).textContent || ''
}));
ok(tornato.giorno === tornato.oggi, 'premendolo si torna a oggi', tornato.giorno);
ok(tornato.memoria === tornato.oggi, 'e il giorno si ricorda anche alla riapertura', tornato.memoria);
const giornoDelMese = String(parseInt(tornato.oggi.slice(8, 10), 10));
ok(tornato.testata.indexOf(giornoDelMese) >= 0, 'la testata mostra la data di oggi', 'giorno ' + giornoDelMese);
ok(await p.evaluate(TROVA) === null, 'e il tasto si e\' tolto di mezzo da solo');

// ------------------------------------------------------------------
console.log('\n3. SENZA FILTRO GIORNO IL TASTO C\'E\'');
// ------------------------------------------------------------------
// «Tutte le giornate» non e' oggi: da li' il tasto deve riportare a oggi.
await p.evaluate(() => { pulisciGiornoGiornate(); });
await p.waitForTimeout(200);
ok(await p.evaluate(() => window.giornoGiornate()) === '', 'la × ha tolto il filtro giorno');
ok(await p.evaluate(TROVA) !== null, 'il tasto «Oggi» c\'e\'');
await p.evaluate(() => { vaiAOggiGiornate(); });
await p.waitForTimeout(200);
ok(await p.evaluate(() => window.giornoGiornate() === window.__oggi), 'e riporta a oggi');

// ------------------------------------------------------------------
console.log('\n4. SU UN ALTRO ANNO DI ESERCIZIO');
// ------------------------------------------------------------------
// Qui sta il difetto che si vedrebbe solo a gennaio: con l'anno scorso
// scelto, oggi non appartiene a quell'anno e giornoGiornate() spegne il
// filtro. Il tasto deve tornare anche all'anno corrente.
const annoPrima = await p.evaluate(() => {
  cambiaAnno(String(new Date().getFullYear() - 1));
  return { anno: window.annoAttivo(), giorno: window.giornoGiornate() };
});
await p.waitForTimeout(250);
ok(annoPrima.anno === String(new Date().getFullYear() - 1), 'si guarda l\'anno scorso', annoPrima.anno);
ok(await p.evaluate(TROVA) !== null, 'il tasto «Oggi» c\'e\' anche qui');
await p.evaluate(() => { vaiAOggiGiornate(); });
await p.waitForTimeout(300);
const dopoAnno = await p.evaluate(() => ({ anno: window.annoAttivo(), giorno: window.giornoGiornate(), oggi: window.__oggi }));
ok(dopoAnno.anno === dopoAnno.oggi.slice(0, 4), 'premendolo si torna all\'anno corrente', dopoAnno.anno);
ok(dopoAnno.giorno === dopoAnno.oggi, 'e il filtro giorno resta su oggi, non si spegne', dopoAnno.giorno || '(vuoto)');

// ------------------------------------------------------------------
console.log('\n5. IL MESE SCELTO NON SI PERDE');
// ------------------------------------------------------------------
// Il giorno passa davanti al mese: chi poi toglie il giorno deve ritrovare
// il mese che aveva scelto, come fanno da sempre le frecce ‹ ›.
const conMese = await p.evaluate(() => {
  applyFilterMeseGiornate('03');
  scorriGiornoGiornate(-4);
  const prima = window.filterMeseGiornate;
  vaiAOggiGiornate();
  return { prima, dopo: window.filterMeseGiornate, giorno: window.giornoGiornate(), oggi: window.__oggi };
});
ok(conMese.giorno === conMese.oggi, 'il tasto porta a oggi anche con un mese scelto', conMese.giorno);
ok(conMese.dopo === conMese.prima, 'e il mese scelto resta quello', conMese.dopo);
await p.evaluate(() => { applyFilterMeseGiornate('ALL'); vaiAOggiGiornate(); });
await p.close();

// ------------------------------------------------------------------
console.log('\n6. A 320 PUNTI LA DATA NON SI STRINGE');
// ------------------------------------------------------------------
// La riga della testata e' stata guadagnata punto per punto: due frecce da
// 44 e la data. Un tasto in piu' non deve ripetere il difetto del
// «mercoledi' 28» tagliato: deve mandare a capo il gruppo di destra.
// Le otto e mezza di mattina, con l'orologio fermo: e' l'unico momento in
// cui un turno di notte datato ieri risulta ancora in corso, e quindi
// l'unico in cui questa riga porta tutte e tre le cose insieme.
const ADESSO = (() => { const o = new Date(); return new Date(Date.UTC(o.getUTCFullYear(), o.getUTCMonth(), o.getUTCDate(), 6, 30)); })();
for (const larghezza of [320, 390, 768, 1280]) {
  const q = await apri(larghezza, ADESSO);
  // La riga piu' piena che si possa avere: un giorno che non e' oggi - e
  // quindi il tasto «Oggi» e la × - e la pastiglia «in turno». Capita per
  // davvero col turno di notte: cominciato ieri alle 23, ancora in corso
  // stamattina, e si sta guardando la giornata di ieri.
  const pieno = await q.evaluate(() => {
    const ieri = new Date(Date.now() - 86400000);
    const due = n => String(n).padStart(2, '0');
    const giorno = `${ieri.getFullYear()}-${due(ieri.getMonth() + 1)}-${due(ieri.getDate())}`;
    window.shifts = window.shifts.filter(t => t.data !== giorno);
    window.shifts.push({ id: 'tvivo', data: giorno, turno: 'Le otto',
      inizio: '23:00', fine: '11:00', ore: 12, lavorato: true, kmTot: 20 });
    applyFilterGiornoGiornate(giorno);
    return giorno;
  });
  await q.waitForTimeout(250);
  const misure = await q.evaluate(`(() => {
    const doc = document.documentElement;
    const tagliati = [];
    document.querySelectorAll('.eroe span, .eroe button, .eroe p').forEach(el => {
      if (!el.children.length && el.scrollWidth > el.clientWidth + 1) tagliati.push((el.textContent || '').trim().slice(0, 28));
    });
    const t = Array.from(document.querySelectorAll('button')).find(x => (x.getAttribute('onclick') || '').indexOf('vaiAOggiGiornate') === 0);
    const eroe = document.querySelector('.eroe').getBoundingClientRect();
    const r = t ? t.getBoundingClientRect() : null;
    return { sbordo: doc.scrollWidth - doc.clientWidth, tagliati,
             dentro: !!r && r.left >= eroe.left - 0.5 && r.right <= eroe.right + 0.5,
             alto: r ? Math.round(r.height) : 0, pastiglia: /in turno/.test(document.querySelector('.eroe').textContent),
             righe: (() => {
               const fila = t ? t.parentElement.parentElement : null;
               if (!fila) return 0;
               const cime = new Set();
               Array.from(fila.children).forEach(c => cime.add(Math.round(c.getBoundingClientRect().top / 4)));
               return cime.size;
             })() };
  })()`);
  ok(misure.sbordo <= 0, `${larghezza}px: la pagina non sborda`, 'sbordo ' + misure.sbordo);
  ok(misure.tagliati.length === 0, `${larghezza}px: niente testo tagliato nella scheda`, misure.tagliati.join(' | '));
  ok(misure.dentro, `${larghezza}px: il tasto «Oggi» sta dentro la scheda`);
  ok(misure.alto >= 44, `${larghezza}px: alto ${misure.alto} punti`);
  ok(misure.pastiglia, `${larghezza}px: la pastiglia «in turno» c'e' davvero`, 'giorno ' + pieno);
  // Due righe al massimo: quando non ci sta, il gruppo di destra va a capo
  // tutto intero - non si stringe la data, che era il difetto della v157.
  ok(misure.righe >= 1 && misure.righe <= 2, `${larghezza}px: la testata sta in ${misure.righe} riga/righe`);
  await q.close();
}

// ------------------------------------------------------------------
console.log('\n7. SI LEGGE, CHIARO E SCURO');
// ------------------------------------------------------------------
// La scheda e' scura in entrambi i temi, ma il grigio del pannello cambia:
// il contrasto si misura in tutti e due.
const lum = c => {
  const [r, g, bl] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
    const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
};
const mescola = (davanti, dietro) => {
  const f = davanti.match(/\d+(\.\d+)?/g).map(Number);
  const d = dietro.match(/\d+(\.\d+)?/g).map(Number);
  const a = f.length > 3 ? f[3] : 1;
  return `rgb(${f[0] * a + d[0] * (1 - a)}, ${f[1] * a + d[1] * (1 - a)}, ${f[2] * a + d[2] * (1 - a)})`;
};
for (const tema of ['chiaro', 'scuro']) {
  const q = await apri(390);
  await q.evaluate(t => { localStorage.setItem('taxi_tema', t); window.applicaTema(t); scorriGiornoGiornate(-3); }, tema);
  await q.waitForTimeout(250);
  const v = await q.evaluate(TROVA);
  ok(!!v, `tema ${tema}: il tasto c'e'`);
  if (v) {
    const sopra = lum(mescola(v.colore, v.sfondoCarta));
    const sotto = lum(v.sfondoCarta);
    const rapporto = (Math.max(sopra, sotto) + 0.05) / (Math.min(sopra, sotto) + 0.05);
    ok(rapporto >= 4.5, `tema ${tema}: la scritta si legge`, rapporto.toFixed(2) + ':1');
  }
  // La cornice del fuoco da tastiera: dentro la scheda scura deve essere chiara.
  const fuoco = await q.evaluate(`(() => {
    const t = Array.from(document.querySelectorAll('button')).find(x => (x.getAttribute('onclick') || '').indexOf('vaiAOggiGiornate') === 0);
    t.focus();
    const s = getComputedStyle(t);
    return { colore: s.outlineColor, largo: parseFloat(s.outlineWidth), stile: s.outlineStyle, messo: t.matches(':focus') };
  })()`);
  ok(fuoco.messo && fuoco.largo >= 2 && fuoco.stile !== 'none', `tema ${tema}: col tasto Tab si vede dov'e'`, `${fuoco.stile} ${fuoco.largo}px`);
  if (fuoco.messo) {
    const r = (() => {
      const a = lum(fuoco.colore), b2 = lum(v.sfondoCarta);
      return (Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05);
    })();
    ok(r >= 3, `tema ${tema}: e la cornice si stacca dalla scheda`, r.toFixed(2) + ':1');
  }
  await q.close();
}

await b.close();
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
