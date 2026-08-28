# Conti — aziendale e famigliare

Applicazione web (PWA) per tenere sotto controllo due conti correnti separati:
quello dell'attività e quello di famiglia. Movimenti, giroconti fra i due conti,
budget mensili, pagamenti ricorrenti con scadenze, report annuale ed esportazione.

Si installa sulla schermata Home di iPhone e Mac e funziona anche senza rete.
È indipendente da TaxiManager: archivio separato, propria icona, proprio
service worker.

## File

| File | A cosa serve |
| --- | --- |
| `index.html` | L'app completa: interfaccia, calcoli e salvataggio |
| `sw.js` | Service worker: tiene l'app disponibile anche senza campo |
| `manifest.json` | Dati di installazione (nome, icone, colori) |
| `icon-*.png`, `favicon*`, `apple-touch-icon-180.png` | Icone dell'app |

Nessuna libreria esterna: niente CDN da scaricare, l'app si apre subito e la
grafica c'è anche alla prima apertura offline.

## Come sono organizzati i dati

- **Conti** — nome, ambito (aziendale o famigliare) e saldo di partenza.
  Il saldo di partenza è quello dell'estratto conto a una certa data: da lì in
  poi l'app somma i movimenti registrati.
- **Movimenti** — entrate, uscite e giroconti. Un giroconto è **un solo**
  movimento con conto di partenza e di arrivo: toglie da uno e aggiunge
  all'altro, e non entra nei totali di entrate e uscite del periodo. È il caso
  del prelievo dal conto aziendale verso quello di famiglia.
- **Budget** — un tetto di spesa mensile su una categoria, valido per tutti i
  mesi. Cambia solo quanto ne hai consumato nel mese che stai guardando.
- **Pagamenti ricorrenti** — rate, bollette, assicurazioni, F24. Si inseriscono
  una volta; l'app calcola la data della prossima e la segnala. **Il movimento
  non viene creato da solo**: alla scadenza lo registri con un tocco, dopo aver
  controllato che sia davvero passato sul conto. Un addebito scritto in
  automatico e mai andato a buon fine falserebbe il saldo senza accorgersene.

Tutto resta nella memoria del browser di questo dispositivo. Da Impostazioni si
scarica un backup JSON (è anche il modo per spostare i dati su un altro
dispositivo) e un CSV dell'anno per il commercialista.

## Caricare l'estratto conto della banca

Da **Movimenti → Carica l'estratto conto** (o dalle Impostazioni) si carica il file dei
movimenti scaricato dall'home banking. La procedura ha tre passi: scelta del file,
controllo delle colonne, revisione delle categorie proposte. **Niente entra in archivio
prima dell'ultimo tocco.**

Il file viene letto dentro il browser del dispositivo: non viene inviato da nessuna parte.

### Formati

`CSV` e `Excel (.xlsx)` — i due che tutte le banche italiane offrono. Vengono gestiti da
soli: separatore `;` `,` o tabulazione, testo in UTF-8 o Windows-1252, righe di
intestazione della banca prima della tabella vera, importi `1.234,56` o `1234.56`, date
`gg/mm/aaaa` `aaaa-mm-gg` o numero seriale di Excel, e sia la colonna unica con il segno
sia le due colonne separate Dare/Avere.

Il **PDF non è supportato**: è un formato di impaginazione, non di dati, e l'estrazione
dei numeri sarebbe inaffidabile proprio dove sbagliare costa di più. Nell'home banking il
CSV sta di norma accanto al pulsante del PDF.

L'Excel viene aperto con `DecompressionStream`, incluso nei browser recenti (iOS 16.4+).
Su un browser più vecchio l'app lo dice e chiede il CSV.

### Come vengono assegnate le categorie

Nell'ordine:

1. **Come hai già classificato tu** un'operazione con la stessa descrizione, guardando i
   movimenti in archivio e le correzioni fatte nelle importazioni precedenti.
2. **Le regole che hai salvato**.
3. **Un elenco di partenza** di insegne e causali italiane (Q8, Esselunga, Enel, SDD, F24,
   INPS, Telepass, POS, prelievi ATM, commissioni bancarie…).

Il confronto avviene sull'*impronta* della descrizione: tolti numeri, date e codici di
riferimento, resta la parte che si ripete uguale ogni mese. Ogni categoria corretta a mano
durante l'importazione viene ricordata e si ritrova alla volta successiva; le regole
imparate si vedono e si cancellano dalle Impostazioni.

### Doppioni

Ricaricando un estratto conto che si sovrappone al precedente, le operazioni già presenti
vengono riconosciute (stessa data, stesso importo, stessa impronta della descrizione),
segnalate in giallo ed **escluse dalla selezione**. Restano importabili spuntandole a mano,
se sono davvero due operazioni identiche nello stesso giorno.

## Accendere la sincronizzazione fra dispositivi

L'app è già predisposta ma parte in locale. In `index.html` c'è l'oggetto
`Sync`, con tre metodi vuoti che vengono chiamati a ogni scrittura:

```js
const Sync = {
  attivo: false,
  inviato(collezione, elemento) { },   // scrittura sul Cloud
  rimosso(collezione, id)       { },   // cancellazione sul Cloud
  avvia()                       { }    // ascolto delle modifiche altrui
};
```

Per accendere il Cloud basta riempirli (per esempio con Firestore) senza toccare
il resto dell'app. Prima di farlo conviene sistemare le regole di sicurezza del
progetto Firebase: quelle usate oggi da TaxiManager tengono i dati in un percorso
pubblico, e un archivio bancario merita un percorso legato al singolo utente.

## Pubblicare un aggiornamento

Dopo ogni modifica ai file va aumentato il valore di `VERSIONE` in `sw.js`
(`conti-v1` → `conti-v2`), altrimenti il telefono continua a usare la copia
salvata. Quando la versione nuova è pronta l'app lo segnala.
