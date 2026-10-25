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

const tipi = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json','.webmanifest':'application/manifest+json',
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

// 1bis) LA RIGA CHE DICE CHI SERVE I FILE, PRIMA CHE CI SIA QUALCUNO
// Appena aperta l'app su un telefono pulito la copia salvata non ha ancora
// preso il comando. In quel momento la riga non deve gridare «NON allineate»
// ne' offrire di buttare via una copia che non esiste: deve dire che non c'e'
// ancora e che si sistema da sola.
// E soprattutto deve RADDRIZZARSI DA SOLA quando la copia prende il comando:
// prima la risposta «nessuna» se la teneva per tutta la sessione, e l'avviso
// giallo restava acceso anche un'ora dopo che non valeva piu'.
await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
await p.evaluate(() => { switchTab('cloud'); renderContent(); });
const leggiRiga = () => p.evaluate(() => {
  const t = document.getElementById('main-container').textContent.replace(/\s+/g, ' ');
  const m = t.match(/Pagina v\d+ · copia salvata sul telefono[^.]*?(tutto allineato|NON allineate|non ancora installata)/);
  return {
    riga: m ? m[0] : '(non trovata)',
    tastoButtaVia: /Butta via la copia salvata/.test(t)
  };
});
const senzaCopia = await leggiRiga();
if (/non ancora installata/.test(senzaCopia.riga)) {
  console.log(`  1a. senza copia dice: «...non ancora installata» ok`);
  console.log(`      e NON offre di buttarla via: ${senzaCopia.tastoButtaVia ? '*** la offre ***' : 'ok'}`);
} else if (/tutto allineato/.test(senzaCopia.riga)) {
  console.log('  1a. la copia aveva gia\' preso il comando: niente da dire (ok)');
} else {
  console.log(`  1a. *** dice «${senzaCopia.riga}» ***`);
}

await p.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 });
console.log('  1. service worker installato e al comando');

// senza ricaricare niente: la riga deve essersi raddrizzata da sola
await p.waitForTimeout(1500);
await p.evaluate(() => renderContent());
await p.waitForTimeout(400);
const conCopia = await leggiRiga();
console.log(`  1b. presa il comando, SENZA riaprire l'app la riga dice: «${conCopia.riga}»`);
console.log(`      ${/tutto allineato/.test(conCopia.riga) ? 'ok' : '*** doveva dire «tutto allineato» ***'}`);

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
const copiaDiScorta = sw + '.originale';

// QUESTA PROVA SCRIVE DENTRO sw.js, E QUINDI PUO' ROMPERLO
// Per provare l'arrivo di una versione nuova bisogna fabbricarne una: si
// scrive v999 dentro sw.js e alla fine si rimette com'era. Il «alla fine»
// pero' e' un finally, e un finally non gira se il processo muore prima -
// basta mandare l'uscita della prova in «head», che chiude il tubo e fa
// morire node a meta'. E' successo: sw.js e' rimasto a v999 nel repository,
// e un commit distratto avrebbe mandato in mano a chi usa l'app un numero
// di versione falso, rompendo gli aggiornamenti per tutti.
// Adesso l'originale si mette da parte su DISCO prima di toccare niente, e
// la prima cosa che si fa al giro dopo e' rimetterlo. Cosi' anche se questo
// giro muore di colpo, il prossimo ripara.
if (fs.existsSync(copiaDiScorta)) {
  fs.copyFileSync(copiaDiScorta, sw);
  fs.unlinkSync(copiaDiScorta);
  console.log('  (sw.js era rimasto modificato da un giro interrotto: rimesso a posto)');
}
const originale = fs.readFileSync(sw, 'utf8');
if (!/taximanager-v\d+/.test(originale)) {
  console.error('*** sw.js non ha un numero di versione riconoscibile: non lo tocco ***');
  process.exit(2);
}
fs.writeFileSync(copiaDiScorta, originale);
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
  if (fs.existsSync(copiaDiScorta)) fs.unlinkSync(copiaDiScorta);
}
await b.close();
server.close();
