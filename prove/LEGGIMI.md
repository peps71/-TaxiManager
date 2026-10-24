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
| `sbordo.mjs` | niente esce dallo schermo **e niente esce dal proprio contenitore** (menu, striscia in cima, contenuto), da 320 a 1280 px, con un logo largo caricato. Salta chi sta dentro una fila che scorre, dove uscire dal bordo è il mestiere |
| `testUso.mjs` | l'app **usata dai suoi pulsanti**: registra turno, corse e spesa dai moduli veri, modifica, cancella, e i totali seguono |
| `testLimiti.mjs` | nove situazioni scomode (archivio vuoto, zero ore, zero euro, anno bisestile, capodanno, caratteri speciali) e a video non deve comparire `NaN`, `Infinity`, `undefined` |
| `storti.mjs` | dati storti in archivio - importi non numerici, date senza senso, identificativi doppi: nessun numero marcio, nessun «NaN» a video, e le tre strade che contano gli incassi devono dire la stessa cifra |
| `baseUnica.mjs` | la base delle tasse si calcola in un posto solo: dieci archivi a caso, e getStats, il report, l'utile dell'anno e la somma dei dodici mesi devono dire tutti la stessa cifra |
| `coerenza.mjs` | 43 identità: gli incassi dell'anno contati in quattro modi, le ripartizioni che ricompongono il totale, le tasse come somma delle parti, il budget, il conguaglio |
| `coerenza2.mjs` | 37 identità fra il report del commercialista, `aggrega`, `getStats`, le vetture e le medie |
| `coerenza3.mjs` | 81 identità sul motore costruito dopo la v121: il costo del giorno con l'IRPEF, il budget fuso col conguaglio, i corrispettivi mese per mese |
| `coerenzaVideo.mjs` | gli stessi importi **letti a video** in Andamento, Spese, Commercialista, Rendimento |
| `testIntegrita.mjs` | backup esportato e reimportato: tutto torna identico. E le scadenze rispettano la cadenza |
| `testGiorni.mjs` | il giro dei giorni su cui poggia il budget: cinque anni, i due cambi dell'ora legale, gli anni bisestili |
| `testPrevisioneRealta.mjs` | il budget è il pavimento, il conto vero comanda quando lo supera, le rate si sommano |
| `testIndiceVivo.mjs` | l'indice dei pagamenti si rifà quando registri o cancelli **dai tasti veri** |
| `testBudget118.mjs` | una spesa «Famiglia - Dettaglio» si aggancia alla voce giusta; le proposte dal registro |
| `testNote.mjs` | le note con data e tipo: si scrivono, si filtrano, si modificano, compaiono sotto la giornata, viaggiano nel backup e non toccano nessun conto |
| `testVersamenti.mjs` | i versamenti di contanti: spostano la cifra dai contanti alla base delle tasse e non toccano nient'altro; le quattro strade che calcolano l'imponibile devono dire la stessa cifra |
| `testFoto.mjs` | le foto allegate alle note: la foto grande del telefono viene rimpicciolita prima di salvarla, finisce nel magazzino grande e non fra i dati dei conti, compare sotto la nota e sotto la giornata, il backup resta leggero, e quando la nota se ne va se ne va anche lei |
| `testFiscali.mjs` | le impostazioni fiscali vanno sul Cloud: salvandole dal modulo, rimettendole da un backup, e senza Cloud non si rompe niente |
| `testOrfane.mjs` | il controllo che trova le spese rimaste senza voce dopo un rinomino, e il tasto che le riaggancia |
| `testRinomina.mjs` | rinominare una voce di budget non le fa perdere le spese già registrate, e non fa pesare due volte la stessa cifra sulla giornata |
| `testBudgetCompatto.mjs` | la sezione del budget resta compatta con dieci voci, e inserisci/modifica/elimina funzionano dai tasti veri |
| `testConguaglio.mjs` | le righe si aprono e dicono quali movimenti contengono, con la provenienza |
| `testPareggio.mjs` | il costo fisso al giorno comprende la quota IRPEF, e l'etichetta del pareggio segue il segno: «Sopra» col più in verde, «Sotto» col meno in rosso |
| `testVerifica.mjs` | una corsa segnata «da verificare» compare nel registro e nei corrispettivi, e non tocca nessun importo |
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
| `testArchivi.mjs` | i cinque archivi che si sincronizzano passano tutti dallo stesso codice: una cartella vuota sul Cloud non svuota il telefono, e l'elenco delle voci di budget non si cancella in nessun caso |
| `testDisegni.mjs` | i sei pacchetti del Cloud fanno un disegno, non sei |
| `testOreTurno.mjs` | le ore scritte a mano chiudono il turno e fermano il €/h su quel numero (400 € in 10 ore = 40 €/h, e ci resta), **senza toccare** il turno normale a metà, lo Spezzato con la sua pausa, il turno non ancora cominciato, il riposo e i due turni nello stesso giorno |
| `testAnnulla.mjs` | si esce dai tre moduli completi senza salvare: il tasto c'è in cima e in fondo, **non è un submit** (se lo fosse salverebbe invece di annullare, e si vedrebbe solo contando i movimenti), a modulo intonso non chiede niente, con qualcosa scritto chiede e dicendo no resta tutto, e «Salva e basta» continua a salvare come prima |
| `testLogo.mjs` | il logo dall'immagine alla striscia e ritorno: si comprime tenendo la trasparenza, prende il posto del taxi disegnato, salvando la scheda non sparisce, esce nel backup **e rientra** (è lì che si nascondeva il buco: il ripristino filtrava i campi con un elenco in cui `logo` non c'era), e un «logo» che è un copione o una pagina viene scartato |
| `testScuro.mjs` | il modo scuro misurato **a tre larghezze** (telefono, tablet, computer) e su **tutta** la pagina, barra laterale e striscia in cima comprese: di giorno non spunta un colore che prima non c'era e ogni regola scura è prefissata, di notte ogni scritta sta sopra la soglia di leggibilità (2.256 misurate) e non resta nessun rettangolo bianco, l'interruttore tiene la scelta anche riaprendo, e il foglio da stampare resta chiaro |
| `testGrafica.mjs` | la grafica misurata invece che guardata: il comando premuto si stringe e si scurisce (e uno spento no), la sotto-scheda aperta si vede tutta a ogni larghezza, corpi e angoli stanno nella scala prevista, e nessun riquadro grosso torna ad avere il fondo colorato fuori dagli otto motivi dichiarati (la barretta in stampa si rifà bordo, se no il foglio del commercialista esce senza tinte) |
| `testAggiorna.mjs` | con un server che si comporta come GitHub Pages (`max-age=600`), la versione nuova si porta la pagina nuova e non quella rimasta nella cache HTTP |
| `installabile.mjs` | si installa come una vera app: manifesto giudicato dal browser, icone misurate davvero, zona sicura dell'icona ritagliabile, colore della barra, schermata di apertura, spazio per la barra di casa dell'iPhone, apertura senza campo |
| `testSW.mjs` | il service worker su HTTP: apertura dalla copia salvata, versione nuova in attesa |
| `avvio.mjs`, `profilo2.mjs` | quanto costa avviare l'app e disegnare ogni schermata |

## Perché stanno qui e non altrove

Stavano in una cartella di lavoro fuori dal repository, e un riavvio della
macchina le ha cancellate tutte una volta. Da qui in avanti vivono con il
codice che controllano.
