// Cerca testo tagliato e sbordi orizzontali su piu' larghezze, su tutte le
// schermate. I testi accorciati apposta con i puntini non contano.
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
const U = APP;
for (const w of [320, 375, 390, 768, 820, 1024, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, locale: 'it-IT' });
  await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.goto(U);
  await p.waitForFunction(() => typeof window.switchTab === 'function');
  await p.evaluate(() => {
    const rec = [], tur = [];
    for (let g = 1; g <= 28; g++) {
      const d = `2026-10-${String(g).padStart(2,'0')}`;
      // Con il contachilometri vero: senza, meta' del Parco Auto non si
      // disegna - niente km percorsi, niente costo al chilometro, niente
      // conto alla rovescia della manutenzione - e quello che non si
      // disegna non si puo' nemmeno misurare.
      tur.push({ id:'t'+g, data:d, turno:'Le otto', inizio:'08:00', fine:'20:00', ore:12, lavorato:true,
                 kmInizio: 242000 + (g-1)*180, kmFine: 242000 + g*180, kmTot:180 });
      for (let c = 0; c < 6; c++) rec.push({ id:`e${g}_${c}`, data:d, tipo:'ENTRATA', categoria:'Corsa', metodo:['Contanti','POS','Satispay','App/Nexi','Conto','Contanti'][c], importo: 28.75+c*7, ora:'1'+c+':00' });
      rec.push({ id:`u${g}`, data:d, tipo:'USCITA', categoria:'Carburante', metodo:'Carta Carburante', importo: 55, fattura:true });
    }
    window.dailyRecords = rec; window.shifts = tur; window.annoScelto = '2026';
    // UNA VETTURA, PERCHE' SENZA LA SCHEDA DEL PARCO AUTO E' VUOTA
    // La schermata si misurava da quando esiste, ma senza vetture mostrava
    // solo «nessuna vettura»: la scheda con i conti, e da adesso il riquadro
    // della manutenzione programmata, non le ha mai viste nessuno.
    window.veicoli = [{ id:'ve1', modello:'Skoda Octavia Wagon 2.0 TDI', targa:'GP711XX',
                        anno:'2019', alimentazione:'Diesel', dataAcquisto:'2024-01-10',
                        kmAcquisto:180000, prezzoAcquisto:28000, uscita:'in-uso',
                        dataUscita:'', valoreStimato:12000, note:'' }];

    // UN LOGO, PERCHE' SENZA NON SI PROVAVA MEZZA TESTATA
    // Il logo e' arrivato nella v161 e questa prova non lo metteva mai: con
    // il taxi disegnato, largo 32, nel menu ci stava tutto. Con un logo vero
    // - una targhetta con dentro una scritta - il titolo usciva dal menu di
    // settantasei punti, e nessuno se n'e' accorto fino a che non si e'
    // visto su un Mac. Qui se ne mette uno largo, come sono quelli veri.
    const tela = document.createElement('canvas');
    tela.width = 520; tela.height = 130;
    const g2 = tela.getContext('2d');
    g2.fillStyle = '#111'; g2.fillRect(0, 0, 520, 130);
    g2.fillStyle = '#fff'; g2.font = 'bold 54px sans-serif';
    g2.fillText('TAXI TORINO 37', 18, 86);
    window.profilo = { nome: 'Giuseppe', cognome: 'Laviano', sigla: 'Torino 37', licenza: '', piva: '', colore: 'verde', logo: tela.toDataURL('image/png') };
    localStorage.setItem('taxi_profilo', JSON.stringify(window.profilo));
    renderNav();
  });
  const schede = ['dashboard','giornata','uscite','auto','scadenze','rendimento','categorie','report','versamenti','note','cloud'];
  const problemi = [];
  for (const t of schede) {
    await p.evaluate(x => { switchTab(x); }, t);
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const doc = document.documentElement;
      const sbordo = doc.scrollWidth - doc.clientWidth;
      let tagliati = 0; const nomi = [];
      // h1 e h2 mancavano dall'elenco: il titolo del menu e' un h1, e quindi
      // non lo guardava nessuno.
      document.querySelectorAll('div, p, span, td, button, h1, h2, h3, label, a').forEach(el => {
        const st = getComputedStyle(el);
        if (st.textOverflow === 'ellipsis') return;
        if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2) {
          tagliati++; if (nomi.length < 4) nomi.push((el.textContent || '').trim().slice(0, 40));
        }
      });

      // CHI ESCE DAL PROPRIO CONTENITORE
      // Il controllo qui sopra trova il testo tagliato DENTRO il suo
      // riquadro. Ma un elemento puo' anche stare largo e uscire di fuori:
      // il riquadro non lo taglia, lo sbrodola. E se a tagliare e' un
      // contenitore con l'overflow nascosto - il menu laterale, per dire -
      // la pagina non sborda e da fuori sembra tutto a posto.
      // E' successo col titolo del menu, che usciva di 76px. Si vedeva solo
      // guardandolo su un Mac.
      const fuoriDalBox = [];
      for (const nome of ['aside', 'header', '#main-container']) {
        const cassa = document.querySelector(nome);
        if (!cassa) continue;
        const rc = cassa.getBoundingClientRect();
        if (rc.width < 2) continue;                       // non visibile a questa larghezza
        cassa.querySelectorAll('*').forEach(el => {
          const st = getComputedStyle(el);
          if (st.position === 'fixed' || st.position === 'absolute') return;
          if (st.display === 'none' || st.visibility === 'hidden') return;
          // DENTRO UNA FILA CHE SCORRE, USCIRE E' IL MESTIERE
          // Le linguette di Gestione stanno in un contenitore che scorre di
          // lato: le prime sono fuori a sinistra ed e' giusto cosi'. Al
          // primo giro questa prova le ha segnalate tutte. Si salta quello
          // che ha sopra di se' un contenitore che SCORRE (auto/scroll);
          // uno che TAGLIA (hidden) no, perche' quello e' proprio il caso
          // da scoprire.
          let dentroUnoScorrevole = false;
          for (let a = el.parentElement; a && a !== cassa.parentElement; a = a.parentElement) {
            const sa = getComputedStyle(a).overflowX;
            if (sa === 'auto' || sa === 'scroll') { dentroUnoScorrevole = true; break; }
          }
          if (dentroUnoScorrevole) return;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          const esce = Math.max(Math.round(rc.left - r.left), Math.round(r.right - rc.right));
          if (esce > 2 && fuoriDalBox.length < 4)
            fuoriDalBox.push(`${el.tagName.toLowerCase()} «${(el.textContent || '').trim().slice(0, 24)}» esce da ${nome} di ${esce}px`);
        });
      }
      return { sbordo, tagliati, nomi, fuoriDalBox };
    });
    if (r.sbordo > 0 || r.tagliati > 0 || r.fuoriDalBox.length) problemi.push(`    ${t}: sbordo ${r.sbordo}px · tagliati ${r.tagliati} → ${r.nomi.map(x => '«'+x+'»').join(', ')}` +
      (r.fuoriDalBox.length ? '\n      fuori dal contenitore: ' + r.fuoriDalBox.join('\n                              ') : ''));
  }
  console.log(`${w}px — ${problemi.length ? 'DA GUARDARE\n' + problemi.join('\n') : 'niente fuori posto'}`);
  await p.close();
}
await b.close();
