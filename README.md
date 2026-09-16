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

## Anche gli incassi: la stima guarda solo il tracciato (versione 99)

Chiuso il giro: dalla v99 la base delle tasse è **tracciato meno tracciato**, da una parte e
dall'altra. Prima erano tutti gli incassi meno le sole spese tracciate.

- `utileFiscaleAnno()`, `utileProiettato()` e `getStats()` tengono solo i movimenti con un
  metodo che lascia una prova, in entrata e in uscita. `getStats()` torna anche
  `entrateTracciate` e `entrateContanti`.
- Il prospetto della stima ora comincia da **«Incassi tracciati 2026 — POS, app, bonifico»**,
  e sotto, in un blocco a parte intitolato **«Fuori da questo conto»**, mette gli incassi in
  contanti e le spese non deducibili: entrano ed escono dalla cassa davvero — il «ti resta»
  ne tiene conto — ma restano fuori dal conto delle tasse.
- Il foglio per il commercialista, sotto gli incassi lordi, dice *«x € tracciati · y €
  contanti»*.
- Nel confronto fra le due basi di calcolo **Satispay è passata fra i tracciati**, dov'era
  giusto stesse: era esclusa dalla colonna B, che quindi risultava più bassa del vero.

**Un avviso in giallo, sotto la stima, che non si toglie:** *questa stima guarda solo i
movimenti tracciati; per il fisco, in regime ordinario, concorrono al reddito tutti i
corrispettivi, contanti compresi, quindi il conto vero è più alto.* Quanto più alto lo dice
il confronto fra le due basi: la colonna A (tutti gli incassi) resta quella che conta per il
fisco, la colonna B è la base di questa stima, e la differenza fra le due è quello che la
stima sta lasciando fuori.

## Anche le tre schede di «Spese e tasse» (versione 98)

Rimasto indietro dalla v97: le tre schede in fondo a «Spese e tasse» — Carburante,
Manutenzione & cura, Altre spese operative — mostravano il **totale intero** con sotto il
cartellino *«Deducibile 100%»*. Anche sulla parte pagata in contanti, che deducibile non è.

Adesso ogni scheda dice il totale speso e, sotto, **quanto di quel totale va davvero in
deduzione**:

- tutto tracciato → cartellino verde **«Tutta deducibile»**;
- in parte no → cartellino blu **«Deducibili 4.320,00 €»** e sotto, in piccolo,
  *«810,00 € pagati in contanti o senza metodo: fuori»*.

`aggrega()` porta tre totali nuovi (`carburanteDed`, `manutenzioneDed`, `altroSpeseDed`, più
`usciteDed`) calcolati con la stessa `metodoTracciato()` di tutto il resto — un posto solo
dove sta la regola.

Sotto le schede una riga lo dice a chiare lettere: *«Deducibili» qui vuol dire pagate in modo
tracciato, secondo la regola che hai stabilito. Quanto poi sia deducibile ogni singola voce —
e in che percentuale — lo dice il commercialista: questa è la somma, non la dichiarazione.*

## In deduzione solo le spese tracciate (versione 97)

La regola, decisa dal tassista: **in deduzione vanno solo le spese tracciate.** Dalla v97
l'app la applica dappertutto, invece di limitarsi a dividere i due mucchi.

**Due utili, che non sono la stessa cosa:**

| | come si calcola | a cosa serve |
| --- | --- | --- |
| **Utile di cassa** | incassi − **tutte** le spese | quello che ti resta davvero in tasca |
| **Utile fiscale** | incassi − **le sole spese deducibili** | la base su cui si stimano le tasse |

Le spese in contanti restano spese vere — tolgono soldi dalla cassa — ma non abbassano
l'imponibile. Quindi:

- la **stima delle tasse** in «Spese e tasse» si calcola sull'utile fiscale, e il prospetto
  lo dice riga per riga: *Incassi · Spese deducibili (tracciate) · Utile fiscale*, e sotto,
  in grigio, *Spese non deducibili*;
- il **netto stimato** resta al netto di **tutte** le spese: `utile di cassa − tasse`;
- l'**accantonamento automatico** (la percentuale che l'app suggerisce di mettere da parte)
  si calcola sullo scaglione dell'utile fiscale, non più di quello di cassa;
- il **foglio per il commercialista** mostra sotto le spese *«x € deducibili · y € no»*, sotto
  la stima *«su x € di utile fiscale»*, e in fondo al dettaglio per categoria le due righe
  divise;
- anche il **confronto fra le due basi di calcolo** (negli approfondimenti fiscali) toglie
  solo le deducibili.

**Attenzione, e va detto chiaro: la stima delle tasse sale.** Con la regola vecchia tutte le
spese abbassavano l'imponibile; adesso i contanti non lo fanno più. Su un esempio da 30.000 €
di incassi con 6.000 € di spese tracciate e 5.000 € in contanti: utile di cassa 19.000 €,
utile fiscale 24.000 €, tasse stimate 10.320 € invece di 8.170 €. Se i conti di prima ti
sembravano più belli, erano semplicemente più ottimisti del dovuto.

**Una spesa senza metodo di pagamento scritto non è deducibile.** Non si sa come è stata
pagata, e darla per buona sarebbe inventare. Compare nell'elenco come **«Non indicato»**: se
ne trovi, aprile e scrivi come le hai pagate.

## Spese tracciate o in contanti (versione 96)

Tolto il tasto «Fattura» (v95), le spese avevano tre modi di pagamento: contanti, POS/carta,
carta carburante. Mancava il **bonifico** — e mancava soprattutto la divisione che conta
davvero: **quello che lascia una traccia e quello che non ne lascia.**

- **Bonifico** è il quarto tasto del pannello veloce. I tasti sono di nuovo quattro, due per
  riga: Contanti · POS/Carta · Carta carburante · Bonifico.
- **`metodoTracciato(metodo)`**: contanti no, tutto il resto sì. Una riga sola, usata
  ovunque, così non ci sono due idee diverse di «tracciato» in giro per l'app.
- **«Come le hai pagate»**, nuovo riquadro in fondo al registro spese: i due mucchi in cima
  — *tracciate* (con quanto di quelle ha anche la fattura) e *in contanti* — e sotto il
  dettaglio per metodo, con la barra della percentuale. Il riepilogo in alto guadagna la riga
  *«tracciate X € · contanti Y €»*.
- Lo stesso riquadro è nel **foglio per il commercialista**, sopra il dettaglio per categoria,
  e si stampa con il resto.

Sulla deducibilità l'app dice quello che sa e si ferma lì: *«Tracciata vuol dire che del
pagamento resta una prova: POS, carta, bonifico, app. È quella che il commercialista può
portare in deduzione senza doverti credere sulla parola. Sui contanti chiediglielo: la regola
non è uguale per tutte le voci, e non la decide questa app.»* I conti li fa, la qualifica
fiscale no — quella ha regole che cambiano voce per voce e anno per anno.

## La fattura non è un modo di pagare (versione 95)

Fra i tasti «come ha pagato» c'era **Fattura / Convenzione**, sia sulle corse che sulle
spese. Ma la fattura non è un modo di pagare: è il documento che ti danno. Il tasto è
sparito da tutti e due i pannelli — restano solo i modi veri: contanti, POS, Satispay, app,
carta carburante.

**«Fattura» resta scegliibile nel modulo completo** (il collegamento *«Tratta scritta o data
diversa»* sulle corse, *«Nota, data diversa o spesa ricorrente»* sulle spese): le corse in
convenzione già registrate restano quelle che sono, e chi vuole continuare a segnarle così
può farlo.

Al suo posto, sulle spese, c'è la spunta **«Mi fa fattura»**:

- sta nel pannello veloce, sopra i tasti del pagamento, e nel modulo completo accanto al
  metodo;
- si ricorda l'ultima scelta, come categoria e metodo — la si vede sempre prima di salvare;
- si può mettere e togliere anche dopo, dalla modifica della riga (sia in «Oggi» che nel
  registro spese);
- sulla riga compare il cartellino **«con fattura»** (in Oggi, per stare stretto, **«fatt.»**);
- nel registro spese il totale dice anche **«di cui *x* € con fattura»**.

Serve al commercialista e serve a te: il pieno con la ricevuta del distributore e il pieno
con la fattura sono la stessa spesa e due cose diverse.

Il campo si chiama `fattura` sul movimento e c'è solo quando è vero: i movimenti vecchi
restano validi così come sono, senza nessuna conversione.

## La prossima scadenza era quella sbagliata (versione 94)

Segnalato guardando l'app: in cima a **Scadenze** c'era scritto *«Prossima: Bollo Auto»*
(31 ottobre) mentre il calendario, due dita più sotto, mostrava l'assicurazione il 7 ottobre.
E *«Entro 30 giorni: 0»* con una scadenza a ventun giorni.

**Perché.** Le tre caselle in cima leggevano la **data scritta nella scheda** della scadenza.
Per una scadenza che si ripete quella data non è la prossima volta: è l'**àncora** della
serie, il punto da cui si contano i giri (README, «Il calendario delle scadenze»). Il
calendario le occorrenze le calcola davvero; le caselle no. Due conti diversi sulla stessa
pagina, e quello sbagliato era in grande.

Lo stesso errore lo faceva **l'avviso rosso** che compare su Oggi, Andamento e Gestione:
poteva tacere su una scadenza fra tre giorni e strillare per una che non c'era.

**Adesso** le caselle e l'avviso contano le occorrenze vere, le stesse del calendario, su tre
anni: l'anno scorso per le arretrate, quest'anno, e l'anno prossimo — perché a dicembre la
prossima cade oltre capodanno.

Due regole che servivano:

- **Di una scadenza in ritardo conta l'ultima volta, non tutte.** Il bollo del 2025 mai
  spuntato non è una seconda cosa da fare oltre a quello del 2026: è la stessa, in ritardo.
  Senza questa regola bastava non spuntare per un anno per avere l'avviso rosso pieno di
  doppioni.
- **Prima dell'àncora la serie non esisteva.** Il conto delle occorrenze, per non perdere i
  bordi dell'anno, ne generava una in più da una parte e dall'altra: quella *prima*
  dell'àncora finiva nel calendario come se fosse dovuta. È il motivo per cui il promemoria
  del backup, creato per il 16 dicembre, compariva «da fare oggi» il 16 settembre. Restano
  solo le date pre-àncora su cui c'è scritto qualcosa (spuntate, o spostate a mano): quelle
  sono storia vera.

**E le tre caselle stanno su una riga sola**, sul fondo scuro: Scadute · Entro 30 gg ·
Prossima, con il nome della prossima, la data e i giorni che mancano. Prima erano tre
schedine chiare in colonna, alte quanto mezzo schermo, per dire due zeri e un nome.

Verificato: `testProssima` (nuovo) fallisce sulla v93 — *prossima: Revisione, tra 65 gg* —
e passa dalla v94, con l'assicurazione a 21 giorni.

## La divisione per metodo su fondo scuro (versioni 92-93)

Il pannello «Filtra per metodo», nella schermata Oggi, era cinque rettangoli grigi uguali su
bianco: il colore del metodo — quello dei tasti con cui la corsa è stata salvata — non si
vedeva da nessuna parte.

Adesso è una scheda scura come quella della giornata, e **ogni riquadro ha il colore del suo
metodo**: verde contanti, rosso Satispay, blu app, azzurro fattura. Quando ne scegli uno, il
riquadro si accende pieno di quel colore e in alto compare «filtro attivo» in giallo.

Il POS nei tasti è nero, e sul nero non si vedrebbe: qui porta il **giallo taxi** (v93).

I riquadri sono passati sopra i menu a tendina: quello che si guarda (quanto ho preso in
contanti) viene prima di quello che si imposta. Gli importi sono senza simbolo dell'euro e
allineati in colonna, come nelle caselle della scheda in cima.

## «Incasso corsa» (versione 91)

L'etichetta sopra il campo dell'importo, nella schermata Oggi, era **«Quanto hai incassato»**:
una domanda, e riferita alla giornata più che alla corsa che stai segnando in quel momento.
Adesso dice **«Incasso corsa»** — è il nome di quello che stai scrivendo, e si distingue a
colpo d'occhio dal riquadro della spesa qui sotto.

## La stessa lingua in Andamento e Gestione (versione 90)

La direzione della v89 portata sulle altre due schermate. Nessun conto è cambiato.

**Andamento**

- La testata dei periodi (Oggi / Mese / Anno) è la stessa scheda scura della giornata:
  incasso grande **bianco** invece che giallo — giallo su nero è la coppia che si legge
  peggio di tutte con il sole in faccia — e sotto le tre caselle **Spese · Ti resta · A corsa**,
  con le cifre allineate in colonna.
- **I campi data e mese non sono più rettangoli bianchi dentro il nero.** Erano la cosa più
  vistosa della schermata e mostravano «09/16/2026». Adesso c'è la data scritta
  («Mercoledì 16 / settembre 2026», «Settembre 2026») con il campo del telefono trasparente
  sopra: si tocca e si apre il calendario, come prima. Il pulsante «Ultimo» è diventato una
  scritta, non un blocco giallo.
- **Meno doppioni**: il titolo del giorno non è più ripetuto sopra le frecce, e la media a
  corsa non è scritta due volte (sta nella casella; sotto resta l'euro all'ora).
- Il riquadro **«Quanto costa questa giornata»** era tutto blu su blu: adesso è una scheda
  bianca con il blu solo dove serve, la quota in grande e i due riquadri allineati.
  «Incasso reale della giornata» si chiama **«Sopra il pareggio»**: mostrava la differenza,
  non l'incasso.
- Il selettore dell'anno era un blocco nero grande come il titolo: adesso è un comando quieto
  accanto al titolo, bianco con un filo di bordo.

**Gestione**

- I sei reparti hanno **un colore ciascuno**, tenue: sei quadrati gialli uguali non aiutano a
  ritrovare la voce, a colpo d'occhio erano sei bolli. La freccia a destra è disegnata, non
  più il carattere `›`.
- Titolo e sottotitolo più composti, e la riga non va più a capo sui telefoni stretti.

**Dappertutto**

- Il nero dell'app (`#111827`, blu di suo) è diventato lo stesso nero caldo della scheda
  della giornata: accanto al fondo color carta il vecchio faceva una macchia fredda.
- Le etichettine delle sezioni sono una classe sola (`.etichetta`), non tredici copie della
  stessa riga di classi.

## Una grafica più curata: la giornata in una scheda sola (versione 89)

Quattro bozze a confronto (com'è adesso, «Rifinitura», «Plancia» scura, «Chiaro» senza
schede), scelta la **Rifinitura**: stesso giallo, stessa struttura, stessi gesti — cambia
la cura. Niente di quello che si tocca si è spostato.

**Cosa non andava, misurato sulla v88:**

- **287 elementi scritti con il peso massimo del carattere.** Se tutto urla, non si legge
  niente per primo.
- **Una sola ombra, piatta** (`0 1px 2px rgba(0,0,0,.05)`): le schede sembravano adesivi
  appoggiati sul fondo.
- **L'incasso della giornata a 24px, il titolo «Oggi» a 30px.** Il titolo gridava più dei
  soldi.

**Cosa è cambiato:**

- **Una lingua visiva sola**, in cima al `<style>`: i colori (fondo color carta `#faf9f6`
  invece del grigio ufficio, fili e grigi caldi), la scala dei pesi (900 solo sulle cifre
  grandi, il resto 800/650), due livelli di ombra. Riscrive le classi di Tailwind
  (`.font-black`, `.shadow-sm`, `.border-gray-100`...), così il tono cambia ovunque senza
  toccare novemila righe di markup, e una schermata scritta domani nasce già giusta.
- **La scheda scura della giornata.** Prima erano tre blocchi in fila — il titolo «Oggi», la
  scheda bianca con il campo data, due rettangoli colorati con i totali — mezza schermata per
  dire una cosa sola. Adesso: il giorno con le frecce, **l'incasso a 42px**, e sotto la riga
  che serve a fine turno — **Spese · Ti resta · All'ora**. L'euro all'ora continua ad
  aggiornarsi ogni minuto mentre il turno è aperto.
- **La data si legge**: «Mercoledì 16 / settembre 2026» su due righe invece di
  «Mercoledì 16 Sett…». Il campo data del telefono è ancora lì, trasparente, sopra la scritta:
  si tocca e si apre il calendario come prima.
- **Niente più doppioni**: con un giorno selezionato, la scheda del registro ripeteva data,
  totale e corse già scritti sopra. Adesso mostra solo quello che in cima non c'è — il turno
  con i suoi orari e i suoi km.
- **Le emoji dei metodi di pagamento sono diventate icone disegnate** (💵 💳 🔴 📱 🧾 →
  stesso tratto del resto dell'app). Le emoji le disegna ogni telefono a modo suo. Restano
  solo dentro i menu a tendina, dove il colore non si può mettere in altro modo.
- **Il numero grande porta il simbolo più piccolo e più chiaro**: da lontano si legge
  «116,50», non «€». Nelle tre caselle in fondo l'euro non c'è proprio: lo dice l'etichetta.
- **In fondo la voce accesa è una pastiglia gialla** dietro l'icona, non un trattino sotto la
  scritta: a un centimetro dal bordo dello schermo il trattino non si vedeva.
- Le linguette «Giornate / Calendario» sono sottolineate invece che dentro una scheda: la
  pagina comincia **40px più su**.

Il foglio di stile è stato rifatto (vedi «Rifare il foglio di stile»): 446 classi usate, 446
coperte.

## Il promemoria del backup (versione 88)

Le tre copie automatiche (v72) vivono nello **stesso account Google** dell'app. Bastano per
un guaio tuo — una giornata cancellata per sbaglio, un telefono perso, un telefono nuovo da
riempire — ma **non per la perdita dell'account**. Un file `.json` scaricato ogni tanto su
iCloud o su una chiavetta è l'unica copia che non dipende da nessuno.

In «Backup e impostazioni», accanto ai due scarichi, c'è **«⏰ Ricordamelo ogni 3 mesi»**: crea
nelle Scadenze un promemoria ricorrente «Scarica il backup dei dati», datato fra tre mesi
(non oggi: il primo giro lo fai adesso scaricando il backup).

Il promemoria **non poteva metterlo nessuno al posto suo**: le scadenze stanno nei dati del
tassista, nella sua cartella privata, e da fuori non ci si scrive. Quello che si può fare è
il tasto che lo crea con un tocco.

Dettagli:

- **Non ne fa due uguali.** Se il promemoria c'è già, lo dice e porta in «Scadenze» invece di
  aggiungerne un altro (il confronto passa da `chiaveNome`, lo stesso che abbina le spese al
  budget).
- **Una volta creato, il tasto diventa una conferma**: *«Te lo ricordo il 16/12/2026, e poi
  ogni tre mesi»*, con il collegamento per andarlo a vedere.
- Si comporta come qualsiasi altra scadenza ricorrente: si spunta, sparisce, e torna tre mesi
  dopo. Verificato: nel 2027 cade quattro volte, il 16 di marzo, giugno, settembre e
  dicembre.

## La sigla in cima (versione 87)

La sigla compare nella barra in alto. **Sigla e colore sono la stessa cosa detta in due modi**
— identificano la vettura — quindi sono un elemento solo: una targhetta con la sigla scritta
dentro, colorata del turno. Tre elementi staccati in cima a un telefono si contenderebbero i
pixel per dire una cosa sola.

```
🚕 Giuseppe  [ Torino 57 ]  [ v87 ]        turno giallo → targhetta gialla
🚕 Giuseppe  [ Torino 57 ]  [ v87 ]        senza turno  → targhetta scura
🚕 Giuseppe La Viana  ●  [ v87 ]           solo turno   → il pallino di prima
```

**Con la sigla accanto, in cima resta il nome di battesimo.** Il nome per intero non ci
stava e veniva tagliato — «Giuse…» a 320px, che è peggio di niente. In cima serve
riconoscersi, non leggere l'anagrafe: il cognome resta nel titolo per chi ci passa sopra, e
per intero nella scheda e sul foglio del commercialista. Senza sigla, nome e cognome come
prima.

Misurato a 320, 375 e 390px con sigle corte e lunghe: l'unico caso in cui il nome si accorcia
ancora è **320px con una sigla da quindici caratteri**, cioè un iPhone SE della prima
generazione con «Torino 1234 bis». Su 375 e 390 non si taglia niente.

## Sigla e colore del turno (versione 86)

**«Codice radio» diventa «Sigla»**, che è come la si chiama davvero, e l'esempio passa da
`57` a `Torino 57`. Chi aveva già compilato il campo non lo perde: all'avvio, se c'è un
vecchio `radio` e la sigla è vuota, il valore si sposta da solo.

**Il colore del turno.** Non è una decorazione: è il colore scritto sulla licenza, quello che
dice quali giorni tocca lavorare. Si sceglie toccando una pastiglia — bianco, giallo, verde,
rosso, blu, nero, o nessuno — e compare in due posti:

- un **pallino** accanto al nome nella barra in alto, che è quello che si guarda al volo la
  mattina;
- una **pastiglia «Turno giallo»** in testa al riepilogo per il commercialista, accanto a
  nome, licenza, sigla e partita IVA.

### Un bug trovato dalla prova, e la bozza

Il primo tentativo scriveva il colore scelto direttamente nel profilo. Sembrava innocuo, ma:
scegliendo il colore a metà compilazione, il riquadro di benvenuto **spariva** — perché a
quel punto il profilo risultava «compilato» — e ti trovavi il modulo chiuso in faccia senza
aver salvato niente.

Adesso quello che stai battendo vive in una **bozza** (`window.bozzaProfilo`): il modulo la
legge, il colore la aggiorna, e solo il salvataggio la travasa nel profilo vero e la butta.
È lo stesso schema che l'app usa già per i chilometri del turno.

*(Nota di manutenzione: `testBudget` aveva una `location.reload()` in corsa con la `goto`
successiva e falliva a intermittenza. Tolta: cinque giri di fila, cinque verdi. Un test che
fallisce a caso è peggio di un test che manca, perché insegna a ignorare il rosso.)*

## La scheda del tassista (versione 85)

### Una premessa: l'app era già di più persone

Non c'era una registrazione da costruire. Chi entra con Google ha **già** una cartella sua
sul Cloud — `artifacts/{appId}/users/{uid}/…` — e a tenerli separati non è il programma ma
le **regole del database**, che girano sui server di Google e dal browser non si aggirano:

```
match /artifacts/{appId}/users/{uid}/{documenti=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

Due tassisti sullo stesso telefono, che entrano con due account, non si vedono i dati a
vicenda. Quello che mancava non era la separazione: era **l'anagrafica**.

### Cosa c'è adesso

Nome, cognome, numero di licenza, codice radio e partita IVA. Vivono nella cartella privata
(`profilo/dati`), si sincronizzano fra i dispositivi come tutto il resto, e viaggiano nel
backup.

**Il benvenuto** compare su «Oggi» al primo avvio e poi non si rivede più. **Non è una pagina
di registrazione**: una schermata obbligatoria davanti all'app sarebbe un muro fra il
tassista e la prima corsa, per dei dati che servono a fine mese. C'è un «Lo faccio dopo», e
la scheda si compila quando si vuole da «Gestione → Backup e impostazioni». Lo stesso modulo
serve in tutti e due i posti (`moduloProfiloHTML`): due copie finirebbero per divergere — in
questa app è già successo.

### Dove serve davvero

**In testa al riepilogo per il commercialista.** Un foglio senza nome e partita IVA è un
foglio anonimo: chi lo riceve non sa di chi è, e in archivio non lo ritrova più.

```
INTESTATARIO
Giuseppe La Viana
Licenza 1234    Codice radio 57    Partita IVA 00743110157
```

E il nome compare nella barra in alto al posto del marchio: «TaxiManager» lo sai già, il tuo
nome dice invece con quale account stai lavorando.

### La partita IVA viene controllata

Undici cifre, e l'ultima è un controllo: si sommano le cifre di posto dispari e quelle di
posto pari raddoppiate (togliendo 9 se superano 9), e il totale deve chiudere alla decina.
Serve a intercettare una cifra battuta storta, che su un documento che va al commercialista
non è un dettaglio.

**Avvisa, non blocca**: potresti non averla sottomano, e la scheda si salva lo stesso con un
messaggio che lo dice.

### Un bug trovato dalla prova

Il primo tentativo metteva il ripristino della scheda **dopo** il controllo «c'è qualcosa da
rimettere in questo backup?». Risultato: un backup fatto appena installata l'app — che
contiene la scheda e nient'altro — veniva scartato per «non ci sono movimenti», buttando via
proprio l'unica cosa che c'era. Adesso la scheda si rimette per prima, fuori da quel
controllo, e il messaggio lo dice: *«Rimessa la tua scheda. Di movimenti e turni in questo
backup non ce n'erano.»*

## Revisione generale: più veloce, meno codice (versione 84)

Una passata di analisi e ottimizzazione, **a comportamento invariato**. Misurato su un
archivio di prova da **9.697 movimenti e 1.096 turni** (tre anni pieni).

### Quanto ci mette a disegnare una schermata

| schermata | prima | dopo |
|---|---|---|
| Spese e tasse | 17,2 ms | **10,9 ms** −37% |
| Andamento · mese | 14,7 ms | **8,1 ms** −45% |
| Andamento · giorno | 8,9 ms | **7,0 ms** −21% |
| Oggi | 7,0 ms | **5,8 ms** −17% |
| Commercialista | 6,5 ms | **6,1 ms** |

### Le quattro cose che pesavano

**1. Il formattatore degli euro si costruiva a ogni importo.** `new Intl.NumberFormat(...)`
è caro da costruire e gratis da riusare: misurato, ventimila importi costano **613 ms**
costruendolo ogni volta e **11 ms** riusandolo — **54 volte tanto**. E una schermata di
questa app formatta centinaia di importi, perché ogni corsa, ogni riga di spesa e ogni
casella del calendario ne ha uno. Adesso i formattatori sono due costanti
(`FORMATO_EURO`, `FORMATO_NUMERO`), costruite una volta all'avvio. Era la singola cosa che
pesava di più.

**2. Ogni spesa ri-normalizzava i nomi di tutte le voci di budget.** Per abbinare una spesa
alla sua voce, `voceBudgetDiRecord` scorreva le voci ricalcolando `chiaveNome(v.nome)` —
`normalize('NFD')` più due espressioni regolari — **per ognuno dei millecinquecento
movimenti dell'anno**. Adesso le voci sono indicizzate per chiave una volta per disegno
(`indiceVociBudget`), e `chiaveNome` tiene da parte i risultati: i nomi da confrontare sono
una manciata, ripetuti migliaia di volte. Il conguaglio è passato da **4,00 a 1,75 ms**.

**3. Il giro del budget chiedeva 365 volte quello che non cambiava.** `budgetPeriodo` e
`budgetVocePeriodo` chiamavano `elencoVociFisse()` e `giorniDelMese()` dentro il ciclo dei
giorni: 732 chiamate per un disegno di «Spese e tasse». Ora escono dal ciclo, e quanti
giorni ha un mese o un anno si calcola una volta per sempre (`GIORNI_MESE`, `GIORNI_ANNO`) —
sono fatti di calendario, non cambiano.

**4. Gli stessi conti chiesti da punti diversi della stessa schermata.** Dodici funzioni
pesanti (`aggrega`, `conguaglioAnno`, `corrispettiviMese`, `statsForfettario`,
`calcolaTasseOrdinario`…) passano da una memoria che **vive solo per la durata di un
disegno**.

### La memoria del disegno, e un bug che ha quasi fatto danni

La memoria si apre e si chiude in un guscio attorno a `renderContent`, con un `try/finally`:

```js
function renderContent() {
    memoDisegno.clear();
    dentroUnDisegno = true;
    try { disegnaContenuto(); }
    finally { dentroUnDisegno = false; memoDisegno.clear(); }
}
```

Fuori da un disegno `memo()` non tiene niente da parte. **Serve davvero**: il primo tentativo
svuotava la memoria «alla fine» di `renderContent`, ma quella riga era finita — per un
aggancio sbagliato — dentro un'altra funzione. Risultato: il riepilogo di oggi restava
bloccato a zero, perché il valore calcolato al primo avvio (archivio ancora vuoto) veniva
riletto dopo. Il guscio con `try/finally` non dipende da dove finisce una funzione lunga
milleduecento righe, e si richiude anche se qualcosa va storto.

### Come so che i numeri non sono cambiati

Una prova che mette a confronto la versione vecchia e quella nuova sullo stesso archivio e
verifica **68 misure**: i totali di tre anni, il budget e il conguaglio per anno e per mese,
le serie mensili e annuali, i corrispettivi, la quota del giorno, le tasse, il forfettario,
le scadenze, l'HTML completo delle dieci schermate.

**68 su 68 identiche.** Più le 39 prove della suite.

### Meno codice

- Tolta `pieghevole()`, mai chiamata (era rimasta dalla 74).
- Le voci del menu «che spesa è» erano scritte due volte — nel modulo completo e nella spesa
  lampo — e le due copie **erano già divergenti**: una passava le categorie da `esc()`,
  l'altra no. Una funzione sola (`opzioniCategoriaSpesa`).
- Zero blocchi di codice duplicati rimasti (prima: 1), zero funzioni mai chiamate.
- Tre prove (`testLicenza`, `testRata`, `testMezzo`) erano **rotte da diverse versioni**:
  cercavano `VOCI_COSTI_FISSI` e `#cf-anno`, spariti col rifacimento del budget. Una prova
  che non può girare è peggio di nessuna prova, perché sembra copertura e non lo è.
  Sostituite da `testCostiFissi`, che copre le stesse cose con l'API di oggi: la rata
  mensile che pesa uguale in ogni mese, il finanziamento escluso dal costo al chilometro,
  l'abbinamento «Costi fissi – X» nel conguaglio, il raggruppamento dei tipi di spesa.

## Due nomi più asciutti (versione 83)

| prima | adesso |
|---|---|
| Quanto rendo | **Rendimento** |
| Per il commercialista | **Commercialista** |

«Quanto rendo» suonava come una domanda, e una voce di menu non fa domande: dice dove
porta. «Rendimento» è anche la parola che quella scheda usa già al suo interno, ed è quella
che si dice al commercialista o in cooperativa.

«Per il commercialista» spiegava troppo: il «per il» è la frase, non l'etichetta. Il
sottotitolo sotto la voce — *«Il riepilogo da stampare o da esportare»* — dice già a cosa
serve.

Cambiati l'etichetta nell'indice, il titolo della schermata e la pastiglia nella fila delle
sezioni: sono tre punti diversi ma leggono tutti lo stesso elenco (`SCHEDE_SECONDARIE`)
tranne il titolo, quindi non possono divergere per distrazione.

## «Gestione», e muoversi dentro (versione 82)

### Il nome

«Altro» è il nome di un cassetto, non di una scheda: dice dove **non** stanno le cose.
Dentro ci sono le spese, le tasse, le scadenze, le vetture, i report e i backup — cioè il
mestiere dalla parte della scrivania. Da qui si chiama **Gestione**, in basso e in cima alla
schermata: `Oggi · Andamento · Gestione`.

### Il ritorno, e il salto laterale

Entrando in una sezione non c'era modo di tornare all'indice se non ritrovando «Gestione»
nella barra in basso — che resta accesa, ma non è un tasto «indietro» e nessuno lo legge
così. E per passare da «Scadenze» a «Le mie auto» servivano due tappe.

Adesso in cima a ogni sezione c'è:

```
‹ Gestione
[ Spese e tasse ] [ Scadenze ] [ Le mie auto ] [ Quanto rendo ] …   ← scorre di lato
```

Il ritorno all'indice, e la fila delle sorelle con quella dove sei accesa: **da una sezione
all'altra è un tocco solo**. La fila scorre di lato sul telefono e non fa sbordare la
pagina.

Il **registro spese** non è una voce dell'indice (v80) ma si apre da «Spese e tasse»: il suo
indietro dice `‹ Spese e tasse` e torna lì, non all'indice (`GENITORE_SEZIONE`). Un
«indietro» che salta una tappa è peggio di nessun indietro.

Una nota di verifica: la freccia `‹` del ritorno convive con quella del cambio anno nel
calendario delle scadenze. Per un occhio umano sono due cose diverse (una dice «‹ Gestione»,
l'altra è una freccia nuda in uno stepper), ma una prova automatica che cercava `‹` prendeva
la prima delle due. Corretta puntando la freccia per nome (`aria-label="Anno precedente"`),
che è poi come la trova anche uno screen reader.

## Il €/h che si muove, e l'ora della corsa (versione 81)

### Il €/h dentro il turno

Diviso per le ore del turno **intero**, a metà giornata quel numero non dice niente: alle
dieci di un turno 08–20, con 40 € fatti, segnava **3,33 €/h** — e uno pensa di stare andando
male quando sta solo andando da due ore.

Adesso, finché il turno è in corso, il conto è sulle ore lavorate **finora** e si rifà da
solo ogni minuto:

| ora | incassato | prima | adesso |
|---|---|---|---|
| 10:00 | 40 € | 3,33 €/h | **20,00 €/h · 2 h finora** |
| 18:00 | 220 € | 18,33 €/h | **22,00 €/h · 10 h finora** |
| a turno chiuso | 260 € | 21,67 €/h | 21,67 €/h *(il consuntivo, invariato)* |

Dettagli che contano:

- **Fuori dal turno** — prima che cominci, o a giornata chiusa — resta il conto sulle ore
  intere, che è il consuntivo vero. L'etichetta «h finora» compare solo mentre serve.
- **Turni a cavallo di mezzanotte** (13:00–01:00): alle 00:30 sono 11,5 h, non un numero
  negativo.
- **Lo Spezzato**: la pausa si toglie solo quando è già passata. Durante la pausa il conto
  si ferma all'ora in cui è cominciata, invece di gonfiarsi.
- **Sotto il quarto d'ora non si divide**: con cinque minuti di lavoro una corsa da 20 €
  darebbe 240 €/h — vero in aritmetica, falso in tutto il resto. Fino a lì si vede «—».
- **Due turni nello stesso giorno**: le ore del turno già chiuso si sommano a quelle fatte
  finora in quello in corso.
- **Il rinfresco non ridisegna la pagina.** Ogni minuto `aggiornaEuroOraVivo()` riscrive
  solo quel numero: un rendering completo cancellerebbe un modulo aperto a metà, e con
  l'app in tasca durante il turno succederebbe di continuo. Quando il turno finisce, quello
  sì è un ridisegno — ma solo se non c'è un modulo aperto.

### L'ora di inserimento

Ogni corsa e ogni spesa si porta dietro l'ora in cui l'hai scritta (`ora: "09:02"`), e la
mostra a sinistra della riga nel registro della giornata. Serve a ritrovare l'ordine in cui
hai battuto le cose e a riconoscere una riga sbagliata fra due uguali.

**È l'ora dell'inserimento, non della corsa**: se segni la sera le corse della mattina, lì
c'è la sera. Le righe registrate prima della 81 non ce l'hanno e semplicemente non la
mostrano. L'ora finisce anche nel CSV dei movimenti, in una colonna sua accanto alla data.

Per far posto all'ora, la freccia `›` a fine riga — che è decorativa — sparisce sul
telefono: quei dodici pixel servono alla descrizione della corsa, che altrimenti diventa
«Carbur…».

## «Registro spese» esce dall'indice (versione 80)

Di spese si parlava in tre posti: «Oggi» (dove si segnano), «Spese e tasse» (dove si
leggono, divise per categoria, con il budget e il conguaglio) e «Registro spese». Tre voci
per una cosa sola sono due di troppo, e l'indice di «Altro» esiste proprio per non far
cercare.

**La voce è sparita** dall'indice e dal menu laterale (leggono lo stesso elenco,
`SCHEDE_SECONDARIE`). L'indice passa da sette voci a sei:

```
Spese e tasse · Scadenze · Le mie auto · Quanto rendo
Per il commercialista · Backup e impostazioni
```

**Ma la scheda resta, e si apre da «Spese e tasse».** L'elenco riga per riga è ancora
l'unico posto dove si **corregge una spesa vecchia** e si **governano quelle che si
ripetono** (la rata della licenza, il radio taxi): renderlo irraggiungibile avrebbe tolto
delle funzioni, non una voce di menu. In cima a «Spese e tasse» — che è dove uno lo va a
cercare — c'è la riga **«Tutte le spese, riga per riga»**.

Se preferisci che sparisca del tutto, si toglie anche quella riga in un attimo.

## Via il POS dal calendario (versione 79)

Il POS nella casella del calendario era nato quando l'incrocio fra giorno e metodo non
esisteva da nessuna parte. Adesso c'è il prospetto dei corrispettivi (v77), che lo dice per
**tutti e cinque** i metodi, in colonna e con i totali: nella casella restavano due numeri
sovrapposti in otto pixel, senza più servire a niente.

Tolto in tutti e quattro i punti della vista Calendario: la casella, il pannello del giorno
aperto, la testata del mese («POS del mese …») e la legenda. Con lui è sparito anche il
conteggio che lo alimentava, quindi la vista mensile fa un giro di conti in meno.

Effetto collaterale misurato: a 320px la schermata Giornate passa da **28 elementi con il
testo tagliato a zero** — era proprio quel numero in otto pixel a non starci.

Il totale della giornata nella casella resta, ed è invariato. **Nella scheda «Giornate» la
riga «di cui POS» resta dov'era**: lì lo spazio c'è, e serve a chi guarda una giornata alla
volta.

## Il nome e la versione, anche sul telefono (versione 78)

Il menu laterale, dove stavano il nome dell'app e il numero di versione, sul telefono è
nascosto dalla 74: ne restava solo una riga in fondo ad «Altro». Ma **la versione va vista a
colpo d'occhio**: è il primo controllo quando ci si chiede se l'aggiornamento è arrivato
davvero — ed è già successo di restare fermi su una versione vecchia senza accorgersene.

Adesso in cima c'è una striscia da 57px (non il blocco alto che c'era prima della 74) con
l'icona, **TaxiManager** e la pastiglia della versione. Su schermo largo non compare: lì il
menu laterale la dice già.

**La pastiglia si tocca** e porta in «Backup e impostazioni», dove c'è «Aggiorna adesso»: il
giro che si fa davvero è *che versione ho? è vecchia? aggiorno*, e adesso sono due tocchi
invece di quattro. Il numero lo scrive il programma da `VERSIONE_APP`, in tutti e due i
posti, così non può restare indietro rispetto al codice.

## Il prospetto dei corrispettivi (versione 77)

Il registro dei corrispettivi si compila una data alla volta, e per ogni data serve la
divisione per come hanno pagato. I numeri c'erano già tutti, ma sparsi: il totale del mese
per metodo da una parte, il totale del giorno dall'altra, e **l'incrocio — che è esattamente
quello che va trascritto — da nessuna parte**.

In `Andamento → Mese` c'è adesso **Corrispettivi giorno per giorno**: una riga per data, una
colonna per metodo, il totale del mese in fondo.

```
Giorno          Contanti     POS   Satispay      App   Fattura     Totale
01/09 mar · 2     120,00   80,50       0,00     0,00      0,00     200,50
02/09 mer · 2      95,00    0,00      22,30     0,00      0,00     117,30
04/09 ven · 3       0,00    0,00       0,00    63,00    200,00     263,00
Totale Settembre  215,00   80,50      22,30    63,00    200,00     580,80
```

- **Il filtro** in cima isola un metodo alla volta: comodo quando si trascrive una voce per
  volta, o per controllare solo il POS.
- **Le colonne vuote non si mostrano.** Cinque colonne di cui tre a zero rendono la tabella
  illeggibile su un telefono: compaiono solo i metodi che nel mese hanno qualcosa.
- **La colonna del giorno resta ferma** mentre si scorre di lato (`.col-ferma`). Con cinque
  metodi su un telefono, senza questo si perde di vista la riga che si sta copiando.
- **Toccando la data** si apre quel giorno nel riepilogo giornaliero, per vedere le singole
  corse.
- **I giorni senza incassi non compaiono**, e una riga in fondo dice quanti sono: «in
  Settembre sono 27 su 30».
- **Un metodo scritto a mano** o arrivato da una versione vecchia non sparisce dal conto:
  `famigliaMetodo()` lo riporta a una delle cinque colonne, e «App» raccoglie il resto. Un
  incasso segnato «Voucher comunale» finisce in App, non nel nulla.
- **Solo gli incassi**: le spese non entrano in questo prospetto.

C'è anche **«Scarica questo prospetto (.csv)»**, per chi compila i corrispettivi al computer
e preferisce tenersi il foglio aperto accanto invece di leggerlo dal telefono. Separatore
punto e virgola e virgola decimale, come si aspetta un Excel italiano:

```
"Data";"Contanti";"POS";"Satispay";"App";"Fattura";"Totale";"Corse"
"01/09/2026";"120,00";"80,50";"0,00";"0,00";"0,00";"200,50";"2"
"TOTALE";"215,00";"80,50";"22,30";"63,00";"200,00";"580,80";"7"
```

Il riquadro è pieghevole e si ricorda come l'hai lasciato, come il budget e il conguaglio.

## Tutti i metodi di pagamento, e la spesa che si vede (versione 76)

### Cinque tasti per la corsa, non due

La 75 aveva solo **Contanti** e **POS**. Sono la maggioranza, non sono tutto: Satispay, le
app e le convenzioni a fattura ci sono, e mandarle nel modulo completo voleva dire fare sei
passaggi proprio per i casi meno comuni — quelli in cui ti ricordi meno com'è che si fa.

```
💵 Contanti       💳 POS
🔴 Satispay       📱 App / Voucher
🧾 Fattura / Convenzione
```

I colori sono gli stessi delle pastiglie nel registro (verde contanti, nero POS, rosso
Satispay, blu app e fattura), così il tasto insegna la legenda mentre lo usi. Il valore
salvato è quello vero — `App/Nexi`, `Satispay`, `Fattura` — quindi i totali per metodo, il
«da versare» e i report li dividono correttamente.

### Quattro tasti per la spesa, e una correzione

La 75 aveva un tasto solo **«POS / Fattura»**, che salvava tutto come `Fattura`: due metodi
diversi finiti sotto un nome solo, con i conti per metodo che ne risentivano. Corretto.
Adesso sono quattro, quelli veri di una spesa:

```
💵 Contanti          💳 POS / Carta
⛽ Carta carburante   🧾 Fattura
```

Satispay e bonifico restano nel modulo completo, che si apre lì sotto senza cambiare scheda.

### «Segna una spesa» è un pulsante, non un link

Era un link sottolineato da 12px in fondo al riquadro, in mezzo ad altri comandi piccoli: si
faceva fatica a trovarlo, e la spesa si segna tutti i giorni quanto la corsa. Adesso è un
pulsante suo, largo tutta la schermata, 64px di altezza, testo da 18px, con l'icona del più
dentro un cerchio. Lo stesso pulsante compare anche nei giorni di riposo, dove la corsa è
bloccata ma la spesa no.

### Una classe sola per i tasti del metodo

Con il corpo normale «Satispay» e «App / Voucher» andavano a capo già a 375px, e quei due
tasti crescevano più degli altri: l'occhio legge una gerarchia che non c'è. La misura adesso
è definita una volta sola nel foglio di stile (`.tasto-metodo`), così il prossimo tasto non
può nascere di misura diversa per distrazione. Verificato a 320, 375 e 390px.

## Anche le spese stanno in «Oggi» (versione 75)

Il pieno si fa tutti i giorni, il lavaggio quasi: è lavoro di turno, non contabilità da
scrivania. Ma per segnarlo bisognava cambiare scheda — e la 74, spostando il registro spese
dentro «Altro», l'aveva pure allontanato di un tocco.

Adesso su «Oggi» c'è anche la spesa, con lo stesso meccanismo della corsa:

```
Stai segnando una spesa                     16/09/2026
Che spesa è?   [ Carburante ▾ ]
€ [ 62,35 ]
[ 💵 Contanti ]  [ 💳 POS / Fattura ]       ← ognuno salva
```

Il tipo di spesa propone l'ultimo usato, che nove volte su dieci è il carburante. Il metodo
di pagamento è il pulsante di conferma, come per la corsa, e dopo il salvataggio il campo
torna vuoto col cursore dentro. Il messaggio conferma anche il totale delle spese di
giornata. Sotto, «Nota, data diversa o spesa ricorrente» apre il **modulo completo lì
dentro**, senza cambiare scheda: `moduloUscitaHTML()` è stato estratto da `renderContent` e
adesso lo usano tutte e due le schermate.

**O la corsa o la spesa, non tutt'e due insieme.** Con i due pannelli aperti nella stessa
schermata c'erano due pulsanti «Contanti» uno sotto l'altro e due campi «quanto» — e non è
un'ipotesi: il primo giro di prove ha salvato come corsa un importo che doveva essere una
spesa, proprio per quell'ambiguità. Sono due lavori diversi, se ne fa uno per volta: aprendo
la spesa la corsa lampo si chiude, e da «← Torna alle corse» si rientra.

**Le spese si vedono dove si registrano.** Segnare il pieno e non vederlo comparire da
nessuna parte sarebbe un salto nel buio. Quindi:

- la testata della giornata dice anche `spese −77,35 €`;
- il riquadro verde in cima aggiunge `spese −77,35 € · ti resta 47,65 €`;
- aprendo la giornata, sotto le corse c'è **Spese della giornata**, con le stesse righe
  toccabili delle corse (si tocca, si apre, e lì dentro c'è anche «Elimina»).

**Nei giorni di riposo le spese si registrano lo stesso.** Le corse restano bloccate — un
incasso in un festivo vuol dire che il tipo di giornata è sbagliato — ma l'auto in un giorno
di riposo costa come sempre, e l'app lo diceva già («nei riposi le spese corrono lo stesso,
ma non c'è incasso a coprirle»). Sarebbe stato contraddittorio impedirne la registrazione.

Il **registro completo** di tutte le spese, con i filtri per tipologia e mese, resta in
«Altro → Registro spese»: quello si guarda a mese, non in mezzo al traffico.

## Tre schede, un riquadro, due tocchi (versione 74)

Secondo e ultimo passo della revisione. La 73 aveva sistemato quello che era
misurabilmente sotto misura senza spostare niente; qui si sposta.

### Tre destinazioni invece di nove

Il menu era piatto: nove porte tutte uguali in fila. Chi non è pratico le apre a caso
finché non ritrova quella giusta. Ma in turno si fanno tre cose, e le altre sei sono
roba da scrivania.

- **Oggi** — il turno, le corse, le spese della giornata
- **Andamento** — come sta andando, a giorno / mese / anno
- **Altro** — un indice scritto a parole, con sotto ogni voce cosa ci trovi

Sul telefono le tre stanno in una **barra in basso**, dove arriva il pollice, non in cima
allo schermo: una mano sola, telefono nel supporto, mezzo guanto. `env(safe-area-inset-bottom)`
le tiene sopra la barra di casa dell'iPhone. Su schermo largo resta il menu laterale, con le
tre in cima e le altre sotto una riga di separazione.

Le scadenze in corso **non** finiscono nel cassetto: l'avviso rosso compare su «Oggi» e su
«Andamento», dove si passa tutti i giorni. Una scadenza nascosta in un sottomenu è una
scadenza persa.

L'**anno di esercizio** non sta più in cima a ogni schermata: costava ~60px su nove schede e
si tocca due volte l'anno. Adesso è una pastiglia sulle quattro schermate i cui numeri
riguardano un anno preciso, più il menu laterale.

### Un riquadro solo, con l'interruttore del periodo

Era il problema più grosso e il meno evidente. «Andamento» impilava **tre riquadri con la
stessa identica struttura** — giornaliero, mensile, annuale — ripetendo venti etichette tre
volte: 4.492px, sessantasette numeri in colonna, cinquantatré elementi cliccabili. Uno sopra
l'altro non si confrontano nemmeno: per confrontarli dovresti vederli insieme, e insieme non
ci stanno.

Adesso è **lo stesso riquadro con tre posizioni**: `Oggi · Mese · Anno`. La scelta si ricorda.
Sopra c'è una testata comune (`testataPeriodo`) con **il** numero — uno solo, grande davvero —
e sotto le due righe che dicono cosa ne resta. Le quattro caselle che ripetevano incasso,
spese e saldo sono sparite: le diceva già la testata.

Nulla è stato tolto. Le spiegazioni lunghe (l'accantonamento, com'è fatta la quota
giornaliera) stanno dietro una riga che si apre, e le due sezioni più pesanti di «Spese e
tasse» — il budget dei costi fissi (1.224px) e il conguaglio (1.543px) — sono pieghevoli, con
lo stato ricordato in `localStorage` (`taxi_apri_*`): **piegare invece di cancellare**.

### La corsa in due tocchi

Il 95% delle corse è *oggi, contanti o POS, tot euro*. Prima erano sei passaggi: apri l'app,
scheda, scorri ~700px, «+ Nuova Corsa», quattro campi, salva.

Adesso il metodo di pagamento **è** il pulsante di conferma:

```
Quanto hai incassato?   [  18,50  ]
[ 💵 Contanti ]  [ 💳 POS ]     ← ognuno salva
```

Scrivi l'importo, tocchi il metodo, è salvata — e il campo torna vuoto col cursore dentro,
pronto per la successiva. Il messaggio conferma anche il totale della giornata. Invio da
tastiera usa l'ultimo metodo. Data, categoria e turno li mette il programma, e il blocco dei
giorni di riposo vale qui come nel modulo completo.

Il modulo completo non è sparito: sta sotto, dietro «Altro metodo, tratta o data diversa»,
per la convenzione, la tratta scritta, la data di ieri. Accanto c'è «+ Segna una spesa», così
il giro quotidiano sta tutto in una schermata.

### Le altre pulizie

- **«Mese (ignorato)»** era uno stato interno finito a video: un menu disattivato che dice
  «ignorato» fa pensare di aver sbagliato qualcosa. Tolto; al suo posto una riga che dice
  perché («stai guardando un giorno solo, quindi il mese non serve»).
- **I filtri** stavano sopra il registro e lo spingevano ~400px più giù. Adesso sono in fondo
  e chiusi, e si aprono da soli solo se un filtro c'è davvero — il giorno non conta, ha le
  sue frecce in cima e in uso normale c'è sempre.
- **I riquadri dei metodi** si mostrano solo se hanno qualcosa dentro: cinque riquadri di cui
  tre a 0,00 € sono tre righe di niente.
- **«Modifica» e «Elimina» su ogni riga**: una giornata da otto corse mostrava sedici
  pulsanti, metà dei quali cancellano. Adesso si tocca la riga e si apre, e «Elimina» sta
  lì dentro, dove stai già modificando quella corsa.
- **I nomi**: se una parola non la diresti a un collega al posteggio, non va scritta.
  «Bilancio & Statistiche» → «Come va il 2026». «Registro Uscite» → «Registro spese».
  «Spese & Deducibilità Fiscale» → «Spese e tasse». «Parco Auto» → «Le mie auto».
  «Report Finanziario & Stampa PDF» → «Per il commercialista». «Cloud & Sync» → «Backup e
  impostazioni». «Metodo Incasso» → «Come ha pagato?». «Importo (€)» → «Quanto?».
  «Azzera filtri» → «Mostra tutto». «Salva e chiudi» → «Salva e basta».

### Le misure, prima e dopo

| Schermata | v72 | v74 |
|---|---|---|
| Andamento | 4.202px · 67 numeri · 53 comandi | **1.752px · 29 numeri · 7 comandi** |
| Spese e tasse | 4.673px | **2.732px** |
| Oggi | 1.657px | **1.426px** (con la corsa lampo dentro) |
| Voci di menu | 9 | **3** (+ un indice) |

Verificato: a 375 e 390px non taglia e non sborda niente; a 320px restano i tagli che c'erano
già prima. Tutte le prove passano, più tre nuove: `testNav` (le tre destinazioni e l'indice),
`testLampo` (la corsa in due tocchi), `testVociNuovo` (il budget dietro il pieghevole).

## Comandi grandi e la virgola al posto giusto (versione 73)

Primo passo di una revisione dell'esperienza d'uso. Qui non si sposta niente di
posto: si sistema quello che era misurabilmente sotto misura. Le misure sono state
prese sulla versione 72, con un telefono da 375px e un mese di lavoro dentro.

**Ventidue comandi erano più piccoli del minimo.** «Elimina» era alto 25px, le frecce
del giorno e la × erano 36×36. Il minimo è 44px — è la misura di Apple (Human Interface
Guidelines) ed è anche il criterio WCAG 2.5.5. Con il telefono nel supporto, mezzo guanto
e gli occhiali da presbite, 25px non si centrano: o non succede niente, o si tocca quello
sbagliato, e lì accanto c'è «Elimina». Adesso sono **zero**. La regola sta nel foglio di
stile una volta sola (`button, select, summary, input { min-height: 44px }`) invece che
classe per classe, così vale anche per i comandi che verranno dopo e nessuno può nascere
piccolo per distrazione. I comandi quadrati chiedono il minimo anche in larghezza con la
classe `.tasto-icona`.

**Il tastierino non aveva la virgola.** Era il guaio più serio, ed era invisibile finché
non si guardava. I campi degli importi erano `type="number"`: su iPhone quel tipo apre un
tastierino **senza virgola decimale**. Chi scriveva `18,50` si ritrovava `1850`, o il
campo vuoto. Adesso sono `type="text" inputmode="decimal"`, che apre il tastierino giusto,
e a leggerli c'è `numeroScritto()` — che l'app aveva già e capisce sia la virgola sia il
punto, separatore delle migliaia compreso:

| scritto | salvato |
|---|---|
| `18,50` | 18,50 |
| `18.50` | 18,50 |
| `1.234,56` | 1.234,56 |

Riguarda dieci campi: i due importi (corsa e spesa), quello della riga che si apre per
modificare un movimento, le ore del turno, i tre valori delle vetture e i quattro della
scheda fiscale. I chilometri e l'anno restano interi, con `inputmode="numeric"`. Tutti i
punti che leggevano quei campi con `parseFloat` sono passati a `numeroScritto`: **un
campo che accetta la virgola e un lettore che non la sa leggere sarebbe stato peggio di
prima.**

Di conseguenza anche le ore a video si scrivono all'italiana (`oreScritte`): prima il
campo diceva `12,0` e due centimetri più in là la scheda diceva `12.0 h`.

**Quarantadue campi, nessuno collegato alla sua etichetta.** Le etichette c'erano come
testo ma nessuna era legata al campo con `for`: chi usa VoiceOver sentiva «campo di
testo», e basta. Ora lo sono tutte e 42, più `aria-label` sui menu a tendina e sui campi
data che un'etichetta a video non ce l'hanno (i filtri, il selettore dell'anno, le righe
di modifica). È anche un miglioramento per tutti: un `<label for>` rende cliccabile
l'etichetta, e allarga il bersaglio gratis.

**Il messaggio di conferma non lo annunciava nessuno.** `showToast()` è l'unica risposta
che l'app dà quando salvi una corsa. Adesso il riquadro è `role="status"` con
`aria-live="polite"`: viene letto ad alta voce senza interrompere quello che si sta
leggendo. Trentaquattro caratteri.

**Centoventidue scritte sotto i 12px** (`text-[10px]` e `text-[11px]`) sono salite a 12.
Sotto quella soglia non si legge con gli occhiali da presbite. Verificato: a 375 e 390px
non taglia niente e non sborda niente; a 320px restano i tagli che c'erano **già prima**
— nessuno nuovo.

Il prezzo onesto: bersagli più grandi e scritte più grandi occupano più spazio. La
schermata Giornate passa da 1.657 a 1.892px, la Dashboard da 4.202 a 4.492. È il passo
successivo della revisione — un riquadro solo con l'interruttore Oggi/Mese/Anno al posto
dei tre riepiloghi impilati — a restituire quello spazio con gli interessi.

## Le copie automatiche (versione 72)

Il backup da scaricare va bene finché uno si ricorda di farlo. Quello che serviva era
una copia che si facesse da sola, e che ci fosse anche il giorno in cui uno si accorge
di aver combinato un guaio il giorno prima.

Adesso l'app tiene **tre copie complete a rotazione** nella cartella privata su
Firestore, in `artifacts/{appId}/users/{uid}/istantanee/{0,1,2}`. L'appuntamento è ogni
notte alle 2:00: quella nuova prende il posto di quella di tre notti fa, così sotto mano
restano sempre gli ultimi tre giorni.

**Il limite da dire in chiaro:** un'app che sta nel telefono non può svegliarsi alle due
di notte a telefono spento — nessuna app web può. L'appuntamento delle 2:00 è l'ora a
cui la copia *scade*, non l'ora in cui parte il telefono: lo scatto avviene la prima
volta che si riapre l'app dopo quell'ora (`controllaIstantanea`, chiamata all'accensione
del Cloud e a ogni ritorno sull'app). Chi apre l'app tutti i giorni ha tutti i giorni la
sua copia; chi non la apre per una settimana, al rientro ne trova una sola, fatta lì per
lì. E serve l'accesso con Google: senza Cloud non c'è nessun posto dove metterla.

Come è fatta:

- `datiDaSalvare()` è lo stesso pacchetto del backup da scaricare — movimenti, turni,
  scadenze, vetture, voci di costo fisso, impostazioni fiscali — così i due non possono
  divergere.
- `slotIstantanea(quando)` conta i giorni interi e fa il resto per tre: ogni notte tocca
  uno slot diverso, ogni tre notti si ricomincia.
- `ultimoScatto()` è l'ultimo appuntamento passato (oggi alle due se le due sono
  passate, ieri alle due se è ancora notte fonda). Si confronta con
  `taxi_ultima_istantanea` in `localStorage`: se la copia è più vecchia dell'appuntamento
  si scatta, altrimenti no.
- Due freni che contano: non si scatta se il Cloud non è acceso, e **non si scatta se
  movimenti e turni sono entrambi vuoti** — i dati dal Cloud arrivano qualche secondo
  dopo l'accesso, e senza quel freno la prima copia della giornata sarebbe un archivio
  vuoto sopra una copia buona. Per lo stesso motivo il controllo all'avvio parte sei
  secondi dopo l'accensione del Cloud.
- Se la scrittura non riesce (rete assente, Cloud lento) non si segna niente: la copia si
  rifà alla prossima apertura.
- Un documento Firestore non può superare il megabyte e tre anni di corse lo superano:
  il documento dell'istantanea tiene solo la scheda (quando, quanti movimenti, quanti
  turni, quanti pezzi) e il contenuto sta in `parti/{n}` da 600.000 caratteri l'uno.
  Se la copia nuova è più corta di quella vecchia i pezzi che avanzano vengono
  cancellati, altrimenti resterebbero lì a occupare posto e a sporcare la rilettura.

In `Cloud & Backup` c'è il riquadro **Copie automatiche**: le tre copie con data, ora e
quanti movimenti e turni contengono, la più recente segnata in verde, un `Ripristina`
per ciascuna e un `Fai una copia adesso` per chi non vuole aspettare la notte.
Il ripristino passa da `applicaBackup()`, lo stesso del file: **unisce**, non cancella —
quello che c'è resta, quello che manca torna, e i movimenti con lo stesso identificativo
tornano come erano nella copia.

## Turni & Corse

Due viste: **Giornate** e **Calendario**. Quella scelta resta: riaprendo l'app si torna
dov'eri, come per la scheda.

### Due schede, due cose

**Giornate** sono le corse; **Calendario** sono i turni. Fino alla versione 63 stavano
insieme e la scheda era lunga il doppio: il turno della giornata, il modulo per registrarlo
e il promemoria dei km si mescolavano all'elenco degli incassi.

#### Giornate — le corse

L'ordine segue quello che si fa:

1. il **giorno** con le frecce ‹ › — il comando che si usa ogni volta;
2. i due **riepiloghi** — incasso, corse, media a corsa; turni, ore, km e **quanto rende
   un'ora** (`€/h`: l'incasso del periodo diviso le ore dei turni). Segue il filtro metodo
   come il riquadro verde, così i due numeri parlano sempre della stessa selezione, e
   sparisce quando nel periodo non ci sono turni — senza ore non c'è niente da dividere;
3. **+ Nuova Corsa**, subito dopo i numeri che ha appena fatto crescere, con l'avviso della
   giornata di riposo quando quella data non accetta incassi;
4. il **pannello dei filtri**: metodo di pagamento, mese, «Azzera filtri» e la ripartizione
   per metodo;
5. il **registro**, in fondo: una riga per giornata, che si apre e mostra le corse di quel
   giorno, ognuna modificabile ed eliminabile sul posto.

La testata di ogni giornata riporta il turno — tipo, ore, km, e l'etichetta **SENZA KM**
quando mancano — ma solo come informazione: il turno si tocca nel calendario.

#### Calendario — i turni

In cima **+ Registra Turno** con il suo modulo, e il promemoria «N turni senza km» con
**Vai al primo**, che porta il calendario sul mese giusto, apre il pannello di quella
giornata e mette i km in modifica. Sotto la griglia del mese; toccando un giorno si apre il
pannello con i tipi di turno, le giornate non lavorate, il riquadro di modifica di ore e km,
«Sposta ad altro giorno», «Elimina» e «Apri nelle giornate».

Il modulo del turno e il riquadro di modifica sono due funzioni a sé (`moduloTurnoHTML`,
`bloccoTurnoHTML`) proprio perché servono da due punti diversi.

### Niente corse nelle giornate di riposo

Se il filtro giorno è su una giornata segnata come non lavorata — festivo, recupero festivo,
malattia, sciopero — il pulsante «+ Nuova Corsa» è spento e al suo posto compare la
spiegazione, con **Apri nel calendario** per andare a cambiare il tipo di giornata se quel
giorno hai lavorato davvero. Il modulo eventualmente già aperto si chiude.

Il blocco non sta solo nel pulsante: `addCorsa` controlla la **data scritta nel modulo**,
che può essere diversa da quella del filtro, e rifiuta il salvataggio dicendo quale tipo di
giornata è di mezzo. La via d'uscita è sempre la stessa — cambiare il tipo di giornata —
così non ci si trova con un incasso in un giorno che l'app conta come riposo.

Vale anche il contrario: segnando come non lavorata una giornata che ha già degli incassi,
l'app chiede conferma dicendo quanto c'è registrato. Le corse non vengono toccate.

### I numeri nelle caselle del calendario

Ogni giornata lavorata mostra le ore, l'incasso totale in verde e,
sotto, la quota incassata **a POS** in blu. Sono solo le entrate con metodo `POS`: una
spesa pagata col bancomat non c'entra e non viene contata. Sopra la griglia c'è il totale
POS del mese, e toccando un giorno il pannello ripete incasso e POS per esteso. Quando in
una giornata non c'è POS la riga semplicemente non compare.

Il POS è scritto **con i centesimi**, perché è il numero che si confronta con l'estratto
conto e lì i centesimi contano; il totale della giornata resta arrotondato, che è una
lettura a colpo d'occhio. Nella casella il POS non porta il simbolo dell'euro: con i
centesimi «120,00 €» non ci starebbe, e su un telefono stretto verrebbe tagliato a metà.
A dire quali sono i due numeri ci pensa la legenda sotto la griglia — **● incassato** in
verde, **● di cui a POS** in blu.

Gli incassi del mese vengono contati **una volta sola**, in un passaggio, invece di
rileggere tutto l'archivio in ogni casella: con qualche anno di corse alle spalle la
differenza si sente.

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
- le **scadenze** no. Tutto sta nel calendario dell'anno (qui sotto): lì compaiono le date
  che ogni scadenza tocca in quell'anno, e lì si spuntano.

Quando la scadenza è stata fatta — revisione passata, bollo pagato — si spunta e sparisce
dall'elenco. L'app **non sposta mai una data da sola**: una scadenza passata e non spuntata
deve restare lì e diventare rossa, altrimenti sparirebbe proprio quando serve vederla.

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

- il **quadratino verde** spunta quella data come fatta, **e la riga sparisce**: quello che
  serve avere davanti è quello che resta da fare. Le fatte non sono perse — l'intestazione
  dice «*N* fatte» ed è un pulsante che le rimette in vista (la scelta viene ricordata).
  Dietro le quinte la scadenza si rimette sulla prima data ancora da fare, senza saltare le
  rate arretrate: se spunti febbraio e maggio non l'hai pagato, la prossima è maggio, non
  agosto. Ritogliendo la spunta si torna indietro.
- la **casella della data** sposta *solo quella occorrenza*. L'INPS teorico cade il 16
  agosto ma quell'anno si paga il 20: si cambia lì, e la serie resta intatta — l'anno dopo
  riparte dal 16.
- **Elimina** toglie la scadenza intera, con tutte le sue date: la conferma lo dice.

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

## Una sola voce «Carburante»

Nel **Registro Uscite** la tipologia si ricava da quello che viene prima del trattino o
della parentesi: «Manutenzione - Tagliando» diventa «Manutenzione». Col carburante non
bastava, perché negli anni l'hai scritto in modi diversi — «Carburante», «Carburante /
Diesel», «Diesel», «Carburante - Q8 corso Francia» — e nel menu delle tipologie comparivano
come voci separate, ognuna con il suo totale parziale.

Adesso `tipoSpesa` chiede prima a `categoriaBase`: se è carburante, la tipologia è
**«Carburante»** e basta. Nel menu fa una riga sola con il totale vero, e selezionandola il
filtro prende tutti i rifornimenti insieme, comunque siano scritti. Le altre categorie
continuano a dividersi per tipologia com'erano.

## Ogni spesa: cosa hai comprato, e come l'hai pagato

In **ogni categoria** le tipologie servono — un tagliando non è un treno di gomme — e
restano. Sotto, staccato da una riga e dall'etichetta **PER PAGAMENTO**, si aggiunge il
riepilogo di quanto è andato in contanti e quanto è passato dal conto (POS, fattura, app):

| Manutenzione (5) | 1.684,00 € |
| --- | --- |
| Gomme ×2 | 784,00 € |
| Tagliando ×2 | 600,00 € |
| Carrozzeria ×1 | 300,00 € |
| **per pagamento** | |
| POS / Fattura ×3 | 1.204,00 € |
| Contanti ×2 | 480,00 € |

La coda compare **solo se in quella categoria ci sono tutti e due i modi**: se è tutta in
contanti sarebbe la stessa cifra scritta una seconda volta, e non serve a niente.

L'unica categoria fatta diversamente è il **carburante**, che ha solo le due righe del
pagamento: lì le tipologie non distinguono niente (vedi qui sotto).

## Il carburante si divide per come l'hai pagato

Nel dettaglio delle **spese per categoria** — in Dashboard, nel riepilogo mensile e nel
Report — ogni categoria si apre nelle sue tipologie, cioè quello che viene dopo il trattino
o la parentesi. Per il carburante non funzionava: «Carburante / Diesel», «Carburante /
Diesel (Icad app)», «Carburante / Diesel (Fattura singola agip corso)», «Q8 fattura
236311km»… nove righe quasi uguali per dire la stessa cosa.

Il carburante fa eccezione e si divide in **due sole voci, per come è stato pagato**:

| | |
| --- | --- |
| Contanti | quello pagato al distributore di tasca |
| POS / Fattura | tutto il resto: POS, carta, fattura, app — quello che passa dal conto |

È `raggruppaCarburantePerPagamento`, che entra in gioco dentro `raggruppaPerTipologia`
quando le voci del gruppo sono di categoria `Carburante` (basta guardare la prima: un gruppo
contiene sempre una sola categoria di base). Una spesa **senza metodo di pagamento**
registrato finisce in «POS / Fattura», che è il comportamento della funzione
`famigliaMetodo` quando il campo è vuoto.

Le altre categorie restano divise per tipologia come prima: lì le diciture distinguono
davvero — un tagliando non è un treno di gomme.

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

## Quanto è già del fisco

L'IRPEF **non** è un costo fisso: è una percentuale sull'utile, e a utile zero non se ne
paga. Metterla a budget sposterebbe il pareggio nel posto sbagliato — in una giornata
storta l'app addebiterebbe una tassa che non è dovuta. I contributi INPS **sul minimale**
invece sì: quelli si pagano anche stando fermi, e vanno a budget come il resto.

Perciò, sotto il pareggio, il riquadro della giornata spacca in due quello che c'è
**sopra**:

| | |
| --- | --- |
| Da mettere da parte | la fetta del margine che è già del fisco |
| Tuoi | quello che resta davvero |

La percentuale non è quella media dell'anno, è quella **marginale**: quanto costa in tasse
l'euro guadagnato in più, allo scaglione dove ti trovi. Si ricava chiedendo due volte la
stima delle tasse — una sull'utile dell'anno, una su mille euro in più — e guardando la
differenza. A metà anno l'utile registrato viene annualizzato, altrimenti lo scaglione
risulterebbe più basso del vero; se ci sono movimenti con data futura si tiene il più alto
fra la proiezione e il totale scritto, così non falsano il conto.

In `Cloud & Sync → Impostazioni Fiscali` c'è il campo **Accantonamento sul margine (%)**:
lasciato **vuoto** lo calcola l'app come sopra, scrivendoci un numero si usa quello. Nel
riquadro c'è sempre scritto quale dei due sta usando.

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

## Gli orari del turno si vedono sempre

I turni predefiniti hanno gli orari **nel nome** — «L'una (13:00 - 1:00)» — ma
«Personalizzato» no: l'orario scelto a mano stava solo nei campi `inizio` e `fine` del
turno, e quando l'elenco dei turni è diventato la scheda Giornate quei due campi non li
mostrava più nessuno. Chi lavorava a orario libero non vedeva più a che ora aveva
attaccato.

Adesso il nome e gli orari si mostrano sempre separati: `nomeTurno` toglie la parentesi dal
nome e `orariTurno` prende gli orari dal turno registrato. Si legge **«Personalizzato ·
05:45 - 15:15 · 9.5 h»** e **«L'una · 13:00 - 01:00 · 12 h»** — senza ripetizioni, e con gli
orari veri anche quando sono stati corretti dopo averli salvati.

Vale nella testata di ogni giornata, nell'intestazione del pannello del calendario e nel
riquadro del turno.

## Verifica generale (versione 70)

Una passata di controllo su tutta l'app, con quattro bug veri trovati e sistemati e
un'ottimizzazione.

**Il ripristino da backup perdeva le impostazioni fiscali.** Il file le conteneva
(`impostazioniFiscali`), ma nessuno le rimetteva a posto: su un telefono nuovo aliquota
INPS, addizionali, soglia del forfettario e accantonamento tornavano ai valori di fabbrica
senza dire niente, e le stime delle tasse cambiavano di conseguenza. Ora vengono
ripristinate, validate una per una, e il messaggio finale lo dice.

**Benzina, GPL e metano finivano fra le «altre spese».** Il totale «Carburante» del Report e
della Dashboard usava un elenco di parole a parte che conosceva solo «carburante» e
«diesel», mentre il dettaglio per categoria usava `categoriaBase`, che conosce anche
benzina, GPL e metano: i due numeri non tornavano. Adesso decide `categoriaBase` in
tutti e due i posti.

**L'accantonamento impazziva a gennaio.** La proiezione dell'utile annualizzava i giorni
trascorsi: il 3 gennaio con 500 € di utile diceva 60.833 € e mandava l'aliquota marginale al
50,6%. Ora nei primi due mesi si appoggia all'**utile vero dell'anno prima**, e se non c'è
un anno prima non moltiplica mai per più di dodici.

**Due turni nello stesso giorno** — l'app li permette, chiedendo conferma — comparivano come
uno solo nel registro mentre ore e km li contavano entrambi. Adesso la testata della
giornata li somma («2 turni · 12.0 h»), l'etichetta *senza km* guarda tutti i turni del
giorno, e il pannello del calendario avverte che ce n'è più di uno.

**La Dashboard si ridisegna in un terzo del tempo.** Il grafico del mese chiamava
`aggrega()` una volta per colonna — trentuno riletture complete di movimenti e turni, con
tanto di ordinamenti e raggruppamenti per categoria — e quello dell'anno altre dodici. Ora
c'è `totaliPerChiave`, che fa un giro solo e raccoglie per giorno o per mese. Su un archivio
di prova da tre anni (10.656 corse, 1.008 turni) il ridisegno passa da **34 a 13
millisecondi**, e `serieMensile` da 10 a 1.

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
