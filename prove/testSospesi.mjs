// IL REGISTRO DELLE MODIFICHE IN ATTESA DEL CLOUD - la logica pura
// Firestore tiene le scritture fatte senza campo solo nella memoria della
// pagina: se iOS chiude l'app prima che torni la rete se ne vanno, e alla
// riapertura l'elenco del server (che quella corsa non l'ha mai vista)
// prendeva il posto dell'archivio del telefono. Fino alla v175 la corsa
// spariva. Dalla v176 ogni modifica lascia un segno in 'taxi_in_sospeso' e
// il segno si toglie solo quando il server ha confermato.
//
// Qui si provano a mano, senza Cloud, le funzioni su cui poggia tutto:
//  - leggiSospesi / contaSospesi: un registro storto o rotto non rompe niente;
//  - segnaSospeso / segnaSospesi: senza un account non si segna niente, e
//    scritta poi cancellata = solo 'd' (se restasse 's' la corsa cancellata
//    risorgerebbe sul Mac);
//  - togliSospesi: il numero protegge una modifica fatta mentre la
//    precedente era in viaggio (se no la conferma della vecchia cancellerebbe
//    il segno della nuova, e la nuova non partirebbe mai);
//  - unisciConSospesi / unisciCampiSospesi: l'elenco del Cloud piu' quello
//    in attesa, con 's' e 'd';
//  - segnaCampiCambiati: del profilo si segnano solo i campi cambiati;
//  - decidiAccount: in tutti i casi;
//  - testoSospesi: la riga della scheda Cloud.
// Sulla v175 queste funzioni non esistono: la prova si ferma e lo dice.
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
  else { ko.push(nome); console.log('  *** ' + nome + (dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio) : '')); }
};

const b = await chromium.launch();
// Fuso fermo: la data «dal 28/10» si legge in ora locale.
const p = await b.newPage({ locale: 'it-IT', timezoneId: 'Europe/Rome' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
// Firebase non si carica: le prove non toccano il Cloud vero.
await p.route('**/gstatic.com/**', r => r.abort());
await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });

const NOMI = ['leggiSospesi', 'segnaSospeso', 'segnaSospesi', 'togliSospesi', 'contaSospesi',
  'unisciConSospesi', 'unisciCampiSospesi', 'decidiAccount', 'segnaCampiCambiati', 'testoSospesi', 'adottaAccount'];
const mancano = await p.evaluate((n) => n.filter(f => typeof window[f] !== 'function'), NOMI);
if (mancano.length) {
  console.log('*** il registro delle modifiche in attesa non c\'e\': mancano ' + mancano.join(', '));
  console.log('*** (e\' la v175 o prima: una corsa battuta senza campo puo\' sparire)');
  await b.close(); process.exit(1);
}

const r = await p.evaluate(() => {
  const o = {};
  const azzera = (uid) => localStorage.setItem('taxi_in_sospeso', JSON.stringify({ v: 1, uid: uid || null, n: 0, dal: null, per: {} }));
  localStorage.removeItem('taxi_in_sospeso');
  o.vuoto = leggiSospesi();
  o.contaVuoto = contaSospesi();

  // senza account non si segna niente, e non si scrive nemmeno il registro
  o.senzaUidRende = segnaSospeso('taxi_records', 'a', 's');
  o.senzaUidDisco = localStorage.getItem('taxi_in_sospeso');

  // con l'account: scritta, poi cancellata = solo 'd'
  adottaAccount('u1');
  o.adottato = leggiSospesi().uid;
  segnaSospeso('taxi_records', 'a', 's');
  segnaSospeso('taxi_records', 'b', 's');
  segnaSospeso('taxi_records', 'b', 'd');
  segnaSospeso('taxi_records', 'c', 's');
  o.reg = leggiSospesi();
  o.conta = contaSospesi();
  // id vuoti o nulli non si segnano
  segnaSospesi('taxi_records', ['', null, undefined], 's');
  o.contaDopoVuoti = contaSospesi();

  // il numero protegge la modifica in viaggio
  const spedita = leggiSospesi().per.taxi_records.a;          // parte con questo valore
  segnaSospeso('taxi_records', 'a', 's');                       // intanto la si cambia di nuovo
  const nuova = leggiSospesi().per.taxi_records.a;
  togliSospesi([['taxi_records', 'a', spedita]]);              // arriva la conferma della vecchia
  o.spedita = spedita; o.nuova = nuova;
  o.dopoConfermaVecchia = leggiSospesi().per.taxi_records.a;
  togliSospesi([['taxi_records', 'a', nuova]]);                // arriva la conferma della nuova
  o.dopoConfermaNuova = leggiSospesi().per.taxi_records.a;
  o.dalResta = leggiSospesi().dal;
  togliSospesi([['taxi_records', 'b', leggiSospesi().per.taxi_records.b], ['taxi_records', 'c', leggiSospesi().per.taxi_records.c]]);
  o.dopoTutto = leggiSospesi();

  // l'unione: 's' prende la versione del telefono, 'd' toglie, il resto passa
  azzera('u1');
  segnaSospeso('taxi_records', 'a', 's');     // cambiata qui
  segnaSospeso('taxi_records', 'b', 'd');     // cancellata qui
  segnaSospeso('taxi_records', 'n', 's');     // nuova qui, il Cloud non l'ha
  segnaSospeso('taxi_records', 'g', 's');     // segnata ma qui non c'e' piu'
  const cloudR = [{ id: 'a', importo: 9 }, { id: 'b', importo: 2 }, { id: 'x', importo: 5 }];
  const qui = [{ id: 'a', importo: 1 }, { id: 'n', importo: 3 }];
  o.unione = unisciConSospesi('taxi_records', 'id', cloudR, qui).map(x => x.id + ':' + x.importo).join(',');
  o.altroArchivio = unisciConSospesi('taxi_shifts', 'id', [{ id: 'q' }], []);
  o.altroArchivioStesso = o.altroArchivio && o.altroArchivio.length === 1 && o.altroArchivio[0].id === 'q';
  // voci di budget: l'identificativo e' lo slug
  segnaSospeso('taxi_voci_fisse', 'radio', 's'); segnaSospeso('taxi_voci_fisse', 'bollo', 'd');
  o.unioneSlug = unisciConSospesi('taxi_voci_fisse', 'slug', [{ slug: 'radio', v: 1 }, { slug: 'bollo' }, { slug: 'rca' }], [{ slug: 'radio', v: 2 }])
    .map(x => x.slug + (x.v ? ':' + x.v : '')).join(',');
  // la voce 's' che in memoria non c'e' si prende dal disco
  localStorage.setItem('taxi_note', JSON.stringify([{ id: 'nd', testo: 'dal disco' }]));
  segnaSospeso('taxi_note', 'nd', 's');
  o.unioneDisco = unisciConSospesi('taxi_note', 'id', [{ id: 'nd', testo: 'dal cloud' }], []).map(x => x.testo).join(',');

  // i campi del profilo
  azzera('u1');
  segnaCampiCambiati('profilo', { nome: 'A', sigla: 'x', piva: '1' }, { nome: 'B', sigla: 'x', piva: '1', logo: '' });
  o.campi = Object.keys(leggiSospesi().per.profilo || {}).sort().join(',');
  azzera('u1');
  segnaCampiCambiati('fiscali', null, { a: 1, b: 2, c: undefined });
  o.campiDaNull = Object.keys(leggiSospesi().per.fiscali || {}).sort().join(',');
  azzera('u1');
  segnaCampiCambiati('profilo', { nome: 'A' }, { nome: 'A' });
  o.campiUguali = contaSospesi();
  azzera('u1');
  segnaCampiCambiati('profilo', { nome: 'A', sigla: 'x' }, { nome: 'B', sigla: 'y' });
  o.unCampi = unisciCampiSospesi('profilo', { nome: 'Server', sigla: 'S', cognome: 'C' }, { nome: 'B', sigla: undefined });
  o.unCampiSenza = unisciCampiSospesi('fiscali', { a: 1 }, { a: 2 });

  // decidiAccount: (uid nuovo, accesso appena fatto, ci sono dati)
  azzera('u1');
  o.dec = {
    stessoRipreso: decidiAccount('u1', false, true),
    stessoAppenaFatto: decidiAccount('u1', true, true),
    altroConDati: decidiAccount('u2', true, true),
    altroRipresoConDati: decidiAccount('u2', false, true),
    altroSenzaDati: decidiAccount('u2', true, false)
  };
  localStorage.removeItem('taxi_in_sospeso');
  o.dec.v175Ripreso = decidiAccount('u1', false, true);
  o.dec.v175RipresoVuoto = decidiAccount('u1', false, false);
  o.dec.maiSenzaDati = decidiAccount('u1', true, false);

  // la riga della scheda Cloud
  localStorage.removeItem('taxi_in_sospeso');
  o.testoMai = testoSospesi(true);
  azzera('u1');
  o.testoZero = testoSospesi(true);
  localStorage.setItem('taxi_in_sospeso', JSON.stringify({ v: 1, uid: 'u1', n: 1, dal: '2026-10-28T10:00:00.000Z', per: { taxi_records: { a: 's1' } } }));
  o.testoUno = testoSospesi(true);
  o.testoUnoFuori = testoSospesi(false);
  localStorage.setItem('taxi_in_sospeso', JSON.stringify({ v: 1, uid: 'u1', n: 3, dal: '2026-10-28T10:00:00.000Z', per: { taxi_records: { a: 's1', b: 'd2' }, profilo: { sigla: 's3' } } }));
  o.testoTre = testoSospesi(true);
  o.testoTreFuori = testoSospesi(false);
  const tante = {}; for (let i = 0; i < 5001; i++) tante['q' + i] = 'd' + (i + 1);
  localStorage.setItem('taxi_in_sospeso', JSON.stringify({ v: 1, uid: 'u1', n: 5001, dal: '2026-10-28T10:00:00.000Z', per: { taxi_records: tante } }));
  o.testoTante = testoSospesi(true);
  localStorage.setItem('taxi_in_sospeso', JSON.stringify({ v: 1, uid: 'u1', n: 2, dal: 'non e\' una data', per: { taxi_records: { a: 's1' } } }));
  o.testoDataStorta = testoSospesi(true);

  // registro storto o rotto
  localStorage.setItem('taxi_in_sospeso', '{"per":{"taxi_records":{"a":"zz","b":"d3","c":5,"../x":"s4","__y__":"s5"},"profilo":{"sigla":"s6","a/b":"s7"},"taxi_altro":{"q":"s8"}},"uid":"u1","n":-3}');
  o.storto = leggiSospesi();
  // senza un account le voci non sono di nessuno: il registro si scarta intero (v176, e7f1654)
  localStorage.setItem('taxi_in_sospeso', '{"per":{"taxi_records":{"b":"d3"}},"uid":5,"n":4}');
  o.senzaAccount = leggiSospesi();
  localStorage.setItem('taxi_in_sospeso', 'non json');
  o.rotto = contaSospesi();
  o.rottoUid = leggiSospesi().uid;
  localStorage.setItem('taxi_in_sospeso', '[1,2]');
  o.lista = contaSospesi();
  localStorage.removeItem('taxi_in_sospeso');
  return o;
});

console.log('--- il registro vuoto e senza account ---');
c('registro assente = vuoto', JSON.stringify(r.vuoto) === '{"v":1,"uid":null,"n":0,"dal":null,"per":{}}', r.vuoto);
c('e conta zero', r.contaVuoto === 0, r.contaVuoto);
c('mai entrato: non si segna niente (e non si scrive nemmeno il registro)', r.senzaUidRende === true && r.senzaUidDisco === null, r.senzaUidDisco);
c('adottaAccount ricorda l\'account', r.adottato === 'u1', r.adottato);

console.log('--- segnare ---');
c('scritta poi cancellata = solo \'d\'', /^d\d+$/.test(r.reg.per.taxi_records.b), r.reg.per.taxi_records.b);
c('le altre restano \'s\'', /^s\d+$/.test(r.reg.per.taxi_records.a) && /^s\d+$/.test(r.reg.per.taxi_records.c), r.reg.per.taxi_records);
c('una voce per identificativo: 3 in attesa, non 4', r.conta === 3, r.conta);
c('il numero cresce a ogni segno (4 segni = n 4)', r.reg.n === 4, r.reg.n);
c('«dal» si scrive alla prima voce', typeof r.reg.dal === 'string' && !isNaN(Date.parse(r.reg.dal)), r.reg.dal);
c('identificativi vuoti o nulli non si segnano', r.contaDopoVuoti === 3, r.contaDopoVuoti);

console.log('--- il numero protegge la modifica in viaggio ---');
c('rifatta mentre viaggia: il valore cambia', r.spedita !== r.nuova && r.nuova[0] === 's', [r.spedita, r.nuova]);
c('la conferma della vecchia NON toglie il segno della nuova', r.dopoConfermaVecchia === r.nuova, r.dopoConfermaVecchia);
c('la conferma della nuova lo toglie', r.dopoConfermaNuova === undefined, r.dopoConfermaNuova);
c('finche\' resta qualcosa «dal» non si azzera', r.dalResta !== null, r.dalResta);
c('tolto tutto: archivio sparito e «dal» azzerato', Object.keys(r.dopoTutto.per).length === 0 && r.dopoTutto.dal === null, r.dopoTutto);

console.log('--- l\'unione con l\'elenco del Cloud ---');
c('\'s\' vince sul Cloud, \'d\' toglie, la nuova entra, la fantasma no', r.unione === 'x:5,a:1,n:3', r.unione);
c('un archivio senza voci passa com\'era', r.altroArchivioStesso, r.altroArchivio);
c('le voci di budget si uniscono per slug', r.unioneSlug === 'rca,radio:2', r.unioneSlug);
c('la voce che in memoria non c\'e\' si prende dal disco', r.unioneDisco === 'dal disco', r.unioneDisco);

console.log('--- i campi del profilo e delle impostazioni ---');
c('si segnano solo i campi cambiati (e quello nuovo)', r.campi === 'logo,nome', r.campi);
c('prima = null: tutti i campi che hanno un valore', r.campiDaNull === 'a,b', r.campiDaNull);
c('niente di cambiato: niente segnato', r.campiUguali === 0, r.campiUguali);
c('unione dei campi: il cambiato qui sopra quello del Cloud, il resto dal Cloud',
  JSON.stringify(r.unCampi) === '{"nome":"B","sigla":"S","cognome":"C"}', r.unCampi);
c('senza voci in attesa il documento del Cloud passa com\'e\'', JSON.stringify(r.unCampiSenza) === '{"a":1}', r.unCampiSenza);

console.log('--- decidiAccount ---');
const d = r.dec;
c('stesso account, sessione ripresa: procedi', d.stessoRipreso === 'procedi', d);
c('stesso account, accesso appena fatto: procedi', d.stessoAppenaFatto === 'procedi', d);
c('altro account con dati qui: chiedi', d.altroConDati === 'chiedi', d);
c('altro account in sessione ripresa con dati: chiedi', d.altroRipresoConDati === 'chiedi', d);
c('altro account senza dati qui: adotta', d.altroSenzaDati === 'adotta', d);
c('telefono dalla v175 (nessun registro, sessione ripresa): adotta senza chiedere', d.v175Ripreso === 'adotta' && d.v175RipresoVuoto === 'adotta', d);
// Mai entrato, primo accesso CON dati: oggi 'chiedi', ma la revisione (B3)
// lo fa diventare 'adotta' come nella v175. Non si fissa qui finche' non e'
// deciso: il controllo si aggiunge con la correzione.
c('mai entrato, primo accesso senza dati: adotta', d.maiSenzaDati === 'adotta', d);

console.log('--- la riga della scheda Cloud ---');
c('mai entrato: niente riga', r.testoMai === '', r.testoMai);
c('zero in attesa: niente riga', r.testoZero === '', r.testoZero);
c('una: «1 modifica in attesa di invio al Cloud (dal 28/10)»', r.testoUno === '1 modifica in attesa di invio al Cloud (dal 28/10)', r.testoUno);
c('una, da fuori: «... partirà quando rientri»', r.testoUnoFuori === '1 modifica in attesa di invio al Cloud (dal 28/10): partirà quando rientri', r.testoUnoFuori);
c('tre (profilo compreso): plurale', r.testoTre === '3 modifiche in attesa di invio al Cloud (dal 28/10)', r.testoTre);
c('tre, da fuori: «partiranno»', r.testoTreFuori === '3 modifiche in attesa di invio al Cloud (dal 28/10): partiranno quando rientri', r.testoTreFuori);
c('oltre 5000: si chiede una rete, non si scarta niente', r.testoTante === '5001 modifiche in attesa di invio al Cloud (dal 28/10) · molte modifiche in attesa: collegati a una rete', r.testoTante);
c('data storta: la riga senza data, niente «NaN»', r.testoDataStorta === '1 modifica in attesa di invio al Cloud', r.testoDataStorta);

console.log('--- registro storto o rotto ---');
c('valori storti, identificativi con / o .. o fra __, archivi sconosciuti: scartati; n negativo = 0',
  JSON.stringify(r.storto) === '{"v":1,"uid":"u1","n":0,"dal":null,"per":{"taxi_records":{"b":"d3"},"profilo":{"sigla":"s6"}}}', r.storto);
c('uid che non e\' una stringa: nessun account, e le voci non partono verso nessuno',
  JSON.stringify(r.senzaAccount) === '{"v":1,"uid":null,"n":4,"dal":null,"per":{}}', r.senzaAccount);
c('registro non JSON: zero, nessun account', r.rotto === 0 && r.rottoUid === null, [r.rotto, r.rottoUid]);
c('registro che e\' una lista: zero', r.lista === 0, r.lista);

console.log(`\n${ok} controlli passati` + (ko.length ? `  *** ${ko.length} FALLITI: ${ko.join(' | ')} ***` : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') : 'nessuno'));
await b.close();
