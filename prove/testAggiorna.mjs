// L'AGGIORNAMENTO ARRIVA DAVVERO SUL TELEFONO
// Il difetto che questa prova difende: il service worker, installandosi,
// scaricava index.html con una fetch normale - e una fetch normale puo'
// essere servita dalla CACHE HTTP del browser. GitHub Pages manda
// «Cache-Control: max-age=600», quindi per dieci minuti la stessa richiesta
// torna senza toccare la rete. Risultato: due versioni pubblicate a meno di
// dieci minuti l'una dall'altra, e il service worker NUOVO si salvava la
// pagina VECCHIA. Dal telefono sembrava che l'aggiornamento non funzionasse.
//
// testSW.mjs non poteva vederlo: serve i file con «no-cache». Qui il server
// si comporta come GitHub Pages, cioe' con max-age=600.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

const swVero = readFileSync(join(RADICE, 'sw.js'), 'utf8');
// Quello che il server pubblica, cambiabile a caldo come una release vera.
let pubblicato = { marcatore: 'VERSIONE-A', versioneSW: 'taximanager-prova-A' };

const PAGINA = (m) => `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<title>prova</title></head><body><p id="marcatore">${m}</p></body></html>`;
const OSPITE = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>ospite</title></head>
<body><script>
navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
  .then(r => { window.reg = r; window.pronto = true; });
</script></body></html>`;

// Come GitHub Pages: dieci minuti di validita' su tutto.
const server = http.createServer((req, res) => {
  const via = req.url.split('?')[0];
  const manda = (corpo, tipo) => {
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'max-age=600' });
    res.end(corpo);
  };
  if (via === '/ospite.html') return manda(OSPITE, 'text/html; charset=utf-8');
  if (via === '/' || via === '/index.html') return manda(PAGINA(pubblicato.marcatore), 'text/html; charset=utf-8');
  if (via === '/sw.js') return manda(swVero.replace(/const VERSIONE = '[^']*'/, `const VERSIONE = '${pubblicato.versioneSW}'`), 'text/javascript');
  if (via === '/manifest.json') return manda('{}', 'application/json');
  res.writeHead(404); res.end('no');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORTA = server.address().port;

let ok = 0; const ko = [];
const c = (nome, vero) => { if (vero) ok++; else ko.push(nome); };

const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'it-IT' });
const p = await ctx.newPage();

const inCache = () => p.evaluate(async () => {
  const nomi = await caches.keys();
  for (const n of nomi) {
    const r = await (await caches.open(n)).match('./index.html');
    if (r) return { cache: n, testo: await r.text() };
  }
  return null;
});

// 1) prima pubblicazione: si installa la A
await p.goto(`http://127.0.0.1:${PORTA}/ospite.html`);
await p.waitForFunction(() => window.pronto === true, { timeout: 20000 });
await p.waitForFunction(async () => (await caches.keys()).length > 0, { timeout: 20000 });
await p.waitForTimeout(600);
const a = await inCache();
c('la prima versione finisce in cache', !!a && a.testo.includes('VERSIONE-A'));

// 2) la pagina si richiede dalla rete: cosi' la cache HTTP del browser e'
//    calda, com'e' sul telefono di chi ha appena aggiornato
await p.evaluate(() => fetch('./index.html').then(r => r.text()));

// 3) seconda pubblicazione, entro i dieci minuti di validita'
pubblicato = { marcatore: 'VERSIONE-B', versioneSW: 'taximanager-prova-B' };
await p.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  await reg.update();
});
await p.waitForFunction(async () => (await caches.keys()).some(n => n.endsWith('-B')), { timeout: 20000 });
await p.waitForTimeout(900);

const d = await p.evaluate(async () => {
  const r = await (await caches.open('taximanager-prova-B')).match('./index.html');
  return r ? await r.text() : null;
});
c('la versione nuova si porta la pagina NUOVA, non quella della cache HTTP',
  !!d && d.includes('VERSIONE-B') && !d.includes('VERSIONE-A'));

await b.close();
server.close();
console.log(`  ${ok} controlli passati`);
ko.forEach(x => console.log(`  *** ${x}`));
