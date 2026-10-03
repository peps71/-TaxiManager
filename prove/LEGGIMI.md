# Le prove

Il giro completo:

```sh
sh prove/tutte.sh
```

Si lancia dalla cartella del repository. Cerca `***` nell'uscita: è il segno di
qualcosa che non torna. Ogni prova si può lanciare anche da sola
(`node prove/coerenza.mjs`).

Serve **node con Playwright**. Lo cerca da solo in
`/opt/node22/lib/node_modules/playwright` e in `./node_modules/playwright`;
se sta altrove: `PLAYWRIGHT=/percorso/playwright/index.mjs sh prove/tutte.sh`.

## Cosa controlla, e perché

| Prova | Cosa guarda |
| --- | --- |
| `verifica.py` | i blocchi `<script>` di `index.html` sono sintatticamente validi |
| `classi.py` | **ogni classe CSS usata esiste davvero.** Una classe che non c'è non dà errore: semplicemente non fa niente, in silenzio. È già successo con la striscia in cima (v119) |
| `smoke.mjs` | le dieci schermate si disegnano e nessuna resta vuota |
| `sbordo.mjs` | niente esce dallo schermo, da 320 a 1280 px |
| `testUso.mjs` | l'app **usata dai suoi pulsanti**: registra turno, corse e spesa dai moduli veri, modifica, cancella, e i totali seguono |
| `testLimiti.mjs` | nove situazioni scomode (archivio vuoto, zero ore, zero euro, anno bisestile, capodanno, caratteri speciali) e a video non deve comparire `NaN`, `Infinity`, `undefined` |
| `coerenza.mjs` | 43 identità: gli incassi dell'anno contati in quattro modi, le ripartizioni che ricompongono il totale, le tasse come somma delle parti, il budget, il conguaglio |
| `coerenza2.mjs` | 37 identità fra il report del commercialista, `aggrega`, `getStats`, le vetture e le medie |
| `coerenzaVideo.mjs` | gli stessi importi **letti a video** in Andamento, Spese e tasse, Commercialista, Rendimento |
| `testIntegrita.mjs` | backup esportato e reimportato: tutto torna identico. E le scadenze rispettano la cadenza |
| `testGiorni.mjs` | il giro dei giorni su cui poggia il budget: cinque anni, i due cambi dell'ora legale, gli anni bisestili |
| `testPrevisioneRealta.mjs` | il budget è il pavimento, il conto vero comanda quando lo supera, le rate si sommano |
| `testIndiceVivo.mjs` | l'indice dei pagamenti si rifà quando registri o cancelli **dai tasti veri** |
| `testBudget118.mjs` | una spesa «Famiglia - Dettaglio» si aggancia alla voce giusta; le proposte dal registro |
| `testConguaglio.mjs` | le righe si aprono e dicono quali movimenti contengono, con la provenienza |
| `testAssegna.mjs` | riassegnare una spesa a una voce di budget: il nome lo riscrive l'app, importo e data non si toccano |
| `testScadenzeBudget.mjs` | una voce di budget con la sua scadenza compare fra le scadenze, e si spunta da sola quando paghi |
| `testConfronto.mjs` | il confronto con l'anno scorso guarda lo stesso tratto, non un anno intero contro dieci mesi |
| `troncati.mjs` | nessun testo e nessuna cifra tagliata con i puntini, a 320, 390 e 768 px di larghezza |
| `impronta.mjs` | salva l'HTML esatto delle 14 viste: serve a confrontare prima e dopo un rimaneggiamento |
| `testScadenze.mjs` | la «prossima» è la più vicina, non la più lontana |
| `testSpalmate.mjs` | le spese a budget non pesano sul giorno in cui le paghi |
| `testCoperto.mjs` | l'occhio copre il totale e **solo** quello |
| `testSpazio.mjs` | archiviare un anno: prima il file, poi la cancellazione, e solo se confermi |
| `mediaAltre.mjs` | somma e divisore della media guardano la stessa finestra |
| `testIniezione.mjs` | un backup confezionato male non esegue niente |
| `testCspViva.mjs` | la protezione sugli indirizzi è davvero applicata, e l'interruttore la toglie |
| `testDisegni.mjs` | i sei pacchetti del Cloud fanno un disegno, non sei |
| `testSW.mjs` | il service worker su HTTP: apertura dalla copia salvata, versione nuova in attesa |
| `avvio.mjs`, `profilo2.mjs` | quanto costa avviare l'app e disegnare ogni schermata |

## Perché stanno qui e non altrove

Stavano in una cartella di lavoro fuori dal repository, e un riavvio della
macchina le ha cancellate tutte una volta. Da qui in avanti vivono con il
codice che controllano.
