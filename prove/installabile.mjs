// SI INSTALLA COME UNA VERA APP?
// Questa prova guarda tutto quello che decide se TaxiManager, aggiunto alla
// schermata Home di un iPhone o di un telefono Android, si comporta da app e
// non da pagina web: il manifesto, le icone, il colore della barra, la
// schermata di apertura, l'orientamento, e il fatto che si apra anche senza
// campo. Il giudizio sul manifesto non lo diamo noi: lo chiediamo al browser
// stesso (Page.getAppManifest), che e' lo stesso codice che decide se
// mostrare o no la proposta di installazione.
//
// Le prove girano da dove sta il repository, non da un percorso fisso: cosi'
// funzionano anche su un'altra macchina. Il motore del browser si cerca dove
// e' installato, oppure lo si dice con PLAYWRIGHT=/percorso/index.mjs.
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato: installalo o indicalo con PLAYWRIGHT=...'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

let guai = 0;
const ok  = (t) => console.log('  ' + t);
const male = (t) => { guai++; console.log('  *** ' + t + ' ***'); };
const dire = (buono, t) => (buono ? ok : male)(t);

// Un sito finto: il manifesto e il service worker non funzionano da file://
let offline = false;
const tipi = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json','.webmanifest':'application/manifest+json',
               '.png':'image/png', '.ico':'image/x-icon', '.jpg':'image/jpeg', '.css':'text/css' };
const server = http.createServer((req, res) => {
  if (offline) { res.socket.destroy(); return; }
  const pulito = decodeURIComponent(req.url.split('?')[0]);
  const rel = pulito === '/' ? '/index.html' : pulito;
  const file = path.join(RADICE, rel);
  if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': tipi[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORTA = server.address().port;
const SITO = `http://127.0.0.1:${PORTA}`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const lamentele = [];
p.on('console', (m) => { if (m.type() === 'error') lamentele.push(m.text()); });
await p.goto(SITO + '/index.html');
await p.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });

// ------------------------------------------------------------------
console.log('\n1. il manifesto, giudicato dal browser');
const cdp = await ctx.newCDPSession(p);
const risposta = await cdp.send('Page.getAppManifest');
const errori = (risposta.errors || []).filter(e => !e.critical === false || true);
const gravi = (risposta.errors || []).filter(e => e.critical);
dire(gravi.length === 0, gravi.length === 0
  ? 'il browser legge il manifesto senza errori gravi'
  : 'il browser segnala: ' + gravi.map(e => e.message).join(' | '));
if (errori.length && !gravi.length) console.log('     avvisi non gravi: ' + errori.map(e => e.message).join(' | '));
dire(!!risposta.url && risposta.url.endsWith('manifest.webmanifest'), 'il manifesto e\' agganciato alla pagina: ' + (risposta.url || 'MANCA'));

const man = JSON.parse(fs.readFileSync(join(RADICE, 'manifest.webmanifest'), 'utf8'));

// ------------------------------------------------------------------
console.log('\n2. le voci che decidono il comportamento da app');
const obbligatorie = {
  name: (v) => typeof v === 'string' && v.length >= 3,
  short_name: (v) => typeof v === 'string' && v.length >= 2 && v.length <= 12,
  start_url: (v) => typeof v === 'string' && v.length > 0,
  scope: (v) => typeof v === 'string' && v.length > 0,
  display: (v) => ['standalone', 'fullscreen', 'minimal-ui'].includes(v),
  lang: (v) => v === 'it',
  theme_color: (v) => /^#[0-9a-f]{6}$/i.test(v),
  background_color: (v) => /^#[0-9a-f]{6}$/i.test(v)
};
for (const [voce, valida] of Object.entries(obbligatorie)) {
  dire(valida(man[voce]), `${voce}: ${man[voce] === undefined ? 'MANCA' : JSON.stringify(man[voce])}`
       + (voce === 'short_name' && man.short_name ? `  (${man.short_name.length} caratteri, sotto l'icona ne stanno una dozzina)` : ''));
}
// Lo start_url deve stare dentro lo scope, altrimenti l'app si apre nel browser
// L'id dice al telefono «sono sempre la stessa app». Senza, vale lo start_url,
// che e' quello che questa app ha sempre avuto: scriverlo esplicitamente e'
// piu' pulito, ma e' anche una cosa in piu' che puo' andare storta, e qui
// l'identita' dell'app non deve cambiare mai.
console.log(`  id: ${man.id === undefined ? 'non scritto, vale lo start_url' : JSON.stringify(man.id)}`);

// L'orientamento lo rispetta Android; l'iPhone lo ignora. Bloccato in
// verticale va bene sul telefono, ma su un tablet impedisce di girarlo.
dire(['portrait-primary', 'portrait', 'any', 'natural', undefined].includes(man.orientation),
     `orientation: ${man.orientation || 'libero'}`
     + (String(man.orientation).startsWith('portrait') ? '  (su Android resta verticale anche su tablet; l\'iPhone la ignora)' : ''));
const dentro = new URL(man.start_url, SITO + '/').href.startsWith(new URL(man.scope, SITO + '/').href);
dire(dentro, dentro ? 'start_url dentro lo scope: l\'app resta a schermo pieno' : 'start_url FUORI dallo scope: si aprirebbe nel browser');

// ------------------------------------------------------------------
console.log('\n3. le icone: misura vera, non quella dichiarata');
const misure = await p.evaluate(async (elenco) => {
  const fuori = [];
  for (const voce of elenco) {
    const img = new Image();
    img.src = voce.src;
    try { await img.decode(); } catch (e) { fuori.push({ ...voce, rotta: true }); continue; }
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    // trasparenza: su iPhone i punti trasparenti diventano neri
    let alfaMinima = 255;
    // zona sicura delle maskable: il cerchio interno e' l'80% del lato, quello
    // che resta fuori il telefono lo puo' tagliare. Guardiamo l'anello fra il
    // 40% e il 50% del lato: deve essere sfondo, non disegno.
    const cx = c.width / 2, cy = c.height / 2;
    const sfondo = [d[0], d[1], d[2]];
    const diverso = (i) => Math.abs(d[i] - sfondo[0]) + Math.abs(d[i + 1] - sfondo[1]) + Math.abs(d[i + 2] - sfondo[2]) > 60;
    // Due misure diverse, e non vogliono dire la stessa cosa:
    //  - cornice: la fascia larga il 10% lungo i quattro bordi. Deve essere
    //    sfondo pieno: e' il margine che il telefono ha il diritto di mangiare.
    //  - angoli: quello che sta fuori dal cerchio piu' grande che ci sta
    //    dentro. Una maschera tonda taglia esattamente quello.
    let cornice = 0, corniceDiversi = 0, angoli = 0, angoliDiversi = 0;
    const banda = 0.1 * c.width, mezzo = 0.5 * c.width;
    for (let y = 0; y < c.height; y++) {
      for (let xx = 0; xx < c.width; xx++) {
        const i = (y * c.width + xx) * 4;
        if (d[i + 3] < alfaMinima) alfaMinima = d[i + 3];
        if (xx < banda || y < banda || xx >= c.width - banda || y >= c.height - banda) {
          cornice++; if (diverso(i)) corniceDiversi++;
        }
        if (Math.hypot(xx - cx, y - cy) > mezzo) { angoli++; if (diverso(i)) angoliDiversi++; }
      }
    }
    fuori.push({ ...voce, larghezza: c.width, altezza: c.height, alfaMinima,
                 percCornice: 100 * corniceDiversi / cornice,
                 percAngoli: angoli ? 100 * angoliDiversi / angoli : 0 });
  }
  return fuori;
}, [
  ...man.icons.map(i => ({ src: i.src, dichiarata: i.sizes, scopo: i.purpose || 'any' })),
  { src: './icona-iphone-180-2.png', dichiarata: '180x180', scopo: 'iphone' }
]);
for (const i of misure) {
  const nome = i.src.replace('./', '');
  if (i.rotta) { male(`${nome}: non si apre`); continue; }
  const [ld, ad] = i.dichiarata.split('x').map(Number);
  dire(i.larghezza === ld && i.altezza === ad,
       `${nome}: dichiarata ${i.dichiarata}, vera ${i.larghezza}x${i.altezza}`);
  dire(i.alfaMinima >= 250, `${nome}: ${i.alfaMinima >= 250 ? 'senza trasparenze' : 'ha punti trasparenti (su iPhone diventano neri)'}`);
}
const ani = man.icons.filter(i => (i.purpose || 'any').split(' ').includes('any'));
const mask = man.icons.filter(i => (i.purpose || 'any').split(' ').includes('maskable'));
dire(ani.length > 0, `icone normali dichiarate: ${ani.length}`);
dire(mask.length > 0, `icone ritagliabili (maskable) dichiarate: ${mask.length}`);
dire(man.icons.some(i => i.sizes === '512x512'), 'c\'e\' la 512x512, quella della schermata di apertura su Android');
dire(man.icons.some(i => i.sizes === '192x192'), 'c\'e\' la 192x192, quella della schermata Home su Android');
dire(!!misure.find(i => i.scopo === 'iphone' && i.larghezza === 180), 'c\'e\' la 180x180 per iPhone (apple-touch-icon)');

// Android non mostra l'icona com'e': la ritaglia con la forma di sistema -
// cerchio, goccia, quadrato stondato. Quello che sta sul bordo sparisce.
// La regola e' avere una cornice di sfondo pieno larga almeno un decimo del
// lato, e tenere il disegno al centro. Qui si controlla la cornice, che e'
// una cosa misurabile; che il soggetto si riconosca dopo il ritaglio e'
// l'occhio a dirlo, non un numero.
console.log('\n4. l\'icona ritagliabile: il telefono la taglia');
for (const i of misure.filter(i => i.scopo.includes('maskable'))) {
  const nome = i.src.replace('./', '');
  dire(i.percCornice < 5,
       `${nome}: la cornice del 10% e' sfondo pieno al ${(100 - i.percCornice).toFixed(1)}%`
       + (i.percCornice < 5 ? '' : ' - il disegno arriva al bordo e il ritaglio se lo mangia'));
  dire(i.percAngoli < 5,
       `${nome}: una maschera tonda taglia solo margine (${i.percAngoli.toFixed(1)}% di disegno negli angoli)`);
}
for (const i of misure.filter(i => i.scopo === 'any' && i.larghezza === 512)) {
  const nome = i.src.replace('./', '');
  ok(`${nome}: normale, mostrata intera - la cornice qui non serve (${(100 - i.percCornice).toFixed(0)}% sfondo)`);
}

// ------------------------------------------------------------------
// L'IPHONE VA A PRENDERE L'ICONA UNA VOLTA SOLA
// Nel momento in cui si tocca «Aggiungi alla schermata Home». Se in quel
// momento il file non arriva, si disegna da solo un quadrato con la lettera
// iniziale, e quello resta finche' non si rifa' l'operazione: l'icona di
// un'app installata non si aggiorna da sola. Quindi non basta che il file
// esista: deve arrivare, con il tipo giusto, a chi lo chiede.
console.log('\n4bis. le icone arrivano davvero a chi le chiede');
const indirizzi = [...man.icons.map(i => i.src), './icona-iphone-180-2.png', './favicon.ico'];
for (const src of indirizzi) {
  const risposta = await p.evaluate(async (s) => {
    try {
      const r = await fetch(s, { cache: 'no-store' });
      return { stato: r.status, tipo: r.headers.get('content-type') || '', byte: (await r.blob()).size };
    } catch (e) { return { stato: 0, tipo: String(e), byte: 0 }; }
  }, src);
  dire(risposta.stato === 200 && /^image\//.test(risposta.tipo) && risposta.byte > 0,
       `${src.replace('./', '')}: ${risposta.stato} ${risposta.tipo} ${risposta.byte} byte`);
}

// IL TIPO DEL MANIFESTO
// Lo standard chiede application/manifest+json. Un file che finisce in .json
// GitHub Pages lo serve come application/json qualunque, e il mio server di
// prova lo serviva invece col tipo giusto: la differenza fra il banco di prova
// e il sito vero non si vedeva. Da qui il nome .webmanifest, che GitHub Pages
// serve come si deve, e questo controllo, che non lo lascia tornare indietro.
const tipoManifesto = await p.evaluate(async () => {
  try { const r = await fetch('manifest.webmanifest', { cache: 'no-store' });
        return (r.headers.get('content-type') || '').split(';')[0]; }
  catch (e) { return String(e); }
});
dire(tipoManifesto === 'application/manifest+json', 'il manifesto arriva come ' + tipoManifesto);

console.log('\n5. le righe nell\'intestazione della pagina');
const testa = await p.evaluate(() => {
  const m = {};
  document.querySelectorAll('meta[name]').forEach(e => { m[e.name] = e.content; });
  return { metas: m,
           manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href') || null,
           iconaApple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || null,
           misuraApple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('sizes') || null,
           quanteApple: document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').length,
           titolo: document.title };
});
dire(testa.manifest === 'manifest.webmanifest', 'link al manifesto: ' + testa.manifest);
dire(testa.iconaApple !== null, 'apple-touch-icon: ' + testa.iconaApple);
dire(testa.misuraApple === '180x180', 'con la misura dichiarata: ' + (testa.misuraApple || 'MANCA'));
dire(testa.quanteApple >= 1, `righe apple-touch-icon nella pagina: ${testa.quanteApple}`);
dire(/viewport-fit=cover/.test(testa.metas.viewport || ''), 'viewport con viewport-fit=cover (serve per il notch e la barra di casa)');
dire(testa.metas['theme-color'] === man.theme_color,
     `colore della barra: pagina ${testa.metas['theme-color']} e manifesto ${man.theme_color}` );
dire(testa.metas['apple-mobile-web-app-capable'] === 'yes', 'apple-mobile-web-app-capable: ' + (testa.metas['apple-mobile-web-app-capable'] || 'MANCA'));
dire(testa.metas['mobile-web-app-capable'] === 'yes', 'mobile-web-app-capable (la riga moderna, quella di Android): ' + (testa.metas['mobile-web-app-capable'] || 'MANCA'));
dire(!!testa.metas['apple-mobile-web-app-title'], 'nome sotto l\'icona su iPhone: ' + (testa.metas['apple-mobile-web-app-title'] || 'MANCA'));
dire(!!testa.metas['apple-mobile-web-app-status-bar-style'], 'stile della barra di stato iPhone: ' + (testa.metas['apple-mobile-web-app-status-bar-style'] || 'MANCA'));

console.log('\n6. la schermata di apertura');
const colorePagina = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
const atteso = man.background_color.toLowerCase();
const rgb = colorePagina.match(/\d+/g);
const esadecimale = rgb ? '#' + rgb.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : '';
dire(esadecimale === atteso,
     `background_color ${man.background_color} e sfondo vero della pagina ${esadecimale}`
     + (esadecimale === atteso ? ': l\'apertura non lampeggia' : ': all\'apertura si vede un lampo di colore diverso'));

// ------------------------------------------------------------------
console.log('\n7. a schermo pieno, senza la barra del browser');
const spazi = await p.evaluate(() => {
  const nav = document.getElementById('barra-basso');
  const toast = document.getElementById('toast');
  const main = document.getElementById('main-container');
  const eraNascosto = toast.classList.contains('hidden');
  toast.classList.remove('hidden'); toast.classList.add('flex');
  const nb = nav.getBoundingClientRect();
  const st = getComputedStyle(toast);
  const r = { navAltezza: nb.height,
              navPad: getComputedStyle(nav).paddingBottom,
              navUsaEnv: (nav.getAttribute('style') || '').includes('safe-area-inset-bottom'),
              toastBasso: st.bottom,
              // env() nello stile gia' calcolato non si vede piu': il browser lo
              // ha risolto, e qui sul computer vale zero. La regola la si va a
              // leggere nel foglio di stile, dove e' ancora scritta.
              toastUsaEnv: (() => {
                for (const foglio of document.styleSheets) {
                  let regole; try { regole = foglio.cssRules; } catch (e) { continue; }
                  for (const r of regole) {
                    // Attenzione: nei browser nuovi ogni regola ha una lista di
                    // regole annidate, quasi sempre vuota. Se si scende li'
                    // dentro e basta, la regola stessa non la si guarda mai.
                    const dentro = [r, ...(r.cssRules ? [...r.cssRules] : [])];
                    for (const x of dentro)
                      if (x.selectorText === '#toast' && (x.style?.bottom || '').includes('safe-area-inset-bottom')) return true;
                  }
                }
                return (toast.getAttribute('style') || '').includes('safe-area-inset-bottom');
              })(),
              mainPad: getComputedStyle(main).paddingBottom,
              sbordo: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  if (eraNascosto) { toast.classList.add('hidden'); toast.classList.remove('flex'); }
  return r;
});
const BARRA_CASA = 34;   // la barra di casa dell'iPhone, in punti
dire(spazi.navUsaEnv, 'la barra in basso tiene conto della barra di casa dell\'iPhone');
const altezzaVera = spazi.navAltezza + BARRA_CASA;
dire(parseFloat(spazi.mainPad) >= altezzaVera,
     `spazio sotto il contenuto ${spazi.mainPad} contro ${altezzaVera}px di barra + barra di casa`);
const toastBasso = parseFloat(spazi.toastBasso);
const toastSalvo = spazi.toastUsaEnv ? toastBasso + BARRA_CASA >= altezzaVera : toastBasso >= altezzaVera;
dire(toastSalvo,
     `il messaggio di servizio sta a ${toastBasso}px dal fondo`
     + (spazi.toastUsaEnv ? ` piu' la barra di casa` : '') + `, la barra in basso ne occupa ${altezzaVera}: `
     + (toastSalvo ? 'resta sopra' : 'su iPhone ci finisce sopra'));
dire(spazi.sbordo === 0, `nessuno sbordo in larghezza (${spazi.sbordo}px)`);

// ------------------------------------------------------------------
console.log('\n8. installata e senza campo: si apre lo stesso');
await p.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 });
const inCache = await p.evaluate(async (elenco) => {
  const nomi = await caches.keys();
  const c = await caches.open(nomi.find(n => n.startsWith('taximanager')) || nomi[0]);
  const dentro = [];
  for (const f of elenco) dentro.push([f, !!(await c.match(f))]);
  return { cache: nomi, dentro };
}, ['./index.html', './manifest.webmanifest', ...man.icons.map(i => i.src), './icona-iphone-180-2.png']);
for (const [f, c] of inCache.dentro) dire(c, `${f.replace('./', '')} ${c ? 'salvato sul telefono' : 'NON salvato: senza campo manca'}`);

offline = true;
const p2 = await ctx.newPage();
const indirizzoAvvio = new URL(man.start_url, SITO + '/').href;
await p2.goto(indirizzoAvvio).catch(() => {});
const viva = await p2.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 }).then(() => true).catch(() => false);
dire(viva, viva ? 'senza campo lo start_url apre l\'app, non la pagina di errore' : 'senza campo lo start_url non apre l\'app');
const manOffline = await p2.evaluate(async () => {
  try { const r = await fetch('./manifest.webmanifest'); return r.ok; } catch (e) { return false; }
});
dire(manOffline, manOffline ? 'anche il manifesto si legge senza campo' : 'senza campo il manifesto non si legge');
offline = false;

// ------------------------------------------------------------------
// IL CASO CHE HA FATTO COMPARIRE LA LETTERA AL POSTO DEL TAXI
// Il service worker rispondeva con la pagina dell'app a QUALUNQUE navigazione
// dentro la sua cartella, compresa quella verso un file. Chiedendo l'icona
// arrivava index.html; chiedendo il manifesto, pure. Nessuno apre a mano
// l'indirizzo di un'icona - ma l'iPhone lo fa, quando si tocca «Aggiungi alla
// schermata Home»: riceveva una pagina HTML al posto dell'icona e del
// manifesto, non poteva usare ne' l'una ne' l'altro, e si disegnava da solo un
// quadrato con la lettera iniziale. Da dentro l'app non si vedeva niente:
// l'app funzionava benissimo. Qui si va a quegli indirizzi come ci va il
// telefono, e si guarda che cosa arriva.
console.log('\n8bis. andando all\'indirizzo di un file arriva il file, non l\'app');
for (const dove of [...man.icons.map(i => i.src), './icona-iphone-180-2.png', './manifest.webmanifest']) {
  const risposta = await p2.goto(new URL(dove, SITO + '/').href);
  const tipo = (risposta && risposta.headers()['content-type']) || '';
  const buono = !/text\/html/.test(tipo);
  dire(buono, `${dove.replace('./', '')}: arriva ${tipo || 'niente'}`
       + (buono ? '' : ' - al telefono arriva la pagina dell\'app al posto del file'));
}
// e una pagina vera deve continuare ad aprire l'app
const paginaVera = await p2.goto(SITO + '/index.html');
dire(/text\/html/.test(paginaVera.headers()['content-type'] || ''),
     'index.html: apre ancora l\'app');

// CON UNA CODA NELL'INDIRIZZO
// L'iPhone si tiene in memoria l'icona che ha gia' costruito per un
// indirizzo: per fargliela rifare si rimette l'app sulla Home da
// index.html?v=146. Quella coda non deve rompere niente - ne' l'apertura, ne'
// il funzionamento senza campo (il service worker deve guardare il percorso,
// non l'indirizzo intero), ne' i dati, che sono gli stessi perche' il sito e'
// lo stesso.
const conCoda = await p2.goto(SITO + '/index.html?v=' + Date.now());
dire(/text\/html/.test(conCoda.headers()['content-type'] || ''), 'index.html con una coda: apre l\'app');
offline = true;
await p2.goto(SITO + '/index.html?v=senzacampo').catch(() => {});
const vivaConCoda = await p2.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 })
  .then(() => true).catch(() => false);
dire(vivaConCoda, vivaConCoda ? 'e si apre anche senza campo' : 'con la coda, senza campo l\'app non si apre');
offline = false;
await p2.close();

// ------------------------------------------------------------------
// LA PAGINA E LA COPIA SALVATA DEVONO DIRE LO STESSO NUMERO
// A servire i file dell'app - la pagina, le icone, il manifesto - non e' la
// pagina: e' il service worker. Se e' rimasto indietro, l'app che si vede e'
// aggiornata e quello che il telefono serve a se' stesso no, e i difetti
// diventano impossibili da capire. Qui si controlla che le due coincidano, e
// che il service worker sappia rispondere a chi gliel'ha chiesto.
console.log('\n8ter. la pagina e la copia salvata sono la stessa versione');
const versioni = await p.evaluate(async () => {
  const attivo = navigator.serviceWorker && navigator.serviceWorker.controller;
  const dalSW = await new Promise((risolvi) => {
    if (!attivo) return risolvi(null);
    const canale = new MessageChannel();
    const scadenza = setTimeout(() => risolvi(null), 4000);
    canale.port1.onmessage = (e) => { clearTimeout(scadenza); risolvi((e.data && e.data.versione) || null); };
    attivo.postMessage({ tipo: 'CHE_VERSIONE' }, [canale.port2]);
  });
  return { pagina: window.VERSIONE_APP || null, copia: dalSW };
});
const numeroSW = versioni.copia ? String(versioni.copia).replace('taximanager-v', '') : null;
dire(numeroSW !== null, 'il service worker risponde a «che versione sei?»: ' + (versioni.copia || 'NON RISPONDE'));

// Il numero della pagina si legge nel file: dentro la pagina e' una costante
// che non sta su window.
const numeroPagina = (fs.readFileSync(join(RADICE, 'index.html'), 'utf8')
  .match(/const VERSIONE_APP = (\d+);/) || [])[1] || null;
dire(numeroPagina !== null && numeroSW === numeroPagina,
     `pagina v${numeroPagina} e copia salvata v${numeroSW}`
     + (numeroSW === numeroPagina ? ': allineate' : ' - NON allineate: ricordati di cambiarle tutte e due'));

// ------------------------------------------------------------------
// IL CONTROLLO CHE GIRA SUL TELEFONO
// Queste prove girano su un computer, e un computer non e' un iPhone: quando
// l'icona della schermata Home e' uscita sbagliata non c'era modo di sapere
// che cosa arrivasse al telefono. Il tasto «Controlla i file
// dell'installazione» (in Gestione) chiede manifesto e icone uno per uno da
// dentro l'app, sul dispositivo che ha il problema. Qui si controlla che quel
// tasto funzioni: se si rompe lui, si resta di nuovo ciechi.
console.log('\n8quater. il controllo che l\'app fa su se stessa');
await p.evaluate(() => { switchTab('cloud'); renderContent(); });
await p.evaluate(() => controllaInstallazione());
await p.waitForFunction(() => window.esitoInstallazione && window.esitoInstallazione !== 'in corso', { timeout: 30000 });
const suoEsito = await p.evaluate(() => ({
  dichiarata: window.esitoInstallazione.dichiarata,
  righe: window.esitoInstallazione.righe.map(r => ({ nome: r.nome, buona: r.buona, riga: r.riga }))
}));
dire(suoEsito.righe.length >= 4, `file controllati dall'app: ${suoEsito.righe.length}`);
for (const r of suoEsito.righe) dire(r.buona, `${r.nome}: ${r.riga}`);
dire(suoEsito.dichiarata === testa.iconaApple,
     `l'app sa quale icona dichiara: ${suoEsito.dichiarata}`);

// ------------------------------------------------------------------
// DUE STRADE, UNA PER TELEFONO
// Android installa leggendo il manifesto; l'iPhone ha le sue righe apple-*,
// che dicono la stessa cosa. Quando ci sono tutte e due l'iPhone sceglie il
// manifesto, e con questa app sceglieva male: l'icona nella condivisione si
// vedeva, quella sulla schermata Home no. Qui si controlla che il manifesto
// venga agganciato dove serve e NON dove fa danno, e che sull'iPhone restino
// tutte le righe che sostituiscono quello che il manifesto avrebbe detto.
console.log('\n8quinquies. il manifesto si aggancia solo dove serve');
dire(testa.manifest === 'manifest.webmanifest', 'su un browser normale il manifesto c\'e\': ' + testa.manifest);

const finto = await b.newContext({
  viewport: { width: 390, height: 844 }, locale: 'it-IT', isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
});
const pi = await finto.newPage();
await pi.goto(SITO + '/index.html');
await pi.waitForFunction(() => typeof window.switchTab === 'function', { timeout: 20000 });
const suIphone = await pi.evaluate(() => {
  const m = {};
  document.querySelectorAll('meta[name]').forEach(e => { m[e.name] = e.content; });
  return {
    manifesto: !!document.querySelector('link[rel="manifest"]'),
    icona: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || null,
    misura: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('sizes') || null,
    aTuttoSchermo: m['apple-mobile-web-app-capable'],
    nome: m['apple-mobile-web-app-title'],
    colore: m['theme-color'],
    barra: m['apple-mobile-web-app-status-bar-style'],
    viva: typeof window.switchTab === 'function'
  };
});
dire(suIphone.manifesto === false, 'con l\'iPhone il manifesto NON viene agganciato');
dire(suIphone.icona !== null && suIphone.misura === '180x180', `e resta l'icona di Apple: ${suIphone.icona} (${suIphone.misura})`);
dire(suIphone.aTuttoSchermo === 'yes', 'a tutto schermo: apple-mobile-web-app-capable = ' + suIphone.aTuttoSchermo);
dire(!!suIphone.nome, 'nome sotto l\'icona: ' + suIphone.nome);
dire(!!suIphone.barra, 'stile della barra di stato: ' + suIphone.barra);
dire(suIphone.colore === man.theme_color, 'colore della barra: ' + suIphone.colore);
dire(suIphone.viva, 'e l\'app funziona lo stesso');
await finto.close();

// ------------------------------------------------------------------
console.log('\n9. lamentele del browser');
const serie = lamentele.filter(t => !/favicon|firebase|gstatic|net::ERR/i.test(t));
dire(serie.length === 0, serie.length === 0 ? 'nessun errore in console' : 'errori: ' + serie.slice(0, 3).join(' | '));

await b.close();
server.close();
console.log(`\nfine: ${guai === 0 ? 'tutto a posto, si installa come una vera app' : guai + ' cose da sistemare'}`);
