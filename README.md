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

- **Ogni mese** per una rata che arriva sempre uguale (il finanziamento della licenza): si
  divide per i giorni di quel mese, così febbraio e marzo tornano tutti e due alla rata
  intera.
- **Ogni giorno** per un costo annuo da spalmare (le polizze).
- **Dal** e **Al** dicono da quando a quando vale: una polizza che parte il 15 marzo non
  pesa a gennaio, e su marzo conta solo per i 17 giorni coperti. Vuoti, la voce vale
  sempre, anno dopo anno.

L'elenco è permanente: si compila una volta e non va riscritto ogni gennaio. Un elenco
vuoto arrivato dal Cloud non lo cancella.

Qui dentro non vanno carburante, manutenzione e ristoro — cambiano ogni mese, e l'app le
spalma da sola partendo da quelle registrate — né INPS e IRPEF, che sono già stimate.

## Le spese vere e il conguaglio

Quando una spesa fissa esce davvero dal conto la si registra come una spesa qualsiasi, nel
giorno in cui è stata pagata. Nel modulo «Nuova Spesa» le voci del budget compaiono in un
gruppo a parte: scegliendole da lì il movimento nasce già con la categoria giusta
(`Costi fissi - Radio taxi`) e il conguaglio lo riconosce.

Il **conguaglio** confronta le due cose, voce per voce: quanto budget è maturato e quanto
hai speso davvero. Per l'anno in corso il budget è quello maturato dal 1° gennaio a oggi.

Una differenza non è per forza un errore: una polizza pagata in un colpo solo a gennaio
risulta in anticipo sul budget e si riallinea da sé a fine anno. Se invece una voce resta a
zero mese dopo mese, quella spesa non è mai stata registrata. Il conguaglio confronta i due
numeri, non li corregge: nei totali dell'anno e nella stima delle tasse conta solo quello
che è stato speso davvero.

## Quanto costa una giornata

Il riepilogo giornaliero della Dashboard mette insieme le due cose:

- il **budget dei costi fissi** di quella giornata;
- la **media delle altre spese** del mese — carburante, manutenzione, lavaggio, ristoro,
  contributi — perché un pieno o un tagliando servono per tutto il mese, non solo per il
  giorno in cui li hai pagati.

Da lì escono il **pareggio della giornata** — quanto bisogna incassare per coprire tutto —
e l'**incasso reale**, cioè quello che resta davvero. Sotto, la stessa quota calcolata sui
soli **giorni lavorati**: nei riposi le spese corrono lo stesso, ma non c'è nessun incasso
a coprirle.

Le altre spese si conoscono solo fino a oggi, quindi in un mese ancora in corso se ne fa la
media sui giorni già passati: dividerle per trentuno le farebbe sembrare la metà di quello
che sono.

È una lettura, non un movimento: nei totali di giorno, mese e anno ogni spesa conta una
volta sola, e nel registro resta dov'era.

## Costi fissi scritti come movimenti (versioni precedenti)

Fino alla versione 36 l'app scriveva i costi fissi come movimenti veri, uno al mese o
addirittura uno al giorno. Quelle righe restano in archivio — per gli anni già passati sono
l'unica traccia di quelle spese — e nel registro compaiono raccolte in una riga sola, che
si apre con «Mostrali».

In `Cloud & Sync`, «Costi fissi scritti come movimenti» le elenca separando quelle generate
dall'app da quelle registrate a mano, e permette di togliere le prime. Attenzione:
togliendole i totali di quegli anni calano e la stima delle tasse cambia. Ha senso farlo
solo registrando al loro posto i pagamenti veri.

## Pubblicare un aggiornamento

Il telefono si accorge di una versione nuova dal numero scritto nel service worker:
dopo ogni modifica ai file va aumentato il valore di `VERSIONE` in `sw.js`
(`taximanager-v23` → `taximanager-v24`), altrimenti resta in uso la copia salvata.
Quando la nuova versione è pronta l'app mostra l'avviso «Nuova versione pronta».
