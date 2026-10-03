// Il service worker si prova solo su HTTP. Qui si guarda:
//  - l'app si apre dalla copia salvata, senza aspettare la rete
//  - una versione nuova resta in attesa e NON si installa da sola
//  - la striscia lo dice, e il tasto la carica
// Le prove girano da dove sta il repository, non da un percorso fisso: cosi'
// funzionano anche su un'altra macchina. Il motore del browser si cerca dove
// e' installato, oppure lo si dice con PLAYWRIGHT=/percorso/index.mjs.
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
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// la radice la da' l'intestazione
let lento = 0;            // ms di ritardo finto sulla rete
let offline = false;
let serviti = { html: 0 };

const tipi = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.ico':'image/x-icon', '.jpg':'image/jpeg' };
const server = http.createServer(async (req, res) => {
  const pulito = decodeURIComponent(req.url.split('?')[0]);
  const rel = pulito === '/' ? '/index.html' : pulito;
  const file = path.join(RADICE, rel);
  if (offline) { res.socket.destroy(); return; }
  if (lento) await new Promise(r => setTimeout(r, lento));
  if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  if (rel.endsWith('.html')) serviti.html++;
  res.writeHead(200, { 'Content-Type': tipi[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORTA = server.address().port;
const U = `http://127.0.0.1:${PORTA}/index.html`;

const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'it-IT' });
const p = await ctx.newPage();
p.on('dialog', d => d.accept());

// 1) primo avvio: installa il service worker
await p.goto(U);
await p.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 });
console.log('  1. service worker installato e al comando');

// 2) riapertura con la rete LENTISSIMA: deve aprirsi comunque subito
lento = 4000;
serviti.html = 0;
const t0 = Date.now();
await p.goto(U);
await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
const apertura = Date.now() - t0;
console.log(`  2. con la rete a 4 secondi di ritardo l'app si apre in ${apertura} ms  ${apertura < 1500 ? 'ok' : '*** TROPPO LENTA ***'}`);
console.log(`     pagine HTML chieste alla rete per aprirsi: ${serviti.html} ${serviti.html === 0 ? 'ok' : '(dovrebbe essere 0)'}`);

// 3) del tutto senza rete
lento = 0; offline = true;
const t1 = Date.now();
await p.goto(U).catch(() => {});
await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
console.log(`  3. senza rete per niente: si apre in ${Date.now() - t1} ms`);
offline = false;
// riapro con la rete di nuovo buona, cosi' la registrazione va a segno
await p.goto(U);
await p.waitForFunction(() => !!window.registrazioneSW, { timeout: 20000 });

// 4) una versione nuova NON deve prendere il comando da sola
const sw = path.join(RADICE, 'sw.js');
const originale = fs.readFileSync(sw, 'utf8');
const versioneAttuale = (originale.match(/taximanager-v\d+/) || [])[0];
if (!versioneAttuale) throw new Error('VERSIONE non trovata in sw.js');
fs.writeFileSync(sw, originale.replace(versioneAttuale, 'taximanager-v999'));
console.log(`     (versione in prova: ${versioneAttuale} \u2192 taximanager-v999)`);
try {
  await p.evaluate(async () => {
    const reg = window.registrazioneSW || await navigator.serviceWorker.getRegistration();
    await reg.update();
  });
  await p.waitForFunction(() => {
    const b2 = document.getElementById('avviso-versione');
    return b2 && !b2.classList.contains('hidden');
  }, { timeout: 20000 });
  console.log('  4. versione nuova scaricata: la striscia compare');
  const r = await p.evaluate(() => ({
    testo: document.getElementById('avviso-versione-testo').textContent.trim(),
    inAttesa: !!(window.registrazioneSW && window.registrazioneSW.waiting),
    comandoCambiato: navigator.serviceWorker.controller.scriptURL,
    spazio: document.body.style.paddingTop
  }));
  console.log(`     dice: «${r.testo}»`);
  console.log(`     la versione nuova e' in ATTESA, non al comando: ${r.inAttesa ? 'ok' : '*** NO ***'}`);
  console.log(`     il corpo scende di ${r.spazio || '0px'} per far posto alla striscia`);
  const cacheNuovaPrima = await p.evaluate(() => caches.keys());
  console.log(`     cache presenti: ${cacheNuovaPrima.join(', ')}`);

  // 5) il tasto «Carica adesso» la fa entrare
  // la pagina si ricarica da sola al cambio di comando: l'evaluate muore, e va bene
  await p.evaluate(() => aggiornaApp()).catch(() => {});
  await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
  await p.waitForTimeout(1200);
  const dopo = await p.evaluate(async () => ({
    cache: await caches.keys(),
    comando: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
    striscia: !document.getElementById('avviso-versione').classList.contains('hidden'),
    spazio: document.body.style.paddingTop
  }));
  const pulita = dopo.cache.length === 1 && dopo.cache[0].includes('999');
  console.log(`  5. dopo «Carica adesso»: cache ${dopo.cache.join(', ')} ${pulita ? 'ok (la vecchia e\' stata cancellata)' : '*** la vecchia e\' rimasta ***'}`);
  console.log(`     la striscia e' sparita: ${dopo.striscia ? '*** NO ***' : 'ok'} · spazio in cima «${dopo.spazio || '0'}»`);
} finally {
  fs.writeFileSync(sw, originale);
}
await b.close();
server.close();
