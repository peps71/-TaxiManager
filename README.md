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

## Costi fissi

Da `Cloud & Sync` si genera un anno intero di spese fisse. Ogni voce ha la sua unità:
**€/mese** per una rata che arriva sempre uguale (il finanziamento della licenza),
**€/gg** per un costo annuo da spalmare, moltiplicato per i giorni di ogni mese
(le assicurazioni).

Le voci generate portano un identificativo della forma `fissi-{anno}-{mese}-{voce}`:
rigenerare lo stesso anno le **aggiorna**, non le duplica.

I costi fissi restano registrati **una volta al mese**, il giorno in cui escono davvero
dal conto: è così che li vede la banca ed è così che vanno in contabilità. Per capire
com'è andata una giornata quel numero però non serve, quindi il riepilogo giornaliero
della Dashboard mostra anche la **quota del giorno** (costi fissi del mese ÷ giorni del
mese), il **pareggio** — quanto bisogna incassare per coprire tutto — e il risultato che
ne deriva. È una lettura, non un movimento: nei totali di mese e anno i costi fissi
contano una volta sola, e nel giorno in cui sono registrati la quota non viene sommata
due volte.

Sotto, «Costi fissi già registrati» mostra tutto quello che c'è in archivio raggruppato
per nome e provenienza. Le voci che non ha generato questa app — rimaste da versioni
precedenti, con altri identificativi — sono segnate «versione precedente» e si tolgono
tutte insieme con un pulsante: altrimenti si sommano alle nuove e il mese risulta pagato
due volte. La distinzione è sulla provenienza e non sul nome, perché alcune voci si
chiamano allo stesso modo in entrambe le serie.

## Pubblicare un aggiornamento

Il telefono si accorge di una versione nuova dal numero scritto nel service worker:
dopo ogni modifica ai file va aumentato il valore di `VERSIONE` in `sw.js`
(`taximanager-v23` → `taximanager-v24`), altrimenti resta in uso la copia salvata.
Quando la nuova versione è pronta l'app mostra l'avviso «Nuova versione pronta».
