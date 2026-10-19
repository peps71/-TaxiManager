// IL LOGO, DALL'IMMAGINE ALLA STRISCIA E RITORNO
// Il giro intero, come lo fa chi lo usa: scegli un file, lo vedi subito in
// cima, salvi la scheda, lo ritrovi nel backup, riapri l'app ed e' ancora li',
// lo togli e torna il taxi disegnato.
// Due cose che si controllano apposta, perche' sbagliate non si vedono:
//   - la trasparenza deve sopravvivere (il compressore delle foto fa JPEG e
//     la ucciderebbe, mettendo il logo dentro un rettangolo bianco);
//   - salvando la scheda il logo non deve sparire (non e' un campo di testo:
//     se non lo si raccoglie a mano, il salvataggio lo cancella).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = 'file://' + join(RADICE, 'index.html');
const DOVE_PW = process.env.PLAYWRIGHT || [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  join(RADICE, 'node_modules/playwright/index.mjs')
].find(existsSync);
if (!DOVE_PW) { console.error('Playwright non trovato'); process.exit(2); }
const { chromium } = await import(DOVE_PW);

let guai = 0;
const ok = (c, testo, dettaglio) => {
  if (!c) guai++;
  console.log(`  ${c ? 'ok  ' : '*** '}${testo}${dettaglio ? '  (' + dettaglio + ')' : ''}${c ? '' : ' ***'}`);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'it-IT' });
p.on('dialog', d => d.accept());
const errori = [];
p.on('pageerror', e => errori.push(e.message));
await p.goto(APP);
await p.evaluate(() => localStorage.clear());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

// Un «logo» finto ma realistico: grande, con un buco trasparente in mezzo e
// l'inchiostro scuro, come sono fatti i loghi veri.
const FINTO = `
window.__finto = function (larghezza, altezza) {
  const c = document.createElement('canvas');
  c.width = larghezza; c.height = altezza;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1a1a';
  g.fillRect(0, 0, larghezza, altezza);
  g.clearRect(larghezza * 0.3, altezza * 0.3, larghezza * 0.4, altezza * 0.4);  // il buco
  return new Promise(r => c.toBlob(bl => r(new File([bl], 'logo.png', { type: 'image/png' })), 'image/png'));
};
window.__mettiFile = async function (sel, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.querySelector(sel);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
window.__trasparenzaDi = async function (dataUri) {
  const img = new Image(); img.src = dataUri; await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let trasp = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 128) trasp++;
  return { larghezza: c.width, altezza: c.height, trasparenti: trasp, totali: c.width * c.height };
};
`;
await p.evaluate(FINTO);

// ------------------------------------------------------------------
console.log('\n1. SI SCEGLIE UN\'IMMAGINE E SI VEDE SUBITO');
// ------------------------------------------------------------------
await p.evaluate(() => { switchTab('cloud'); renderContent(); });
await p.waitForTimeout(150);
const cEra = await p.evaluate(() => !!document.querySelector('input[type="file"][accept="image/*"]'));
ok(cEra, 'il comando per scegliere l\'immagine c\'e\'');

const scelto = await p.evaluate(async () => {
  const f = await window.__finto(900, 300);           // ben piu' grande del massimo
  await window.__mettiFile('input[type="file"][accept="image/*"]', f);
  await new Promise(r => setTimeout(r, 600));
  const logo = window.logoAttuale();
  const img = document.getElementById('logo-in-cima');
  const taxi = document.getElementById('taxi-in-cima');
  return {
    lungo: logo.length,
    tipo: logo.slice(0, 20),
    inCimaVisibile: img && !img.classList.contains('hidden'),
    taxiNascosto: taxi && taxi.classList.contains('hidden'),
    srcUguale: img && img.getAttribute('src') === logo,
    salvatoGia: !!(window.profilo || {}).logo
  };
});
ok(scelto.lungo > 100, 'l\'immagine e\' stata letta e compressa', `${Math.round(scelto.lungo/1024)} KB`);
ok(/^data:image\/(webp|png)/.test(scelto.tipo), 'e\' un formato che tiene la trasparenza', scelto.tipo);
ok(scelto.inCimaVisibile && scelto.taxiNascosto, 'in cima il logo ha preso il posto del taxi disegnato');
ok(scelto.srcUguale, 'ed e\' proprio quello scelto');
ok(!scelto.salvatoGia, 'ma nella scheda non e\' ancora salvato: prima si conferma');

// ------------------------------------------------------------------
console.log('\n2. LA TRASPARENZA E IL PESO');
// ------------------------------------------------------------------
const forma = await p.evaluate(() => window.__trasparenzaDi(window.logoAttuale()));
ok(forma.trasparenti > forma.totali * 0.05,
   'il buco trasparente c\'e\' ancora dopo la compressione',
   `${Math.round(100*forma.trasparenti/forma.totali)}% trasparente`);
ok(forma.altezza <= 128 && forma.larghezza <= 512,
   'e\' stato rimpicciolito a una misura da striscia', `${forma.larghezza}x${forma.altezza}`);
const peso = await p.evaluate(() => window.logoAttuale().length);
ok(peso <= 60 * 1024, 'sta nel peso massimo', `${Math.round(peso/1024)} KB su 60`);

// ------------------------------------------------------------------
console.log('\n3. SI SALVA LA SCHEDA E IL LOGO NON SPARISCE');
// ------------------------------------------------------------------
const dopoSalva = await p.evaluate(async () => {
  document.getElementById('prof-nome').value = 'Giuseppe';
  document.getElementById('prof-sigla').value = 'Livorno 71';
  salvaProfiloDalModulo();
  await new Promise(r => setTimeout(r, 200));
  return {
    nelProfilo: !!(window.profilo || {}).logo,
    lungo: ((window.profilo || {}).logo || '').length,
    suDisco: !!(JSON.parse(localStorage.getItem('taxi_profilo') || '{}').logo)
  };
});
ok(dopoSalva.nelProfilo, 'salvando la scheda il logo resta', `${Math.round(dopoSalva.lungo/1024)} KB`);
ok(dopoSalva.suDisco, 'ed e\' finito su disco insieme al resto della scheda');

// ------------------------------------------------------------------
console.log('\n4. VIAGGIA NEL BACKUP E NELL\'ESPORTAZIONE');
// ------------------------------------------------------------------
const nelBackup = await p.evaluate(() => {
  const pacco = window.datiDaSalvare ? window.datiDaSalvare() : null;
  return pacco ? { c: !!(pacco.profilo && pacco.profilo.logo) } : null;
});
if (nelBackup === null) {
  // il costruttore del pacco non e' esposto: si guarda il profilo, che e' cio'
  // che il pacco mette dentro
  const viaProfilo = await p.evaluate(() => !!(window.profilo || {}).logo);
  ok(viaProfilo, 'il logo sta nel profilo, che e\' quello che il backup porta con se\'');
} else {
  ok(nelBackup.c, 'il logo e\' dentro il pacco del backup');
}

// ------------------------------------------------------------------
console.log('\n5. RIAPRENDO L\'APP E\' ANCORA LI\'');
// ------------------------------------------------------------------
await p.reload();
await p.waitForFunction(() => typeof window.switchTab === 'function');
await p.evaluate(FINTO);
const dopoRiapertura = await p.evaluate(() => {
  const img = document.getElementById('logo-in-cima');
  const taxi = document.getElementById('taxi-in-cima');
  return {
    nelProfilo: !!(window.profilo || {}).logo,
    visibile: img && !img.classList.contains('hidden'),
    taxiNascosto: taxi && taxi.classList.contains('hidden'),
    conSrc: img && (img.getAttribute('src') || '').indexOf('data:image') === 0
  };
});
ok(dopoRiapertura.nelProfilo, 'il logo e\' ancora nella scheda');
ok(dopoRiapertura.visibile && dopoRiapertura.taxiNascosto && dopoRiapertura.conSrc,
   'e si rivede in cima appena si apre l\'app');

// ------------------------------------------------------------------
console.log('\n6. SI PUO\' TOGLIERE');
// ------------------------------------------------------------------
const tolto = await p.evaluate(async () => {
  switchTab('cloud'); renderContent();
  await new Promise(r => setTimeout(r, 150));
  togliLogo();
  salvaProfiloDalModulo();
  await new Promise(r => setTimeout(r, 200));
  const img = document.getElementById('logo-in-cima');
  const taxi = document.getElementById('taxi-in-cima');
  return {
    viaDallaScheda: !((window.profilo || {}).logo),
    imgNascosta: img && img.classList.contains('hidden'),
    senzaSrc: img && !img.getAttribute('src'),
    taxiTornato: taxi && !taxi.classList.contains('hidden'),
    nomeRimasto: ((window.profilo || {}).nome || '')
  };
});
ok(tolto.viaDallaScheda, 'tolto dalla scheda');
ok(tolto.imgNascosta && tolto.senzaSrc, 'l\'immagine sparisce davvero, non resta appesa');
ok(tolto.taxiTornato, 'e torna il taxi disegnato');
ok(tolto.nomeRimasto === 'Giuseppe', 'togliendo il logo il resto della scheda non si tocca', tolto.nomeRimasto);

// ------------------------------------------------------------------
console.log('\n7. IL GIRO COMPLETO DEL BACKUP: ESCE E RIENTRA');
// ------------------------------------------------------------------
// Questo e' il controllo che mancava, ed e' quello che ha trovato il buco:
// il ripristino filtra i campi della scheda con un elenco, e «logo» non
// c'era. Il logo finiva nel file e veniva buttato via al rientro, in
// silenzio. Fare il giro intero e' l'unico modo per accorgersene.
const giro = await p.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 120;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 400, 120);
  const logo = c.toDataURL('image/png');
  window.profilo = { nome: 'Giuseppe', cognome: 'Rossi', sigla: 'Livorno 71', licenza: '', piva: '', colore: '', logo };
  const pacco = window.datiDaSalvare();
  const nelFile = !!(pacco.profilo && pacco.profilo.logo);
  // si riparte da zero e si rientra dal file, come fa un ripristino vero
  window.profilo = { nome: '', cognome: '', licenza: '', sigla: '', colore: '', piva: '', logo: '' };
  await window.applicaBackup(JSON.parse(JSON.stringify(pacco)));
  return { nelFile, tornato: !!(window.profilo || {}).logo, uguale: (window.profilo || {}).logo === logo };
});
ok(giro.nelFile, 'il logo esce nel file del backup');
ok(giro.tornato, 'e rientra ripristinando quel file');
ok(giro.uguale, 'ed e\' identico a quello che era uscito');

// Un file confezionato male non deve poter appendere quello che vuole
const sporco = await p.evaluate(async () => {
  const pacco = window.datiDaSalvare();
  pacco.profilo = Object.assign({}, pacco.profilo, { logo: 'javascript:alert(1)' });
  await window.applicaBackup(JSON.parse(JSON.stringify(pacco)));
  const a = (window.profilo || {}).logo || '';
  const pacco2 = window.datiDaSalvare();
  pacco2.profilo = Object.assign({}, pacco2.profilo, { logo: 'data:text/html;base64,' + 'A'.repeat(100) });
  await window.applicaBackup(JSON.parse(JSON.stringify(pacco2)));
  const b = (window.profilo || {}).logo || '';
  return { conCopione: a, conPagina: b };
});
ok(sporco.conCopione === '', 'un «logo» che e\' un copione viene scartato', `«${sporco.conCopione}»`);
ok(sporco.conPagina === '', 'un «logo» che e\' una pagina viene scartato', `«${sporco.conPagina.slice(0,24)}»`);

ok(errori.length === 0, 'nessun errore JS in tutto il giro', errori.slice(0,2).join(' | ') || 'nessuno');

await b.close();
console.log(`\n  ${guai === 0 ? 'tutto a posto' : guai + ' controlli falliti'}`);
process.exit(guai ? 1 : 0);
