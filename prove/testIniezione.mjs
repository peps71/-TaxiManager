// Un file di backup confezionato male non deve poter eseguire niente.
// Due difese: l'id si controlla all'importazione, e comunque passa da escJs.
//
// E i campi dei turni (dalla fase 1 dopo la v176). Inizio, fine, ore e km
// finivano a video cosi' com'erano, senza esc(): un turno con
// «<img src=x onerror=...>» nelle ore, arrivato da un backup o dal Cloud,
// eseguiva codice aprendo il calendario o la modifica in riga. Due difese
// anche qui, e si provano tutte e due:
//   - applicaBackup ripulisce ogni campo che non ha la forma che l'app
//     scrive (orario «08:00», ore e km in cifre): l'orario storto diventa '',
//     il numero storto null, e il resto del turno entra lo stesso. I valori
//     giusti («7:30», «8,5», 12, «1200») restano identici, anche nel tipo;
//   - un turno storto scritto DIRETTAMENTE in taxi_shifts (dove nessuno
//     pulisce: e' la strada del Cloud e dei dati vecchi) a video non deve
//     far partire niente, in nessuna scheda e nemmeno nella modifica in riga.
// Le prove girano da dove sta il repository, non da un percorso fisso: cosi'
// funzionano anche su un'altra macchina. Il motore del browser si cerca dove
// e' installato, oppure lo si dice con PLAYWRIGHT=/percorso/index.mjs.
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
const b = await chromium.launch();
const p = await b.newPage({ locale: 'it-IT' });
const errori = []; p.on('pageerror', e => errori.push(String(e)));
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

const r = await p.evaluate(async () => {
  window.__bucato = false;
  window.dailyRecords = []; window.shifts = [];
  localStorage.setItem('taxi_voci_fisse_avviato','si'); window.vociFisse = [];
  const cattivi = [
    { id: "1');window.__bucato=true;//", data: '2026-03-10', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 },
    { id: '2"><img src=x onerror="window.__bucato=true">', data: '2026-03-11', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 },
    { id: 'buono-3', data: '2026-03-12', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10 }
  ];
  await applicaBackup({ records: cattivi, shifts: [] });
  const entrati = (window.dailyRecords || []).map(x => String(x.id));

  // seconda difesa: anche se un id cattivo arrivasse dal Cloud, disegnare
  // la riga non deve eseguirlo
  window.dailyRecords = [{ id: "9');window.__bucato=true;//", data: '2026-03-13', tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 10, ora: '10:00' }];
  switchTab('giornata'); applyFilterGiornoGiornate('2026-03-13');
  await new Promise(r2 => setTimeout(r2, 400));
  const html = document.getElementById('main-container').innerHTML;
  return {
    entrati,
    bucato: window.__bucato,
    // l'apice dell'id deve essere uscito scappato, non nudo
    apiceNudo: html.includes("deleteRecord('9');"),
    apiceScappato: html.includes("\\'") || html.includes('&#39;')
  };
});
const prova = (n, bene, extra) => console.log(`  ${bene ? 'ok ' : '***'} ${n}${bene ? '' : '  *** ' + extra + ' ***'}`);
prova('i due id malformati sono stati scartati', r.entrati.length === 1 && r.entrati[0] === 'buono-3', JSON.stringify(r.entrati));
prova('niente e\' stato eseguito', r.bucato === false, 'CODICE ESEGUITO');
prova('nell\'HTML l\'apice esce scappato, non nudo', !r.apiceNudo, 'apice nudo nell\'onclick');

// ------------------------------------------------------------------
// I CAMPI DEI TURNI
// ------------------------------------------------------------------
let guai = 0;
const ok = (c, testo, dettaglio) => {
  if (!c) guai++;
  console.log(`  ${c ? 'ok ' : '***'} ${testo}${c ? '' : '  *** ' + (dettaglio === undefined ? '' : dettaglio) + ' ***'}`);
};
// Il veleno chiude un attributo («">») e apre un'immagine che non carica: se
// arriva nudo nell'HTML, sia dentro un testo sia dentro value="...", parte.
// Ognuno firma col nome del suo campo, cosi' si sa quale e' passato.
const ORARI = ['inizio', 'fine', 'pausaInizio', 'pausaFine'];
const NUMERI = ['ore', 'kmTot', 'kmInizio', 'kmFine'];
const CAMPI = [...ORARI, ...NUMERI];
const veleno = k => `x"><img src=x onerror="window.__bucato=(window.__bucato||'')+'|${k}'">`;
const BASE = { turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true,
               kmInizio: '45000', kmFine: '45180', kmTot: 180 };
// Un turno per campo avvelenato, in giorni diversi di marzo 2026; e uno
// tutto giusto, con le forme meno ovvie che l'app scrive davvero.
const avvelenati = CAMPI.map((k, i) => Object.assign({}, BASE,
  { id: 'tv-' + k, data: `2026-03-0${i + 1}`, [k]: veleno(k) }));
const BUONO = { id: 'tbuono', data: '2026-03-10', turno: 'Lo spezzato', inizio: '7:30', fine: '21:30',
                pausaInizio: '13:00', pausaFine: '15:00', ore: '8,5', kmTot: 12,
                kmInizio: '1200', kmFine: '1212', lavorato: true };
const ALTRO_BUONO = { id: 'tbuono2', data: '2026-03-09', turno: 'Le otto', inizio: '08:00', fine: '20:00',
                      ore: '12', kmTot: '', kmInizio: null, kmFine: null, lavorato: true };

console.log('\n  -- turni che passano da applicaBackup --');
const dopo = await p.evaluate(async (turni) => {
  window.__bucato = undefined;
  window.dailyRecords = []; window.shifts = [];
  await applicaBackup({ records: [], shifts: turni });
  const disco = JSON.parse(localStorage.getItem('taxi_shifts') || '[]');
  return { memoria: window.shifts, disco };
}, [...avvelenati, BUONO, ALTRO_BUONO]);
for (const k of CAMPI) {
  const t = dopo.memoria.find(x => x.id === 'tv-' + k);
  const vuoto = ORARI.includes(k) ? '' : null;
  ok(!!t, `il turno col ${k} storto entra lo stesso`, JSON.stringify(dopo.memoria.map(x => x.id)));
  if (!t) continue;
  ok(t[k] === vuoto, `${k} storto esce ${JSON.stringify(vuoto)}`, JSON.stringify(t[k]));
  const resto = CAMPI.filter(x => x !== k).every(x => JSON.stringify(t[x]) === JSON.stringify(BASE[x]));
  ok(resto, `e gli altri campi di quel turno restano com'erano`, JSON.stringify(t));
  const suDisco = dopo.disco.find(x => x.id === 'tv-' + k);
  ok(!!suDisco && suDisco[k] === vuoto, `${k}: ripulito anche su disco`, JSON.stringify(suDisco && suDisco[k]));
}
for (const atteso of [BUONO, ALTRO_BUONO]) {
  const t = dopo.memoria.find(x => x.id === atteso.id);
  const uguali = !!t && Object.keys(atteso).every(k => JSON.stringify(t[k]) === JSON.stringify(atteso[k]));
  ok(uguali, `turno giusto ${atteso.id}: ogni campo identico, tipo compreso`, JSON.stringify(t));
}

console.log('\n  -- turni storti scritti direttamente in taxi_shifts --');
// Qui nessuno pulisce: e' quello che arriva dal Cloud o da un telefono con
// dati vecchi. Si guarda a video, con l'orologio fermo dentro quel marzo.
const q = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
await q.clock.setFixedTime(new Date('2026-03-11T12:00:00+01:00'));
const erroriQ = []; q.on('pageerror', e => erroriQ.push(String(e)));
q.on('dialog', d => d.accept());
await q.goto(APP);
await q.evaluate((turni) => {
  localStorage.clear();
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_shifts', JSON.stringify(turni));
  localStorage.setItem('taxi_records', JSON.stringify(turni.map((t, i) => ({
    id: 'e' + i, data: t.data, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 30 + i, ora: '10:00' }))));
}, [...avvelenati, BUONO]);
await q.goto(APP);
await q.waitForFunction(() => typeof window.switchTab === 'function');
const caricati = await q.evaluate(() => (window.shifts || []).filter(t => String(t.id).startsWith('tv-')).length);
ok(caricati === CAMPI.length, `i ${CAMPI.length} turni storti sono davvero in memoria`, String(caricati));
// Un'immagine «x» nel documento vuol dire che il veleno e' entrato come HTML,
// anche se il suo onerror non e' ancora partito.
const guarda = async (dove) => {
  await q.waitForTimeout(200);
  return q.evaluate((dove) => {
    const img = document.querySelectorAll('img[src="x"]').length;
    if (img) window.__entrati = (window.__entrati || []).concat(dove + ' (' + img + ' img)');
  }, dove);
};
const SCHEDE = ['dashboard', 'giornata', 'uscite', 'categorie', 'scadenze', 'auto', 'rendimento',
                'report', 'versamenti', 'note', 'cloud', 'altro'];
for (const tab of SCHEDE) {
  await q.evaluate(t => { switchTab(t); }, tab);
  await guarda('scheda ' + tab);
}
let modifiche = 0;
for (const t of [...avvelenati, BUONO]) {
  await q.evaluate(d => { switchTab('dashboard'); setDashGiorno(d); }, t.data);
  await guarda('dashboard ' + t.data);
  await q.evaluate(d => { switchTab('giornata'); setVistaGiornata('giornate'); applyFilterGiornoGiornate(d); }, t.data);
  await guarda('giornate ' + t.data);
  await q.evaluate(d => { switchTab('giornata'); setVistaGiornata('calendario'); window.giornoCalendarioAperto = null; toccaGiornoCalendario(d); }, t.data);
  await guarda('calendario ' + t.data);
  // La modifica in riga dal suo tasto vero: e' li' che i valori finiscono
  // dentro value="...".
  const tasto = q.locator(`button[onclick="apriModificaTurno('${t.id}')"]`);
  if (await tasto.count()) {
    await tasto.first().click();
    await guarda('modifica in riga ' + t.id);
    const aperta = await q.evaluate(id => !!document.getElementById('ore-edit-' + id), t.id);
    if (aperta) modifiche++;
    await q.evaluate(() => annullaModificaTurno());
  }
  // Lo spostamento nomina il turno e la sua data.
  await q.evaluate(id => iniziaSpostamento(id), t.id);
  await guarda('spostamento ' + t.id);
  await q.evaluate(() => annullaSpostamento());
}
ok(modifiche === avvelenati.length + 1, `la modifica in riga si e' aperta per tutti i ${avvelenati.length + 1} turni`, String(modifiche));
// Il modulo del turno nuovo propone i km di partenza dal turno prima.
await q.evaluate(() => { switchTab('giornata'); apriFormTurno('2026-03-11'); });
await guarda('modulo turno nuovo');
await q.evaluate(() => { switchTab('giornata'); apriFormTurno('2026-03-08'); });
await guarda('modulo turno dopo il kmFine storto');
await q.waitForTimeout(400);
const esito = await q.evaluate(() => ({ bucato: window.__bucato, entrati: window.__entrati || [] }));
ok(esito.bucato === undefined, 'nessun campo del turno ha eseguito codice', esito.bucato);
ok(esito.entrati.length === 0, 'e nessun veleno e\' entrato nella pagina come HTML', esito.entrati.slice(0, 8).join(', '));
ok(erroriQ.length === 0, 'nessun errore JS aprendo le schede', erroriQ.join(' | '));
await q.close();

console.log('\n  errori JS:', errori.length ? errori : 'nessuno');
await b.close();
const primaParte = r.entrati.length === 1 && r.bucato === false && !r.apiceNudo;
process.exit(guai || !primaParte ? 1 : 0);
