/* Rigenera tutte le icone dell'app a partire da icona-sorgente.jpg.
   Uso:  node strumenti/icone.mjs      (serve Playwright con Chromium)
   I file finiscono nella cartella dell'app, accanto a index.html. */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Playwright puo' essere installato qui accanto o a livello di sistema.
const { chromium } = await import('playwright')
  .catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const cartella = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(cartella, 'icona-sorgente.jpg');
const dataUri = 'data:image/jpeg;base64,' + fs.readFileSync(src).toString('base64');

const b = await chromium.launch();
const p = await b.newPage();
await p.setContent('<canvas id="c"></canvas>');

const out = await p.evaluate(async (uri) => {
  const img = new Image();
  img.src = uri;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;

  // 1) trova il riquadro dell'icona (scarta il margine chiaro attorno)
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H).data;
  const at = (i, j) => { const k = (j * W + i) * 4; return [d[k], d[k+1], d[k+2]]; };
  // Il riquadro dell'icona misurato sull'immagine: (157,157) lato 709.
  // Rientro del 5,5% per togliere il bordo dorato e gli angoli arrotondati,
  // cosi' l'icona riempie tutto il quadrato e ci pensa il sistema ad arrotondarla.
  const bordoX = 157, bordoY = 157, bordoLato = 709;
  const rientro = 0.055;
  const lato = bordoLato * (1 - 2 * rientro);
  const sx = bordoX + bordoLato * rientro, sy = bordoY + bordoLato * rientro;

  // Alle misure minime (favicon) si stringe sull'auto, altrimenti non si legge nulla.
  const stretto = 485, sxS = 511 - stretto / 2, syS = 543 - stretto / 2;

  // Il baffo tricolore: una lama curva appoggiata in basso, appuntita alle due
  // estremita' e tagliata in tre per verde, bianco e rosso. Le misure sono
  // frazioni del lato, cosi' viene uguale a 512 come a 32 pixel.
  const baffo = (g, ox, oy, lat) => {
    const P = (fx, fy) => [ox + fx * lat, oy + fy * lat];
    const [ax, ay] = P(0.160, 0.872);   // punta sinistra
    const [bx, by] = P(0.840, 0.872);   // punta destra
    const [csx, csy] = P(0.500, 0.960); // curva di sotto
    const [cix, ciy] = P(0.500, 0.826); // curva di sopra
    const sagoma = new Path2D();
    sagoma.moveTo(ax, ay);
    sagoma.quadraticCurveTo(csx, csy, bx, by);
    sagoma.quadraticCurveTo(cix, ciy, ax, ay);
    sagoma.closePath();
    // un'ombra sottile sotto, perche' stacchi dal selciato
    g.save();
    g.translate(0, lat * 0.008);
    g.fillStyle = 'rgba(8,12,24,0.42)';
    g.fill(sagoma);
    g.restore();
    // verde, bianco, rosso in tre parti uguali
    g.save();
    g.clip(sagoma);
    const colori = ['#009246', '#f1f2f1', '#ce2b37'];
    const da = 0.160 * lat, largo = 0.680 * lat / 3;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = colori[i];
      g.fillRect(ox + da + largo * i, oy, largo + 1, lat);
    }
    g.restore();
  };

  const rendi = (n, dentro) => {
    const k = document.createElement('canvas');
    k.width = n; k.height = n;
    const g = k.getContext('2d');
    g.imageSmoothingQuality = 'high';
    if (dentro) {
      // versione "maskable": l'arte al 78% su se stessa sfocata, cosi' il ritaglio
      // tondo di Android non taglia mai l'auto e non si vede nessun bordo netto.
      g.filter = 'blur(' + Math.round(n / 16) + 'px)';
      g.drawImage(img, sx, sy, lato, lato, -n * 0.12, -n * 0.12, n * 1.24, n * 1.24);
      g.filter = 'none';
      const m = n * 0.78, o = (n - m) / 2;
      g.drawImage(img, sx, sy, lato, lato, o, o, m, m);
      baffo(g, o, o, m);
    } else {
      const zoom = n <= 64;
      g.drawImage(img, zoom ? sxS : sx, zoom ? syS : sy, zoom ? stretto : lato, zoom ? stretto : lato, 0, 0, n, n);
      baffo(g, 0, 0, n);
    }
    return k.toDataURL('image/png');
  };

  return {
    riquadro: [Math.round(sx), Math.round(sy), Math.round(lato)],
    '512': rendi(512), '192': rendi(192), '180': rendi(180),
    '64': rendi(64), '32': rendi(32), '16': rendi(16),
    'mask': rendi(512, true)
  };
}, dataUri);

console.log('riquadro', out.riquadro);
const salva = (nome, chiave) => {
  const dove = path.join(cartella, nome);
  fs.writeFileSync(dove, Buffer.from(out[chiave].split(',')[1], 'base64'));
  console.log(nome, fs.statSync(dove).size + ' byte');
};
salva('icon-512.png', '512');
salva('icon-192.png', '192');
salva('apple-touch-icon-180.png', '180');
salva('favicon-32.png', '32');
salva('favicon-16.png', '16');
salva('icon-512-maskable.png', 'mask');

// favicon.ico: un PNG 32x32 dentro il contenitore ICO
const png = Buffer.from(out['32'].split(',')[1], 'base64');
const ico = Buffer.alloc(22 + png.length);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 32; ico[7] = 32; ico[8] = 0; ico[9] = 0;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
png.copy(ico, 22);
fs.writeFileSync(path.join(cartella, 'favicon.ico'), ico);
console.log('favicon.ico', ico.length + ' byte');

await b.close();
