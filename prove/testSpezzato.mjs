// LO SPEZZATO E LA SUA PAUSA
// Lo Spezzato va dalle 7:30 alle 13, due ore di pausa, e riprende dalle 15
// alle 21:30: dodici ore lavorate in quattordici di finestra. Il modello la
// pausa ce l'aveva, ma sul turno registrato non finiva: data, inizio, fine,
// ore, km - e basta. Dalla v166, in cui il turno si chiude quando le ore
// lavorate raggiungono quelle dichiarate, quelle due ore mancanti chiudevano
// lo Spezzato alle 19:30 invece che alle 21:30, e per tutto il pomeriggio il
// €/h girava su due ore di lavoro che non c'erano state.
// Qui si cammina lungo la giornata, ora per ora, con l'orologio fermato.
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

// Un giovedì qualunque, con l'ora solare: la giornata su cui si è visto il
// difetto. Le ore si scrivono in ora italiana.
const GIORNO = '2026-10-29';
const alle = (hhmm) => new Date(`${GIORNO}T${hhmm}:00+01:00`);

const b = await chromium.launch();

async function apri(ora) {
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  p.on('dialog', d => d.accept());
  await p.clock.setFixedTime(alle(ora));
  await p.goto(APP);
  await p.evaluate(() => localStorage.clear());
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  return p;
}

// Lo Spezzato come lo salvava l'app fino alla v173: senza la pausa scritta.
const SENZA_PAUSA = {
  id: 't1', data: GIORNO, inizio: '07:30', fine: '21:30',
  turno: 'Lo spezzato (7:30-13:00 / 15:00-21:30)', ore: 12, lavorato: true,
  kmInizio: 1000, kmFine: null, kmTot: null
};

// ------------------------------------------------------------------
console.log('\n1. LA GIORNATA DELLO SPEZZATO, ORA PER ORA');
// ------------------------------------------------------------------
// Il turno e' quello gia' in archivio, senza pausa scritta: la pausa si
// ripesca dal modello, altrimenti la giornata di oggi resterebbe storta.
const tappe = [
  ['07:00', null,  'alle 7:00 non e\' ancora cominciato'],
  ['07:30', 0,     'alle 7:30 comincia'],
  ['08:00', 0.5,   'alle 8:00 mezz\'ora'],
  ['12:59', 5.48,  'alle 12:59, un minuto prima della pausa, cinque ore e mezza scarse'],
  ['13:30', 5.5,   'alle 13:30, dentro la pausa, il conto sta fermo a cinque e mezza'],
  ['14:59', 5.5,   'alle 14:59, fino all\'ultimo minuto di pausa, sempre cinque e mezza'],
  ['15:30', 6,     'alle 15:30 riparte: sei ore'],
  ['19:36', 10.1,  'alle 19:36 dieci ore e sei minuti - e il turno e\' APERTO'],
  ['21:00', 11.5,  'alle 21:00 undici e mezza'],
  ['21:29', 11.98, 'alle 21:29 ci siamo quasi'],
  ['21:30', null,  'alle 21:30 il turno si chiude'],
  ['22:00', null,  'e alle 22:00 resta chiuso']
];

let p = await apri('07:00');
for (const [ora, atteso, testo] of tappe) {
  await p.clock.setFixedTime(alle(ora));
  const r = await p.evaluate((t) => {
    const ore = window.oreFinora(t);
    return { inCorso: ore !== null, ore: ore === null ? null : +ore.toFixed(2) };
  }, SENZA_PAUSA);
  if (atteso === null) {
    ok(!r.inCorso, testo, r.ore === null ? 'chiuso' : r.ore + ' h');
  } else {
    ok(r.inCorso && Math.abs(r.ore - atteso) < 0.02, testo, (r.inCorso ? r.ore + ' h' : 'chiuso') + ' invece di ' + atteso);
  }
}
await p.close();

// ------------------------------------------------------------------
console.log('\n2. IL €/H NON CONTA LA PAUSA');
// ------------------------------------------------------------------
// Alle 19:36 con 300 € incassati: 300 diviso 10,1 ore sono 29,70 €/h.
// Contando anche le due ore di pausa sarebbero stati 24,79: un numero che
// sembra vero e non lo e'.
p = await apri('19:36');
const eo = await p.evaluate((t) => {
  const r = window.euroOraVivo(300, t.ore, [t]);
  return { vivo: r.vivo, ore: +r.ore.toFixed(2), valore: +r.valore.toFixed(2) };
}, SENZA_PAUSA);
ok(eo.vivo, 'alle 19:36 l\'app dice ancora «in turno»');
ok(Math.abs(eo.ore - 10.1) < 0.02, 'sulle ore davvero lavorate', eo.ore + ' h');
ok(Math.abs(eo.valore - 29.70) < 0.05, '300 € in 10,1 ore fanno 29,70 €/h', eo.valore + ' €/h');

// ------------------------------------------------------------------
console.log('\n3. E IL REGISTRO RESTA APERTO');
// ------------------------------------------------------------------
// E' il difetto come si vedeva sullo schermo: «Turno chiuso: il registro è
// fermo» alle 19:36, in mezzo al turno.
await p.evaluate((t) => {
  window.shifts = [t];
  window.dailyRecords = [];
  window.annoScelto = t.data.slice(0, 4);
  window.versioneDati = (window.versioneDati || 0) + 1;
  switchTab('giornata');
}, SENZA_PAUSA);
await p.waitForTimeout(350);
const schermo = await p.evaluate(() => ({
  aperto: window.registroAperto(),
  fermo: /il registro è fermo/.test(document.getElementById('main-container').textContent),
  campoIncasso: !!document.getElementById('corsa-lampo')
}));
ok(schermo.aperto, 'il registro e\' aperto');
ok(!schermo.fermo, 'niente riquadro «Turno chiuso»');
ok(schermo.campoIncasso, 'e il campo dell\'incasso c\'e\'');
await p.close();

// ------------------------------------------------------------------
console.log('\n4. DA ADESSO LA PAUSA SI SCRIVE SUL TURNO');
// ------------------------------------------------------------------
// Ripescarla dal modello salva le giornate gia' registrate, ma un turno
// nuovo se la deve portare dietro scritta: e' un dato suo, non del modello.
p = await apri('19:36');
await p.evaluate(() => {
  window.shifts = [];
  switchTab('giornata');
  ricordaVista('calendario');
  window.showShiftForm = true;
  renderContent();
});
await p.waitForTimeout(300);
await p.evaluate((g) => {
  document.getElementById('sh-data').value = g;
  const tipo = document.getElementById('sh-tipo');
  tipo.value = 'spezzato';
  onShiftTypeChange('spezzato');
}, GIORNO);
await p.waitForTimeout(300);
await p.evaluate(() => {
  document.querySelector('form[onsubmit="addShift(event)"]')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
await p.waitForTimeout(400);
const salvato = await p.evaluate(() => {
  const t = (window.shifts || [])[0] || {};
  const suDisco = (JSON.parse(localStorage.getItem('taxi_shifts') || '[]')[0] || {});
  return { turno: t.turno, ore: t.ore, pausa: t.pausaInizio + '-' + t.pausaFine,
           pausaSuDisco: suDisco.pausaInizio + '-' + suDisco.pausaFine,
           inCorso: window.oreFinora(t) !== null, fatte: window.oreFinora(t) === null ? null : +window.oreFinora(t).toFixed(2) };
});
ok(/spezzato/i.test(salvato.turno || ''), 'lo Spezzato si registra dal modulo', salvato.turno);
ok(salvato.ore === 12, 'con dodici ore dichiarate', String(salvato.ore));
ok(salvato.pausa === '13:00-15:00', 'e la pausa scritta sul turno', salvato.pausa);
ok(salvato.pausaSuDisco === '13:00-15:00', 'anche sul disco', salvato.pausaSuDisco);
ok(salvato.inCorso && Math.abs(salvato.fatte - 10.1) < 0.02, 'e alle 19:36 risulta in corso', salvato.fatte + ' h');

// e anche quello registrato dal calendario con un tocco
await p.evaluate((g) => { window.shifts = []; segnaTurnoLavoro(g, 'spezzato'); }, GIORNO);
await p.waitForTimeout(300);
const dalCalendario = await p.evaluate(() => {
  const t = (window.shifts || [])[0] || {};
  return { pausa: t.pausaInizio + '-' + t.pausaFine, ore: t.ore };
});
ok(dalCalendario.pausa === '13:00-15:00', 'e lo stesso dal calendario', dalCalendario.pausa);
ok(dalCalendario.ore === 12, 'sempre dodici ore', String(dalCalendario.ore));
await p.close();

// ------------------------------------------------------------------
console.log('\n5. QUELLO CHE NON DEVE CAMBIARE');
// ------------------------------------------------------------------
p = await apri('19:36');
const altri = await p.evaluate((g) => {
  const prova = (t) => {
    const ore = window.oreFinora(t);
    return { inCorso: ore !== null, ore: ore === null ? null : +ore.toFixed(2) };
  };
  return {
    // «Le otto» non ha pause: alle 19:36 ha fatto 11,6 ore su 12, e' ancora in corso
    otto: prova({ id: 'a', data: g, inizio: '08:00', fine: '20:00', turno: 'Le otto (8:00 - 20:00)', ore: 12, lavorato: true }),
    // orari cambiati a mano: la pausa del modello non vale piu' e non si inventa
    storto: prova({ id: 'b', data: g, inizio: '09:00', fine: '21:30', turno: 'Lo spezzato (7:30-13:00 / 15:00-21:30)', ore: 12, lavorato: true }),
    // uno Spezzato con la pausa scritta diversa: comanda quella del turno
    suo: prova({ id: 'c', data: g, inizio: '07:30', fine: '21:30', turno: 'Lo spezzato (7:30-13:00 / 15:00-21:30)',
                 pausaInizio: '12:00', pausaFine: '13:00', ore: 12, lavorato: true }),
    // un riposo non e' mai in corso
    riposo: prova({ id: 'd', data: g, inizio: '', fine: '', turno: 'Festivo', ore: 0, lavorato: false })
  };
}, GIORNO);
ok(altri.otto.inCorso && Math.abs(altri.otto.ore - 11.6) < 0.02, '«Le otto» alle 19:36 ha fatto 11,6 ore', altri.otto.ore + ' h');
// Orari cambiati a mano: dalle 9:00 alle 19:36 sono 10,6 ore filate. Se si
// applicasse lo stesso la pausa del modello ne risulterebbero 8,6 - due ore
// di pausa che quel giorno non sono state fatte.
ok(altri.storto.inCorso && Math.abs(altri.storto.ore - 10.6) < 0.02,
   'con gli orari cambiati a mano la pausa del modello non si applica', altri.storto.ore + ' h, non 8,6');
ok(altri.suo.inCorso && Math.abs(altri.suo.ore - 11.1) < 0.02, 'una pausa scritta sul turno comanda su quella del modello', altri.suo.ore + ' h');
ok(!altri.riposo.inCorso, 'una giornata di riposo non e\' mai in corso');

// le ore dichiarate chiudono lo Spezzato al momento giusto
const dichiarate = await p.evaluate((g) => {
  const t = { id: 'e', data: g, inizio: '07:30', fine: '21:30', turno: 'Lo spezzato (7:30-13:00 / 15:00-21:30)',
              pausaInizio: '13:00', pausaFine: '15:00', ore: 10, lavorato: true };
  const quando = (hhmm) => new Date(g + 'T' + hhmm + ':00+01:00');
  return {
    alle1929: window.oreFinora(t, quando('19:29')) !== null,
    alle1931: window.oreFinora(t, quando('19:31')) !== null
  };
}, GIORNO);
ok(dichiarate.alle1929, 'scrivendo 10 ore, alle 19:29 il turno e\' ancora aperto');
ok(!dichiarate.alle1931, 'e alle 19:31 si chiude: dieci ore lavorate, pausa esclusa');
await p.close();

await b.close();
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
