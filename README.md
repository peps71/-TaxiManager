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

Da `Cloud & Sync` si tiene l'elenco delle proprie spese fisse — si aggiungono, si
modificano, si tolgono — e si genera un anno intero di movimenti.

**L'elenco è permanente**: si compila una volta e vale per tutti gli anni. Generare un
anno non lo tocca, e un elenco vuoto arrivato dal Cloud non lo cancella. Gli importi si
scrivono con la virgola o con il punto, indifferentemente.

Ogni voce ha la sua unità: **€/mese** per una rata che arriva sempre uguale (il
finanziamento della licenza), **€/gg** per un costo annuo da spalmare, moltiplicato per i
giorni di ogni mese (le assicurazioni).

Ogni voce ha anche un **periodo di validità**, con `Dal` e `Al` facoltativi: vuoti, la
voce vale sempre. Una polizza che parte il 15 marzo non compare a gennaio, e su marzo
viene contata solo per i 17 giorni coperti; una rata mensile invece arriva intera dal
primo mese coperto, perché una rata non si dimezza, e il movimento cade sull'ultimo
giorno davvero coperto. Restringendo il periodo e rigenerando, i mesi non più coperti
vengono tolti.

Si sceglie anche **ogni quanto scrivere il movimento**:

- **Ogni giorno, in sottofondo** — la spesa viene scritta giorno per giorno, così ogni
  giornata si porta la sua quota e l'ultimo del mese non arriva più il mucchio di tutte le
  spese fisse insieme. Nel registro non si vedono voce per voce: compaiono raccolte in una
  riga sola, che si apre con «Mostrali» quando servono. Nei totali di giorno, mese e anno
  ci sono per intero, e nell'export per il commercialista escono tutte.
- **Una voce al mese** — cade quando la spesa esce davvero dal conto, così il registro
  coincide con l'estratto conto, ma l'ultimo giorno del mese risulta pesantissimo. È la
  scelta di partenza, e resta quella finché non si sceglie altro.
- **Una voce al giorno, in elenco** — come il sottofondo, ma le righe restano tutte in
  vista. Sono circa 1.800 all'anno: il registro diventa lungo.

Dividendo una rata mensile per i giorni resta qualche centesimo di scarto: lo assorbe
l'ultimo giorno del mese, così il mese torna esatto alla rata.

Rigenerando si passa da una cadenza all'altra senza lasciare doppioni: le righe della
cadenza precedente vengono tolte. I tre modi danno lo stesso totale annuo al centesimo.
Cambiare la scelta da sola non riscrive niente — l'app lo dice con un avviso e indica
quali anni vanno rigenerati. E finché un anno non è rigenerato le sue righe mensili
restano in vista: nascondere un movimento mensile lascerebbe un totale che non si spiega.

Le voci generate portano un identificativo della forma `fissi-{anno}-{mese}-{voce}` (o
`fissi-{anno}-{mese}-{giorno}-{voce}`): rigenerare lo stesso anno le **aggiorna**, non le
duplica.

Comunque siano registrati, il riepilogo giornaliero della Dashboard mostra la **quota del
giorno** (costi fissi del mese ÷ giorni del mese), il **pareggio** — quanto bisogna
incassare per coprire tutto — e il risultato che ne deriva. Nei totali di mese e anno i
costi fissi contano una volta sola, e nei giorni in cui sono già registrati la quota non
viene sommata due volte.

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
