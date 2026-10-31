// L'USO SULL'IPHONE: CAMPI, TASTIERA, CALENDARIO, CROCETTE, SEGNAPOSTO
// Le correzioni della fase 3 della v176, misurate invece che guardate:
//  1. (e844230) Safari su iPhone, toccando un campo scritto sotto i 16px,
//     ingrandisce tutta la pagina e la lascia cosi': succedeva col
//     selettore dell'anno (15px), il filtro dei metodi, le date dei filtri,
//     la data di una scadenza fatta (13px), le impostazioni fiscali, la
//     modifica in riga. Qui si gira OGNI scheda (e la modifica in riga, il
//     calendario con la giornata aperta, la spesa veloce) e nessun campo
//     visibile deve stare sotto i 16px. La cifra della corsa veloce resta
//     grande (la regola non la deve rimpicciolire), e a 320 px il
//     selettore dell'anno, ora piu' grande, non taglia «2026».
//  2. (8519525) Toccando «Incasso corsa» la tastiera saliva sopra i tasti
//     Contanti/POS/Satispay/App: la scheda della corsa ora sale in cima con
//     8 punti di margine al fuoco, ci resta mentre si scrive e dopo una
//     corsa (il fuoco torna nel campo). Sul Mac (1280, senza tocco) la
//     pagina non salta. La tastiera vera di Safari qui non c'e': si prova
//     su uno schermo basso (500 e 480 punti), con il tocco acceso.
//  4. (53d35f6) Calendario: a 320 punti la freccia ‹ era schiacciata a 18
//     punti dal titolo. Le frecce devono essere da 44x44 col nome per
//     VoiceOver, e il titolo del mese piu' lungo («settembre») sta nel suo
//     posto senza uscire.
//  5. (53d35f6) Le crocette (chiudi la giornata, togli il filtro del giorno,
//     togli una foto) erano tasti da 20x15 senza nome: 44x44 con nome.
//  6. (8a954f0) Al buio il «0,00» del campo grande sembrava un importo vero:
//     il segnaposto scende a rgb(94, 88, 77). Di giorno non cambia.
// Chromium non e' Safari: lo zoom al tocco, la tastiera vera e
// visualViewport che si restringe vanno visti sull'iPhone vero.
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

let ok = 0; const ko = [];
const c = (nome, vero, dettaglio) => {
  if (vero) { ok++; console.log('  ok  ' + nome); }
  else { ko.push(nome); console.log('  *** ' + nome + (dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio).slice(0, 400) : '')); }
};
const erroriJS = [];
const b = await chromium.launch();

// Mercoledi' 11 marzo 2026, mezzogiorno a Torino, con il turno 8-20 vivo:
// senza turno vivo il campo della corsa veloce non c'e'.
const OGGI = '2026-03-11';
const TURNO_OGGI = { id: 'toggi', data: OGGI, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 180 };
async function apri({ w = 390, h = 900, tocco = false, tema = 'chiaro', ora = '2026-03-11T12:00:00+01:00', semina = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'it-IT', timezoneId: 'Europe/Rome', hasTouch: tocco, isMobile: tocco });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(ora));
  p.on('pageerror', e => erroriJS.push(w + ' px: ' + String(e.message || e)));
  p.on('dialog', d => d.accept());
  await p.goto(APP);
  await p.evaluate(({ tema, semina, TURNO_OGGI }) => {
    localStorage.clear();
    localStorage.setItem('taxi_voci_fisse_avviato', 'si');
    localStorage.setItem('taxi_tema', tema);
    const rec = [], tur = [TURNO_OGGI];
    if (semina) for (let m = 1; m <= 3; m++) for (const g of [2, 5, 9]) {
      const d = `2026-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
      tur.push({ id: 't' + m + g, data: d, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 180 });
      rec.push({ id: `e${m}${g}`, data: d, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 20, ora: '10:00' });
      rec.push({ id: `u${m}${g}`, data: d, tipo: 'USCITA', categoria: 'Carburante', metodo: 'Contanti', importo: 60 });
    }
    if (semina) rec.push({ id: 'eoggi', data: '2026-03-11', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 18, ora: '09:00' });
    localStorage.setItem('taxi_records', JSON.stringify(rec));
    localStorage.setItem('taxi_shifts', JSON.stringify(tur));
    localStorage.setItem('taxi_scadenze', JSON.stringify([
      { id: 's1', nome: 'Bollo Auto', data: '2026-10-31', cadenza: 'anno', fatta: false },
      { id: 's2', nome: 'Revisione', data: '2026-02-01', fatta: true, fattaIl: '2026-02-01' }]));
  }, { tema, semina, TURNO_OGGI });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.waitForTimeout(200);
  return { p, ctx };
}
const caso = async (titolo, fn) => {
  console.log('--- ' + titolo + ' ---');
  try { await fn(); }
  catch (e) { ko.push(titolo + ' (interrotto)'); console.log('  *** il caso si e\' interrotto: ' + String(e.message || e).split('\n')[0]); }
};

// ------------------------------------------------------------------ 1
// I campi visibili adesso, col loro corpo. Si escludono solo quelli che non
// si scrivono (spunte, tondini, file, nascosti).
const campiVisibili = (p) => p.evaluate(() => [...document.querySelectorAll('input,select,textarea')]
  .filter(e => !['checkbox', 'radio', 'file', 'hidden'].includes(e.type))
  .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
  .map(e => ({ chi: e.id || e.name || e.getAttribute('aria-label') || e.placeholder || e.className.slice(0, 50), corpo: parseFloat(getComputedStyle(e).fontSize) })));

await caso('1. nessun campo sotto i 16 px, in tutte le schede', async () => {
  for (const w of [390, 320]) {
    const { p, ctx } = await apri({ w });
    const piccoli = new Map(); let contati = 0;
    const raccogli = async (dove) => { for (const x of await campiVisibili(p)) { contati++; if (x.corpo < 16) piccoli.set(dove + ': ' + x.chi, x.corpo); } };
    for (const t of ['giornata', 'dashboard', 'altro', 'uscite', 'categorie', 'scadenze', 'auto', 'rendimento', 'report', 'cloud']) {
      await p.evaluate(x => switchTab(x), t); await p.waitForTimeout(200); await raccogli(t);
    }
    // Giornate col turno vivo: la corsa veloce, la spesa veloce, la modifica in riga
    await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); }); await p.waitForTimeout(200);
    await raccogli('giornate');
    await p.locator('button[onclick="alternaSpesaLampo()"]').first().click(); await p.waitForTimeout(200);
    await raccogli('spesa veloce');
    await p.locator('button[onclick="alternaSpesaLampo()"]').first().click(); await p.waitForTimeout(150);
    await p.locator(`button[onclick="apriModificaRecord('eoggi')"]`).first().click(); await p.waitForTimeout(200);
    await raccogli('modifica in riga');
    // il calendario con una giornata aperta
    await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('calendario'); }); await p.waitForTimeout(200);
    await p.locator(`button[onclick="toccaGiornoCalendario('2026-03-09')"]`).first().click(); await p.waitForTimeout(200);
    await raccogli('calendario');
    c(w + ' px: ' + contati + ' campi visti, nessuno sotto i 16 px', piccoli.size === 0 && contati > 20, Object.fromEntries(piccoli));
    await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); }); await p.waitForTimeout(200);
    const grande = await p.evaluate(() => { const e = document.getElementById('corsa-lampo'); return e ? parseFloat(getComputedStyle(e).fontSize) : null; });
    c(w + ' px: la cifra della corsa veloce resta grande (' + grande + ' px)', grande >= 30, grande);
    if (w === 320) {
      // Il selettore dell'anno: la scritta deve entrare nel riquadro, frecce comprese.
      for (const t of ['dashboard', 'altro', 'rendimento', 'report', 'categorie']) {
        await p.evaluate(x => switchTab(x), t); await p.waitForTimeout(200);
        const m = await p.evaluate(() => {
          const s = [...document.querySelectorAll('select[id^="scelta-anno"]')].find(e => e.getClientRects().length);
          if (!s) return null;
          const cs = getComputedStyle(s); const cv = document.createElement('canvas').getContext('2d');
          cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const testo = cv.measureText(s.options[s.selectedIndex].text).width;
          const q = s.getBoundingClientRect(); const madre = s.parentElement.getBoundingClientRect();
          return { id: s.id, corpo: cs.fontSize, testo: Math.ceil(testo), spazio: Math.floor(s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 16),
            dentro: q.left >= madre.left - 1 && q.right <= madre.right + 1 && q.right <= innerWidth };
        });
        c('320 px, ' + t + ': il selettore dell\'anno non taglia la scritta e sta nel suo posto', m && m.testo <= m.spazio && m.dentro, m);
      }
    }
    await ctx.close();
  }
});

// ------------------------------------------------------------------ 2
const schedaCorsa = (p) => p.evaluate(() => {
  const campo = document.getElementById('corsa-lampo'); if (!campo) return null;
  // Sulla v175 la scheda non ha il segno: si misura la scheda bianca che contiene il campo.
  const s = campo.closest('[data-scheda-corsa]') || campo.closest('.bg-white');
  return Math.round(s.getBoundingClientRect().top);
});
await caso('2. la tastiera non copre i tasti del metodo', async () => {
  for (const [w, h, tocco] of [[390, 500, true], [320, 480, true], [1280, 800, false]]) {
    const { p, ctx } = await apri({ w, h, tocco });
    await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); });
    await p.waitForTimeout(300);
    // Il campo in fondo allo schermo, dove la tastiera lo coprirebbe: e'
    // dove l'ha lasciato chi ha scorso la pagina. (Il tocco di Playwright
    // porta in vista l'elemento da solo: cosi' non deve muovere niente.)
    await p.evaluate(() => document.getElementById('corsa-lampo').scrollIntoView({ block: 'end' }));
    await p.waitForTimeout(150);
    const prima = await schedaCorsa(p);
    if (tocco) await p.tap('#corsa-lampo'); else await p.click('#corsa-lampo');
    await p.waitForTimeout(300);
    const alFuoco = await schedaCorsa(p);
    const nome = `${w}x${h}${tocco ? ' col dito' : ' col mouse'}`;
    if (!tocco) {
      c(nome + ': la pagina non salta al clic nel campo (' + prima + ' -> ' + alFuoco + ')', alFuoco === prima, { prima, alFuoco });
      await ctx.close(); continue;
    }
    console.log(`    ${nome}: scheda a ${prima} prima del tocco, a ${alFuoco} col fuoco`);
    c(nome + ': al tocco la scheda sale in cima, 8 punti (+-2)', Math.abs(alFuoco - 8) <= 2, { prima, alFuoco });
    const tasto = await p.evaluate(() => { const t = document.querySelector("button[onclick=\"corsaLampo('POS')\"]").getBoundingClientRect(); return Math.round(t.bottom); });
    c(nome + ': i tasti del metodo stanno nella meta\' alta dello schermo (POS finisce a ' + tasto + ')', tasto <= h * 0.6, tasto);
    await p.keyboard.type('12,5'); await p.waitForTimeout(150);
    c(nome + ': mentre si scrive resta li\'', Math.abs((await schedaCorsa(p)) - 8) <= 2, await schedaCorsa(p));
    await p.tap("button[onclick=\"corsaLampo('POS')\"]");
    await p.waitForTimeout(400);
    const dopo = await schedaCorsa(p);
    const fuoco = await p.evaluate(() => document.activeElement && document.activeElement.id);
    c(nome + ': dopo la corsa il fuoco torna nel campo e la scheda e\' ancora in cima', fuoco === 'corsa-lampo' && Math.abs(dopo - 8) <= 2, { fuoco, dopo });
    await ctx.close();
  }
});

// ------------------------------------------------------------------ 4 e 5
const misuraTasto = (p, sel) => p.evaluate((sel) => {
  const e = document.querySelector(sel); if (!e) return null;
  const q = e.getBoundingClientRect();
  return { l: Math.round(q.width), a: Math.round(q.height), nome: e.getAttribute('aria-label') || '' };
}, sel);
await caso('4. calendario: frecce da 44 col nome, il titolo di settembre non esce', async () => {
  for (const w of [320, 390, 1280]) {
    const { p, ctx } = await apri({ w, ora: '2026-09-11T12:00:00+02:00', semina: false });
    await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('calendario'); }); await p.waitForTimeout(300);
    for (const [sel, nome] of [['button[onclick="scorriMeseCalendario(-1)"]', 'Mese precedente'], ['button[onclick="scorriMeseCalendario(1)"]', 'Mese successivo']]) {
      const m = await misuraTasto(p, sel);
      c(`${w} px: «${nome}» almeno 44x44, e col nome`, m && m.l >= 44 && m.a >= 44 && m.nome === nome, m);
    }
    const t = await p.evaluate(() => {
      const prima = document.querySelector('button[onclick="scorriMeseCalendario(-1)"]');
      const titolo = prima.nextElementSibling;
      const dentro = [titolo, ...titolo.querySelectorAll('*')];
      return { testo: titolo.innerText.split('\n')[0], esce: dentro.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.tagName + ' ' + e.scrollWidth + '>' + e.clientWidth),
        sopra: titolo.getBoundingClientRect().left < prima.getBoundingClientRect().right - 1 };
    });
    c(`${w} px: il titolo «${t.testo}» sta nel suo posto`, /settembre/i.test(t.testo) && !t.esce.length && !t.sopra, t);
    // 5. la crocetta della giornata scelta
    await p.evaluate(() => { localStorage.setItem('taxi_shifts', JSON.stringify([{ id: 't1', data: '2026-09-10', turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true }])); });
    await p.reload(); await p.waitForFunction(() => typeof window.switchTab === 'function');
    await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('calendario'); }); await p.waitForTimeout(250);
    await p.locator(`button[onclick="toccaGiornoCalendario('2026-09-10')"]`).first().click(); await p.waitForTimeout(250);
    const croce = await p.evaluate(() => {
      const e = [...document.querySelectorAll(`button[onclick="toccaGiornoCalendario('2026-09-10')"]`)].find(x => x.textContent.trim() === '×');
      if (!e) return null; const q = e.getBoundingClientRect(); return { l: Math.round(q.width), a: Math.round(q.height), nome: e.getAttribute('aria-label') || '' };
    });
    c(`${w} px: la crocetta della giornata aperta e\' 44x44 e si chiama «Chiudi la giornata»`, croce && croce.l >= 44 && croce.a >= 44 && croce.nome === 'Chiudi la giornata', croce);
    await ctx.close();
  }
});

await caso('5. le altre crocette: il filtro del giorno e le foto', async () => {
  const { p, ctx } = await apri({ w: 390 });
  await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); applyFilterGiornoGiornate('2026-03-09'); });
  await p.waitForTimeout(250);
  const m = await misuraTasto(p, 'button[onclick="pulisciGiornoGiornate()"]');
  c('la x del giorno scelto: 44x44, «Mostra tutti i giorni»', m && m.l >= 44 && m.a >= 44 && m.nome === 'Mostra tutti i giorni', m);
  // Le crocette delle foto: si disegnano le due righe di miniature (quella
  // della foto appena scelta e quella della nota in modifica) e si misurano.
  const foto = await p.evaluate(() => {
    window.fotoInAttesa = [{ dati: '' }];
    const d = document.createElement('div'); d.style.padding = '30px';
    d.innerHTML = riquadroFotoInAttesa() + miniatureNotaInModifica({ id: 'n1', foto: ['f1'] });
    document.body.prepend(d);
    const r = [...d.querySelectorAll('button[onclick^="togliFotoInAttesa"], button[onclick^="staccaFoto"]')].map(e => { const q = e.getBoundingClientRect(); return { l: Math.round(q.width), a: Math.round(q.height), nome: e.getAttribute('aria-label') || '' }; });
    d.remove(); return r;
  });
  c('due crocette sulle foto, tutte e due 44x44 col nome', foto.length === 2 && foto.every(x => x.l >= 44 && x.a >= 44 && x.nome), foto);
  await ctx.close();
});

// ------------------------------------------------------------------ 6
await caso('6. il segnaposto del campo grande, al buio e di giorno', async () => {
  const leggi = async (tema) => {
    const { p, ctx } = await apri({ tema });
    await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); }); await p.waitForTimeout(250);
    const v = await p.evaluate(() => getComputedStyle(document.getElementById('corsa-lampo'), '::placeholder').color);
    await ctx.close(); return v;
  };
  const buio = await leggi('scuro');
  const giorno = await leggi('chiaro');
  console.log('    segnaposto: al buio ' + buio + ', di giorno ' + giorno);
  c('al buio: rgb(94, 88, 77), non sembra piu\' un importo', buio === 'rgb(94, 88, 77)', buio);
  // il colore di giorno della v175, misurato su 589628d: non deve cambiare
  c('di giorno invariato: rgb(209, 213, 219)', giorno === 'rgb(209, 213, 219)', giorno);
});

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') : 'nessuno'));
await b.close();
