// LE FOTO ALLEGATE ALLE NOTE
// Lo scontrino, il danno, il documento. Qui si prova il giro vero dai tasti:
// si sceglie una foto grande come quelle del telefono, si controlla che venga
// rimpicciolita PRIMA di salvarla, che finisca nel magazzino grande e non fra
// i dati dei conti, che compaia sotto la nota e sotto la giornata, che il file
// di backup resti leggero, e che quando la nota se ne va se ne vada anche lei.
// E la cosa che conta piu' di tutte: che non sposti di un centesimo nessun
// numero dell'app.
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

let ok = 0; const ko = [];
const c = (nome, vero) => { if (vero) ok++; else ko.push(nome); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 1200 }, locale: 'it-IT' });
const erroriJS = []; p.on('pageerror', e => erroriJS.push(e.message));
p.on('dialog', d => d.accept());
await p.goto(APP);
// Si parte puliti: le prove di prima lasciano il magazzino pieno.
await p.evaluate(async () => {
  localStorage.clear();
  await new Promise(r => { const q = indexedDB.deleteDatabase('taxi_foto'); q.onsuccess = r; q.onerror = r; q.onblocked = r; });
});
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');

// Il permesso di tenere il magazzino: qui si guarda che venga CHIESTO. Se poi
// il browser lo conceda e' affare suo - senza un telefono vero e senza un'app
// aggiunta alla Home, headless dice sempre di no, e non e' un difetto.
await p.evaluate(() => {
  window.permessoFotoChiesto = false;
  if (navigator.storage && navigator.storage.persist) {
    const prima = navigator.storage.persist.bind(navigator.storage);
    navigator.storage.persist = () => { window.permessoFotoChiesto = true; return prima(); };
  }
});

const ANNO = String(new Date().getFullYear());
const G = `${ANNO}-03-10`;
await p.evaluate(({ anno, g }) => {
  window.vociFisse = [{ slug: 'r', nome: 'Radio taxi', importo: 3151.08, unita: 'anno', tipo: 'scadenza', scadenza: '', dataInizio: '', dataFine: '' }];
  localStorage.setItem('taxi_voci_fisse_avviato', 'si');
  localStorage.setItem('taxi_budget_proposte_no', JSON.stringify(['carburante']));
  window.dailyRecords = [
    { id: 'e1', data: g, tipo: 'ENTRATA', categoria: 'Corsa', metodo: 'POS', importo: 120 },
    { id: 'u1', data: g, tipo: 'USCITA', categoria: 'Carburante', metodo: 'Bonifico', importo: 60 }
  ];
  window.shifts = [{ id: 't1', data: g, turno: 'Le otto', inizio: '08:00', fine: '20:00', ore: 12, lavorato: true, kmTot: 170 }];
  window.scadenze = []; window.veicoli = []; window.note = [];
  window.annoScelto = anno; window.incassoVisibile = true;
  window.versioneDati = (window.versioneDati || 0) + 1;
}, { anno: ANNO, g: G });

const conti = () => p.evaluate((anno) => {
  const st = getStats(); const agg = aggrega(anno); const cong = conguaglioAnno(anno);
  const q = quotaDelGiorno(`${anno}-03-10`);
  return { entrate: st.entrate, uscite: st.uscite, tasse: st.tasse, budget: budgetAnno(anno),
           cong: cong.speso, quota: +q.quota.toFixed(4), corse: agg.nCorse };
}, ANNO);
const prima = await conti();

// Una foto come quelle del telefono: 3000x2000, piena di roba, cosi' il JPEG
// pesa davvero e il rimpicciolimento ha qualcosa da fare.
const grande = await p.evaluate(() => {
  const k = document.createElement('canvas');
  k.width = 3000; k.height = 2000;
  const g = k.getContext('2d');
  const sfuma = g.createLinearGradient(0, 0, 3000, 2000);
  sfuma.addColorStop(0, '#1d4ed8'); sfuma.addColorStop(1, '#f59e0b');
  g.fillStyle = sfuma; g.fillRect(0, 0, 3000, 2000);
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = `hsl(${(i * 37) % 360} 80% ${30 + (i % 50)}%)`;
    g.fillRect((i * 613) % 3000, (i * 271) % 2000, 40 + (i % 90), 30 + (i % 70));
  }
  g.fillStyle = '#fff'; g.font = 'bold 150px sans-serif';
  g.fillText('SCONTRINO 48,30', 180, 1050);
  return k.toDataURL('image/jpeg', 0.92);
});
const bufferFoto = Buffer.from(grande.split(',')[1], 'base64');
console.log(`  foto di partenza: ${Math.round(bufferFoto.length / 1024)} KB, 3000x2000`);
c('la foto di prova e\' grande come una vera (oltre mezzo mega)', bufferFoto.length > 512 * 1024);

// ------------------------------------------------------------------
// 1) si sceglie la foto nel modulo della nota
await p.evaluate(() => { switchTab('note'); renderContent(); });
await p.waitForTimeout(300);
await p.setInputFiles('#nota-foto-campo', { name: 'scontrino.jpg', mimeType: 'image/jpeg', buffer: bufferFoto });
await p.waitForFunction(() => (window.fotoInAttesa || []).length === 1, { timeout: 15000 });

const piccola = await p.evaluate(() => {
  const f = window.fotoInAttesa[0];
  return { byte: f.byte, larghezza: f.larghezza, altezza: f.altezza, inizio: f.jpeg.slice(0, 23) };
});
console.log(`  dopo il rimpicciolimento: ${Math.round(piccola.byte / 1024)} KB, ${piccola.larghezza}x${piccola.altezza}`);
c('la foto viene rimpicciolita sotto il quarto di mega', piccola.byte <= 260 * 1024);
c('il lato lungo scende a 1600 punti', Math.max(piccola.larghezza, piccola.altezza) === 1600);
c('le proporzioni restano quelle', Math.abs(piccola.larghezza / piccola.altezza - 1.5) < 0.01);
c('resta un JPEG', piccola.inizio.startsWith('data:image/jpeg;base64'));
c('pesa molto meno dell\'originale', piccola.byte < bufferFoto.length / 2);

// La miniatura si vede gia' prima di salvare, e si riempie davvero
await p.waitForFunction(() => {
  const i = document.querySelector('img[data-foto^="attesa:"]');
  return i && i.getAttribute('src');
}, { timeout: 10000 });
c('la miniatura compare nel modulo prima di salvare', true);

// 2) e finche' non si salva, nel magazzino non c'e' niente
const vuotoPrima = await p.evaluate(() => fotoTutte().then(v => v.length));
c('finche\' la nota non si salva, il magazzino resta vuoto', vuotoPrima === 0);

// 3) si salva la nota
await p.evaluate(({ g }) => {
  document.getElementById('nota-data').value = g;
  document.getElementById('nota-tipo').value = 'Vettura';
  document.getElementById('nota-testo').value = 'Gomme nuove sull\'anteriore';
  aggiungiNota(new Event('submit'));
}, { g: G });
await p.waitForFunction(() => (window.note || []).length === 1 && (window.note[0].foto || []).length === 1, { timeout: 15000 });

const dopoSalvata = await p.evaluate(async () => {
  const n = window.note[0];
  const tutte = await fotoTutte();
  const salvata = JSON.parse(localStorage.getItem('taxi_note') || '[]')[0];
  return { idFoto: n.foto[0], quante: tutte.length, idMagazzino: tutte[0] && tutte[0].id,
           byteMagazzino: tutte[0] && tutte[0].byte,
           inAttesa: (window.fotoInAttesa || []).length,
           fotoSuDisco: (salvata && salvata.foto) || [],
           pesoNote: (localStorage.getItem('taxi_note') || '').length,
           conto: contoFoto() };
});
c('la nota si porta dietro l\'identificativo della foto', dopoSalvata.fotoSuDisco.length === 1);
c('la foto e\' nel magazzino grande', dopoSalvata.quante === 1 && dopoSalvata.idMagazzino === dopoSalvata.idFoto);
c('il modulo si svuota dopo il salvataggio', dopoSalvata.inAttesa === 0);
c('il conto delle foto e\' aggiornato', dopoSalvata.conto.quante === 1 && dopoSalvata.conto.byte === dopoSalvata.byteMagazzino);
// Il magazzino si chiede di tenerlo: quando lo spazio scarseggia il browser
// puo' svuotarlo senza avvisare.
c('si e\' chiesto al telefono di non buttare via il magazzino',
  await p.evaluate(() => window.permessoFotoChiesto === true));

// 4) QUESTA E' LA PROVA CHE CONTA: nei dati dei conti la foto non entra
c('nelle note su disco non c\'e\' nessuna immagine', !(await p.evaluate(() => (localStorage.getItem('taxi_note') || '').includes('data:image'))));
c('le note su disco restano leggere (sotto 2 KB)', dopoSalvata.pesoNote < 2048);
const nessunaImmagineInLocale = await p.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const v = localStorage.getItem(localStorage.key(i)) || '';
    if (v.includes('data:image')) return localStorage.key(i);
  }
  return null;
});
c('nessuna immagine da nessuna parte in localStorage', nessunaImmagineInLocale === null);

// 5) la miniatura compare nella riga della nota e nella giornata
await p.evaluate(() => { switchTab('note'); renderContent(); });
await p.waitForFunction(() => {
  const i = document.querySelector('#main-container img[data-foto]');
  return i && i.getAttribute('src');
}, { timeout: 10000 });
c('la miniatura si vede nella riga della nota', true);

await p.evaluate((g) => { switchTab('giornata'); applyFilterGiornoGiornate(g); }, G);
await p.waitForTimeout(800);
const nellaGiornata = await p.evaluate(() => document.querySelectorAll('#main-container img[data-foto]').length);
c('la miniatura si vede anche sotto la giornata', nellaGiornata >= 1);

// 6) il visore
await p.evaluate(() => { const i = document.querySelector('#main-container img[data-foto]');
                         if (i) apriFoto(i.getAttribute('data-foto')); });
await p.waitForFunction(() => {
  const v = document.getElementById('visore-foto');
  const i = document.getElementById('visore-foto-img');
  return v && !v.classList.contains('hidden') && i && i.getAttribute('src');
}, { timeout: 10000 });
c('toccandola si apre grande', true);
await p.evaluate(() => chiudiFoto());
c('e si richiude', await p.evaluate(() => document.getElementById('visore-foto').classList.contains('hidden')
                                        && !document.getElementById('visore-foto-img').getAttribute('src')));

// 7) i conti non si sono mossi di un centesimo
const dopo = await conti();
const uguali = Object.keys(prima).every(k => prima[k] === dopo[k]);
c('incassi, uscite, tasse, budget, conguaglio, costo giornata e corse: tutto identico', uguali);
if (!uguali) console.log('    prima', prima, '\n    dopo ', dopo);

// 8) il backup resta leggero e porta l'identificativo, non l'immagine
const backup = await p.evaluate(() => JSON.stringify(datiDaSalvare()));
c('nel backup non c\'e\' nessuna immagine', !backup.includes('data:image'));
c('nel backup la nota porta la sua foto per identificativo', backup.includes(dopoSalvata.idFoto));
c('il backup resta leggero (sotto 20 KB)', backup.length < 20480);
console.log(`  backup: ${Math.round(backup.length / 1024)} KB  ·  foto fuori: ${Math.round(dopoSalvata.byteMagazzino / 1024)} KB`);

// 9) il file delle foto: si scarica, si svuota il magazzino, si rimette
const scarico = p.waitForEvent('download');
await p.evaluate(() => exportFoto());
const file = await scarico;
c('il file delle foto si scarica', /TaxiManager_Foto_\d{4}-\d{2}-\d{2}\.json/.test(file.suggestedFilename()));
const pacco = await p.evaluate(async () => {
  const tutte = await fotoTutte();
  return JSON.stringify({ versione: 1, tipo: 'foto', foto: tutte, date: new Date().toISOString() });
});
await p.evaluate(async () => {
  for (const f of await fotoTutte()) { await fotoCancella(f.id); scordaFoto(f.id); }
});
c('il magazzino si e\' svuotato', (await p.evaluate(() => fotoTutte().then(v => v.length))) === 0);
// con la foto sparita la riga non si rompe: resta il riquadro, senza immagine
await p.evaluate(() => { switchTab('note'); renderContent(); });
await p.waitForTimeout(600);
const senzaFoto = await p.evaluate(() => {
  const i = document.querySelector('#main-container img[data-foto]');
  return { c: !!i, src: i ? i.getAttribute('src') : null, alt: i ? i.alt : null };
});
c('senza la foto la nota si disegna lo stesso', senzaFoto.c && !senzaFoto.src && /non disponibile/.test(senzaFoto.alt || ''));

await p.evaluate(() => { switchTab('cloud'); renderContent(); });
await p.waitForTimeout(400);
await p.setInputFiles('input[onchange="importFoto(event)"]',
                      { name: 'TaxiManager_Foto.json', mimeType: 'application/json', buffer: Buffer.from(pacco) });
await p.waitForFunction(() => fotoTutte().then(v => v.length === 1), { timeout: 15000 });
c('rimettendo il file le foto tornano al loro posto', true);
c('e tornano con lo stesso identificativo',
  (await p.evaluate(() => fotoTutte().then(v => v[0].id))) === dopoSalvata.idFoto);

// un file confezionato male non deve avere nessuna strada per entrare
for (const finta of ['javascript:void(0)',
                     'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
                     'data:text/html,<script>alert(1)</script>']) {
  await p.setInputFiles('input[onchange="importFoto(event)"]',
                        { name: 'finto.json', mimeType: 'application/json',
                          buffer: Buffer.from(JSON.stringify({ foto: [{ id: 'x' + finta.length, jpeg: finta }] })) });
  await p.waitForTimeout(500);
}
c('tre file confezionati male vengono tutti scartati',
  (await p.evaluate(() => fotoTutte().then(v => v.length))) === 1);

// 10) staccare una foto la porta via dal magazzino
await p.evaluate(() => { switchTab('note'); renderContent(); });
await p.waitForTimeout(400);
await p.evaluate(() => { const n = window.note[0]; staccaFoto(n.id, n.foto[0]); });
await p.waitForFunction(() => (window.note[0].foto || []).length === 0, { timeout: 10000 });
c('staccando la foto la nota resta e la foto se ne va',
  (await p.evaluate(() => fotoTutte().then(v => v.length))) === 0);
c('e il conto torna a zero', (await p.evaluate(() => contoFoto().quante)) === 0);

// 11) eliminando una nota con foto, se ne va anche la foto
await p.setInputFiles('#nota-foto-campo', { name: 'danno.jpg', mimeType: 'image/jpeg', buffer: bufferFoto });
await p.waitForFunction(() => (window.fotoInAttesa || []).length === 1, { timeout: 15000 });
await p.evaluate(({ g }) => {
  document.getElementById('nota-data').value = g;
  document.getElementById('nota-tipo').value = 'Incidente';
  document.getElementById('nota-testo').value = 'Specchietto destro, via Po';
  aggiungiNota(new Event('submit'));
}, { g: G });
await p.waitForFunction(() => (window.note || []).some(n => (n.foto || []).length === 1), { timeout: 15000 });
c('una seconda nota con la sua foto', (await p.evaluate(() => fotoTutte().then(v => v.length))) === 1);
await p.evaluate(() => { const n = window.note.find(x => (x.foto || []).length); eliminaNota(n.id); });
await p.waitForFunction(() => (window.note || []).every(n => !(n.foto || []).length), { timeout: 10000 });
c('eliminando la nota se ne va anche la sua foto',
  (await p.evaluate(() => fotoTutte().then(v => v.length))) === 0);

// 12) e dopo tutto questo giro i conti sono ancora quelli
const finale = await conti();
const ancoraUguali = Object.keys(prima).every(k => prima[k] === finale[k]);
c('dopo tutto il giro i conti sono ancora identici', ancoraUguali);
if (!ancoraUguali) console.log('    prima', prima, '\n    finale', finale);

// 13) il tetto di sei foto per nota
await p.evaluate(() => { window.fotoInAttesa = new Array(6).fill({ jpeg: 'data:image/jpeg;base64,x', byte: 10, larghezza: 1, altezza: 1 }); });
await p.setInputFiles('#nota-foto-campo', { name: 'settima.jpg', mimeType: 'image/jpeg', buffer: bufferFoto });
await p.waitForTimeout(800);
c('oltre le sei foto per nota non si va', (await p.evaluate(() => window.fotoInAttesa.length)) === 6);
await p.evaluate(() => { window.fotoInAttesa = []; });

console.log(`\n${ok} controlli passati` + (ko.length ? `\n*** ${ko.length} FALLITI ***\n  - ` + ko.join('\n  - ') : ''));
console.log('errori JS: ' + (erroriJS.length ? '*** ' + erroriJS.join(' | ') + ' ***' : 'nessuno'));
await b.close();
