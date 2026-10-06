// UNA CORSA SEGNATA DA VERIFICARE
// Il segno sta sul movimento, quindi deve seguirlo dappertutto: nel registro
// della giornata, nella testata della giornata chiusa, e nel prospetto dei
// corrispettivi - che e' il posto dove i conti del mese si chiudono.
// E non deve toccare nessun importo: e' un promemoria, non un movimento.
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

let ok = 0; const ko = [];
const c = (nome, vero) => { if (vero) ok++; else ko.push(nome); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 1600 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
p.on('dialog', d => d.accept());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const ANNO = String(new Date().getFullYear());
const G = `${ANNO}-03-10`;
await p.evaluate(({ anno, g }) => {
  window.vociFisse = []; localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  window.dailyRecords = [
    { id: 'c1', data: g, tipo: 'ENTRATA', categoria: 'Stazione', metodo: 'POS', importo: 42.50, ora: '09:00' },
    { id: 'c2', data: g, tipo: 'ENTRATA', categoria: 'Aeroporto', metodo: 'Contanti', importo: 61.00, ora: '11:00' },
    { id: 'c3', data: `${anno}-03-12`, tipo: 'ENTRATA', categoria: 'Ospedale', metodo: 'Conto', importo: 18.00, ora: '08:00' }
  ];
  window.shifts = [{ id: 't1', data: g, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 170 }];
  window.scadenze = []; window.veicoli = [];
  window.annoScelto = anno; window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
}, { anno: ANNO, g: G });

const totali = () => p.evaluate((anno) => {
  const st = getStats ? getStats(anno) : null;
  const c = corrispettiviMese(anno + '-03');
  return { incassi: st ? st.incassi : null, totMese: c.totali.tot, nCorse: c.totali.n };
}, ANNO);

const prima = await totali();

// --- si segna, e il dato lo registra ---
await p.evaluate(() => alternaVerificaCorsa('c1'));
await p.waitForTimeout(400);
const dopo = await p.evaluate(() => {
  const r = (window.dailyRecords || []).find(x => x.id === 'c1');
  const c = corrispettiviMese(window.annoScelto + '-03');
  const g = c.righe.find(x => x.iso.endsWith('-10'));
  return { segnata: !!r.daVerificare, importo: r.importo, categoria: r.categoria,
           nelGiorno: g ? g.daVerificare : null, nelMese: c.totali.daVerificare,
           nelMetodo: g ? g.verifica.POS : null, altroMetodo: g ? g.verifica.Contanti : null };
});
c('il movimento porta il segno', dopo.segnata === true);
c('l\'importo non si tocca', dopo.importo === 42.50);
c('la descrizione non si tocca', dopo.categoria === 'Stazione');
c('il giorno dei corrispettivi conta la corsa segnata', dopo.nelGiorno === 1);
c('il mese dei corrispettivi la conta', dopo.nelMese === 1);
c('il segno sta nella colonna del metodo con cui e\' stata pagata', dopo.nelMetodo === 1);
c('le altre colonne restano pulite', dopo.altroMetodo === 0);

const dopoTot = await totali();
c('gli incassi dell\'anno non cambiano', prima.incassi === dopoTot.incassi);
c('il totale del mese non cambia', Math.abs(prima.totMese - dopoTot.totMese) < 0.005);
c('il numero di corse non cambia', prima.nCorse === dopoTot.nCorse);

// --- si vede nel registro della giornata ---
await p.evaluate((g) => { switchTab('giornata'); applyFilterGiornoGiornate(g); }, G);
await p.waitForTimeout(400);
const registro = await p.evaluate(() => document.getElementById('main-container').innerText);
c('il registro della giornata mostra «da verificare»', /da verificare/i.test(registro));

// --- si vede nei corrispettivi ---
await p.evaluate(() => {
  switchTab('dashboard'); cambiaPeriodoDash('mese');
  window.dashMese = window.annoScelto + '-03';
  try { localStorage.setItem('taxi_apri_corrisp', '1'); } catch (e) {}
  renderContent();
});
await p.waitForTimeout(500);
// Il segno sta SOLO sulla cella del metodo: niente riquadro in cima, niente
// pastiglia nella colonna del giorno. In un prospetto che si compila una
// colonna alla volta, l'avviso serve dov'e' la cifra da controllare.
const corrisp = await p.evaluate(() => {
  const tabella = [...document.querySelectorAll('table')]
    .find(t => /Giorno/i.test(t.querySelector('thead') ? t.querySelector('thead').innerText : ''));
  if (!tabella) return null;
  const intestazioni = [...tabella.querySelectorAll('thead th')].map(x => x.innerText.trim());
  const celleSegnate = [];
  tabella.querySelectorAll('tbody tr').forEach(tr => {
    [...tr.children].forEach((td, i) => {
      if (td.getAttribute('title') && /da verificare/i.test(td.getAttribute('title'))) {
        celleSegnate.push({ colonna: intestazioni[i], giorno: tr.children[0].innerText.trim().split('\n')[0] });
      }
    });
  });
  // Il colore vero, come lo vede l'occhio: la riga segnata deve staccarsi
  // da quelle normali, e la colonna del giorno - che resta ferma mentre la
  // tabella scorre di lato - deve portare la barra.
  const righe = [...tabella.querySelectorAll('tbody tr')].map(tr => ({
    classe: tr.className || '',
    giorno: tr.children[0].innerText.trim().split('\n')[0],
    fondoGiorno: getComputedStyle(tr.children[0]).backgroundColor,
    barra: getComputedStyle(tr.children[0]).boxShadow,
    fondiCelle: [...tr.children].slice(1).map(td => getComputedStyle(td).backgroundColor)
  }));
  return { intestazioni, celleSegnate, righe, testoSezione: document.getElementById('main-container').innerText };
});
c('la tabella dei corrispettivi c\'e\'', !!corrisp);
c('una sola cella porta il segno', corrisp.celleSegnate.length === 1);
c('ed e\' quella del metodo giusto', corrisp.celleSegnate[0] && /POS/i.test(corrisp.celleSegnate[0].colonna));
c('ed e\' quella del giorno giusto', corrisp.celleSegnate[0] && corrisp.celleSegnate[0].giorno.startsWith('10/'));
c('niente riquadro in cima ai corrispettivi', !/cors[ae] da verificare in marzo/i.test(corrisp.testoSezione));

// --- la riga intera si vede, non solo la cella ---
const segnata = corrisp.righe.find(r => r.giorno.startsWith('10/'));
const normale = corrisp.righe.find(r => !r.giorno.startsWith('10/'));
const colorata = (x) => !!x && x !== 'rgba(0, 0, 0, 0)' && x !== 'transparent' && x !== 'rgb(255, 255, 255)';
c('la riga segnata porta la sua classe', !!segnata && /riga-verifica/.test(segnata.classe));
c('la colonna del giorno e\' colorata anche se e\' ferma', !!segnata && colorata(segnata.fondoGiorno));
c('e porta la barra sul bordo sinistro', !!segnata && /inset/.test(segnata.barra));
c('tutte le celle della riga sono colorate', !!segnata && segnata.fondiCelle.every(colorata));
c('la cella del metodo e\' piu\' decisa delle altre',
  !!segnata && new Set(segnata.fondiCelle).size > 1);
c('le righe senza segno restano bianche',
  !!normale && !/riga-verifica/.test(normale.classe) && !normale.fondiCelle.some(colorata));

// --- il prospetto in CSV porta la colonna solo quando serve ---
const csv = await p.evaluate((anno) => {
  const c = corrispettiviMese(anno + '-03');
  const senza = corrispettiviMese(anno + '-04');
  return { conSegno: c.totali.daVerificare, senzaSegno: senza.totali.daVerificare };
}, ANNO);
c('un mese senza segni non ha niente da verificare', csv.senzaSegno === 0);
c('il mese con il segno lo conta', csv.conSegno === 1);

// --- si toglie ---
await p.evaluate(() => alternaVerificaCorsa('c1'));
await p.waitForTimeout(400);
const tolto = await p.evaluate(() => {
  const r = (window.dailyRecords || []).find(x => x.id === 'c1');
  const c = corrispettiviMese(window.annoScelto + '-03');
  return { campo: Object.prototype.hasOwnProperty.call(r, 'daVerificare'), mese: c.totali.daVerificare };
});
c('togliendo il segno il campo sparisce dal movimento', tolto.campo === false);
c('e i corrispettivi tornano puliti', tolto.mese === 0);

await b.close();
console.log(`  ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
console.log(erroriJS.length ? '  *** errori JS: ' + erroriJS.join(' · ') : '  errori JS: nessuno');
