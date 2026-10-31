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

// ============================================================
//  GLI INDIRIZZI ESATTI (versione 176)
//  Fino alla v175 connect-src ammetteva *.googleapis.com, *.google.com,
//  *.firebaseio.com, *.firebaseapp.com, *.cloudfunctions.net: posti dove
//  CHIUNQUE puo' affittare un indirizzo (uno script su script.google.com, un
//  secchio su storage.googleapis.com, il database di un altro progetto). Un
//  copione entrato per sbaglio nella pagina poteva mandarci i dati. Adesso
//  devono passare solo i tre servizi che l'app usa: firestore,
//  identitytoolkit, securetoken.
//  Nessuna richiesta esce davvero: page.route le prende tutte. Quelle che
//  arrivano alla route le ha lasciate passare la CSP, e si risponde 200 da
//  qui; quelle che la CSP ferma non ci arrivano e accendono l'evento
//  securitypolicyviolation. Cosi' il rifiuto della CSP non si confonde con
//  un errore di rete.
// ============================================================
const VIETATI = ['https://script.google.com/macros/s/X/exec', 'https://storage.googleapis.com/secchio-altrui/x',
  'https://www.googleapis.com/upload/x', 'https://x.firebaseio.com/x.json', 'https://x.cloudfunctions.net/f',
  'https://altro.firebaseapp.com/api'];
const AMMESSI = ['https://firestore.googleapis.com/v1/x', 'https://identitytoolkit.googleapis.com/v1/x',
  'https://securetoken.googleapis.com/v1/token'];
let falliti = 0;
const segna = (vero, testo) => { console.log((vero ? '    ok  ' : '    *** ') + testo); if (!vero) falliti++; };

async function uscite(spenta) {
  const ctx = await b.newContext({ serviceWorkers: 'block', locale: 'it-IT' });
  const arrivate = new Set();
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => {
    arrivate.add(new URL(r.request().url()).host);
    // per le richieste di prova si risponde da qui; il resto (Firebase) si ferma
    if (r.request().method() === 'POST') r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'finto' });
    else r.abort();
  });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.__viol = []; document.addEventListener('securitypolicyviolation', e => window.__viol.push({ dir: e.effectiveDirective || e.violatedDirective, uri: e.blockedURI || '' })); });
  await p.goto(U);
  await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
  if (spenta) { await p.evaluate(() => localStorage.setItem('taxi_csp', 'no')); await p.goto(U);
                await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 }); }
  const esiti = {};
  for (const u of VIETATI.concat(AMMESSI)) {
    const prima = await p.evaluate(() => window.__viol.length);
    const fetchOk = await p.evaluate(u => fetch(u, { method: 'POST', body: 'dati' }).then(r => r.ok, () => false), u);
    await p.waitForTimeout(50);
    const viol = await p.evaluate((n) => window.__viol.slice(n), prima);
    const host = new URL(u).host;
    esiti[host] = { fetchOk, arrivata: arrivate.has(host), violazione: viol.some(v => /connect-src/.test(v.dir) && v.uri.includes(host)) };
  }
  await ctx.close();
  return esiti;
}

console.log('\n  --- indirizzi di altri dentro i domini di Google e Firebase ---');
const acc = await uscite(false);
for (const u of VIETATI) {
  const h = new URL(u).host, e = acc[h];
  segna(!e.fetchOk && !e.arrivata && e.violazione, `con la protezione ${h}: ${e.violazione && !e.arrivata ? 'rifiutato dalla CSP' : 'LASCIATO USCIRE'} ${JSON.stringify(e)}`);
}
for (const u of AMMESSI) {
  const h = new URL(u).host, e = acc[h];
  segna(e.fetchOk && e.arrivata && !e.violazione, `con la protezione ${h}: ${e.arrivata && !e.violazione ? 'ammesso' : 'FERMATO (l\'app non si sincronizzerebbe)'} ${JSON.stringify(e)}`);
}
const spe = await uscite(true);
for (const u of VIETATI.concat(AMMESSI)) {
  const h = new URL(u).host, e = spe[h];
  segna(e.fetchOk && e.arrivata && !e.violazione, `interruttore spento, ${h}: ${e.arrivata ? 'passa' : 'FERMATO'}`);
}

// ============================================================
//  NESSUNA VIOLAZIONE NELL'USO NORMALE
//  Un indirizzo stretto troppo si vede cosi': una scheda che carica
//  un'immagine, un copione o un servizio che la CSP rifiuta. Si girano
//  tutte le schede con l'ascoltatore acceso: zero violazioni. Tutte le
//  richieste esterne si fermano qui (nessun contatto con Firebase).
// ============================================================
console.log('\n  --- il giro di tutte le schede con la protezione accesa ---');
{
  const ctx = await b.newContext({ serviceWorkers: 'block', locale: 'it-IT', viewport: { width: 390, height: 900 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.__viol = []; document.addEventListener('securitypolicyviolation', e => window.__viol.push((e.effectiveDirective || e.violatedDirective) + ' ' + (e.blockedURI || '').slice(0, 80))); });
  await p.goto(U);
  await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
  // Con un logo caricato (un'immagine data:) e un profilo compilato, se no
  // img-src non viene messa alla prova da nessuna scheda.
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const g = c.getContext('2d'); g.fillStyle = '#f5c400'; g.fillRect(0, 0, 8, 8);
    localStorage.setItem('taxi_profilo', JSON.stringify({ nome: 'Prova', cognome: 'CSP', sigla: 'L 71', logo: c.toDataURL('image/png') }));
  });
  await p.goto(U);
  await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
  segna(await p.evaluate(() => { const i = document.getElementById('logo-in-cima'); return !!i && /^data:image/.test(i.getAttribute('src') || ''); }), 'il logo (immagine data:) e\' in pagina');
  const schede = [...new Set(await p.evaluate(() => Array.from(document.querySelectorAll('[onclick*="switchTab("]'))
    .map(e => (e.getAttribute('onclick').match(/switchTab\('([^']+)'/) || [])[1]).filter(Boolean)))];
  for (const s of schede) { await p.evaluate(x => window.switchTab(x), s); await p.waitForTimeout(200); }
  // e le giornate
    await p.evaluate(() => { switchTab('giornata'); if (window.setVistaGiornata) setVistaGiornata('giornate'); }).catch(() => {});
  await p.waitForTimeout(300);
  const attiva = await p.evaluate(() => !!window.cspAttiva);
  const viol = await p.evaluate(() => window.__viol);
  segna(attiva, 'protezione accesa durante il giro');
  segna(schede.length >= 8, `schede visitate: ${schede.length} (${schede.join(', ')})`);
  segna(viol.length === 0, `violazioni della CSP: ${viol.length}${viol.length ? ' ' + JSON.stringify(viol) : ''}`);
  await ctx.close();
}
console.log(`\n  indirizzi e giro: ${falliti ? '*** ' + falliti + ' controlli non tornano ***' : 'tutto torna'}`);

await b.close(); server.close(); altro.close();
