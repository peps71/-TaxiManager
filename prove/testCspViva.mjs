// La protezione messa dal copione e' DAVVERO applicata? E l'interruttore la toglie?
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
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
// la radice la da' l'intestazione
const tipi = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.ico':'image/x-icon', '.jpg':'image/jpeg' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]) === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(RADICE, rel);
  if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': tipi[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const U = `http://127.0.0.1:${server.address().port}/index.html`;
// Un secondo server, raggiungibile davvero ma su un'altra porta: per la CSP
// e' un'altra origine. Se la risposta non arriva, e' la CSP che l'ha fermata,
// non il DNS - l'indirizzo .invalid di prima non distingueva i due casi.
const altro = http.createServer((q, s2) => { s2.writeHead(200, {'Access-Control-Allow-Origin':'*'}); s2.end('ciao'); });
await new Promise(r => altro.listen(0, '127.0.0.1', r));
const ALTRA_ORIGINE = `http://127.0.0.1:${altro.address().port}/x`;
const b = await chromium.launch();

async function prova(spenta) {
  const p = await b.newPage({ locale: 'it-IT' });
  p.on('dialog', d => d.accept());
  await p.goto(U);
  await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
  if (spenta) { await p.evaluate(() => localStorage.setItem('taxi_csp','no')); await p.goto(U);
                await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 }); }
  const r = await p.evaluate(async (altraOrigine) => {
    const esito = {};
    esito.attiva = !!window.cspAttiva;
    // 1) un'origine raggiungibile ma non permessa: deve essere rifiutata
    try { const risp = await fetch(altraOrigine); esito.estraneo = 'PASSATO (' + await risp.text() + ')'; }
    catch (e) { esito.estraneo = 'bloccato (' + String(e.message).slice(0, 48) + ')'; }
    // 2) un copione iniettato da un indirizzo non permesso: deve essere rifiutato
    esito.copione = await new Promise((ris) => {
      const sc = document.createElement('script');
      sc.src = 'https://esempio-non-permesso.invalid/x.js';
      sc.onerror = () => ris('bloccato o non raggiungibile');
      sc.onload = () => ris('CARICATO');
      document.head.appendChild(sc);
      setTimeout(() => ris('nessuna risposta'), 2500);
    });
    // 3) le regole viste dal browser
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    esito.regolePresenti = !!m;
    esito.objectSrc = m ? /object-src 'none'/.test(m.content) : false;
    return esito;
  }, ALTRA_ORIGINE);
  await p.close();
  return r;
}

const acceso = await prova(false);
const spento = await prova(true);
console.log('  --- protezione accesa (normale) ---');
console.log(`    regole presenti nella pagina: ${acceso.regolePresenti ? 'sì' : 'NO ***'}`);
console.log(`    indirizzo estraneo con fetch: ${acceso.estraneo}`);
console.log(`    copione da indirizzo estraneo: ${acceso.copione}`);
console.log('  --- interruttore su «no» ---');
console.log(`    regole presenti nella pagina: ${spento.regolePresenti ? '*** ANCORA PRESENTI ***' : 'no, togliere funziona'}`);
console.log(`    window.cspAttiva: ${spento.attiva}`);
console.log(`    la stessa origine estranea adesso: ${spento.estraneo}`);
console.log(`\n  conclusione: ${/bloccato/.test(acceso.estraneo) && /PASSATO/.test(spento.estraneo)
    ? 'ok \u2014 con la protezione l\'origine estranea e\' rifiutata, senza passa: e\' la CSP che lavora'
    : '*** non dimostrato: ' + acceso.estraneo + ' / ' + spento.estraneo + ' ***'}`);
await b.close(); server.close(); altro.close();
