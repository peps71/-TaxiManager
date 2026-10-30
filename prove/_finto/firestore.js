// ============================================================
//  FIREBASE FINTO - firebase-firestore.js
//  Non tocca MAI il Cloud vero: non apre connessioni, non conosce il
//  progetto. Le prove (testOffline.mjs) lo servono al posto dei tre file
//  di gstatic.com intercettando la rete di Playwright:
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
//  setDoc e batch.set con { merge: true } uniscono i campi come il vero.
// ============================================================
const leggi = () => JSON.parse(localStorage.getItem('__cloud') || '{}');
const scrivi = (o) => localStorage.setItem('__cloud', JSON.stringify(o));
const offline = () => window.__offline || localStorage.getItem('__offline') === '1';
const ascolti = []; const coda = [];
window.__scritture = [];
export function getFirestore() { return {}; }
export function collection(db, ...s) { return { path: s.join('/'), tipo: 'col' }; }
export function doc(db, ...s) { return { path: s.join('/'), id: s[s.length - 1], tipo: 'doc' }; }
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
  if (localStorage.getItem('__rifiuta') === '1') return Promise.reject(Object.assign(new Error('permission-denied'), { code: 'permission-denied' }));
  if (offline()) return new Promise((ok) => coda.push(() => { applica(ops); ok(); }));
  // localStorage.__passano = N: passano le prime N scritture, le altre restano appese (app chiusa a meta')
  const pas = localStorage.getItem('__passano');
  if (pas !== null && (!localStorage.getItem('__passanoSu') || ops.some(o => o[1].path.includes(localStorage.getItem('__passanoSu'))))) { if (+pas <= 0) return new Promise(() => {}); localStorage.setItem('__passano', String(+pas - 1)); }
  applica(ops); return Promise.resolve();
}
window.__tornaRete = () => { window.__offline = false; localStorage.removeItem('__offline'); while (coda.length) coda.shift()(); avvisa(); window.dispatchEvent(new Event('online')); };
window.__inCoda = () => coda.length;
export async function setDoc(r, d, opz) { return esegui([['s', r, d, opz]]); }
export async function deleteDoc(r) { return esegui([['d', r]]); }
export async function getDoc(r) { const o = leggi(); const d = o[r.path]; return { exists: () => d !== undefined, data: () => d, id: r.id }; }
function snap(path) {
  if (offline()) return { empty: true, size: 0, docs: [], forEach: () => {}, metadata: { fromCache: true, hasPendingWrites: false } };
  const o = leggi(); const docs = Object.keys(o).filter(k => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/'))
    .map(k => ({ id: k.slice(path.length + 1), data: () => o[k], ref: { path: k } }));
  return { empty: !docs.length, size: docs.length, docs, forEach: f => docs.forEach(f), metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] };
}
export async function getDocs(c) { return snap(c.path); }
export function onSnapshot(r, cb) {
  const f = () => { if (r.tipo === 'col') cb(snap(r.path)); else { const o = leggi(); const d = offline() ? undefined : o[r.path]; cb({ exists: () => d !== undefined, data: () => d, id: r.id, metadata: { fromCache: offline() } }); } };
  setTimeout(f, 30); ascolti.push(f); return () => { const i = ascolti.indexOf(f); if (i >= 0) ascolti.splice(i, 1); };
}
export function writeBatch() { const ops = []; return {
  set: (r, d, opz) => ops.push(['s', r, d, opz]), delete: (r) => ops.push(['d', r]), update: (r, d) => ops.push(['s', r, d, { merge: true }]),
  commit: () => esegui(ops) }; }
