// UNA CORSA DA DUEMILA EURO E' UNA VIRGOLA DIMENTICATA
// Sul tastierino del telefono «23,50» scritto di fretta diventa «2350», e il
// tasto del metodo salvava 2.350 € con un tocco solo: un incasso finto che
// finisce nei corrispettivi e nella stima delle tasse. Qui si controlla,
// dai tasti veri, la guardia che c'e' adesso:
//   - tasto veloce: sopra SOGLIA_CORSA_STRANA (300) il primo tocco NON salva
//     e sotto il campo compare la domanda; lo stesso metodo ritoccato salva,
//     un altro metodo o un'altra cifra ripartono da capo; 300 e 299 salvano
//     subito, come sempre;
//   - il doppio tocco nervoso: con touch-action: manipulation Safari non
//     aspetta piu' il doppio tocco per ingrandire, e due click a 50 ms
//     confermavano i 2.350 € prima che l'avviso si potesse leggere. Ora la
//     conferma vale solo ATTESA_CONFERMA_CORSA_MS (600 ms) dopo il tocco che
//     ha acceso l'avviso, misurati con performance.now() (che l'orologio
//     fermo di setFixedTime non ferma); un tocco piu' rapido non salva,
//     lascia l'avviso e NON riparte il conto (se ripartisse, il tocco calmo
//     dopo un rimbalzo chiederebbe ancora). Il tempo e' quello vero: ogni
//     tocco normale aspetta 650 ms prima di cadere, quelli del dito che
//     rimbalza arrivano subito, e quanto e' passato davvero si misura nella
//     pagina - se la macchina fosse cosi' lenta da rendere il caso senza
//     senso, la prova lo dice invece di passare;
//   - modulo completo: «0», «abc», «Infinity», «1e400» non entrano (lo zero
//     e l'infinito entravano, e l'infinito manda in fumo ogni totale
//     dell'anno); sopra soglia chiede conferma, e «no» vuol dire no;
//   - la modifica in riga: infinito e zero non entrano nemmeno da li'; ma una
//     vecchia corsa gia' a zero si puo' correggere di metodo senza inventare
//     una cifra, da 20 a 2.350 chiede conferma (e «no» lascia 20), e una corsa
//     da 500 toccata solo nel metodo non fa domande;
//   - il modulo completo in un giorno di riposo: la corsa si rifiuta PRIMA di
//     chiedere «2.350 € per una corsa sola?» - la domanda prima, e il rifiuto
//     dopo il si', era una domanda inutile;
//   - spese: 2.000 € entrano senza domande (un'assicurazione e' normale), lo
//     zero resta permesso (manutenzione in garanzia), «abc» e l'infinito no;
//   - la domanda a 320 px non esce dalla scheda, e si legge di giorno e al buio.
// Orologio e fuso fermi: mercoledi' 11 marzo 2026, mezzogiorno a Torino, con
// un turno 8-20 in corso. Il registro si apre solo a turno vivo (v173).
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

const ORA_FISSA = new Date('2026-03-11T12:00:00+01:00');
const OGGI = '2026-03-11';
const NBSP = ' ';       // formatCurrency mette lo spazio non separabile prima di «€»

// Le misure del contrasto, le stesse di testScuro.
const AIUTI = `
window.__rgb = s => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
  const q = m[1].split(',').map(parseFloat); return { r:q[0], g:q[1], b:q[2], a:q.length>3?q[3]:1 }; };
window.__sopra = (f,d) => ({ r:f.r*f.a+d.r*(1-f.a), g:f.g*f.a+d.g*(1-f.a), b:f.b*f.a+d.b*(1-f.a), a:1 });
window.__luce = c => { const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
window.__contrasto = (a,b) => { const l1=window.__luce(a),l2=window.__luce(b);
  return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
window.__fondoDi = e => { let n = e; const pila = [];
  while (n && n !== document.documentElement) { const c = window.__rgb(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0) { pila.push(c); if (c.a === 1) break; } n = n.parentElement; }
  let giu = window.__rgb(getComputedStyle(document.documentElement).backgroundColor);
  if (!giu || giu.a < 1) giu = window.__rgb(getComputedStyle(document.body).backgroundColor);
  if (!giu || giu.a < 1) giu = { r:255, g:255, b:255, a:1 };
  for (let i = pila.length - 1; i >= 0; i--) giu = window.__sopra(pila[i], giu);
  return giu; };
`;

const b = await chromium.launch();

// Le finestre di dialogo: si registrano tutte, e si risponde come dice la prova.
let risposta = 'accept';
let domande = [];
async function apri(larghezza, tema, altro = {}) {
  const p = await b.newPage({ viewport: { width: larghezza, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await p.clock.setFixedTime(ORA_FISSA);
  p.__errori = [];
  p.on('pageerror', e => p.__errori.push(String(e)));
  p.on('dialog', d => { domande.push(d.message()); return risposta === 'accept' ? d.accept() : d.dismiss(); });
  await p.goto(APP);
  await p.evaluate(({ oggi, tema, altro }) => {
    localStorage.clear();
    localStorage.setItem('taxi_voci_fisse_avviato', 'si');
    localStorage.setItem('taxi_tema', tema);
    localStorage.setItem('taxi_shifts', JSON.stringify([
      { id: 'toggi', data: oggi, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true }
    ].concat(altro.turni || [])));
    if (altro.movimenti) localStorage.setItem('taxi_records', JSON.stringify(altro.movimenti));
  }, { oggi: OGGI, tema, altro });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(AIUTI);
  await p.evaluate(() => { switchTab('giornata'); setVistaGiornata('giornate'); });
  await p.waitForTimeout(250);
  return p;
}

// L'archivio tiene le righe dalla piu' nuova; qui si rimettono in ordine di
// registrazione (l'id cresce a ogni riga, anche con l'orologio fermo), cosi'
// c[n] e' la n-esima corsa salvata dalla prova.
const corse = p => p.evaluate(() => (window.dailyRecords || [])
  .filter(r => r.tipo === 'ENTRATA').slice().sort((x, y) => String(x.id).localeCompare(String(y.id)))
  .map(r => ({ importo: r.importo, metodo: r.metodo })));
const spese = p => p.evaluate(() => (window.dailyRecords || [])
  .filter(r => r.tipo === 'USCITA').slice().sort((x, y) => String(x.id).localeCompare(String(y.id)))
  .map(r => ({ importo: r.importo })));
const avviso = p => p.evaluate(() => {
  const e = document.getElementById('corsa-lampo-avviso');
  if (!e) return { c: false, visibile: false, testo: '' };
  const r = e.getBoundingClientRect();
  return { c: true, visibile: !e.classList.contains('hidden') && r.width > 0 && r.height > 0, testo: e.textContent.trim() };
});
const toast = p => p.evaluate(() => (document.getElementById('toast-text') || {}).textContent || '');
const scrivi = async (p, v) => { await p.fill('#corsa-lampo', v); };
// Il tocco normale: un dito che legge l'avviso e poi conferma, quindi
// almeno 650 ms dopo il tocco prima (la soglia e' 600, misurata in pagina
// con performance.now()).
const tocca = async (p, metodo) => {
  await p.waitForTimeout(650);
  await p.click(`button[onclick="corsaLampo('${metodo}')"]`);
  await p.waitForTimeout(120);
};
// Il dito che rimbalza: il click parte subito, e si torna l'istante in
// pagina (performance.now()) subito dopo.
const toccaSubito = async (p, metodo) => {
  await p.click(`button[onclick="corsaLampo('${metodo}')"]`);
  return p.evaluate(() => performance.now());
};
const domanda = (cifra, metodo) => `${cifra}${NBSP}€ per una corsa sola? Tocca di nuovo ${metodo} per confermare.`;

// ------------------------------------------------------------------
console.log('\n1. IL TASTO VELOCE SOPRA I 300 EURO');
// ------------------------------------------------------------------
let p = await apri(390, 'chiaro');
ok(await p.locator('#corsa-lampo').count() === 1, 'il registro e\' aperto: il campo dell\'incasso c\'e\'');
let a = await avviso(p);
ok(a.c && !a.visibile, 'all\'apertura la riga della domanda esiste ed e\' nascosta', JSON.stringify(a));

await scrivi(p, '2350');
await tocca(p, 'Contanti');
let c = await corse(p);
a = await avviso(p);
ok(c.length === 0, '2350 + Contanti: il primo tocco non salva', JSON.stringify(c));
ok(a.visibile, 'e sotto il campo compare la domanda');
ok(a.testo === domanda('2.350,00', 'Contanti'), 'con le parole giuste', JSON.stringify(a.testo));
ok(await p.inputValue('#corsa-lampo') === '2350', 'la cifra resta nel campo, da confermare o correggere');

await tocca(p, 'Contanti');
c = await corse(p);
a = await avviso(p);
ok(c.length === 1 && c[0].importo === 2350 && c[0].metodo === 'Contanti', 'secondo tocco su Contanti: salvata UNA corsa da 2.350', JSON.stringify(c));
ok(!a.visibile, 'e la domanda se ne va');
// Dalla versione 180 dopo la corsa non c'e' scritta: resta solo «Annulla»,
// che dice a VoiceOver quale corsa annulla.
const etichettaAnnulla = await p.evaluate(() => (document.getElementById('toast-annulla') || {}).getAttribute?.('aria-label') || '');
ok(etichettaAnnulla.includes(`2.350,00${NBSP}€`), 'l\'Annulla dice 2.350,00 €', JSON.stringify(etichettaAnnulla));

// Un altro metodo e' un'altra corsa da confermare: POS dopo Contanti vale
// come primo tocco, non come conferma.
await scrivi(p, '2350');
await tocca(p, 'Contanti');
await tocca(p, 'POS');
c = await corse(p);
a = await avviso(p);
ok(c.length === 1, '2350 + Contanti poi POS: POS non conferma, non salva', JSON.stringify(c));
ok(a.testo === domanda('2.350,00', 'POS'), 'la domanda ora parla di POS', JSON.stringify(a.testo));
await tocca(p, 'POS');
c = await corse(p);
ok(c.length === 2 && c[1].importo === 2350 && c[1].metodo === 'POS', 'POS ritoccato: salvata la corsa POS', JSON.stringify(c));

// Il nome sul tasto «App / Voucher» non e' il metodo «App/Nexi»: la domanda
// deve usare le parole che si leggono sotto il pollice.
await scrivi(p, '450');
await tocca(p, 'App/Nexi');
a = await avviso(p);
ok(a.testo === domanda('450,00', 'App / Voucher'), 'su App / Voucher la domanda usa il nome del tasto', JSON.stringify(a.testo));

// Cambiare la cifra riparte da capo.
await scrivi(p, '2350');
await tocca(p, 'Contanti');
await scrivi(p, '2351');
a = await avviso(p);
ok(!a.visibile, 'scrivendo un\'altra cifra la domanda si spegne');
await tocca(p, 'Contanti');
c = await corse(p);
a = await avviso(p);
ok(c.length === 2, '2351 + Contanti dopo la domanda su 2350: non salva', JSON.stringify(c));
ok(a.testo === domanda('2.351,00', 'Contanti'), 'e chiede di 2.351', JSON.stringify(a.testo));
await tocca(p, 'Contanti');
c = await corse(p);
ok(c.length === 3 && c[2].importo === 2351, 'confermata: 2.351', JSON.stringify(c));

// Il caso furbo: cifra cambiata e poi rimessa uguale. La conferma non deve
// sopravvivere alla correzione.
await scrivi(p, '999');
await tocca(p, 'Contanti');
await scrivi(p, '99');
await scrivi(p, '999');
await tocca(p, 'Contanti');
c = await corse(p);
ok(c.length === 3, '999, corretto e riscritto: il tocco dopo la correzione richiede ancora', JSON.stringify(c));
await tocca(p, 'Contanti');
c = await corse(p);
ok(c.length === 4 && c[3].importo === 999, 'e la conferma vera salva', JSON.stringify(c));

// Sotto e sulla soglia: un tocco, come sempre.
await scrivi(p, '300');
await tocca(p, 'Contanti');
c = await corse(p);
ok(c.length === 5 && c[4].importo === 300, '300 esatti: salvata subito', JSON.stringify(c.slice(4)));
await scrivi(p, '299');
await tocca(p, 'POS');
c = await corse(p);
ok(c.length === 6 && c[5].importo === 299, '299: salvata subito', JSON.stringify(c.slice(5)));
await scrivi(p, '300,01');
await tocca(p, 'Contanti');
c = await corse(p);
ok(c.length === 6, '300,01: sopra soglia di un centesimo, chiede', JSON.stringify(c.slice(6)));
await scrivi(p, '23,50');
await tocca(p, 'Contanti');
c = await corse(p);
ok(c.length === 7 && c[6].importo === 23.5, 'la cifra giusta, 23,50: salvata al primo tocco', JSON.stringify(c.slice(6)));
ok(domande.length === 0, 'il tasto veloce non apre nessuna finestra di dialogo', JSON.stringify(domande));

// Il doppio tocco nervoso: il secondo click arriva a pochi millisecondi dal
// primo. Non e' una risposta all'avviso, e' lo stesso dito.
await scrivi(p, '2350');
const T = await toccaSubito(p, 'Contanti');    // accende l'avviso: istante T
const t1 = await toccaSubito(p, 'Contanti');   // subito dopo
c = await corse(p);
a = await avviso(p);
ok(t1 - T < 300, `il secondo tocco e' arrivato davvero di corsa (${Math.round(t1 - T)} ms dopo il primo)`);
ok(c.length === 7, 'doppio tocco: il secondo non salva', JSON.stringify(c.slice(7)));
ok(a.visibile && a.testo === domanda('2.350,00', 'Contanti'), '  e l\'avviso resta li\', con le stesse parole', JSON.stringify(a));
ok(await p.inputValue('#corsa-lampo') === '2350', '  e la cifra resta nel campo');
// Un terzo tocco a meta' strada (300 ms dal primo): ancora troppo presto.
await p.waitForFunction(t => performance.now() >= t + 300, T, { polling: 10 });
const t2 = await toccaSubito(p, 'Contanti');
c = await corse(p);
a = await avviso(p);
ok(t2 - T < 600, `terzo tocco a ${Math.round(t2 - T)} ms dal primo: ancora sotto i 600`);
ok(c.length === 7, '  non salva', JSON.stringify(c.slice(7)));
ok(a.visibile, '  e l\'avviso resta visibile');
// Il tocco calmo: 650 ms dopo il PRIMO, ma meno di 600 dall'ultimo
// rimbalzo. Se i rimbalzi avessero fatto ripartire il conto, non salverebbe.
await p.waitForFunction(t => performance.now() >= t + 650, T, { polling: 10 });
const t3 = await toccaSubito(p, 'Contanti');
c = await corse(p);
a = await avviso(p);
ok(t3 - t2 < 600, `il tocco calmo cade ${Math.round(t3 - T)} ms dopo il primo e ${Math.round(t3 - t2)} dall'ultimo rimbalzo: il caso dice qualcosa`);
ok(c.length === 8 && c[7].importo === 2350 && c[7].metodo === 'Contanti',
   'il tocco calmo salva UNA corsa: i rimbalzi non hanno fatto ripartire il conto', JSON.stringify(c.slice(7)));
ok(!a.visibile, '  e l\'avviso se ne va');
await p.waitForTimeout(120);
await toccaSubito(p, 'Contanti');
await p.waitForTimeout(120);
c = await corse(p);
ok(c.length === 8, 'un tocco subito dopo, a campo vuoto, non salva una seconda corsa', JSON.stringify(c.slice(7)));

// Il totale della giornata a video segue le corse vere.
const totale = await p.evaluate(() => (window.dailyRecords || []).filter(r => r.tipo === 'ENTRATA').reduce((t, r) => t + r.importo, 0));
ok(Math.abs(totale - (2350 + 2350 + 2351 + 999 + 300 + 299 + 23.5 + 2350)) < 0.001, 'nell\'archivio solo le corse confermate', String(totale));
ok(p.__errori.length === 0, 'nessun errore JS', p.__errori.join(' | '));
await p.close();

// ------------------------------------------------------------------
console.log('\n2. IL MODULO COMPLETO DELLA CORSA');
// ------------------------------------------------------------------
p = await apri(390, 'chiaro');
const apriModulo = async () => {
  await p.evaluate(() => { window.showCorsaForm = true; renderContent(); });
  await p.waitForTimeout(150);
};
const salvaCorsa = async (v) => {
  await apriModulo();
  await p.fill('#corsa-imp', v);
  await p.click('form[onsubmit*="addCorsa"] button[value="chiudi"]');
  await p.waitForTimeout(150);
};
for (const v of ['0', 'abc', 'Infinity', '1e400']) {
  domande = [];
  await salvaCorsa(v);
  c = await corse(p);
  ok(c.length === 0, `«${v}»: non entra`, JSON.stringify(c));
  ok(domande.length === 0, `«${v}»: e non chiede conferme`, JSON.stringify(domande));
}
await salvaCorsa('abc');
ok(/in cifre/.test(await toast(p)), '«abc» dice cosa scrivere', JSON.stringify(await toast(p)));
await salvaCorsa('0');
ok(/zero/.test(await toast(p)), '«0» dice che una corsa non vale zero', JSON.stringify(await toast(p)));

domande = []; risposta = 'dismiss';
await salvaCorsa('2350');
c = await corse(p);
ok(domande.length === 1 && domande[0] === `2.350,00${NBSP}€ per una corsa sola? Confermi l'importo?`, '2350: chiede conferma con la cifra', JSON.stringify(domande));
ok(c.length === 0, 'rispondendo no: non salva', JSON.stringify(c));
domande = []; risposta = 'accept';
await p.click('form[onsubmit*="addCorsa"] button[value="chiudi"]');
await p.waitForTimeout(150);
c = await corse(p);
ok(domande.length === 1, 'riprovando chiede di nuovo', JSON.stringify(domande));
ok(c.length === 1 && c[0].importo === 2350, 'rispondendo si\': salvata la corsa da 2.350', JSON.stringify(c));
domande = [];
await salvaCorsa('300');
c = await corse(p);
ok(domande.length === 0 && c.length === 2 && c[1].importo === 300, '300 dal modulo: niente domande, salvata', JSON.stringify({ domande, c }));

// La modifica in riga: l'infinito e lo zero non entrano neanche da li'.
const idCorsa = await p.evaluate(() => (window.dailyRecords || []).find(r => r.tipo === 'ENTRATA' && r.importo === 300).id);
for (const v of ['Infinity', '1e400', '0']) {
  await p.evaluate(id => { apriModificaRecord(id); renderContent(); }, idCorsa);
  await p.waitForTimeout(150);
  await p.evaluate(({ id, v }) => {
    const campo = document.getElementById('mv-imp-' + id);
    if (campo) campo.value = v;
    salvaModificaRecord(id);
  }, { id: idCorsa, v });
  await p.waitForTimeout(150);
  const imp = await p.evaluate(id => (window.dailyRecords || []).find(r => r.id === id).importo, idCorsa);
  ok(imp === 300, `modifica della corsa a «${v}»: resta 300`, String(imp));
}
ok(p.__errori.length === 0, 'nessun errore JS', p.__errori.join(' | '));
await p.close();

// ------------------------------------------------------------------
console.log('\n2b. LA MODIFICA DI UNA CORSA GIA\' REGISTRATA');
// ------------------------------------------------------------------
// Tre corse di oggi: una a zero (registrata prima che lo zero si
// rifiutasse), una da 20, una da 500 gia' confermata.
const vecchia = (id, importo, metodo) => ({ id, data: OGGI, tipo: 'ENTRATA', categoria: 'Corsa', metodo, importo, ora: '09:00' });
p = await apri(390, 'chiaro', { movimenti: [vecchia('czero', 0, 'Contanti'), vecchia('cventi', 20, 'POS'), vecchia('ccinquecento', 500, 'Contanti')] });
const riga = id => p.evaluate(id => { const r = (window.dailyRecords || []).find(x => x.id === id); return r && { importo: r.importo, metodo: r.metodo }; }, id);
// La modifica si apre e si salva dai suoi campi e dal suo tasto «Salva».
const modifica = async (id, { metodo, importo }) => {
  await p.evaluate(id => { window.editRecordId = null; apriModificaRecord(id); }, id);
  await p.waitForTimeout(150);
  if (metodo) await p.selectOption('#mv-met-' + id, metodo);
  if (importo !== undefined) await p.fill('#mv-imp-' + id, importo);
  await p.locator(`button[onclick="salvaModificaRecord('${id}')"]`).first().click();
  await p.waitForTimeout(200);
};
domande = []; risposta = 'accept';
await modifica('czero', { metodo: 'POS' });
let rr = await riga('czero');
ok(rr.metodo === 'POS' && rr.importo === 0, 'corsa gia\' a zero cambiata solo di metodo: si salva (POS, sempre 0)', JSON.stringify(rr));
ok(domande.length === 0, '  senza domande', JSON.stringify(domande));
await p.evaluate(() => { window.editRecordId = null; renderContent(); });

await modifica('cventi', { importo: '0' });
rr = await riga('cventi');
ok(rr.importo === 20, 'da 20 a 0: rifiutata, resta 20', JSON.stringify(rr));
ok(/zero/.test(await toast(p)), '  e dice che una corsa non vale zero', JSON.stringify(await toast(p)));
await p.evaluate(() => { window.editRecordId = null; renderContent(); });

domande = []; risposta = 'dismiss';
await modifica('cventi', { importo: '2350' });
rr = await riga('cventi');
ok(domande.length === 1 && domande[0] === `2.350,00${NBSP}€ per una corsa sola? Confermi l'importo?`, 'da 20 a 2350: chiede conferma con la cifra', JSON.stringify(domande));
ok(rr.importo === 20, '  rispondendo no resta 20', JSON.stringify(rr));
domande = []; risposta = 'accept';
// Dicendo no la modifica resta aperta, con 2350 scritto: si riprova dal
// suo «Salva». (Se si fosse chiusa, l'importo era gia' passato senza domande.)
const ancoraAperta = p.locator(`button[onclick="salvaModificaRecord('cventi')"]`);
ok(await ancoraAperta.count() > 0, '  e la modifica resta aperta, per correggere o confermare');
if (await ancoraAperta.count()) await ancoraAperta.first().click();
else await modifica('cventi', { importo: '2350' });
await p.waitForTimeout(200);
rr = await riga('cventi');
ok(domande.length === 1, '  riprovando chiede di nuovo', JSON.stringify(domande));
ok(rr.importo === 2350, '  rispondendo si\' diventa 2350', JSON.stringify(rr));

domande = [];
await modifica('ccinquecento', { metodo: 'Satispay' });
rr = await riga('ccinquecento');
ok(domande.length === 0, 'corsa da 500 cambiata solo di metodo: nessuna domanda', JSON.stringify(domande));
ok(rr.importo === 500 && rr.metodo === 'Satispay', '  e si salva (500, Satispay)', JSON.stringify(rr));
ok(p.__errori.length === 0, 'nessun errore JS', p.__errori.join(' | '));
await p.close();

// ------------------------------------------------------------------
console.log('\n2c. IL MODULO COMPLETO IN UN GIORNO DI RIPOSO');
// ------------------------------------------------------------------
// Il modulo si apre oggi (turno vivo) e la data si cambia a ieri, segnato
// come riposo: la corsa non si puo' salvare, quindi non si chiede niente.
p = await apri(390, 'chiaro', { turni: [{ id: 'tieri', data: '2026-03-10', turno: 'Riposo', inizio: '', fine: '', ore: 0, lavorato: false }] });
await p.evaluate(() => { window.showCorsaForm = true; renderContent(); });
await p.waitForTimeout(150);
domande = []; risposta = 'accept';
await p.fill('#corsa-data', '2026-03-10');
await p.fill('#corsa-imp', '2350');
await p.click('form[onsubmit*="addCorsa"] button[value="chiudi"]');
await p.waitForTimeout(200);
c = await corse(p);
ok(domande.length === 0, '2350 in un giorno di riposo: nessuna domanda', JSON.stringify(domande));
ok(c.length === 0, '  e nessuna corsa salvata', JSON.stringify(c));
ok(/segnato come Riposo/.test(await toast(p)), '  e dice perche\'', JSON.stringify(await toast(p)));
ok(p.__errori.length === 0, 'nessun errore JS', p.__errori.join(' | '));
await p.close();

// ------------------------------------------------------------------
console.log('\n3. LE SPESE NON C\'ENTRANO');
// ------------------------------------------------------------------
p = await apri(390, 'chiaro');
const salvaSpesa = async (v) => {
  await p.evaluate(() => { switchTab('uscite'); window.showUscitaForm = true; renderContent(); });
  await p.waitForTimeout(200);
  await p.fill('#uscita-imp', v);
  await p.evaluate(() => {
    const sel = document.getElementById('uscita-cat-select');
    const opt = Array.from(sel.options).find(o => /carburante/i.test(o.text));
    sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.click('form[onsubmit*="addUscita"] button[value="chiudi"]');
  await p.waitForTimeout(200);
};
domande = [];
await salvaSpesa('2000');
let s = await spese(p);
ok(s.length === 1 && s[0].importo === 2000, 'spesa da 2.000 €: salvata', JSON.stringify(s));
ok(domande.length === 0, 'senza domande', JSON.stringify(domande));
await salvaSpesa('0');
s = await spese(p);
ok(s.length === 2 && s[1].importo === 0, 'spesa da 0 €: ancora permessa (manutenzione in garanzia)', JSON.stringify(s));
for (const v of ['abc', 'Infinity', '1e400']) {
  await salvaSpesa(v);
  s = await spese(p);
  ok(s.length === 2, `spesa «${v}»: non entra`, JSON.stringify(s));
}
ok(p.__errori.length === 0, 'nessun errore JS', p.__errori.join(' | '));
await p.close();

// ------------------------------------------------------------------
console.log('\n4. LA DOMANDA STA NELLA SCHEDA E SI LEGGE');
// ------------------------------------------------------------------
for (const [larghezza, tema] of [[320, 'chiaro'], [320, 'scuro'], [390, 'scuro'], [768, 'chiaro'], [1280, 'scuro']]) {
  p = await apri(larghezza, tema);
  // la cifra piu' larga che si possa scrivere davvero
  await scrivi(p, '99999,99');
  await tocca(p, 'App/Nexi');
  const m = await p.evaluate(() => {
    const e = document.getElementById('corsa-lampo-avviso');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const scheda = e.parentElement.getBoundingClientRect();
    const s = getComputedStyle(e);
    const fondo = window.__fondoDi(e);
    const testo = window.__sopra(window.__rgb(s.color), fondo);
    return {
      visibile: !e.classList.contains('hidden') && r.width > 0,
      dentroSchermo: r.left >= 0 && r.right <= window.innerWidth + 0.5,
      dentroScheda: r.left >= scheda.left - 0.5 && r.right <= scheda.right + 0.5,
      sborda: e.scrollWidth > e.clientWidth + 1,
      pagina: document.documentElement.scrollWidth <= window.innerWidth,
      corpo: parseFloat(s.fontSize),
      contrasto: window.__contrasto(testo, fondo),
      tema: document.documentElement.getAttribute('data-tema')
    };
  });
  const dove = `${larghezza}px ${tema}`;
  ok(!!m && m.visibile, `${dove}: la domanda compare`);
  ok(!!m && m.tema === tema, `${dove}: il tema e' davvero quello`, m && m.tema);
  if (m) {
    ok(m.dentroSchermo && m.dentroScheda, `${dove}: sta dentro lo schermo e dentro la scheda`);
    ok(!m.sborda, `${dove}: il testo va a capo invece di sbordare`);
    ok(m.pagina, `${dove}: la pagina non scorre di lato`);
    ok(m.corpo >= 14, `${dove}: corpo ${m.corpo}px`);
    ok(m.contrasto >= 4.5, `${dove}: si legge`, m.contrasto.toFixed(2) + ':1');
  }
  ok(p.__errori.length === 0, `${dove}: nessun errore JS`, p.__errori.join(' | '));
  await p.close();
}

await b.close();
console.log(guai ? `\n${guai} cose da sistemare` : '\nTutto in ordine');
process.exit(guai ? 1 : 0);
