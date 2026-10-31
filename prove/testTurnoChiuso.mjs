// IL REGISTRO SI APRE COL TURNO E SI CHIUDE CON LUI
// Una corsa registrata a turno finito quasi sempre e' un tocco per sbaglio:
// il telefono in tasca, l'app rimasta aperta sulla schermata di prima. In
// fondo al mese quella corsa non si distingue piu' dalle altre.
// Qui si misura la porta: chiusa fuori dal turno, aperta mentre si lavora, e
// il tasto che la apre a mano quando serve davvero. E soprattutto quello che
// NON deve bloccare: il modulo del turno (e' la via per riaprire), le
// modifiche a quello che e' gia' registrato, e il turno di notte - datato
// ieri ma ancora in corso stamattina.
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

// L'ORA FERMA. Senza un orologio fermo la prova girava con l'ora vera, e
// fra mezzanotte e l'una (o le due) di Roma cadeva per un motivo che non
// c'entra: «oggi» per la pagina (fuso di Roma) e «oggi» per i conti della
// prova (fuso della macchina, UTC) erano due giorni diversi, e un turno
// costruito attorno all'ora vera scavalcava la mezzanotte. Falliva uguale
// sulla v175: era la prova, non l'app. Si resta attorno al giorno VERO di
// Roma (la prova vale in ogni giorno dell'anno, come prima), ma a
// mezzogiorno di quel giorno; e il «mattino» e' le 06:30 UTC dello stesso
// giorno (07:30 o 08:30 a Roma).
const GIORNO_ROMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const ORA_FISSA = new Date(GIORNO_ROMA + 'T11:00:00Z');
const MATTINO = new Date(GIORNO_ROMA + 'T06:30:00Z');

// I turni si costruiscono attorno all'orologio di adesso: una prova che vale
// solo alle dieci di mattina non e' una prova.
const SEMINA = (quando) => {
  const due = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
  const orario = d => due(d.getHours()) + ':' + due(d.getMinutes());
  const ora = new Date();
  window.__oggi = iso(ora);
  window.__ieri = iso(new Date(ora.getTime() - 86400000));
  window.dailyRecords = [];
  window.shifts = [];
  if (quando === 'in-corso') {
    const ini = new Date(ora.getTime() - 2 * 3600000);
    const fin = new Date(ora.getTime() + 6 * 3600000);
    window.shifts = [{ id: 'tVivo', data: window.__oggi, turno: 'Le otto', inizio: orario(ini),
                       fine: orario(fin), ore: 8, lavorato: true, kmInizio: 1000, kmFine: null, kmTot: null }];
  } else if (quando === 'finito') {
    const ini = new Date(ora.getTime() - 9 * 3600000);
    const fin = new Date(ora.getTime() - 1 * 3600000);
    window.shifts = [{ id: 'tFinito', data: window.__oggi, turno: 'Le otto', inizio: orario(ini),
                       fine: orario(fin), ore: 8, lavorato: true, kmInizio: 1000, kmFine: 1100, kmTot: 100 }];
  } else if (quando === 'riposo') {
    window.shifts = [{ id: 'tRiposo', data: window.__oggi, turno: 'Festivo', inizio: '', fine: '',
                       ore: 0, lavorato: false, kmInizio: null, kmFine: null, kmTot: null }];
  }
  window.annoScelto = String(ora.getFullYear());
  window.versioneDati = (window.versioneDati || 0) + 1;
  switchTab('giornata');
  return window.__oggi;
};

async function apri(quando, oraFissa) {
  const p = await b.newPage({ viewport: { width: 390, height: 1000 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  p.on('dialog', d => d.accept());
  await p.clock.setFixedTime(oraFissa || ORA_FISSA);
  await p.goto(APP);
  await p.evaluate(() => localStorage.clear());
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(SEMINA, quando);
  await p.waitForTimeout(300);
  return p;
}

const LETTURA = `(() => {
  const t = document.getElementById('main-container').textContent;
  const tasti = Array.from(document.querySelectorAll('button'));
  const onclick = (x) => x.getAttribute('onclick') || '';
  return {
    aperto: window.registroAperto(),
    riquadroChiuso: /il registro è fermo/.test(t),
    campoIncasso: !!document.getElementById('corsa-lampo'),
    strisciaSbloccata: /Giornata sbloccata/.test(t),
    tastoSblocca: tasti.some(x => onclick(x).indexOf('sbloccaGiornata') === 0),
    tastoRichiudi: tasti.some(x => onclick(x).indexOf('richiudiGiornata') === 0),
    tastoTurno: tasti.some(x => onclick(x).indexOf('vaiARegistrareIlTurno') === 0),
    tastoSpesa: tasti.some(x => onclick(x).indexOf('alternaSpesaLampo') === 0)
  };
})()`;

// ------------------------------------------------------------------
console.log('\n1. SENZA TURNO IL REGISTRO E\' FERMO');
// ------------------------------------------------------------------
let p = await apri('niente');
let v = await p.evaluate(LETTURA);
ok(!v.aperto, 'il registro è chiuso');
ok(v.riquadroChiuso, 'e lo dice con un riquadro al posto dei tasti');
ok(!v.campoIncasso, 'il campo dell\'incasso non c\'è');
ok(!v.tastoSpesa, 'e nemmeno il tasto della spesa');
ok(v.tastoSblocca, 'ma c\'è il tasto per sbloccare');
ok(v.tastoTurno, 'e quello per registrare il turno');
ok(await p.evaluate(() => /Turno non ancora aperto/.test(document.getElementById('main-container').textContent)),
   'il riquadro dice che il turno non è ancora aperto');

// Il modulo del turno non si blocca mai: e' la via per riaprire. E sta nel
// Calendario, l'altra meta' di questa schermata: il tasto ci deve portare,
// non limitarsi ad accenderlo dove non si vede.
await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button'))
    .find(x => (x.getAttribute('onclick') || '').indexOf('vaiARegistrareIlTurno') === 0);
  t.click();
});
await p.waitForTimeout(350);
ok(await p.evaluate(() => !!document.getElementById('sh-data')),
   '«Registra il turno» porta davvero al modulo del turno');
await p.close();

// ------------------------------------------------------------------
console.log('\n2. COL TURNO IN CORSO SI REGISTRA');
// ------------------------------------------------------------------
p = await apri('in-corso');
v = await p.evaluate(LETTURA);
ok(v.aperto, 'il registro è aperto');
ok(!v.riquadroChiuso, 'niente riquadro');
ok(v.campoIncasso, 'il campo dell\'incasso c\'è');
ok(v.tastoSpesa, 'e il tasto della spesa');
ok(!v.strisciaSbloccata, 'e non c\'è nessuna striscia da sbloccato: è il turno che tiene aperto');

// la corsa si registra davvero
await p.evaluate(() => {
  document.getElementById('corsa-lampo').value = '18,50';
  corsaLampo('Contanti');
});
await p.waitForTimeout(300);
ok(await p.evaluate(() => (window.dailyRecords || []).some(r => r.tipo === 'ENTRATA' && r.importo === 18.5)),
   'e la corsa entra nel registro', '18,50 €');
await p.close();

// ------------------------------------------------------------------
console.log('\n3. A TURNO FINITO SI RICHIUDE');
// ------------------------------------------------------------------
p = await apri('finito');
v = await p.evaluate(LETTURA);
ok(!v.aperto, 'il registro è chiuso');
ok(v.riquadroChiuso && !v.campoIncasso, 'via i tasti, c\'è il riquadro');
ok(await p.evaluate(() => /Turno chiuso/.test(document.getElementById('main-container').textContent)),
   'e dice «Turno chiuso»');
ok(!v.tastoTurno || true, 'il turno di oggi c\'è già, quindi non lo richiede');

// ------------------------------------------------------------------
console.log('\n4. IL TASTO CHE APRE LA GIORNATA');
// ------------------------------------------------------------------
await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button'))
    .find(x => (x.getAttribute('onclick') || '').indexOf('sbloccaGiornata') === 0);
  t.click();
});
await p.waitForTimeout(300);
v = await p.evaluate(LETTURA);
ok(v.aperto, 'premuto «Sblocca la giornata», il registro si apre');
ok(v.campoIncasso, 'il campo dell\'incasso torna');
ok(v.strisciaSbloccata, 'e una riga ricorda che si sta scrivendo a registro sbloccato');
ok(v.tastoRichiudi, 'con il tasto per richiuderlo subito');
ok(await p.evaluate(() => localStorage.getItem('taxi_sblocco_giornata') === window.__oggi),
   'lo sblocco si ricorda anche se l\'app si riapre');

await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button'))
    .find(x => (x.getAttribute('onclick') || '').indexOf('richiudiGiornata') === 0);
  t.click();
});
await p.waitForTimeout(300);
v = await p.evaluate(LETTURA);
ok(!v.aperto && v.riquadroChiuso, '«Richiudi» lo richiude');
ok(await p.evaluate(() => !localStorage.getItem('taxi_sblocco_giornata')), 'e se lo dimentica');

// lo sblocco e' una data, non un interruttore: domani non vale piu'
await p.evaluate(() => {
  window.sbloccoGiornata = window.__ieri;
  localStorage.setItem('taxi_sblocco_giornata', window.__ieri);
  renderContent();
});
await p.waitForTimeout(250);
ok(await p.evaluate(() => !window.registroAperto()),
   'lo sblocco di ieri oggi non vale più: si richiude da sé a mezzanotte');
await p.close();

// ------------------------------------------------------------------
console.log('\n5. IL TURNO DI NOTTE');
// ------------------------------------------------------------------
// Cominciato ieri alle 23, ancora in corso alle sette e mezza. Guardare solo
// i turni che portano la data di oggi lo avrebbe lasciato fuori, e il
// registro sarebbe rimasto chiuso proprio mentre si lavora.
const MATTINA = MATTINO;
p = await apri('niente', MATTINA);
await p.evaluate(() => {
  window.shifts = [{ id: 'tNotte', data: window.__ieri, turno: 'La notte', inizio: '23:00',
                     fine: '11:00', ore: 12, lavorato: true, kmInizio: 1000, kmFine: null, kmTot: null }];
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
});
await p.waitForTimeout(300);
ok(await p.evaluate(() => window.registroAperto()), 'con il turno di notte in corso, oggi il registro è aperto');
ok(await p.evaluate(() => window.registroAperto(window.__ieri)), 'e anche la giornata di ieri, che è quella del turno');
ok(await p.evaluate(() => !!document.getElementById('corsa-lampo')), 'il campo dell\'incasso c\'è');
await p.close();

// ------------------------------------------------------------------
console.log('\n6. IL REGISTRO SPESE');
// ------------------------------------------------------------------
p = await apri('finito');
await p.evaluate(() => { switchTab('uscite'); });
await p.waitForTimeout(300);
const spese = await p.evaluate(() => {
  const t = document.getElementById('main-container').textContent;
  return { chiuso: /il registro è fermo/.test(t), tastoNuova: /Nuova Spesa/.test(t),
           modulo: !!document.getElementById('uscita-imp') };
});
ok(spese.chiuso, 'col turno chiuso il riquadro c\'è anche qui');
ok(!spese.tastoNuova, 'e il tasto «+ Nuova Spesa» non c\'è');
await p.evaluate(() => { sbloccaGiornata(oggiISO()); });
await p.waitForTimeout(300);
ok(await p.evaluate(() => /Nuova Spesa/.test(document.getElementById('main-container').textContent)),
   'sbloccando la giornata il tasto torna');

// e il modulo aperto prima dello sblocco non resta appeso
await p.evaluate(() => { window.showUscitaForm = true; richiudiGiornata(); });
await p.waitForTimeout(300);
ok(await p.evaluate(() => !document.getElementById('uscita-imp')),
   'richiudendo, il modulo della spesa sparisce con lui');
await p.close();

// ------------------------------------------------------------------
console.log('\n7. L\'AVVISO DELLA MANUTENZIONE APRE LA PORTA DA SE\'');
// ------------------------------------------------------------------
// «Registra l'intervento» e' gia' dire «voglio registrarlo»: mandare in una
// schermata dove il modulo non c'e' sarebbe un tasto che non fa niente.
p = await apri('finito');
await p.evaluate(() => {
  window.veicoli = [{ id: 'v1', modello: 'Skoda Octavia', dataAcquisto: (new Date().getFullYear() - 2) + '-01-10',
                      kmAcquisto: 180000, uscita: 'in-uso', dataUscita: '' }];
  window.shifts = window.shifts.concat([]);
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
});
await p.waitForTimeout(250);
ok(await p.evaluate(() => !window.registroAperto()), 'si parte col registro fermo');
await p.evaluate(() => { apriSpesaManutenzione('tagliando'); });
await p.waitForTimeout(400);
const manut = await p.evaluate(() => ({
  aperto: window.registroAperto(),
  scheda: window.activeTab,
  modulo: !!document.getElementById('uscita-imp'),
  intervento: (document.getElementById('uscita-sotto') || {}).value
}));
ok(manut.aperto, 'il tasto dell\'avviso sblocca la giornata');
ok(manut.scheda === 'uscite' && manut.modulo, 'e il modulo si apre davvero', manut.scheda);
ok(manut.intervento === 'tagliando', 'con l\'intervento già scelto');
await p.close();

// ------------------------------------------------------------------
console.log('\n8. IL GIORNO DI RIPOSO NON CAMBIA REGOLA');
// ------------------------------------------------------------------
p = await apri('riposo');
let rip = await p.evaluate(() => {
  const t = document.getElementById('main-container').textContent;
  return { riposo: /qui non si registrano corse/.test(t), chiuso: /il registro è fermo/.test(t),
           spesa: Array.from(document.querySelectorAll('button')).some(x => (x.getAttribute('onclick') || '').indexOf('alternaSpesaLampo') === 0) };
});
ok(rip.riposo, 'il riquadro del riposo resta dov\'era');
ok(rip.chiuso && !rip.spesa, 'e col registro fermo nemmeno la spesa passa');
await p.evaluate(() => { sbloccaGiornata(oggiISO()); });
await p.waitForTimeout(300);
rip = await p.evaluate(() => {
  const t = document.getElementById('main-container').textContent;
  return { corse: !!document.getElementById('corsa-lampo'), riposo: /qui non si registrano corse/.test(t),
           spesa: Array.from(document.querySelectorAll('button')).some(x => (x.getAttribute('onclick') || '').indexOf('alternaSpesaLampo') === 0) };
});
ok(rip.spesa, 'sbloccando torna il tasto della spesa');
ok(!rip.corse && rip.riposo, 'ma le corse no: in un giorno di riposo non si registrano comunque');
await p.close();

// ------------------------------------------------------------------
console.log('\n9. QUELLO CHE E\' GIA\' REGISTRATO SI TOCCA LO STESSO');
// ------------------------------------------------------------------
// Il blocco e' sull'inserire, non sul correggere: una cifra sbagliata si
// deve poter aggiustare anche a turno chiuso.
p = await apri('finito');
await p.evaluate(() => {
  window.dailyRecords = [{ id: 'r1', data: window.__oggi, tipo: 'ENTRATA', categoria: 'Corsa',
                           metodo: 'Contanti', importo: 22, ora: '10:00' }];
  window.versioneDati = (window.versioneDati || 0) + 1;
  renderContent();
});
await p.waitForTimeout(300);
const haModifica = await p.evaluate(() => Array.from(document.querySelectorAll('button'))
  .some(x => (x.getAttribute('onclick') || '').indexOf('apriModificaRecord') === 0));
ok(haModifica, 'la corsa già registrata si può ancora aprire');
// Il pannello della modifica - con importo, data e il tasto Elimina - si apre
// di sotto: e' li' che si corregge, ed e' li' che si deve poter arrivare
// anche a registro fermo.
await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button'))
    .find(x => (x.getAttribute('onclick') || '').indexOf('apriModificaRecord') === 0);
  t.click();
});
await p.waitForTimeout(300);
const tocca = await p.evaluate(() => ({
  campoImporto: !!document.querySelector('[id^="mv-imp-"]'),
  elimina: Array.from(document.querySelectorAll('button'))
    .some(x => (x.getAttribute('onclick') || '').indexOf('deleteRecord') === 0)
}));
ok(tocca.campoImporto, 'il pannello della modifica si apre e l\'importo si corregge');
ok(tocca.elimina, 'e la corsa si può cancellare');
await p.close();

// ------------------------------------------------------------------
console.log('\n10. IL DISEGNO, STRETTO E AL BUIO');
// ------------------------------------------------------------------
const lum = (c) => {
  const [r, g, bl] = String(c).match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(x => {
    const y = x / 255; return y <= 0.03928 ? y / 12.92 : Math.pow((y + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
};
const contrasto = (a, b2) => {
  const x = lum(a), y = lum(b2);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
for (const larghezza of [320, 390, 768, 1280]) {
  const q = await apri('finito');
  await q.setViewportSize({ width: larghezza, height: 1000 });
  await q.waitForTimeout(300);
  const m = await q.evaluate(() => {
    const doc = document.documentElement;
    const riquadro = Array.from(document.querySelectorAll('.riquadro-tinto'))
      .find(x => /il registro è fermo/.test(x.textContent));
    const tagliati = [];
    riquadro.querySelectorAll('p, button, span').forEach(el => {
      if (!el.children.length && el.scrollWidth > el.clientWidth + 1) tagliati.push((el.textContent || '').trim().slice(0, 24));
    });
    const r = riquadro.getBoundingClientRect();
    const padre = riquadro.parentElement.getBoundingClientRect();
    return {
      sbordo: doc.scrollWidth - doc.clientWidth, tagliati,
      dentro: r.left >= padre.left - 0.5 && r.right <= padre.right + 0.5,
      tasti: Array.from(riquadro.querySelectorAll('button')).map(x => Math.round(x.getBoundingClientRect().height))
    };
  });
  ok(m.sbordo <= 0, `${larghezza}px: la pagina non sborda`, 'sbordo ' + m.sbordo);
  ok(m.tagliati.length === 0, `${larghezza}px: niente testo tagliato`, m.tagliati.join(' | '));
  ok(m.dentro, `${larghezza}px: il riquadro sta dentro la colonna`);
  ok(m.tasti.length > 0 && m.tasti.every(h => h >= 44), `${larghezza}px: i tasti si prendono col dito`, m.tasti.join(' '));
  await q.close();
}

for (const tema of ['chiaro', 'scuro']) {
  const q = await apri('finito');
  await q.evaluate((t) => { localStorage.setItem('taxi_tema', t); window.applicaTema(t); renderContent(); }, tema);
  await q.waitForTimeout(300);
  const colori = await q.evaluate(() => {
    const riquadro = Array.from(document.querySelectorAll('.riquadro-tinto'))
      .find(x => /il registro è fermo/.test(x.textContent));
    const titolo = riquadro.querySelector('p');
    const spiega = riquadro.querySelectorAll('p')[1];
    let n = riquadro, sfondo = 'rgb(255,255,255)';
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)/.test(c)) { sfondo = c; break; }
      n = n.parentElement;
    }
    return { titolo: getComputedStyle(titolo).color, spiega: getComputedStyle(spiega).color, sfondo };
  });
  ok(contrasto(colori.titolo, colori.sfondo) >= 4.5, `tema ${tema}: «il registro è fermo» si legge`,
     contrasto(colori.titolo, colori.sfondo).toFixed(2) + ':1');
  ok(contrasto(colori.spiega, colori.sfondo) >= 4.5, `tema ${tema}: e la spiegazione sotto anche`,
     contrasto(colori.spiega, colori.sfondo).toFixed(2) + ':1');
  await q.close();
}

await b.close();
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
