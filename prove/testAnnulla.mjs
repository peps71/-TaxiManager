// LA VIA D'USCITA DAI MODULI
// I tre moduli completi - corsa, spesa, turno - avevano in fondo due tasti che
// salvavano tutti e due. Aperto il modulo per sbaglio, non si usciva.
// Il rischio vero di un tasto «Annulla» dentro un <form> non si vede
// guardandolo: se e' un submit, SALVA. Qui si annulla e si CONTANO i movimenti.
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

const MODULI = [
  { nome: 'spesa',  apri: 'toggleUscitaForm', flag: 'showUscitaForm', importo: 'uscita-imp', nota: 'uscita-nota', scheda: 'uscite' },
  { nome: 'corsa',  apri: 'toggleCorsaForm',  flag: 'showCorsaForm',  importo: 'corsa-imp',  nota: null,          scheda: 'giornata' },
  // Il modulo del turno si disegna solo nella vista Calendario: aperto
  // dalla vista Giornate non comparirebbe, e la prova cercherebbe a vuoto.
  { nome: 'turno',  apri: 'toggleShiftForm',  flag: 'showShiftForm',  importo: null,         nota: null,          scheda: 'giornata', vista: 'calendario' }
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT' });
const errori = [];
p.on('pageerror', e => errori.push(e.message));
// Le finestrelle di conferma si decidono caso per caso: qui si dice cosa fare.
let rispostaDialogo = 'accetta';
let dialoghiVisti = 0;
p.on('dialog', async d => {
  dialoghiVisti++;
  if (rispostaDialogo === 'accetta') await d.accept(); else await d.dismiss();
});
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
await p.evaluate(() => {
  window.dailyRecords = []; window.shifts = [];
  window.annoScelto = String(new Date().getFullYear());
  // Dalla v173 il registro si apre col turno, e senza moduli non c'e' niente
  // da annullare. Qui i turni non c'entrano - si provano le vie d'uscita - e
  // tenerne uno in archivio sballerebbe i conti di questa prova, che guarda
  // proprio quanti movimenti e quanti turni restano. Si passa dall'altra
  // porta: la giornata sbloccata a mano.
  window.sbloccoGiornata = oggiISO();
  switchTab('giornata'); renderContent();
});

const conta = () => p.evaluate(() => ({
  movimenti: (window.dailyRecords || []).length,
  turni: (window.shifts || []).length
}));

for (const m of MODULI) {
  console.log(`\n--- ${m.nome.toUpperCase()} ---`);

  // 1. il modulo si apre e la via d'uscita c'e', in cima e in fondo
  const aperto = await p.evaluate((m) => {
    switchTab(m.scheda);
    window.vistaGiornata = m.vista || 'giornate';
    renderContent();
    window[m.apri]();
    const tasti = [...document.querySelectorAll('#main-container button')]
      .filter(e => /annullaModulo\(/.test(e.getAttribute('onclick') || ''));
    return {
      aperto: !!window[m.flag],
      quanti: tasti.length,
      tipi: tasti.map(t => t.getAttribute('type')),
      testi: tasti.map(t => (t.textContent || '').trim().slice(0, 10))
    };
  }, m);
  ok(aperto.aperto, `${m.nome}: il modulo si apre`);
  ok(aperto.quanti >= 2, `${m.nome}: la via d'uscita c'e' in cima E in fondo`, `${aperto.quanti} tasti: ${aperto.testi.join(' / ')}`);
  // IL CONTROLLO CHE CONTA: dentro un <form>, un tasto senza type="button"
  // e' un submit, e invece di annullare salverebbe.
  ok(aperto.tipi.every(t => t === 'button'),
     `${m.nome}: nessuno dei due e\' un tasto che salva`, aperto.tipi.join(', '));

  // 2. modulo vuoto: si chiude senza chiedere niente
  const primaVuoto = await conta();
  dialoghiVisti = 0;
  const chiusoVuoto = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#main-container button')]
      .filter(e => /annullaModulo\(/.test(e.getAttribute('onclick') || ''));
    if (!t.length) return false;      // niente da cliccare: lo dira' il controllo sopra
    t[t.length - 1].click();          // quello in fondo
    return true;
  });
  await p.waitForTimeout(150);
  const dopoVuoto = await conta();
  const statoVuoto = await p.evaluate((m) => !!window[m.flag], m);
  ok(!statoVuoto, `${m.nome}: vuoto, si chiude`);
  ok(dialoghiVisti === 0, `${m.nome}: vuoto, non chiede niente`, `${dialoghiVisti} domande`);
  ok(dopoVuoto.movimenti === primaVuoto.movimenti && dopoVuoto.turni === primaVuoto.turni,
     `${m.nome}: vuoto, non salva niente`, `${dopoVuoto.movimenti} movimenti, ${dopoVuoto.turni} turni`);

  // Il turno nasce gia' compilato (km del turno prima, ore del tipo scelto):
  // non deve chiedere niente finche' non ci metti mano, ma deve chiedere
  // appena lo fai. Sono i due lati della stessa regola.
  if (!m.importo) {
    await p.evaluate((m) => { window[m.apri](); }, m);
    await p.waitForTimeout(120);
    const toccato = await p.evaluate(() => {
      const campi = [...document.querySelectorAll('#main-container input[inputmode="decimal"], #main-container input[type="text"]')]
        .filter(c => c.defaultValue);
      if (!campi.length) return null;
      campi[0].value = String(campi[0].defaultValue) + '7';
      return { id: campi[0].id, prima: campi[0].defaultValue, adesso: campi[0].value };
    });
    if (!toccato) { ok(false, `${m.nome}: non trovo un campo gia' compilato da modificare`); continue; }
    rispostaDialogo = 'rifiuta'; dialoghiVisti = 0;
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#main-container button')]
        .filter(e => /annullaModulo\(/.test(e.getAttribute('onclick') || ''));
      if (t.length) t[t.length - 1].click();
    });
    await p.waitForTimeout(150);
    ok(dialoghiVisti === 1, `${m.nome}: toccando un valore proposto, allora chiede`,
       `${toccato.id}: ${toccato.prima} -> ${toccato.adesso}`);
    ok(await p.evaluate((m) => !!window[m.flag], m), `${m.nome}: e dicendo no resta aperto`);
    rispostaDialogo = 'accetta';
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#main-container button')]
        .filter(e => /annullaModulo\(/.test(e.getAttribute('onclick') || ''));
      if (t.length) t[0].click();
    });
    await p.waitForTimeout(150);
    continue;
  }

  // 3. con qualcosa scritto: chiede, e dicendo NO resta aperto con i dati
  await p.evaluate((m) => { window[m.apri](); }, m);
  await p.waitForTimeout(120);
  await p.evaluate((m) => {
    document.getElementById(m.importo).value = '42,50';
    if (m.nota) document.getElementById(m.nota).value = 'prova';
  }, m);
  const primaScritto = await conta();
  rispostaDialogo = 'rifiuta';
  dialoghiVisti = 0;
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('#main-container button')]
      .filter(e => /annullaModulo\(/.test(e.getAttribute('onclick') || ''));
    t[t.length - 1].click();
  });
  await p.waitForTimeout(150);
  const dopoNo = await p.evaluate((m) => ({
    aperto: !!window[m.flag],
    importo: (document.getElementById(m.importo) || {}).value || ''
  }), m);
  ok(dialoghiVisti === 1, `${m.nome}: con qualcosa scritto, chiede conferma`, `${dialoghiVisti} domande`);
  ok(dopoNo.aperto, `${m.nome}: dicendo no, il modulo resta aperto`);
  ok(dopoNo.importo === '42,50', `${m.nome}: e quello che avevi scritto e\' ancora li\'`, `«${dopoNo.importo}»`);

  // 4. dicendo SI: si chiude e NON salva
  rispostaDialogo = 'accetta';
  dialoghiVisti = 0;
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('#main-container button')]
      .filter(e => /annullaModulo\(/.test(e.getAttribute('onclick') || ''));
    t[t.length - 1].click();
  });
  await p.waitForTimeout(200);
  const dopoSi = await conta();
  const statoSi = await p.evaluate((m) => !!window[m.flag], m);
  ok(dialoghiVisti === 1, `${m.nome}: chiede una volta sola`);
  ok(!statoSi, `${m.nome}: dicendo si, si chiude`);
  ok(dopoSi.movimenti === primaScritto.movimenti && dopoSi.turni === primaScritto.turni,
     `${m.nome}: e i 42,50 NON sono stati salvati`, `${dopoSi.movimenti} movimenti`);

  // 5. anche la crocetta in cima fa la stessa cosa
  await p.evaluate((m) => { window[m.apri](); }, m);
  await p.waitForTimeout(120);
  rispostaDialogo = 'accetta'; dialoghiVisti = 0;
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('#main-container button')]
      .filter(e => /annullaModulo\(/.test(e.getAttribute('onclick') || ''));
    if (t.length) t[0].click();       // quello in cima
  });
  await p.waitForTimeout(150);
  const dopoCroce = await p.evaluate((m) => !!window[m.flag], m);
  ok(!dopoCroce, `${m.nome}: anche la crocetta in cima chiude`);
}

// E il salvataggio vero deve continuare a funzionare: un «Annulla» messo male
// dentro un form puo' anche rompere l'invio.
console.log('\n--- CHE SALVARE FUNZIONI ANCORA ---');
const salvato = await p.evaluate(async () => {
  switchTab('uscite'); renderContent();
  window.showUscitaForm = false; toggleUscitaForm();
  await new Promise(r => setTimeout(r, 120));
  document.getElementById('uscita-imp').value = '31,00';
  const form = document.getElementById('uscita-imp').closest('form');
  form.querySelector('button[type="submit"][value="chiudi"]').click();
  await new Promise(r => setTimeout(r, 250));
  const ultimo = (window.dailyRecords || []).slice(-1)[0] || null;
  return { quanti: (window.dailyRecords || []).length, importo: ultimo && ultimo.importo, chiuso: !window.showUscitaForm };
});
ok(salvato.quanti === 1, 'una spesa salvata per davvero', `${salvato.quanti} movimenti`);
ok(Math.abs(Number(salvato.importo) - 31) < 0.001, 'con l\'importo giusto', String(salvato.importo));
ok(salvato.chiuso, 'e «Salva e basta» chiude come prima');

ok(errori.length === 0, 'nessun errore JS', errori.slice(0,2).join(' | ') || 'nessuno');

await b.close();
console.log(`\n  ${guai === 0 ? 'tutto a posto' : guai + ' controlli falliti'}`);
process.exit(guai ? 1 : 0);
