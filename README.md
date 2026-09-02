# TaxiManager

Applicazione web (PWA) per la gestione quotidiana del lavoro di taxi: corse e incassi,
spese, turni, calendario, parco auto, scadenze, rendimento e stima delle tasse. Funziona da browser,
si installa sulla schermata Home di iPhone e Mac e sincronizza i dati fra i dispositivi
tramite Firebase/Firestore.

## File

| File | A cosa serve |
| --- | --- |
| `index.html` | L'app completa: interfaccia, calcoli e sincronizzazione Cloud |
| `sw.js` | Service worker: tiene l'app disponibile anche senza campo |
| `firestore.rules` | Regole di sicurezza del database: da incollare nella console Firebase |
| `tailwind.config.js`, `tailwind.in.css` | Servono a rifare il foglio di stile incorporato in `index.html` |
| `manifest.json` | Dati di installazione (nome, icone, colori) |
| `icon-*.png`, `favicon*`, `apple-touch-icon-180.png` | Icone dell'app |
| `icona-sorgente.jpg` | L'immagine da cui nascono tutte le icone |
| `strumenti/icone.mjs` | Ritaglia `icona-sorgente.jpg` e rigenera le icone |
| `Gestione_Taxi_2026.txt` | Appunti e conteggi di partenza |
| `TaxiManager_2026_iPhone.html` | Prima versione, tenuta come riferimento |

## Accesso e sicurezza dei dati

Fino alla versione 43 l'app entrava nel Cloud con un accesso anonimo e scriveva tutto in
una cartella `public`: chiunque conoscesse l'indirizzo del progetto Firebase poteva leggere
e scrivere i movimenti. Adesso non più.

- Si entra con **Google**, da `Cloud & Sync`. Una volta per dispositivo: l'accesso resta
  memorizzato.
- I dati stanno in `artifacts/{app}/users/{tuo-identificativo}/…`, una cartella per
  account.
- Le regole in [`firestore.rules`](firestore.rules) lasciano entrare in quella cartella
  **solo** chi ha quell'identificativo. La vecchia cartella `public` è chiusa
  esplicitamente, e tutto il resto del database pure.
- **Senza accesso l'app funziona per intero**, solo su quel dispositivo: niente va sul
  Cloud. Uscendo dal Cloud non si cancella niente.
- Al primo accesso, quello che è già registrato sul dispositivo viene caricato nella
  cartella dell'account: è così che i dati arrivano sul secondo dispositivo.

### Cosa va fatto una volta sola nella console Firebase

Sono tre cose, su [console.firebase.google.com](https://console.firebase.google.com) →
progetto `taximanager-5ac5b`. Prima di cominciare, scarica un backup `.json` dall'app.

1. **Authentication → Sign-in method → Google → Enable**, scegli l'email di supporto,
   salva.
2. **Authentication → Settings → Authorized domains**: verifica che ci sia
   `peps71.github.io`; se manca, aggiungilo.
3. **Firestore Database → Rules**: incolla il contenuto di `firestore.rules` al posto di
   quello che c'è e premi **Publish**.

Finché il punto 3 non è fatto il database resta aperto; finché non sono fatti 1 e 2
l'accesso non riesce e l'app lo dice con un avviso che nomina il passaggio mancante.

I vecchi dati nella cartella `public` restano lì, non più leggibili dall'app: si possono
cancellare a mano dalla console quando il nuovo accesso funziona su tutti i dispositivi.

## Come funziona il salvataggio

1. Ogni dato viene scritto subito nella memoria del telefono (`localStorage`): l'app
   funziona per intero anche senza rete.
2. Se il Cloud è raggiungibile lo stesso dato viene inviato a Firestore e compare
   sugli altri dispositivi in tempo reale.
3. Se il Cloud non risponde il dato resta comunque salvato in locale e l'app lo dice
   con un avviso, invece di far credere che il salvataggio sia fallito.

Da `Cloud & Sync` si scarica un backup completo in JSON (movimenti, turni, scadenze e
impostazioni fiscali) e un CSV dell'anno da passare al commercialista.

## Turni & Corse

Tre viste: **Elenco corse**, **Elenco turni** e **Calendario**. Quella scelta resta:
riaprendo l'app si torna dov'eri, come per la scheda.

Elenco corse ed elenco turni hanno gli stessi filtri — giorno con le frecce ‹ › e il × per
toglierlo, mese, e «Azzera filtri» — e il giorno, quando è impostato, ha la precedenza sul
mese. Nell'elenco corse il giorno parte su oggi; in quello dei turni parte spento, così
all'apertura si continua a vedere tutto l'anno. Toccando un giorno del calendario e poi
«Apri nell'elenco turni» il filtro si posiziona su quella data.

## Parco auto

Nella scheda **Parco Auto** si registrano le vetture avute, quella in uso e quelle future:
marca e modello, targa, anno, alimentazione, telaio, data e km e costo di acquisto, e
quando esce dal parco anche data, km e valore di realizzo (vendita, permuta, rottamazione,
incidente, fine leasing).

Da lì l'app calcola da sola, senza chiedere altri dati:

- **Km percorsi** — per le vetture uscite dai km dichiarati, per quella in uso dal
  contachilometri più alto registrato nei turni di quel periodo.
- **Valore perso** — costo di acquisto meno valore di realizzo. Per l'auto in uso il conto
  si fa solo se indichi quanto vale oggi, ed è segnalato come stima.
- **Spese del periodo** — prese dai movimenti già registrati, per data di possesso:
  carburante, manutenzione, lavaggio, assicurazione, bollo, pedaggi, multe. Restano fuori
  radio taxi, commercialista e ristoro, che ci sarebbero con qualsiasi vettura, e i costi
  fissi, dove sta il finanziamento della licenza. Fuori anche le rate di un eventuale
  finanziamento dell'auto: quanto è costata la vettura è già nel valore perso, e sommarci
  le rate la conterebbe due volte.
- **Costo al chilometro**, diviso fra la vettura in sé e le spese di gestione, con il
  confronto fra le auto già uscite, dalla più economica.

Due avvertenze incorporate: se due vetture risultano possedute negli stessi giorni l'app
lo segnala, perché le spese di quei giorni verrebbero contate su entrambe; e nei turni
l'avviso «contachilometri all'indietro» non compare più quando fra i due turni c'è
l'acquisto di un'auto nuova, dove ripartire da capo è normale.

## Scadenze ricorrenti

Revisione, bollo, RCA, verifica del tassametro: tornano sempre uguali a distanza regolare.
Nel riquadro «Aggiungi una scadenza» c'è la spunta **Scadenza ricorrente**, con la cadenza
da scegliere: ogni 3 mesi, 6 mesi, ogni anno, 2, 3, 5 o 10 anni.

Funziona in modo diverso dalle spese ricorrenti, e apposta:

- le **spese** ricorrenti generano davvero tanti movimenti, uno per ogni rata, perché ogni
  rata è un'uscita che deve entrare nei conti;
- le **scadenze** no. In elenco resta **una riga sola**, quella che scade per prima, con
  l'etichetta viola della cadenza. Riempire la lista con dieci bolli futuri non servirebbe
  a niente: quello che conta è la prossima.

Quando la scadenza è stata fatta — revisione passata, bollo pagato — si tocca **Fatta** e
la data salta al periodo successivo. L'app **non la sposta mai da sola**: una scadenza
passata deve restare lì e diventare rossa, altrimenti sparirebbe proprio quando serve
vederla.

La data successiva si conta sempre dalla data di partenza, non da quella corretta il mese
prima: una scadenza del 31 resta del 31 anche dopo essere passata da febbraio. Se una
ricorrente è rimasta indietro di anni, «Fatta» salta avanti quanto serve invece di
proporre un'altra data già passata.

La cadenza è un campo in più sulla scadenza (`cadenza`): le scadenze scritte prima di
questa versione restano valide e semplicemente non ce l'hanno.

## Il calendario delle scadenze

Sopra l'elenco c'è il **Calendario dell'anno**: una riga per ogni data che le scadenze
toccano in quell'anno. L'INPS, che torna ogni 3 mesi, ci compare quattro volte; il bollo e
la revisione una volta. Con le frecce `‹ ›` si sfoglia avanti e indietro senza cambiare
l'anno di esercizio di tutta l'app: il **2027 c'è già**, con le stesse voci del 2026 alle
date corrispondenti, e a gennaio non c'è niente da ricopiare — c'è solo da verificarlo.

Ogni riga ha due comandi:

- il **quadratino verde** spunta quella singola data come fatta. La riga in elenco si
  rimette da sola sulla prima data ancora da fare, senza saltare le rate arretrate: se
  spunti febbraio e maggio non l'hai pagato, la prossima diventa maggio, non agosto.
  Ritogliendo la spunta si torna indietro.
- la **casella della data** sposta *solo quella occorrenza*. L'INPS teorico cade il 16
  agosto ma quell'anno si paga il 20: si cambia lì, e la serie resta intatta — l'anno dopo
  riparte dal 16.

Quello che cambia resta scritto sulla scadenza, sotto `occorrenze`, con la data teorica
come chiave: `{"2026-08-16": {"data": "2026-08-20"}}`. La prima data della serie è in
`ancora` e non si tocca più: tutte le altre si contano da lì, così una scadenza del 31
resta del 31 anche dopo essere passata da febbraio.

### Le scadenze segnate una volta sola

Le ricorrenti si ripresentano da sole. Quelle **non ricorrenti** no: se nel 2025 avevi la
tassa rifiuti e nel 2026 non c'è, il calendario mostra in fondo un riquadro giallo *«Nel
2025 avevi anche queste»* con la data già spostata avanti di un anno. Si spunta quello che
serve, si correggono le date e si tocca **Aggiungi le selezionate**. Il confronto è sul
nome, quindi una voce già rimessa a mano non viene riproposta due volte.

## Costi fissi: budget, non movimenti

I costi fissi non sono spese che si registrano: sono **quanto costa lavorare**, prima
ancora di uscire di casa. La licenza, il radio taxi, il commercialista, le assicurazioni.
In `Spese & Fisco` se ne tiene l'elenco — nome, importo, unità e periodo di validità — e
l'app ne ricava una **quota che matura ogni giorno**.

Il budget non scrive nessun movimento. Serve a una cosa sola: sapere quanto devi incassare
oggi perché la giornata sia davvero in attivo.

- **Mese** per una rata che arriva sempre uguale (il finanziamento della licenza): si
  divide per i giorni di quel mese, così febbraio e marzo tornano tutti e due alla rata
  intera.
- **Anno** per una cifra che ti aspetti in dodici mesi (6.500 € di carburante): si divide
  per i giorni dell'anno, 366 quando è bisestile.
- **Giorno** per un costo già ridotto a giornata (le polizze).
- **Dal** e **Al** dicono da quando a quando vale: una polizza che parte il 15 marzo non
  pesa a gennaio, e su marzo conta solo per i 17 giorni coperti. Vuoti, la voce vale
  sempre, anno dopo anno.

L'elenco è permanente: si compila una volta e non va riscritto ogni gennaio. Un elenco
vuoto arrivato dal Cloud non lo cancella.

A budget ci può stare anche una spesa che cambia da un mese all'altro, come il carburante:
si mette quello che si prevede di spendere in un anno, ogni giornata ne porta la sua quota
e il conguaglio dice a fine anno quanto ci si è presi. Quello che non è a budget l'app lo
spalma da sola, facendo la media di quello che è stato registrato nel mese. INPS e IRPEF
restano fuori: sono già stimate.

## Le note sulle spese

Ogni spesa ha una **categoria** e, a parte, delle **note**. La categoria è quella che
decide tutto: la tipologia nei riepiloghi, il costo al chilometro delle vetture e
l'abbinamento con il budget. Le note sono testo libero — targa, fornitore, numero di
fattura, quello che serve — e non entrano in nessun conto: ci si può scrivere dentro
trattini, barre e punteggiatura senza che nulla cambi.

Nel registro compaiono sotto la categoria, in piccolo, e finiscono in una colonna a parte
del CSV per il commercialista. Scegliendo «Altro (scrivi tu)» compare un campo apposta per
il nome della spesa, che diventa la categoria.

I movimenti registrati con le versioni precedenti, dove la nota era attaccata alla
categoria (`Carburante - Q8 corso Francia`), restano come sono e continuano a funzionare:
l'abbinamento con il budget guarda la parte prima del trattino. Volendo si separano a mano,
riga per riga, con «Modifica».

## Spese ricorrenti

Nel modulo «Nuova Spesa» c'è **Spesa ricorrente**: si scrive la spesa una volta, si sceglie
ogni quanto torna — settimana, due settimane, mese, due, tre o sei mesi, anno — e fino a
quando, e l'app crea la serie. Prima di scrivere niente mostra quanti movimenti nascono,
da che data a che data e quanto fanno in tutto, e chiede conferma.

Sono movimenti veri, uno per ogni scadenza: si modificano e si eliminano come tutti gli
altri, e contano nei totali uno per uno. Nel registro portano il segno «ricorrente» e un
pulsante **Serie** che li toglie tutti insieme.

Le date si calcolano dalla prima, non a catena: una rata del 31 diventa il 28 (o il 29) a
febbraio e torna al 31 il mese dopo. Il limite è di 400 movimenti per serie.

Una serie creata in anticipo mette in archivio dei movimenti con data futura. Nei totali
dell'anno e nella stima delle tasse ci sono da subito; nel conguaglio invece no, perché
quei soldi dal conto non sono ancora usciti — il pannello lo dice, con quanti sono e quanto
valgono.

## Le spese vere e il conguaglio

Quando una spesa a budget esce davvero dal conto la si registra come una spesa qualsiasi,
nel giorno in cui è stata pagata. **Il conguaglio l'abbina alla voce dal nome**, non dal
prefisso, quindi vanno bene tutte e due le forme:

- `Carburante - Q8 corso Francia` — le spese che hanno già una categoria loro si registrano
  lì, così restano nel costo al chilometro delle vetture e nelle caselle fiscali;
- `Costi fissi - Finanziamento licenza` — le spese di sola gestione, che una categoria loro
  non ce l'hanno. Nel modulo «Nuova Spesa» compaiono in un gruppo a parte, così il
  movimento nasce già con il nome giusto.

Il **conguaglio** confronta le due cose voce per voce. La colonna del budget è quella
dell'**anno intero**, quello che hai ipotizzato: 6.500 € di carburante restano 6.500 € anche
a marzo. Sotto, in piccolo, quanto ne è maturato a oggi.

In cima, «a che punto sei»: una barra con quello che hai speso e una riga nera che segna a
che punto è l'anno. Barra più corta della riga vuol dire che sei sotto le previsioni, più
lunga che stai spendendo più in fretta di quanto avevi messo a budget. Nella tabella, una
voce che ha già speso più di quanto sia maturato ha il numero in rosso.

L'abbinamento fra movimento e voce si fa sul **nome**, e passa anche dalla categoria a cui
l'app riconduce la spesa: una voce di budget «Carburante» ritrova i movimenti scritti
«Carburante / Diesel - Q8» come quelli scritti «Carburante - Eni».

Una differenza non è per forza un errore: a metà anno è normale aver speso meno del budget
di tutto l'anno, e una polizza pagata in un colpo solo a gennaio risulta in anticipo. Se
invece una voce resta a zero mese dopo mese, quella spesa non è mai stata registrata. Il
conguaglio confronta i due numeri, non li corregge: nei totali dell'anno e nella stima delle
tasse conta solo quello che è stato speso davvero.

## Quanto costa una giornata

Il riepilogo giornaliero della Dashboard mette insieme le due cose:

- il **budget** di quella giornata;
- la **media delle spese fuori budget** del mese, perché un tagliando serve per tutto il
  mese, non solo per il giorno in cui l'hai pagato.

Da lì escono il **pareggio della giornata** — quanto bisogna incassare per coprire tutto —
e l'**incasso reale**, cioè quello che resta davvero. Sotto, la stessa quota calcolata sui
soli **giorni lavorati**: nei riposi le spese corrono lo stesso, ma non c'è nessun incasso
a coprirle.

Le spese fuori budget si conoscono solo fino a oggi, quindi in un mese ancora in corso se ne
fa la media sui giorni già passati: dividerle per trentuno le farebbe sembrare la metà di
quello che sono.

È una lettura, non un movimento: nei totali di giorno, mese e anno ogni spesa conta una
volta sola, e nel registro resta dov'era.

## Costi fissi scritti come movimenti (versioni precedenti)

Fino alla versione 36 l'app scriveva i costi fissi come movimenti veri, uno al mese o
addirittura uno al giorno. Quelle righe restano in archivio — per gli anni già passati sono
l'unica traccia di quelle spese — e nel registro compaiono raccolte in una riga sola, che
si apre con «Mostrali».

In `Cloud & Sync`, «Costi fissi scritti come movimenti» le elenca separando quelle generate
dall'app da quelle registrate a mano, e permette di togliere le prime. Con **Anno su cui
lavorare** si fa pulizia su un anno solo, senza toccare gli altri: per gli anni già chiusi
conviene lasciare tutto com'è. Attenzione: togliendole i totali di quell'anno calano e la
stima delle tasse cambia. Ha senso farlo solo registrando al loro posto i pagamenti veri.

## L'icona dell'app

Tutte le icone nascono da una sola immagine, `icona-sorgente.jpg`: il taxi bianco di tre
quarti davanti alla Mole, con la Mole e le montagne sullo sfondo.

L'immagine originale ha il quadrato con il bordo dorato e gli angoli arrotondati dentro una
cornice chiara. Le icone vere non li vogliono: iPhone e Android arrotondano da soli, e un
bordo disegnato dentro l'icona finisce tagliato male. Perciò lo strumento ritaglia il
quadrato (angolo 157,157, lato 709 pixel) e **stringe di un altro 5,5%** per buttare via
bordo e angoli: quello che resta riempie il quadrato da parte a parte.

Sopra il ritaglio lo strumento disegna il **baffo tricolore**: una lama curva
appoggiata in basso, appuntita alle due estremita' e divisa in tre parti uguali fra verde,
bianco e rosso. E' disegnata in frazioni del lato, non in pixel fissi, percio' viene uguale
a 512 come a 32. Le tre righe da toccare per spostarla o ingrossarla stanno nella funzione
`baffo`: `punta sinistra`, `punta destra`, `curva di sotto` e `curva di sopra`.

Da questo ritaglio escono sei file:

| File | Dove si vede |
| --- | --- |
| `icon-512.png`, `icon-192.png` | Android e schermata Home |
| `icon-512-maskable.png` | Android quando ritaglia l'icona a cerchio: l'auto sta nel 78% centrale, il contorno è la stessa immagine sfocata, così non si vede nessun bordo |
| `apple-touch-icon-180.png` | Schermata Home di iPhone e iPad |
| `favicon-32.png`, `favicon-16.png`, `favicon.ico` | Linguetta del browser |

Le due favicon sono **più strette sull'auto**: a 16 e 32 pixel l'inquadratura larga
diventerebbe una macchia verde, mentre così si riconosce almeno la sagoma bianca.

Per rifarle (serve `node` e Playwright installato):

```
node strumenti/icone.mjs
```

Per cambiare icona basta sostituire `icona-sorgente.jpg` con un'altra immagine quadrata e
ricontrollare in cima allo strumento le due righe `bordoX / bordoY / bordoLato` e `rientro`:
se la nuova immagine non ha cornice attorno, si mettono `0, 0, <lato>` e rientro `0`.

## Rifare il foglio di stile

La grafica sta **dentro `index.html`**, in un `<style>` in cima. Prima arrivava da
`cdn.tailwindcss.com`: su un telefono nuovo, o con la cache svuotata, se quel sito non
rispondeva l'app si apriva senza colori e senza colonne. Adesso non dipende da nessuno.

Il rovescio della medaglia: **una classe Tailwind nuova non funziona finché il foglio non
viene rifatto.** Se aggiungi una classe che prima non c'era — poniamo `bg-teal-200` — devi
rigenerare, altrimenti quella riga di CSS non esiste e non si vede niente.

```
npm install tailwindcss@3
npx tailwindcss -c tailwind.config.js -i tailwind.in.css -o /tmp/tw.css --minify
```

Poi si sostituisce il contenuto del `<style>` in cima a `index.html` con quello di
`/tmp/tw.css`. Tailwind legge `index.html`, trova le classi anche dentro le stringhe del
JavaScript e tiene solo quelle: ne esce una trentina di kilobyte invece dei due megabyte
del pacchetto intero.

## Pubblicare un aggiornamento

Due numeri da aumentare insieme a ogni modifica:

- `VERSIONE` in `sw.js` (`taximanager-v44` → `taximanager-v45`): è da qui che il telefono
  capisce che deve riscaricare i file;
- `VERSIONE_APP` in `index.html`: è il numero mostrato nella barra laterale e in
  `Cloud & Sync`, e serve a vedere in un colpo d'occhio quale copia sta girando davvero
  sul dispositivo.

Quando la nuova versione è pronta l'app lo dice, e in `Cloud & Sync` c'è **Aggiorna
adesso**: chiede al telefono di ricontrollare e mette in uso la copia nuova senza chiudere
l'app. Il controllo viene chiesto anche a ogni ritorno sull'app, perché sull'icona in
schermata Home iOS lo farebbe di rado per conto suo.

Se il numero nella barra laterale non è quello che ti aspetti, il telefono sta usando una
copia vecchia tenuta in cache: quello è il primo posto dove guardare quando «le modifiche
non si vedono».
