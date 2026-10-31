// ============================================================
//  FIREBASE FINTO - firebase-firestore.js
//  Non tocca MAI il Cloud vero: non apre connessioni, non conosce il
//  progetto. Le prove (testOffline.mjs, testAccount.mjs, testSpedizione.mjs)
//  lo servono al posto dei tre file di gstatic.com intercettando la rete
//  di Playwright:
//
//    for (const [n, f] of [['firebase-app.js','app.js'], ['firebase-auth.js','auth.js'],
//                          ['firebase-firestore.js','firestore.js']])
//      await ctx.route('**/firebasejs/11.6.1/' + n, r => r.fulfill({
//        contentType: 'application/javascript', body: readFileSync('prove/_finto/' + f, 'utf8') }));
//
//  Il "server" sta in localStorage['__cloud']: un oggetto percorso -> dati
//  ('artifacts/taximanager-2026/users/u1/taxi_records/r1': {...}). La prova
//  lo semina e lo rilegge: e' il Mac dall'altra parte.
//
//  Le leve:
//   - senza campo: window.__offline = true (vale finche' la pagina vive) o
//     localStorage.__offline = '1' (vale anche dopo una riapertura). Le
//     scritture restano in coda IN MEMORIA, come fa Firestore: se la pagina
//     si chiude si perdono. Gli elenchi arrivano vuoti con fromCache:true.
//   - window.__tornaRete(): torna il campo, la coda parte, gli ascolti
//     ricevono l'elenco vero e si lancia l'evento 'online'.
//   - window.__inCoda(): quante scritture aspettano.
//   - localStorage.__rifiuta = '1': il server rifiuta tutto (permission-denied).
//   - localStorage.__passano = N: passano le prime N scritture (un batch
//     conta uno), le altre restano appese per sempre: l'app chiusa a meta'.
//     Con localStorage.__passanoSu = 'taxi_records' il conto vale solo per
//     le scritture che toccano quel percorso.
//   - window.__scritture: [tipo, percorso, 'merge' o ''] di ogni scrittura
//     arrivata sul "server".
//   - localStorage.__rifiutaId = 'b2': il server rifiuta (invalid-argument)
//     ogni scrittura, singola o blocco, che tocca un documento con
//     quell'identificativo; le altre passano. E' la riga «colpevole».
//   - window.__tentativi: quante scritture (un batch conta uno) hanno
//     bussato al server, rifiutate da __rifiuta comprese; non contano
//     quelle fermate prima per l'identificativo.
//   - localStorage.__cacheVera = '1': senza campo l'elenco dalla copia in
//     memoria non arriva vuoto ma con le scritture di QUESTA pagina non
//     ancora partite (fromCache:true, hasPendingWrites:true), e ogni
//     scrittura fa ripartire gli ascolti: e' quello che fa il Firestore vero
//     con la cache in memoria.
//   - localStorage.__codiceId = 'b2:internal,x1:invalid-argument': ogni
//     scrittura che tocca quel documento si rifiuta, poco dopo, con quel
//     codice (per provare i codici uno per uno).
//   - window.__blocchi: [quante righe, quante scritture in volo, l'ultimo
//     pezzo del percorso della prima] di ogni scrittura che bussa;
//     window.__maxVolo e window.__maxSingoli: il massimo di scritture in
//     volo insieme, tutte e quelle da una riga sola di taxi_records;
//     window.__nBatch: quanti writeBatch l'app ha costruito.
//  Come il vero, e senza leve:
//   - doc() con un numero dispari di pezzi nel percorso (un id con una «/»)
//     si rompe subito con un'eccezione, e cosi' set/delete di un batch;
//   - batch.set con una lista dentro una lista si rompe subito
//     (invalid-argument: «Nested arrays are not supported»), setDoc la
//     rifiuta;
//   - un identificativo «__qualcosa__», «.» o «..» fa rifiutare dal server
//     tutto il blocco (invalid-argument).
//  setDoc e batch.set con { merge: true } uniscono i campi come il vero.
// ============================================================
const leggi = () => JSON.parse(localStorage.getItem('__cloud') || '{}');
const scrivi = (o) => localStorage.setItem('__cloud', JSON.stringify(o));
const offline = () => window.__offline || localStorage.getItem('__offline') === '1';
const ascolti = []; const coda = []; const pendenti = [];
window.__scritture = [];
export function getFirestore() { return {}; }
export function collection(db, ...s) { return { path: s.join('/'), tipo: 'col' }; }
// Come il vero: un riferimento a un documento ha un numero pari di pezzi.
const pari = (path) => { const n = String(path).split('/').filter(Boolean).length; if (n % 2) throw new Error('Invalid document reference. Document references must have an even number of segments, but ' + path + ' has ' + n); };
export function doc(db, ...s) { pari(s.join('/')); return { path: s.join('/'), id: s[s.length - 1], tipo: 'doc' }; }
// Come il vero: Firestore non accetta una lista dentro una lista.
const listaInLista = (v) => Array.isArray(v) ? v.some(e => Array.isArray(e) || listaInLista(e)) : (v && typeof v === 'object' ? Object.values(v).some(listaInLista) : false);
const nonAccettato = (msg) => Object.assign(new Error(msg), { code: 'invalid-argument' });
function avvisa() { ascolti.forEach(f => f()); }
function applica(ops) {
  const o = leggi();
  ops.forEach(([t, r, d, opz]) => {
    window.__scritture.push([t, r.path, opz && opz.merge ? 'merge' : '']);
    if (t === 's') o[r.path] = JSON.parse(JSON.stringify(opz && opz.merge ? Object.assign({}, o[r.path] || {}, d) : d));
    else delete o[r.path];
  });
  scrivi(o); avvisa();
}
function esegui(ops) {
  const uno = ops.length === 1 && ops[0][1].path.includes('/taxi_records/');
  window.__inVolo = (window.__inVolo || 0) + 1; window.__maxVolo = Math.max(window.__maxVolo || 0, window.__inVolo);
  if (uno) { window.__singoliInVolo = (window.__singoliInVolo || 0) + 1; window.__maxSingoli = Math.max(window.__maxSingoli || 0, window.__singoliInVolo); }
  return eseguiVero(ops).finally(() => { window.__inVolo--; if (uno) window.__singoliInVolo--; });
}
function eseguiVero(ops) {
  // come il vero: identificativi riservati, '.' e '..' fanno rifiutare tutto il blocco
  for (const o of ops) { const id = o[1].path.split('/').pop(); if (/^__.*__$/.test(id) || id === '.' || id === '..') return Promise.reject(nonAccettato('INVALID_ARGUMENT id ' + id)); }
  (window.__blocchi = window.__blocchi || []).push([ops.length, window.__inVolo, ops[0] && ops[0][1].path.split('/').slice(-2).join('/')]);
  const cid = localStorage.getItem('__codiceId');
  if (cid) for (const pz of cid.split(',')) {
    const [cidId, cidCode] = pz.split(':');
    if (ops.some(o => o[1].path.endsWith('/' + cidId))) return new Promise((_, no) => setTimeout(() => no(Object.assign(new Error(cidCode), { code: cidCode })), 2));
  }
  const rid = localStorage.getItem('__rifiutaId');
  if (rid && ops.some(o => o[1].path.endsWith('/' + rid))) return Promise.reject(nonAccettato('INVALID_ARGUMENT doc ' + rid));
  window.__tentativi = (window.__tentativi || 0) + 1;
  if (localStorage.getItem('__rifiuta') === '1') return Promise.reject(Object.assign(new Error('permission-denied'), { code: 'permission-denied' }));
  if (offline()) {
    pendenti.push(...ops);
    const pr = new Promise((ok) => coda.push(() => { applica(ops); ok(); }));
    if (localStorage.getItem('__cacheVera') === '1') setTimeout(avvisa, 10);
    return pr;
  }
  // localStorage.__passano = N: passano le prime N scritture, le altre restano appese (app chiusa a meta')
  const pas = localStorage.getItem('__passano');
  if (pas !== null && (!localStorage.getItem('__passanoSu') || ops.some(o => o[1].path.includes(localStorage.getItem('__passanoSu'))))) { if (+pas <= 0) return new Promise(() => {}); localStorage.setItem('__passano', String(+pas - 1)); }
  applica(ops); return Promise.resolve();
}
window.__tornaRete = () => { window.__offline = false; localStorage.removeItem('__offline'); pendenti.length = 0; while (coda.length) coda.shift()(); avvisa(); window.dispatchEvent(new Event('online')); };
window.__inCoda = () => coda.length;
export async function setDoc(r, d, opz) { if (listaInLista(d)) throw nonAccettato('Nested arrays are not supported'); return esegui([['s', r, d, opz]]); }
export async function deleteDoc(r) { return esegui([['d', r]]); }
export async function getDoc(r) { const o = leggi(); const d = o[r.path]; return { exists: () => d !== undefined, data: () => d, id: r.id }; }
function snap(path) {
  if (offline()) {
    // __cacheVera: dalla copia in memoria escono le scritture di questa pagina non ancora partite
    const m = {};
    if (localStorage.getItem('__cacheVera') === '1') pendenti.forEach(([t, r, d]) => {
      if (r.path.startsWith(path + '/') && !r.path.slice(path.length + 1).includes('/')) { if (t === 's') m[r.path] = d; else delete m[r.path]; }
    });
    const docs = Object.keys(m).map(k => ({ id: k.slice(path.length + 1), data: () => m[k], ref: { path: k } }));
    return { empty: !docs.length, size: docs.length, docs, forEach: f => docs.forEach(f), metadata: { fromCache: true, hasPendingWrites: !!docs.length }, docChanges: () => [] };
  }
  const o = leggi(); const docs = Object.keys(o).filter(k => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/'))
    .map(k => ({ id: k.slice(path.length + 1), data: () => o[k], ref: { path: k } }));
  return { empty: !docs.length, size: docs.length, docs, forEach: f => docs.forEach(f), metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] };
}
export async function getDocs(c) { return snap(c.path); }
export function onSnapshot(r, cb) {
  const f = () => { if (r.tipo === 'col') cb(snap(r.path)); else { const o = leggi(); const d = offline() ? undefined : o[r.path]; cb({ exists: () => d !== undefined, data: () => d, id: r.id, metadata: { fromCache: offline() } }); } };
  setTimeout(f, 30); ascolti.push(f); return () => { const i = ascolti.indexOf(f); if (i >= 0) ascolti.splice(i, 1); };
}
export function writeBatch() { window.__nBatch = (window.__nBatch || 0) + 1; const ops = []; return {
  set: (r, d, opz) => { pari(r.path); if (listaInLista(d)) throw nonAccettato('Nested arrays are not supported'); ops.push(['s', r, d, opz]); },
  delete: (r) => { pari(r.path); ops.push(['d', r]); },
  update: (r, d) => ops.push(['s', r, d, { merge: true }]),
  commit: () => esegui(ops) }; }
