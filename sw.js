/* TaxiManager 2026 - service worker
   Cambia il numero di VERSIONE ogni volta che aggiorni l'app:
   è così che il telefono capisce che deve scaricare la versione nuova. */

const VERSIONE = 'taximanager-v148';

// File dell'app da tenere sempre disponibili offline
const FILE_APP = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icona-192-2.png',
  './icona-512-2.png',
  './icona-ritagliabile-512-2.png',
  './icona-iphone-180-2.png',
  './favicon-32.png',
  './favicon-16.png',
  './favicon.ico'
];

// L'APERTURA NON ASPETTA LA RETE
// Prima si chiedeva la rete e si attendeva fino a 3 secondi prima di mostrare
// la copia salvata. Risultato: in garage, in un sottopasso, in una zona senza
// campo, si guardava il vuoto per tre secondi - mentre sul telefono c'era una
// copia perfetta, pronta. Adesso la copia salvata si da' SUBITO, e il
// controllo della versione nuova corre in sottofondo (lo chiede la pagina con
// registration.update(), all'avvio e ogni volta che l'app torna in primo
// piano). Quando una versione nuova e' pronta non entra di prepotenza: si
// mette in attesa, la pagina lo dice con una striscia, e tocca all'utente.

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

// SCARICARE DALLA RETE, NON DALLA CACHE DEL BROWSER
// cache.add fa una fetch normale, e una fetch normale puo' essere servita
// dalla cache HTTP del browser. GitHub Pages manda Cache-Control: max-age=600,
// quindi per dieci minuti dopo uno scarico la stessa richiesta torna dalla
// cache senza toccare la rete. Risultato: due versioni pubblicate a meno di
// dieci minuti l'una dall'altra, e il service worker NUOVO si salvava la
// pagina VECCHIA. Il numero di versione del service worker cambiava, ma
// l'app restava indietro - e dal telefono sembrava che l'aggiornamento non
// funzionasse. Con cache: 'reload' la rete si interroga per forza.
// Se un browser vecchio non conosce l'opzione, si riprova alla maniera di
// prima: meglio una copia dubbia che nessuna copia offline.
function scaricaFresco(cache, file) {
  return cache.add(new Request(file, { cache: 'reload' }))
    .catch(() => cache.add(file))
    .catch((err) => { console.warn('[SW] file non messo in cache:', file, err); });
}

// Installazione: scarico e metto in cache i file dell'app.
// Ogni file si scarica per conto suo: con cache.addAll bastava una sola icona
// mancante per far fallire l'intera installazione, e l'app restava senza offline.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSIONE)
      .then((cache) => Promise.all(FILE_APP.map((file) => scaricaFresco(cache, file))))
  );
  // Niente skipWaiting qui: la versione nuova resta in attesa e prende il
  // comando solo quando la pagina glielo dice (AGGIORNA_SUBITO, dal tasto
  // «Carica adesso»). Prendendolo da sola, l'app si ricaricava sotto le mani
  // di chi stava battendo una corsa.
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

// Permette alla pagina di far passare subito una versione nuova senza chiudere
// l'app, e di farsi riscaricare i file quando la copia salvata e' rimasta
// indietro (vedi «scaricaFresco» qui sopra): e' la via d'uscita se una copia
// vecchia e' gia' finita in cache.
self.addEventListener('message', (evento) => {
  const dati = evento.data || {};
  if (dati.tipo === 'AGGIORNA_SUBITO') { self.skipWaiting(); return; }
  // «Tu che versione sei?» La pagina lo chiede per poterlo mostrare: se la
  // pagina e' la 145 e la copia salvata e' la 143, da fuori non si vede
  // niente - e si cercano difetti in posti dove non ci sono.
  if (dati.tipo === 'CHE_VERSIONE') {
    if (evento.ports && evento.ports[0]) evento.ports[0].postMessage({ versione: VERSIONE });
    return;
  }
  if (dati.tipo === 'RISCARICA_APP') {
    const rispondi = (esito) => {
      if (evento.ports && evento.ports[0]) evento.ports[0].postMessage(esito);
    };
    evento.waitUntil(
      caches.open(VERSIONE)
        .then((cache) => Promise.all(FILE_APP.map((file) => scaricaFresco(cache, file))))
        .then(() => rispondi({ fatto: true, versione: VERSIONE }))
        .catch((err) => rispondi({ fatto: false, errore: String(err) }))
    );
  }
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

// Il clone va fatto subito, prima di qualsiasi await: dopo che la risposta e'
// stata letta non si puo' piu' clonare. Si restituisce la promessa perche' chi
// chiama la passa a evento.waitUntil: senza, il browser puo' spegnere il
// service worker a meta' scrittura e la copia resta tronca.
function salvaInCache(richiesta, risposta) {
  const copia = risposta.clone();
  return caches.open(VERSIONE)
    .then((cache) => cache.put(richiesta, copia))
    .catch(() => { /* cache piena o richiesta non salvabile: pazienza */ });
}

// Una pagina o un file?
// Senza estensione (./ oppure /-TaxiManager/) e' una pagina dell'app.
// Con un'estensione che non sia .html e' un file, e va servito quel file:
// un'icona, il manifesto, un'immagine. Si guarda solo l'ultimo pezzo del
// percorso, cosi' una cartella che contiene un punto non inganna.
function eUnaPaginaDellApp(url) {
  let percorso;
  try { percorso = new URL(url).pathname; } catch (err) { return true; }
  const punto = percorso.lastIndexOf('.');
  const barra = percorso.lastIndexOf('/');
  if (punto < barra) return true;
  const estensione = percorso.slice(punto + 1).toLowerCase();
  return estensione === 'html' || estensione === 'htm';
}

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;

  if (richiesta.method !== 'GET') return;
  // Estensioni del browser e simili: non sono roba nostra
  if (!richiesta.url.startsWith('http')) return;
  if (daNonIntercettare(richiesta.url)) return;

  // Navigazione (apertura dell'app): la copia salvata, subito.
  // In cache l'app ci va al momento dell'installazione di questa versione, che
  // e' l'unico posto che la scrive: cosi' quello che si apre e' sempre la
  // copia coerente con questo service worker, mai un misto fra due versioni.
  // Senza copia salvata (primissimo avvio, o installazione interrotta) si
  // prende la rete, e senza nemmeno quella la paginetta qui sopra.
  //
  // MA SOLO SE E' DAVVERO UNA PAGINA (vedi eUnaPaginaDellApp)
  // Prima qui dentro ci finiva QUALUNQUE navigazione dentro la cartella
  // dell'app, compresa quella verso un file: chiedendo
  // icona-iphone-180-2.png si riceveva index.html, e chiedendo
  // manifest.webmanifest pure. Nessuno apre a mano l'indirizzo di un'icona - ma
  // l'iPhone lo fa, quando si tocca «Aggiungi alla schermata Home». Riceveva
  // una pagina HTML al posto dell'icona e del manifesto, non poteva usare ne'
  // l'una ne' l'altro, e si disegnava da solo un quadrato giallo con la
  // lettera T. Il difetto era invisibile da dentro l'app: l'app funzionava
  // benissimo.
  if (richiesta.mode === 'navigate' && eUnaPaginaDellApp(richiesta.url)) {
    evento.respondWith(
      caches.match('./index.html')
        .then((salvata) => salvata || fetch(richiesta))
        .catch(() => fetch(richiesta))
        .catch(() => new Response(PAGINA_OFFLINE, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }))
    );
    return;
  }

  // Tutto il resto (icone, Tailwind, script): prima la cache, poi la rete in background
  evento.respondWith(
    caches.match(richiesta).then((salvata) => {
      const dallaRete = fetch(richiesta)
        .then((risposta) => {
          if (daSalvare(risposta)) evento.waitUntil(salvaInCache(richiesta, risposta));
          return risposta;
        })
        // Niente rete e niente copia salvata: si risponde comunque qualcosa,
        // altrimenti il browser mostra un errore di rete al posto della risorsa.
        .catch(() => salvata || new Response('', { status: 504, statusText: 'Offline' }));
      return salvata || dallaRete;
    })
  );
});
