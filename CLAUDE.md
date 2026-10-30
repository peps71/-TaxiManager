# TaxiManager — istruzioni per Claude Code

PWA per il lavoro di un tassista di Torino: corse e incassi, spese, turni, calendario,
vetture e manutenzione, scadenze, budget, rendimento, stima delle tasse e report per il
commercialista. Si usa soprattutto **da iPhone, installata sulla schermata Home**, e si
sincronizza con il Mac tramite Firebase. I dati dentro sono **i conti veri di un lavoro**:
un errore qui è un errore nella dichiarazione dei redditi.

## Com'è fatto il progetto (verificato)

| Cosa | Dove / come |
| --- | --- |
| Framework | **Nessuno.** JavaScript puro, niente build, niente `package.json`, niente bundler |
| L'app | `index.html` — un file solo (~15.500 righe, ~1 MB): 5 blocchi `<script>` classici + 1 `<script type="module">` per Firebase |
| Stile | Tailwind **già compilato e incorporato** in `index.html`. `tailwind.config.js` e `tailwind.in.css` servono solo a rifarlo (vedi README, «Rifare il foglio di stile») |
| Database locale | `localStorage` (fonte primaria, l'app funziona tutta offline) + **IndexedDB** per le foto delle note |
| Database Cloud | **Firebase 11.6.1** dal CDN `gstatic.com`: Auth con Google + Firestore. Progetto `taximanager-5ac5b`. Percorso `artifacts/taximanager-2026/users/{uid}/…` (`appId` fisso nel codice) |
| Regole | `firestore.rules` — si applicano **a mano** dalla console Firebase, non da qui |
| Offline | `sw.js`, service worker con `VERSIONE = 'taximanager-vNNN'` |
| Installazione | `manifest.webmanifest`, icone `icona-*.png`, `favicon*` (rigenerate da `strumenti/icone.mjs`) |
| Pubblicazione | **GitHub Pages da `main`** → `peps71.github.io`. Unire su `main` = pubblicare sul telefono |
| Prove | `prove/` — `sh prove/tutte.sh` (Python 3 + Node con Playwright/Chromium). Vedi `prove/LEGGIMI.md` |
| Storia | `README.md` racconta ogni versione: cosa, perché, quali prove |
| Riferimento storico | `TaxiManager_2026_iPhone.html` — prima versione, **non si tocca** |

## Regole che non si discutono

1. **Non cancellare funzionalità esistenti.** Si aggiunge o si corregge; togliere qualcosa
   richiede una richiesta esplicita dell'utente.
2. **Non alterare i dati storici.** Niente migrazioni, rinomini di chiavi di `localStorage`,
   cambi di formato del backup JSON, del percorso Firestore o dello schema IndexedDB senza
   autorizzazione esplicita. Un backup vecchio deve continuare a rientrare.
3. **Non toccare database e Firebase senza autorizzazione:** `firestore.rules`, la
   configurazione Firebase in `index.html`, `appId`, `authDomain`, la versione dell'SDK.
   Mai comandi `firebase`/`gcloud` verso il progetto. Mai cancellare o disattivare Firebase
   Hosting (serve all'accesso con Google, vedi README).
4. **Nessun deploy.** Non si fa push su `main`, non si unisce una PR, non si pubblica niente.
   Si lavora sul ramo assegnato e si apre una PR: la decisione di pubblicare è dell'utente.
5. **Compatibilità iPhone sempre.** Safari iOS in modalità standalone è la piattaforma
   principale (vedi sotto).
6. **Ogni modifica si controlla:** prove pertinenti + `sh prove/tutte.sh` prima di proporla,
   e revisione di `code-reviewer`.
7. **Non abilitare funzioni sperimentali** (di Claude Code, del browser o di Firebase)
   senza averne verificato il supporto.

Le negazioni più pericolose sono anche bloccate in `.claude/settings.json` (deploy Firebase,
`gcloud`, push su `main`, push forzati).

## Compatibilità iPhone — la lista di controllo

- `viewport-fit=cover` e `env(safe-area-inset-*)`: niente sotto la tacca o la barra di casa.
- Campi di testo con `font-size` ≥ 16px, se no Safari ingrandisce la pagina al tocco.
- Larghezze da **320 a 1280 px** (`prove/sbordo.mjs`, `prove/troncati.mjs`).
- Bersagli di tocco comodi; niente che dipenda dal passaggio del mouse.
- Modo scuro e chiaro (`prove/testScuro.mjs`); il foglio per il commercialista resta chiaro.
- Niente API che Safari iOS non ha (o con alternativa): verificare prima di usarle.
- L'app deve aprirsi **senza campo** dalla copia del service worker.
- Ricordarsi che Playwright usa Chromium: ciò che è specifico di WebKit va ragionato a parte
  e dichiarato nella PR.

## Come si rilascia una versione (quando l'utente lo chiede)

Una modifica all'app porta sempre, insieme:
1. `VERSIONE_APP` in `index.html` **e** `VERSIONE` in `sw.js` allo stesso numero (+1);
2. una sezione nel `README.md` in cima alla storia: cosa è cambiato, perché, le prove;
3. una prova nuova in `prove/` se il comportamento è nuovo, aggiunta a `prove/tutte.sh` e
   alla tabella di `prove/LEGGIMI.md`.

Se cambia una classe CSS non presente nel foglio incorporato va rifatto lo stile
(`prove/classi.py` lo segnala).

## Le prove

```sh
python3 prove/verifica.py        # sintassi dei blocchi <script>
python3 prove/classi.py          # ogni classe CSS usata esiste
node prove/smoke.mjs             # le schermate si disegnano
sh prove/tutte.sh                # il giro completo: cercare «***» nell'uscita
```

Nell'ambiente cloud Playwright si trova in `/opt/node22/lib/node_modules/playwright`, già
cercato dalle prove. **Non** lanciare `playwright install`. Le prove non toccano Firebase.

## Stile

- Tutto in **italiano**: commenti, messaggi di commit, README, testi dell'interfaccia.
- Commenti che spiegano il *perché*, nel tono di quelli esistenti.
- Commit con titolo descrittivo in italiano e, se è una versione, `(vNNN)` in fondo.
- Si imita il codice intorno: stessi nomi, stessa densità di commenti, stessi idiomi.

## La squadra di agenti

La sessione principale fa da **Project Manager**: capisce la richiesta, la divide, sceglie
gli specialisti, li fa lavorare in ordine, mette insieme i risultati e risponde all'utente.
Gli specialisti in `.claude/agents/` **non delegano ad altri agenti** (lo strumento `Agent`
è loro negato): il coordinamento passa sempre di qui, così c'è un solo punto che vede tutto.

| Agente | Quando chiamarlo | Scrive codice? |
| --- | --- | --- |
| `software-architect` | Prima di ogni modifica non banale: piano, file toccati, rischi sui dati | No |
| `ui-ux-designer` | Schermate, testi, flussi, tocco su iPhone, modo scuro, accessibilità | No (propone) |
| `frontend-developer` | Interfaccia, viste, moduli, CSS, service worker, manifest | Sì |
| `backend-developer` | Calcoli, archivi, `localStorage`/IndexedDB, sincronizzazione Firestore, backup | Sì |
| `qa-tester` | Scrive ed esegue prove in `prove/`, riproduce i difetti | Solo prove |
| `code-reviewer` | Dopo ogni modifica, prima della PR | No |
| `security-engineer` | Autenticazione, regole, CSP, input esterni, backup importati, segreti | No |
| `performance-engineer` | Avvio, disegno delle schermate, dimensione del file, cache | No (misura e propone) |

### Il giro di lavoro tipico

1. **Capire** — il PM rilegge la richiesta e la sezione pertinente del README.
2. **Progettare** — `software-architect` (e `ui-ux-designer` se c'è interfaccia).
3. **Fare** — `frontend-developer` e/o `backend-developer`, uno per area, mai due sullo
   stesso pezzo di `index.html` contemporaneamente.
4. **Provare** — `qa-tester`: prova nuova + giro completo.
5. **Controllare** — `code-reviewer` sempre; `security-engineer` se si toccano accesso,
   dati in entrata o Firebase; `performance-engineer` se si tocca avvio, liste lunghe o cache.
6. **Consegnare** — il PM riassume, fa commit sul ramo di lavoro e apre la PR. Niente merge.

Se uno specialista trova che serve toccare Firebase, i dati storici o togliere una funzione,
**si ferma e lo riferisce al PM**, che chiede all'utente.
