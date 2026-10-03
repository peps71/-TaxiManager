// La «prossima» deve essere la piu' VICINA, non la piu' lontana.
// Questa prova nasce da un errore vero: una sostituzione in blocco di
// .sort(perData) aveva girato l'ordine al contrario.
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
const b = await chromium.launch();
const p = await b.newPage({ locale: 'it-IT' });
p.on('dialog', d => d.accept());
await p.goto(APP);
await p.waitForFunction(() => typeof window.switchTab === 'function');
const r = await p.evaluate(() => {
  const oggi = oggiISO();
  const piu = (g) => { const d = new Date(oggi + 'T12:00:00'); d.setDate(d.getDate() + g);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  window.scadenze = [
    { id:'s1', nome:'Revisione',    data: piu(200), cadenza:'anno', ancora: piu(200) },
    { id:'s2', nome:'Assicurazione',data: piu(12),  cadenza:'anno', ancora: piu(12)  },
    { id:'s3', nome:'Bollo',        data: piu(90),  cadenza:'anno', ancora: piu(90)  },
    { id:'s4', nome:'Tassametro',   data: piu(-30), cadenza:'anno', ancora: piu(-30) }
  ];
  window.dailyRecords = []; window.shifts = [];
  const st = statoScadenze();
  return {
    prossima: st.prossima && st.prossima.nome,
    giorni: st.prossima && st.prossima.giorniMancanti,
    vicine: (st.vicine || []).map(v => v.nome),
    scadute: (st.scadute || []).map(v => v.nome)
  };
});
const prova = (nome, bene, visto) => console.log(`  ${bene ? 'ok ' : '***'} ${nome}${bene ? '' : '  *** SBAGLIATO: ' + visto + ' ***'}`);
prova('la prossima e\' l\'Assicurazione (fra 12 giorni)', r.prossima === 'Assicurazione' && r.giorni === 12, `${r.prossima} fra ${r.giorni}`);
prova('fra le vicine (<=30 gg) c\'e\' solo l\'Assicurazione', JSON.stringify(r.vicine) === '["Assicurazione"]', JSON.stringify(r.vicine));
prova('fra le scadute c\'e\' il Tassametro', r.scadute.includes('Tassametro'), JSON.stringify(r.scadute));
console.log(`\n  (ordine letto: prossima ${r.prossima}, vicine ${JSON.stringify(r.vicine)}, scadute ${JSON.stringify(r.scadute)})`);
await b.close();
