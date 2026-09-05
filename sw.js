/* TaxiManager 2026 - service worker
   Cambia il numero di VERSIONE ogni volta che aggiorni l'app:
   è così che il telefono capisce che deve scaricare la versione nuova. */

const VERSIONE = 'taximanager-v54';

// File dell'app da tenere sempre disponibili offline
const FILE_APP = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon-180.png',
  './favicon-32.png',
  './favicon-16.png',
  './favicon.ico'
];

// Secondi di attesa massimi per la rete quando si apre l'app: oltre questi
// si mostra subito la copia salvata. Con una linea agganciata ma lentissima
// (garage, sottopasso, zona senza campo) l'app si apriva dopo mezzo minuto.
const ATTESA_RETE_MS = 3000;

// Pagina mostrata solo se manca sia la rete sia la copia salvata: succede
// se qualcuno apre l'app prima che l'installazione abbia finito.
const PAGINA_OFFLINE = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TaxiManager offline</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#facc15;color:#111827;
margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}
div{padding:2rem}h1{font-size:1.5rem;margin:0 0 .5rem}p{margin:0;opacity:.75}</style></head>
<body><div><h1>TaxiManager non è ancora disponibile offline</h1>
<p>Collegati una volta alla rete: da lì in poi l'app si aprirà anche senza campo.</p></div></body></html>`;

// Installazione: scarico e metto in cache i file dell'app.
// Ogni file si scarica per conto suo: con cache.addAll bastava una sola icona
// mancante per far fallire l'intera installazione, e l'app restava senza offline.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSIONE)
      .then((cache) => Promise.all(
        FILE_APP.map((file) => cache.add(file).catch((err) => {
          console.warn('[SW] file non messo in cache:', file, err);
        }))
      ))
      .then(() => self.skipWaiting())
  );
});

// Attivazione: cancello le cache delle versioni precedenti
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(
        chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Permette alla pagina di far passare subito una versione nuova senza chiudere l'app
self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'AGGIORNA_SUBITO') self.skipWaiting();
});

// Richieste che NON devono mai passare dalla cache:
// Firestore e le API Firebase devono parlare sempre con la rete,
// altrimenti la sincronizzazione dei dati si rompe.
function daNonIntercettare(url) {
  return (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebaseinstallations.googleapis.com') ||
    url.includes('firebasedatabase.app') ||
    url.includes('/google.firestore')
  );
}

// Vale la pena salvarla?
// - le risposte normali (status 200) sì;
// - le risposte "opache" (status 0) arrivano da un altro sito e il browser non
//   ci fa leggere dentro, ma le sa riusare: e' il caso del codice di Firebase.
//   La grafica non passa piu' di qui, ora sta dentro index.html.
function daSalvare(risposta) {
  if (!risposta) return false;
  if (risposta.status === 200) return true;
  return risposta.status === 0 && risposta.type === 'opaque';
}

function salvaInCache(richiesta, risposta) {
  const copia = risposta.clone();
  caches.open(VERSIONE)
    .then((cache) => cache.put(richiesta, copia))
    .catch(() => { /* cache piena o richiesta non salvabile: pazienza */ });
}

// Rete con tempo massimo di attesa: scaduto quello si va avanti con la cache.
function reteConScadenza(richiesta, ms) {
  return new Promise((risolvi, rifiuta) => {
    const scaduta = setTimeout(() => rifiuta(new Error('rete troppo lenta')), ms);
    fetch(richiesta).then(
      (r) => { clearTimeout(scaduta); risolvi(r); },
      (e) => { clearTimeout(scaduta); rifiuta(e); }
    );
  });
}

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;

  if (richiesta.method !== 'GET') return;
  // Estensioni del browser e simili: non sono roba nostra
  if (!richiesta.url.startsWith('http')) return;
  if (daNonIntercettare(richiesta.url)) return;

  // Navigazione (apertura dell'app): prima la rete, se manca o è troppo lenta
  // uso la copia salvata. In cache va solo una risposta valida: prima ci finiva
  // anche una pagina di errore del server, che poi restava lì per sempre.
  if (richiesta.mode === 'navigate') {
    evento.respondWith(
      reteConScadenza(richiesta, ATTESA_RETE_MS)
        .then((risposta) => {
          if (risposta && risposta.ok && risposta.type === 'basic') {
            salvaInCache('./index.html', risposta);
          }
          return risposta;
        })
        .catch(() => caches.match('./index.html').then((salvata) =>
          salvata || new Response(PAGINA_OFFLINE, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
        ))
    );
    return;
  }

  // Tutto il resto (icone, Tailwind, script): prima la cache, poi la rete in background
  evento.respondWith(
    caches.match(richiesta).then((salvata) => {
      const dallaRete = fetch(richiesta)
        .then((risposta) => {
          if (daSalvare(risposta)) salvaInCache(richiesta, risposta);
          return risposta;
        })
        // Niente rete e niente copia salvata: si risponde comunque qualcosa,
        // altrimenti il browser mostra un errore di rete al posto della risorsa.
        .catch(() => salvata || new Response('', { status: 504, statusText: 'Offline' }));
      return salvata || dallaRete;
    })
  );
});
