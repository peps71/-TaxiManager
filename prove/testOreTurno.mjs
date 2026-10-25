// LE ORE DEL TURNO E IL GUADAGNO ALL'ORA
// Un turno nasce con un orario di fine, e finche' quell'ora non arriva l'app
// lo considera in corso e conta il €/h sulle ore passate dall'orologio.
// Ma le ore si possono correggere: si smette prima e si scrive 10 al posto di
// 12. Quella correzione non toccava inizio ne' fine, e il €/h continuava a
// scivolare fino all'ora di fine che non era stata lavorata.
// Qui si misura il caso vero e - altrettanto importante - i casi che NON
// devono cambiare: il turno normale a meta', lo Spezzato con la sua pausa,
// il turno non ancora cominciato, il riposo.
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
const p = await b.newPage({ viewport: { width: 390, height: 900 }, locale: 'it-IT' });
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

// Un turno costruito attorno a ADESSO, cosi' la prova vale a qualunque ora giri.
await p.evaluate(`
window.__turno = function (opz) {
  const due = n => String(n).padStart(2, '0');
  const adesso = new Date();
  const ini = new Date(adesso.getTime() - opz.cominciatoOreFa * 3600000);
  const fin = new Date(ini.getTime() + opz.finestraOre * 3600000);
  const orario = d => due(d.getHours()) + ':' + due(d.getMinutes());
  const t = { id: 't' + Math.random(), data: ini.toISOString().slice(0, 10),
              turno: opz.nome || 'Le otto', inizio: orario(ini), fine: orario(fin),
              ore: opz.ore, lavorato: opz.lavorato !== false, kmTot: 150 };
  if (opz.pausaDaOreFa !== undefined) {
    const pi = new Date(adesso.getTime() - opz.pausaDaOreFa * 3600000);
    const pf = new Date(pi.getTime() + opz.pausaOre * 3600000);
    t.pausaInizio = orario(pi); t.pausaFine = orario(pf);
  }
  return t;
};
window.__fra = function (t, oreAvanti) {
  const quando = new Date(Date.now() + oreAvanti * 3600000);
  const passate = window.oreFinora(t, quando);
  return { inCorso: passate !== null, ore: passate === null ? parseFloat(t.ore) : +passate.toFixed(2) };
};
`);

// ------------------------------------------------------------------
console.log('\n1. HO SCRITTO 10 ORE: IL CONTO SI FERMA SU 10');
// ------------------------------------------------------------------
// Cominciato 10 ore fa, in programma 12, ma ne ha dichiarate 10.
const caso = await p.evaluate(() => {
  const t = window.__turno({ cominciatoOreFa: 10, finestraOre: 12, ore: 10 });
  const passi = [0, 0.5, 1, 1.5, 2].map(h => Object.assign({ h }, window.__fra(t, h)));
  const eo = window.euroOraVivo(400, 10, [t]);
  return { passi, euroOra: +eo.valore.toFixed(2), vivo: eo.vivo, orari: `${t.inizio}-${t.fine}` };
});
ok(caso.passi.every(x => !x.inCorso), 'il turno e\' chiuso', caso.orari);
ok(caso.passi.every(x => x.ore === 10), 'e le ore restano 10 col passare del tempo',
   caso.passi.map(x => `+${x.h}h:${x.ore}`).join(' '));
ok(Math.abs(caso.euroOra - 40) < 0.01, '400 € in 10 ore fanno 40 €/h', `${caso.euroOra} €/h`);
ok(!caso.vivo, 'e non dice piu\' «in turno»');

// ------------------------------------------------------------------
console.log('\n2. IL TURNO NORMALE NON CAMBIA');
// ------------------------------------------------------------------
const normale = await p.evaluate(() => {
  // «Le otto»: 12 ore dichiarate in una finestra di 12. Cominciato 3 ore fa.
  const t = window.__turno({ cominciatoOreFa: 3, finestraOre: 12, ore: 12 });
  const eo = window.euroOraVivo(150, 12, [t]);
  return {
    aMeta: window.__fra(t, 0),
    pocoPrimaDellaFine: window.__fra(t, 8.9),
    allaFine: window.__fra(t, 9.1),
    euroOra: +eo.valore.toFixed(2), vivo: eo.vivo
  };
});
ok(normale.aMeta.inCorso, 'a meta\' turno e\' ancora in corso', `${normale.aMeta.ore} ore fatte`);
ok(Math.abs(normale.aMeta.ore - 3) < 0.05, 'e conta le ore dell\'orologio', `${normale.aMeta.ore}`);
ok(normale.pocoPrimaDellaFine.inCorso, 'poco prima della fine ancora in corso', `${normale.pocoPrimaDellaFine.ore} ore`);
ok(!normale.allaFine.inCorso, 'passate le 12 ore si chiude da solo', `${normale.allaFine.ore} ore`);
ok(Math.abs(normale.euroOra - 50) < 0.5, 'e intanto il €/h e\' quello dal vivo', `${normale.euroOra} €/h su 3 ore`);

// ------------------------------------------------------------------
console.log('\n3. LO SPEZZATO E LA SUA PAUSA');
// ------------------------------------------------------------------
// Finestra 14 ore, pausa di 2, quindi 12 lavorate. Cominciato 13 ore fa, con
// la pausa finita: le ore lavorate sono 11, non 13.
const spezzato = await p.evaluate(() => {
  const t = window.__turno({ cominciatoOreFa: 13, finestraOre: 14, ore: 12,
                             nome: 'Lo spezzato', pausaDaOreFa: 5, pausaOre: 2 });
  return { adesso: window.__fra(t, 0), fraUnOra: window.__fra(t, 1), fraDue: window.__fra(t, 2) };
});
ok(spezzato.adesso.inCorso, 'con la pausa gia\' fatta e\' ancora in corso', `${spezzato.adesso.ore} ore lavorate su 13 passate`);
ok(Math.abs(spezzato.adesso.ore - 11) < 0.05, 'la pausa non si conta come lavoro', `${spezzato.adesso.ore} ore`);
ok(!spezzato.fraDue.inCorso, 'e si chiude quando le ore lavorate arrivano a 12', `fra 2 ore: ${spezzato.fraDue.ore}`);

// ------------------------------------------------------------------
console.log('\n4. I CASI CHE NON SONO UN TURNO IN CORSO');
// ------------------------------------------------------------------
const altri = await p.evaluate(() => {
  const nonCominciato = window.__turno({ cominciatoOreFa: -2, finestraOre: 12, ore: 12 });
  const riposo = window.__turno({ cominciatoOreFa: 3, finestraOre: 12, ore: 0, lavorato: false });
  const senzaOre = window.__turno({ cominciatoOreFa: 3, finestraOre: 12, ore: 0 });
  return {
    nonCominciato: window.oreFinora(nonCominciato) !== null,
    riposo: window.oreFinora(riposo) !== null,
    senzaOre: window.oreFinora(senzaOre) !== null,
    senzaOreQuante: window.oreFinora(senzaOre)
  };
});
ok(!altri.nonCominciato, 'un turno che deve ancora cominciare non e\' in corso');
ok(!altri.riposo, 'una giornata di riposo non e\' un turno in corso');
ok(altri.senzaOre, 'con zero ore dichiarate vale l\'orologio, come prima',
   `${altri.senzaOreQuante === null ? 'chiuso' : altri.senzaOreQuante.toFixed(2) + ' ore'}`);

// ------------------------------------------------------------------
console.log('\n5. DUE TURNI NELLO STESSO GIORNO');
// ------------------------------------------------------------------
const due = await p.evaluate(() => {
  const chiuso = window.__turno({ cominciatoOreFa: 12, finestraOre: 4, ore: 4 });
  const aperto = window.__turno({ cominciatoOreFa: 2, finestraOre: 8, ore: 8 });
  const eo = window.euroOraVivo(300, 12, [chiuso, aperto]);
  return { ore: +eo.ore.toFixed(2), vivo: eo.vivo, valore: +eo.valore.toFixed(2) };
});
ok(due.vivo, 'col secondo turno aperto il conto e\' dal vivo');
ok(Math.abs(due.ore - 6) < 0.05, 'e somma le 4 ore del turno chiuso alle 2 fatte finora', `${due.ore} ore`);
ok(Math.abs(due.valore - 50) < 0.5, '300 € in 6 ore fanno 50 €/h', `${due.valore} €/h`);

await b.close();
console.log(`\n  ${guai === 0 ? 'tutto a posto' : guai + ' controlli falliti'}`);
process.exit(guai ? 1 : 0);
