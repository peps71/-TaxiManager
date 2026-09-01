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
| `manifest.json` | Dati di installazione (nome, icone, colori) |
| `icon-*.png`, `favicon*`, `apple-touch-icon-180.png` | Icone dell'app |
| `Gestione_Taxi_2026.txt` | Appunti e conteggi di partenza |
| `TaxiManager_2026_iPhone.html` | Prima versione, tenuta come riferimento |

## Come funziona il salvataggio

1. Ogni dato viene scritto subito nella memoria del telefono (`localStorage`): l'app
   funziona per intero anche senza rete.
2. Se il Cloud è raggiungibile lo stesso dato viene inviato a Firestore e compare
   sugli altri dispositivi in tempo reale.
3. Se il Cloud non risponde il dato resta comunque salvato in locale e l'app lo dice
   con un avviso, invece di far credere che il salvataggio sia fallito.

Da `Cloud & Sync` si scarica un backup completo in JSON (movimenti, turni, scadenze e
impostazioni fiscali) e un CSV dell'anno da passare al commercialista.

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

## Pubblicare un aggiornamento

Il telefono si accorge di una versione nuova dal numero scritto nel service worker:
dopo ogni modifica ai file va aumentato il valore di `VERSIONE` in `sw.js`
(`taximanager-v23` → `taximanager-v24`), altrimenti resta in uso la copia salvata.
Quando la nuova versione è pronta l'app mostra l'avviso «Nuova versione pronta».
