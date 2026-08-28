/* Conti — service worker
   Aumenta il numero di VERSIONE a ogni modifica dei file: è così che il
   telefono capisce di dover scaricare la versione nuova. */

const VERSIONE = 'conti-v1';

// L'app non dipende da niente di esterno: sono tutti file di questa cartella.
const FILE_APP = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon-180.png',
  './favicon-32.png',
  './favicon-16.png',
  './favicon.ico'
];

// Secondi di attesa massimi per la rete all'apertura: oltre questi si usa
// subito la copia salvata, invece di restare fermi su una linea lentissima.
const ATTESA_RETE_MS = 3000;

const PAGINA_OFFLINE = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Conti offline</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#1e3a5f;color:#fff;margin:0;
min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}
div{padding:2rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0;opacity:.75}</style></head>
<body><div><h1>L'app non è ancora disponibile offline</h1>
<p>Collegati una volta alla rete: da lì in poi si aprirà anche senza campo.</p></div></body></html>`;

// Installazione: ogni file si scarica per conto suo, così un file mancante
// non manda a monte l'intera installazione lasciando l'app senza offline.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSIONE)
      .then((cache) => Promise.all(
        FILE_APP.map((f) => cache.add(f).catch((err) => console.warn('[SW] non messo in cache:', f, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

// Attivazione: via le cache delle versioni precedenti
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'AGGIORNA_SUBITO') self.skipWaiting();
});

function reteConScadenza(richiesta, ms) {
  return new Promise((risolvi, rifiuta) => {
    const scaduta = setTimeout(() => rifiuta(new Error('rete troppo lenta')), ms);
    fetch(richiesta).then(
      (r) => { clearTimeout(scaduta); risolvi(r); },
      (err) => { clearTimeout(scaduta); rifiuta(err); }
    );
  });
}

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;
  if (!richiesta.url.startsWith('http')) return;

  // Apertura dell'app: prima la rete (per prendere gli aggiornamenti),
  // se manca o è troppo lenta si usa la copia salvata.
  if (richiesta.mode === 'navigate') {
    evento.respondWith(
      reteConScadenza(richiesta, ATTESA_RETE_MS)
        .then((risposta) => {
          if (risposta && risposta.ok && risposta.type === 'basic') {
            const copia = risposta.clone();
            caches.open(VERSIONE).then((c) => c.put('./index.html', copia)).catch(() => {});
          }
          return risposta;
        })
        .catch(() => caches.match('./index.html').then((salvata) =>
          salvata || new Response(PAGINA_OFFLINE, {
            status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
        ))
    );
    return;
  }

  // Tutto il resto: prima la copia salvata (apertura immediata),
  // intanto si aggiorna in sottofondo.
  evento.respondWith(
    caches.match(richiesta).then((salvata) => {
      const dallaRete = fetch(richiesta)
        .then((risposta) => {
          if (risposta && risposta.status === 200) {
            const copia = risposta.clone();
            caches.open(VERSIONE).then((c) => c.put(richiesta, copia)).catch(() => {});
          }
          return risposta;
        })
        .catch(() => salvata || new Response('', { status: 504, statusText: 'Offline' }));
      return salvata || dallaRete;
    })
  );
});
