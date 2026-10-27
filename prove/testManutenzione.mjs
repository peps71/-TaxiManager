// LA MANUTENZIONE PROGRAMMATA, CHE SI CONTA IN CHILOMETRI
// Il libretto dice ogni quanti chilometri va fatto ogni intervento: tagliando
// ogni 30.000, service del cambio ogni 70.000, distribuzione ogni 130.000.
// Qui si misura il giro intero - il traguardo, l'avviso che compare a inizio
// turno, la spesa che lo azzera - e soprattutto quello che NON deve
// succedere: l'avviso che parla quando il turno non e' cominciato, il conto
// che riparte per una spesa di carburante, i chilometri di partenza che si
// perdono al primo salvataggio della vettura o al giro del backup.
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

// Una vettura comprata a 180.000 km e i turni che la portano fino a dove
// serve. I turni si seminano attorno a oggi, cosi' la prova vale sempre.
const SEMINA = (kmFinale) => {
  const due = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
  const oggi = new Date();
  window.__oggi = iso(oggi);
  window.veicoli = [{
    id: 'v1', modello: 'Skoda Octavia', targa: 'AB123CD', anno: '2019',
    alimentazione: 'Diesel', dataAcquisto: (oggi.getFullYear() - 2) + '-01-10',
    kmAcquisto: 180000, prezzoAcquisto: 28000, uscita: 'in-uso',
    dataUscita: '', kmUscita: null, valoreUscita: null, valoreStimato: 12000, note: ''
  }];
  // L'ultimo turno porta il contachilometri dove vuole la prova. I turni sono
  // di ieri e prima: oggi resta libero, cosi' l'avviso parte solo quando la
  // prova registra il turno di oggi.
  const tur = [];
  for (let i = 1; i <= 5; i++) {
    const d = new Date(oggi.getTime() - i * 86400000);
    const km = kmFinale - (i - 1) * 200;
    tur.push({ id: 't' + i, data: iso(d), turno: 'Le otto', inizio: '08:00', fine: '20:00',
               ore: 12, lavorato: true, kmInizio: km - 200, kmFine: km, kmTot: 200 });
  }
  window.shifts = tur;
  window.dailyRecords = [];
  window.annoScelto = String(oggi.getFullYear());
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
  return window.__oggi;
};

async function apri(kmFinale) {
  const p = await b.newPage({ viewport: { width: 420, height: 1000 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  p.on('dialog', d => d.accept());
  await p.goto(APP);
  await p.evaluate(() => localStorage.clear());
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(SEMINA, kmFinale);
  return p;
}

const stato = `(() => window.statoManutenzioni(window.veicoloInUso()).map(m => ({
  slug: m.slug, nome: m.nome, ogniKm: m.ogniKm, kmBase: m.kmBase,
  ultimoKm: m.ultimoKm, prossimo: m.prossimo, mancano: m.mancano,
  scaduto: m.scaduto, daImpostare: m.daImpostare, kmOra: m.kmOra, daSpesa: m.daSpesa
})))()`;

// ------------------------------------------------------------------
console.log('\n1. IL PUNTO DI PARTENZA, SENZA SCRIVERE NIENTE');
// ------------------------------------------------------------------
// La vettura e' nata prima di questa versione: non ha nessun elenco scritto.
// Gli interventi del libretto e i chilometri degli ultimi gia' fatti le
// arrivano da soli, senza che nessuna migrazione tocchi il disco.
let p = await apri(233000);
const partenza = await p.evaluate(stato);
ok(partenza.length === 3, 'ci sono i tre interventi del libretto', partenza.map(m => m.slug).join(' '));
const perSlug = Object.fromEntries(partenza.map(m => [m.slug, m]));
ok(perSlug.tagliando && perSlug.tagliando.ogniKm === 30000, 'tagliando ogni 30.000 km');
ok(perSlug.dsc && perSlug.dsc.ogniKm === 70000, 'service DSC ogni 70.000 km');
ok(perSlug.distribuzione && perSlug.distribuzione.ogniKm === 130000, 'distribuzione ogni 130.000 km');
ok(perSlug.tagliando.kmBase === 212282 && perSlug.dsc.kmBase === 212282, 'tagliando e DSC partono da 212.282 km');
ok(perSlug.distribuzione.kmBase === 113000, 'la distribuzione parte da 113.000 km');
ok(await p.evaluate(() => window.veicoliocopia === undefined && window.veicoli[0].manutenzioni === undefined),
   'e sulla vettura non e\' stato scritto niente');

// ------------------------------------------------------------------
console.log('\n2. IL CONTO ALLA ROVESCIA');
// ------------------------------------------------------------------
ok(perSlug.tagliando.kmOra === 233000, 'il contachilometri e\' quello dei turni', perSlug.tagliando.kmOra + ' km');
ok(perSlug.tagliando.prossimo === 242282, 'prossimo tagliando a 242.282 km');
ok(perSlug.tagliando.mancano === 9282, 'mancano 9.282 km', String(perSlug.tagliando.mancano));
ok(perSlug.distribuzione.prossimo === 243000, 'prossima distribuzione a 243.000 km');
ok(perSlug.dsc.prossimo === 282282, 'prossimo service DSC a 282.282 km');
ok(partenza.every(m => !m.scaduto), 'e non c\'e\' ancora niente da fare');
ok(await p.evaluate(() => window.avvisoManutenzione() === ''), 'nessun avviso');
await p.close();

// ------------------------------------------------------------------
console.log('\n3. L\'AVVISO SI ATTIVA A INIZIO TURNO, NON PRIMA');
// ------------------------------------------------------------------
// Contachilometri oltre il traguardo del tagliando (242.282).
p = await apri(243100);
const oltre = await p.evaluate(stato);
// A 243.100 km sono passati due traguardi insieme: il tagliando (242.282) e
// la distribuzione (243.000). Capita per davvero, ed e' il caso che conta -
// l'avviso deve dirli tutti e due, non uno solo.
ok(oltre.find(m => m.slug === 'tagliando').scaduto, 'il tagliando risulta da fare', 'traguardo 242.282');
ok(oltre.find(m => m.slug === 'distribuzione').scaduto, 'e anche la distribuzione', 'traguardo 243.000');
ok(!oltre.find(m => m.slug === 'dsc').scaduto, 'il service DSC no, è lontano', 'traguardo 282.282');
ok(await p.evaluate(() => window.avvisoManutenzione() === ''),
   'senza il turno di oggi l\'avviso sta zitto');

// si registra il turno di oggi
await p.evaluate(() => {
  window.shifts = window.shifts.concat([{ id: 'tOggi', data: window.__oggi, turno: 'Le otto',
    inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmInizio: 243100, kmFine: null, kmTot: null }]);
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
});
const conTurno = await p.evaluate(() => window.avvisoManutenzione());
ok(conTurno.includes('Tagliando olio e filtri'), 'col turno registrato l\'avviso compare');
ok(conTurno.includes('Cinghia distribuzione e pompa acqua'), 'e dice tutti e due gli interventi');
ok((conTurno.match(/apriSpesaManutenzione/g) || []).length === 2, 'con un tasto per ciascuno');
ok(conTurno.includes('243.100'), 'e il contachilometri di adesso', '243.100 km');

// la crocetta «Più tardi» lo mette via per questo turno
await p.evaluate(() => window.rimandaManutenzione());
ok(await p.evaluate(() => window.avvisoManutenzione() === ''), '«Più tardi» lo mette via');
// al turno dopo torna
await p.evaluate(() => {
  window.shifts = window.shifts.map(t => t.id === 'tOggi' ? Object.assign({}, t, { id: 'tDomani' }) : t);
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
});
ok(await p.evaluate(() => window.avvisoManutenzione().includes('Tagliando')), 'al turno dopo torna');

// una giornata non lavorata non e' un turno
await p.evaluate(() => {
  window.shifts = window.shifts.filter(t => t.data !== window.__oggi).concat([{
    id: 'tRiposo', data: window.__oggi, turno: 'Festivo', inizio: '', fine: '',
    ore: 0, lavorato: false, kmInizio: null, kmFine: null, kmTot: null }]);
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
});
ok(await p.evaluate(() => window.avvisoManutenzione() === ''), 'in un giorno di riposo l\'avviso non parte');

// ------------------------------------------------------------------
console.log('\n4. DALL\'AVVISO AL MODULO DELLA SPESA');
// ------------------------------------------------------------------
await p.evaluate(() => {
  window.shifts = window.shifts.filter(t => t.data !== window.__oggi).concat([{
    id: 'tVero', data: window.__oggi, turno: 'Le otto', inizio: '08:00', fine: '20:00',
    ore: 12, lavorato: true, kmInizio: 243100, kmFine: null, kmTot: null }]);
  window.manutenzioneRimandata = '';
  window.versioneDati = (window.versioneDati || 0) + 1;
  switchTab('giornata');
});
await p.waitForTimeout(250);
const avvisoInPagina = await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button'))
    .find(x => (x.getAttribute('onclick') || '').indexOf('apriSpesaManutenzione') === 0);
  return t ? { testo: t.textContent.trim(), alto: Math.round(t.getBoundingClientRect().height) } : null;
});
ok(!!avvisoInPagina, 'il tasto «Registra l\'intervento» e\' nella schermata Giornate');
if (avvisoInPagina) ok(avvisoInPagina.alto >= 44, 'e si prende con il dito', avvisoInPagina.alto + ' punti');

await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button'))
    .find(x => (x.getAttribute('onclick') || '').indexOf('apriSpesaManutenzione') === 0);
  t.click();
});
await p.waitForTimeout(300);
const modulo = await p.evaluate(() => ({
  scheda: window.activeTab,
  categoria: (document.getElementById('uscita-cat-select') || {}).value,
  intervento: (document.getElementById('uscita-sotto') || {}).value,
  km: (document.getElementById('uscita-km') || {}).value,
  sottoVisibile: !(document.getElementById('uscita-sotto-box') || { className: 'hidden' }).className.includes('hidden'),
  kmVisibile: !(document.getElementById('uscita-km-box') || { className: 'hidden' }).className.includes('hidden')
}));
ok(modulo.scheda === 'uscite', 'si apre il Registro spese', modulo.scheda);
ok(modulo.categoria === 'Manutenzione', 'con la categoria Manutenzione già scelta', modulo.categoria);
ok(modulo.intervento === 'tagliando', 'e il tipo di intervento già scelto', modulo.intervento);
ok(modulo.sottoVisibile && modulo.kmVisibile, 'i due campi si vedono');
ok(modulo.km === '243100', 'il contachilometri è già scritto', modulo.km);

// ------------------------------------------------------------------
console.log('\n5. REGISTRATA LA SPESA, IL CONTO RIPARTE');
// ------------------------------------------------------------------
await p.evaluate(() => {
  document.getElementById('uscita-imp').value = '180,00';
  document.querySelector('form[onsubmit="addUscita(event)"]')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
await p.waitForTimeout(400);
const dopo = await p.evaluate(() => {
  const r = (window.dailyRecords || []).find(x => x.tipo === 'USCITA');
  return {
    categoria: r ? r.categoria : '', slug: r ? r.manutenzione : '', km: r ? r.km : null,
    importo: r ? r.importo : null,
    base: r ? window.categoriaBase(r.categoria) : '',
    sotto: r ? window.sottocategoria(r.categoria) : '',
    stato: window.statoManutenzioni(window.veicoloInUso()).find(m => m.slug === 'tagliando'),
    avviso: window.avvisoManutenzione()
  };
});
ok(dopo.categoria === 'Manutenzione - Tagliando olio e filtri', 'la spesa si chiama come l\'intervento', dopo.categoria);
ok(dopo.slug === 'tagliando', 'e porta il contrassegno dell\'intervento');
ok(dopo.km === 243100, 'con i chilometri a cui è stato fatto', String(dopo.km));
ok(dopo.importo === 180, 'e l\'importo scritto', String(dopo.importo));
ok(dopo.base === 'Manutenzione', 'per i conti resta una spesa di Manutenzione', dopo.base);
ok(dopo.sotto === 'Tagliando olio e filtri', 'e la sottocategoria è l\'intervento', dopo.sotto);
ok(dopo.stato.ultimoKm === 243100, 'il conto riparte da 243.100 km', String(dopo.stato.ultimoKm));
ok(dopo.stato.prossimo === 273100, 'prossimo tagliando a 273.100 km', String(dopo.stato.prossimo));
ok(!dopo.stato.scaduto, 'non è più da fare');
ok(dopo.stato.daSpesa, 'e il conto adesso lo dice la spesa, non più il numero di partenza');
ok(!dopo.avviso.includes('Tagliando'), 'l\'avviso non parla più del tagliando');
ok(dopo.avviso.includes('Cinghia distribuzione'), 'ma la distribuzione resta da fare');

// ------------------------------------------------------------------
console.log('\n6. QUELLO CHE NON DEVE AZZERARE NIENTE');
// ------------------------------------------------------------------
const prima6 = await p.evaluate(() => window.statoManutenzioni(window.veicoloInUso()).find(m => m.slug === 'dsc').prossimo);
await p.evaluate(() => {
  // una manutenzione generica e un pieno, segnati come sempre
  window.dailyRecords = window.dailyRecords.concat([
    { id: 'x1', data: window.__oggi, tipo: 'USCITA', categoria: 'Manutenzione', metodo: 'Contanti', importo: 90 },
    { id: 'x2', data: window.__oggi, tipo: 'USCITA', categoria: 'Carburante', metodo: 'Contanti', importo: 70 }
  ]);
  window.versioneDati = (window.versioneDati || 0) + 1;
});
const dopo6 = await p.evaluate(() => window.statoManutenzioni(window.veicoloInUso()));
ok(dopo6.find(m => m.slug === 'dsc').prossimo === prima6, 'una manutenzione generica non sposta il service DSC');
ok(dopo6.find(m => m.slug === 'tagliando').ultimoKm === 243100, 'né il tagliando');
ok(dopo6.find(m => m.slug === 'distribuzione').kmBase === 113000, 'né la distribuzione');

// cambiando categoria il tipo di intervento si spegne
await p.evaluate(() => { window.showUscitaForm = true; window.manutenzioneDaRegistrare = 'dsc'; renderContent(); });
await p.waitForTimeout(200);
const spento = await p.evaluate(() => {
  const sel = document.getElementById('uscita-cat-select');
  sel.value = 'Carburante';
  window.onUscitaCatChange('Carburante');
  return {
    intervento: (document.getElementById('uscita-sotto') || {}).value,
    sottoNascosto: (document.getElementById('uscita-sotto-box') || {}).className.includes('hidden'),
    kmNascosto: (document.getElementById('uscita-km-box') || {}).className.includes('hidden')
  };
});
ok(spento.intervento === '' && spento.sottoNascosto && spento.kmNascosto,
   'passando a Carburante il tipo di intervento si spegne');
await p.close();

// ------------------------------------------------------------------
console.log('\n7. IL RIQUADRO NEL PARCO AUTO');
// ------------------------------------------------------------------
p = await apri(233000);
await p.evaluate(() => { switchTab('auto'); });
await p.waitForTimeout(300);
const parco = await p.evaluate(() => {
  const testo = document.getElementById('main-container').textContent;
  const tasti = Array.from(document.querySelectorAll('button')).map(x => x.getAttribute('onclick') || '');
  return {
    titolo: testo.includes('Manutenzione programmata'),
    tagliando: testo.includes('Tagliando olio e filtri'),
    mancano: testo.includes('9.282'),
    prossima: testo.includes('242.282'),
    modifica: tasti.some(x => x.indexOf('apriModificaManutenzione') === 0),
    aggiungi: tasti.some(x => x.indexOf('aggiungiManutenzione') === 0)
  };
});
ok(parco.titolo, 'il riquadro c\'è');
ok(parco.tagliando, 'con il nome dell\'intervento');
ok(parco.prossima && parco.mancano, 'il traguardo e quanto manca', '242.282 · 9.282');
ok(parco.modifica && parco.aggiungi, 'si può modificare e aggiungere');

// modifica: l'intervallo del libretto di un\'altra auto
await p.evaluate(() => { apriModificaManutenzione('v1', 'tagliando'); });
await p.waitForTimeout(200);
await p.evaluate(() => {
  document.getElementById('man-ogni-tagliando').value = '25000';
  document.getElementById('man-ultimo-tagliando').value = '220000';
  salvaRigaManutenzione('v1', 'tagliando');
});
await p.waitForTimeout(250);
const modificato = await p.evaluate(() => ({
  stato: window.statoManutenzioni(window.veicoloInUso()).find(m => m.slug === 'tagliando'),
  scritto: Array.isArray(window.veicoli[0].manutenzioni),
  suDisco: JSON.parse(localStorage.getItem('taxi_veicoli') || '[]')[0].manutenzioni.length
}));
ok(modificato.stato.ogniKm === 25000 && modificato.stato.kmBase === 220000, 'la modifica prende');
ok(modificato.stato.prossimo === 245000, 'e il traguardo si sposta a 245.000 km', String(modificato.stato.prossimo));
ok(modificato.scritto && modificato.suDisco === 3, 'adesso l\'elenco è scritto sulla vettura', modificato.suDisco + ' voci');

// aggiunta e cancellazione
await p.evaluate(() => { aggiungiManutenzione('v1'); });
await p.waitForTimeout(200);
const slugNuovo = await p.evaluate(() => String(window.manutenzioneInModifica).split(':')[1]);
await p.evaluate((slug) => {
  document.getElementById('man-nome-' + slug).value = 'Filtro antipolline';
  document.getElementById('man-ogni-' + slug).value = '15000';
  document.getElementById('man-ultimo-' + slug).value = '230000';
  salvaRigaManutenzione('v1', slug);
}, slugNuovo);
await p.waitForTimeout(250);
const conNuovo = await p.evaluate(stato);
ok(conNuovo.length === 4 && conNuovo.some(m => m.nome === 'Filtro antipolline'), 'un intervento in più si aggiunge');
await p.evaluate((slug) => { eliminaManutenzione('v1', slug); }, slugNuovo);
await p.waitForTimeout(250);
ok((await p.evaluate(stato)).length === 3, 'e si toglie');

// ------------------------------------------------------------------
console.log('\n8. I CHILOMETRI DI PARTENZA NON SI PERDONO');
// ------------------------------------------------------------------
// Salvando la vettura (per cambiare la targa) l'elenco diventa roba scritta:
// deve restare quello che l'app stava gia' mostrando, numeri compresi.
await p.close();
p = await apri(233000);
await p.evaluate(() => { switchTab('auto'); });
await p.waitForTimeout(250);
await p.evaluate(() => { apriFormVeicolo('v1'); });
await p.waitForTimeout(300);
await p.evaluate(() => {
  document.getElementById('vc-targa').value = 'ZZ999ZZ';
  document.querySelector('form[onsubmit="salvaVeicolo(event)"]')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
await p.waitForTimeout(300);
const dopoSalva = await p.evaluate(stato);
const t8 = dopoSalva.find(m => m.slug === 'tagliando');
ok(await p.evaluate(() => window.veicoli[0].targa === 'ZZ999ZZ'), 'la vettura si salva');
ok(t8 && t8.kmBase === 212282, 'e i chilometri di partenza restano', String(t8 && t8.kmBase));
ok(dopoSalva.length === 3, 'con tutti e tre gli interventi');

// una vettura nuova parte senza numeri di partenza: quelli li sa solo chi l'ha comprata
await p.evaluate(() => {
  window.veicoli = window.veicoli.map(v => Object.assign({}, v, { uscita: 'venduta', dataUscita: window.__oggi, kmUscita: 233000 }));
  salvaVeicoli();
  apriFormVeicolo('nuovo');
});
await p.waitForTimeout(300);
await p.evaluate(() => {
  document.getElementById('vc-modello').value = 'Toyota Corolla';
  document.getElementById('vc-data-acquisto').value = window.__oggi;
  document.getElementById('vc-km-acquisto').value = '40000';
  document.querySelector('form[onsubmit="salvaVeicolo(event)"]')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
await p.waitForTimeout(300);
const nuova = await p.evaluate(stato);
ok(nuova.length === 3, 'la vettura nuova nasce con i tre interventi');
ok(nuova.every(m => m.kmBase === null), 'ma senza i chilometri dell\'altra auto');
ok(nuova.every(m => m.daImpostare), 'li chiede a te');
ok(await p.evaluate(() => window.avvisoManutenzione() === ''), 'e non avvisa di niente finché non glieli dai');

// ------------------------------------------------------------------
console.log('\n9. IL GIRO DEL BACKUP');
// ------------------------------------------------------------------
// La lezione della v161: una cosa nuova sulla vettura si perde nel ripristino
// se non ci si guarda. Qui si fa il giro intero, fuori e dentro.
const giro = await p.evaluate(async () => {
  window.veicoli = [{ id: 'v9', modello: 'Skoda Octavia', dataAcquisto: '2024-01-10',
    kmAcquisto: 180000, uscita: 'in-uso', dataUscita: '',
    manutenzioni: [{ slug: 'tagliando', nome: 'Tagliando olio e filtri', ogniKm: 30000, kmBase: 212282 }] }];
  window.dailyRecords = [{ id: 'r9', data: window.__oggi, tipo: 'USCITA',
    categoria: 'Manutenzione - Tagliando olio e filtri', metodo: 'Contanti', importo: 180,
    manutenzione: 'tagliando', km: 243100 }];
  salvaVeicoli();
  const pacco = JSON.parse(JSON.stringify(datiDaSalvare()));
  window.veicoli = []; window.dailyRecords = [];
  await applicaBackup(pacco);
  const v = (window.veicoli || [])[0] || {};
  const r = (window.dailyRecords || [])[0] || {};
  return {
    manutenzioni: Array.isArray(v.manutenzioni) ? v.manutenzioni.length : 0,
    base: Array.isArray(v.manutenzioni) && v.manutenzioni[0] ? v.manutenzioni[0].kmBase : null,
    slug: r.manutenzione || '', km: r.km === undefined ? null : r.km
  };
});
ok(giro.manutenzioni === 1 && giro.base === 212282, 'gli interventi tornano dal backup', giro.base + ' km');
ok(giro.slug === 'tagliando' && giro.km === 243100, 'e la spesa si riporta dietro intervento e chilometri');

await p.close();

// ------------------------------------------------------------------
console.log('\n10. IL DISEGNO, STRETTO E AL BUIO');
// ------------------------------------------------------------------
// L'avviso e il riquadro del Parco Auto sono due pezzi nuovi: si misurano
// dove si rompe tutto - a 320 punti - e nei due temi.
const lum = (c) => {
  const [r, g, bl] = String(c).match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
    const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
};
const contrasto = (a, b2) => {
  const x = lum(a), y = lum(b2);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

for (const larghezza of [320, 390, 768, 1280]) {
  const q = await apri(243100);
  await q.evaluate(() => {
    window.shifts = window.shifts.concat([{ id: 'tOggi', data: window.__oggi, turno: 'Le otto',
      inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmInizio: 243100, kmFine: null, kmTot: null }]);
    window.versioneDati = (window.versioneDati || 0) + 1;
    switchTab('giornata');
  });
  await q.setViewportSize({ width: larghezza, height: 1000 });
  await q.waitForTimeout(300);
  for (const scheda of ['giornata', 'auto']) {
    await q.evaluate((x) => { switchTab(x); }, scheda);
    await q.waitForTimeout(300);
    const m = await q.evaluate(() => {
      const doc = document.documentElement;
      const tagliati = [];
      document.querySelectorAll('.riquadro-tinto p, .riquadro-tinto span, .riquadro-tinto button').forEach(el => {
        if (!el.children.length && el.scrollWidth > el.clientWidth + 1) tagliati.push((el.textContent || '').trim().slice(0, 26));
      });
      const tasti = Array.from(document.querySelectorAll('button')).filter(x => {
        const o = x.getAttribute('onclick') || '';
        return o.indexOf('apriSpesaManutenzione') === 0 || o.indexOf('apriModificaManutenzione') === 0
            || o.indexOf('aggiungiManutenzione') === 0 || o.indexOf('rimandaManutenzione') === 0;
      }).map(x => ({ testo: x.textContent.trim(), alto: Math.round(x.getBoundingClientRect().height) }));
      return { sbordo: doc.scrollWidth - doc.clientWidth, tagliati, tasti };
    });
    ok(m.sbordo <= 0, `${larghezza}px · ${scheda}: la pagina non sborda`, 'sbordo ' + m.sbordo);
    ok(m.tagliati.length === 0, `${larghezza}px · ${scheda}: niente testo tagliato`, m.tagliati.join(' | '));
    ok(m.tasti.length > 0, `${larghezza}px · ${scheda}: i tasti nuovi ci sono`, m.tasti.length + '');
    ok(m.tasti.every(t => t.alto >= 44), `${larghezza}px · ${scheda}: e si prendono con il dito`,
       m.tasti.map(t => t.alto).join(' '));
  }

  // E il modulo della spesa aperto dall'avviso: e' li' che sono finiti i due
  // campi nuovi, e «Contachilometri» e' una parola lunga.
  await q.evaluate(() => { switchTab('giornata'); });
  await q.waitForTimeout(250);
  await q.evaluate(() => {
    const t = Array.from(document.querySelectorAll('button'))
      .find(x => (x.getAttribute('onclick') || '').indexOf('apriSpesaManutenzione') === 0);
    t.click();
  });
  await q.waitForTimeout(350);
  const mod = await q.evaluate(() => {
    const doc = document.documentElement;
    const modulo = document.getElementById('uscita-sotto').closest('form');
    const tagliati = [];
    modulo.querySelectorAll('label, option:checked, span').forEach(el => {
      if (!el.children.length && el.scrollWidth > el.clientWidth + 1) tagliati.push((el.textContent || '').trim().slice(0, 26));
    });
    const dentro = (id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect(), f = modulo.getBoundingClientRect();
      return r.left >= f.left - 0.5 && r.right <= f.right + 0.5 && r.width > 40;
    };
    return { sbordo: doc.scrollWidth - doc.clientWidth, tagliati,
             sotto: dentro('uscita-sotto'), km: dentro('uscita-km') };
  });
  ok(mod.sbordo <= 0, `${larghezza}px · modulo spesa: la pagina non sborda`, 'sbordo ' + mod.sbordo);
  ok(mod.tagliati.length === 0, `${larghezza}px · modulo spesa: niente scritta tagliata`, mod.tagliati.join(' | '));
  ok(mod.sotto && mod.km, `${larghezza}px · modulo spesa: i due campi nuovi stanno dentro`);
  await q.close();
}

for (const tema of ['chiaro', 'scuro']) {
  const q = await apri(243100);
  await q.evaluate((t) => {
    localStorage.setItem('taxi_tema', t); window.applicaTema(t);
    window.shifts = window.shifts.concat([{ id: 'tOggi', data: window.__oggi, turno: 'Le otto',
      inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmInizio: 243100, kmFine: null, kmTot: null }]);
    window.versioneDati = (window.versioneDati || 0) + 1;
    switchTab('giornata');
  }, tema);
  await q.waitForTimeout(350);
  const colori = await q.evaluate(() => {
    const dentro = document.querySelector('.riquadro-tinto.tinta-rossa .bg-white');
    const titolo = dentro.querySelector('p');
    const sotto = dentro.querySelectorAll('p')[1];
    const tasto = dentro.querySelector('button');
    const sfondo = getComputedStyle(dentro).backgroundColor;
    return {
      titolo: getComputedStyle(titolo).color, sotto: getComputedStyle(sotto).color, sfondo,
      tastoTesto: getComputedStyle(tasto).color, tastoFondo: getComputedStyle(tasto).backgroundColor
    };
  });
  ok(contrasto(colori.titolo, colori.sfondo) >= 4.5, `tema ${tema}: il nome dell'intervento si legge`,
     contrasto(colori.titolo, colori.sfondo).toFixed(2) + ':1');
  ok(contrasto(colori.sotto, colori.sfondo) >= 4.5, `tema ${tema}: e i chilometri anche`,
     contrasto(colori.sotto, colori.sfondo).toFixed(2) + ':1');
  ok(contrasto(colori.tastoTesto, colori.tastoFondo) >= 4.5, `tema ${tema}: il tasto rosso si legge`,
     contrasto(colori.tastoTesto, colori.tastoFondo).toFixed(2) + ':1');
  await q.close();
}

// ------------------------------------------------------------------
console.log('\n11. CORREGGERE I CHILOMETRI DI UN INTERVENTO GIA\' REGISTRATO');
// ------------------------------------------------------------------
// Fatto il tagliando si registra la spesa, e nel modulo si batte il
// contachilometri. Se quella cifra e' sbagliata - 243.372 al posto di
// 234.372 - si riapre «Modifica» per correggerla, e li' dentro ci si deve
// trovare il numero di adesso, non quello di partenza di due anni fa.
p = await apri(243400);
await p.evaluate(() => {
  window.dailyRecords = [{ id: 'r1', data: window.__oggi, tipo: 'USCITA',
    categoria: 'Manutenzione - Tagliando olio e filtri', metodo: 'Contanti',
    importo: 180, manutenzione: 'tagliando', km: 243372 }];
  window.versioneDati = (window.versioneDati || 0) + 1;
  switchTab('auto');
});
await p.waitForTimeout(300);
const conSpesa = await p.evaluate(stato);
const t11 = conSpesa.find(m => m.slug === 'tagliando');
ok(t11.ultimoKm === 243372, 'il conto parte dalla spesa registrata', String(t11.ultimoKm));
ok(t11.kmBase === 212282, 'e il numero di partenza resta dov\'è', String(t11.kmBase));

await p.evaluate(() => { apriModificaManutenzione('v1', 'tagliando'); });
await p.waitForTimeout(250);
const campo = await p.evaluate(() => {
  const el = document.getElementById('man-ultimo-tagliando');
  const nota = el.parentElement.querySelector('p');
  return { valore: el.value, nota: (nota ? nota.textContent : '').replace(/\s+/g, ' ').trim() };
});
ok(campo.valore === '243372', 'aprendo «Modifica» il campo mostra i chilometri di adesso', campo.valore);
ok(/spesa del \d\d\/\d\d\/\d{4}/.test(campo.nota), 'e dice che sono quelli della spesa', campo.nota.slice(0, 60));

// la correzione: il numero giusto e' PIU' BASSO di quello sbagliato
await p.evaluate(() => {
  document.getElementById('man-ultimo-tagliando').value = '234372';
  salvaRigaManutenzione('v1', 'tagliando');
});
await p.waitForTimeout(400);
const corretto = await p.evaluate(() => ({
  stato: window.statoManutenzioni(window.veicoloInUso()).find(m => m.slug === 'tagliando'),
  spesa: (window.dailyRecords || [])[0],
  suDisco: (JSON.parse(localStorage.getItem('taxi_records') || '[]')[0] || {}).km
}));
ok(corretto.spesa.km === 234372, 'salvando si corregge la spesa', String(corretto.spesa.km));
ok(corretto.suDisco === 234372, 'e la correzione è anche sul disco', String(corretto.suDisco));
ok(corretto.stato.ultimoKm === 234372, 'il conto segue il numero corretto', String(corretto.stato.ultimoKm));
ok(corretto.stato.prossimo === 264372, 'e il traguardo si sposta a 264.372 km', String(corretto.stato.prossimo));
ok(corretto.stato.kmBase === 212282, 'il numero di partenza non è stato toccato', String(corretto.stato.kmBase));
ok(corretto.spesa.categoria === 'Manutenzione - Tagliando olio e filtri' && corretto.spesa.importo === 180,
   'e il resto della spesa è rimasto com\'era');

// cancellata la spesa, il numero di partenza torna buono
await p.evaluate(() => {
  window.dailyRecords = [];
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
});
await p.waitForTimeout(250);
const senzaSpesa = await p.evaluate(stato);
ok(senzaSpesa.find(m => m.slug === 'tagliando').ultimoKm === 212282,
   'cancellata la spesa, torna buono il numero di partenza');
await p.close();

await b.close();
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
