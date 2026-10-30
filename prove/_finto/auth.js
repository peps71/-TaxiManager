// FIREBASE FINTO - firebase-auth.js (vedi firestore.js per come si usa).
// Non contatta Google: l'accesso e' una riga di localStorage.
//  - localStorage.__uid: l'utente della sessione ripresa all'apertura
//    (assente = 'u1', stringa vuota = nessuno, come chi non e' mai entrato);
//  - localStorage.__prossimo: chi entra premendo «Entra con Google» (se no 'u1');
//  - signOut azzera __uid e conta le uscite in window.__uscite.
// L'utente finto ha email '<uid>@esempio.it'.
const fatto = (uid) => uid ? { uid, email: uid + '@esempio.it', displayName: 'Prova ' + uid } : null;
const ini = localStorage.getItem('__uid');
const stato = { currentUser: fatto(ini === null ? 'u1' : ini) };
const ascolti = [];
export function getAuth() { return stato; }
// window.__authFatto: la prima risposta e' arrivata all'app (la prova la aspetta).
export function onAuthStateChanged(a, cb) { ascolti.push(cb); setTimeout(() => { cb(stato.currentUser); window.__authFatto = true; }, 50); return () => {}; }
export class GoogleAuthProvider { setCustomParameters() {} }
function cambia(u) { stato.currentUser = u; localStorage.setItem('__uid', u ? u.uid : ''); ascolti.forEach(f => f(u)); }
export async function signInWithPopup() { const u = fatto(localStorage.getItem('__prossimo') || 'u1'); cambia(u); return { user: u }; }
export async function signInWithRedirect() {}
export async function getRedirectResult() { return null; }
export async function signOut() { window.__uscite = (window.__uscite || 0) + 1; cambia(null); }
export async function setPersistence() {}
export const browserLocalPersistence = {};
