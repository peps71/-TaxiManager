#!/bin/sh
# Il giro completo delle prove di TaxiManager.
# Si lancia dalla cartella del repository:   sh prove/tutte.sh
# Serve node con Playwright. Se sta in un posto suo:  PLAYWRIGHT=/percorso/index.mjs sh prove/tutte.sh
cd "$(dirname "$0")/.." || exit 1
P=prove
# Una prova che si interrompe a meta' (un'eccezione, un tasto che non si
# trova, un tempo scaduto) non stampa nessun «***»: muore e basta, e nel
# fiume dell'uscita passava per buona. Il suo codice d'uscita si perdeva nel
# tubo verso grep, perche' sh di un tubo guarda solo l'ultimo comando. Qui
# il codice si mette da parte in un file, prima del tubo, e si rilegge dopo.
# Si tiene il conto anche delle prove che hanno stampato «***» senza
# interrompersi: alla fine il riepilogo le nomina tutte, e lo script esce
# con errore se ce n'e' anche una sola.
ESITO=$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/tutte-esito.$$")
USCITA=$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/tutte-uscita.$$")
trap 'rm -f "$ESITO" "$USCITA"' EXIT
trap 'exit 130' INT TERM
rosse=0;   interrotte=""
segnate=0; con_stelle=""
titolo() { echo; echo "=== $1 ==="; }
giro() {
  echo 99 > "$ESITO"
  { node "$P/$1" 2>&1; echo $? > "$ESITO"; } | grep -v agent-proxy | tee "$USCITA"
  codice=$(cat "$ESITO")
  if [ "$codice" != 0 ]; then
    echo "*** $1 si e' interrotta: codice d'uscita $codice ***"
    rosse=$((rosse + 1)); interrotte="$interrotte $1"
  elif grep -q '[*][*][*]' "$USCITA"; then
    segnate=$((segnate + 1)); con_stelle="$con_stelle $1"
  fi
}

titolo "sintassi";                python3 "$P/verifica.py" || exit 1
titolo "classi CSS";              python3 "$P/classi.py"   || exit 1
titolo "le dieci schermate";      giro smoke.mjs
titolo "impaginazione";           giro sbordo.mjs
titolo "testo tagliato";          giro troncati.mjs
titolo "uso vero dell'app";       giro testUso.mjs
titolo "casi limite";             giro testLimiti.mjs
titolo "dati storti";             giro storti.mjs
titolo "una sola base imponibile"; giro baseUnica.mjs
titolo "coerenza dei conti";      giro coerenza.mjs
titolo "coerenza del report";     giro coerenza2.mjs
titolo "coerenza del motore";     giro coerenza3.mjs
titolo "coerenza a video";        giro coerenzaVideo.mjs
titolo "integrita' dei dati";     giro testIntegrita.mjs
titolo "ripristino con conferma"; giro testRipristino.mjs
titolo "file che escono (CSV e nomi)"; giro testEsporta.mjs
titolo "il giro dei giorni";      giro testGiorni.mjs
titolo "previsione e realta'";    giro testPrevisioneRealta.mjs
titolo "indice dei pagamenti";    giro testIndiceVivo.mjs
titolo "budget e proposte";       giro testBudget118.mjs
titolo "budget compatto";         giro testBudgetCompatto.mjs
titolo "rinominare una voce";     giro testRinomina.mjs
titolo "spese senza voce";        giro testOrfane.mjs
titolo "versamenti contanti";     giro testVersamenti.mjs
titolo "note degli avvenimenti"; giro testNote.mjs
titolo "foto allegate";           giro testFoto.mjs
titolo "impostazioni fiscali";    giro testFiscali.mjs
titolo "conguaglio apribile";     giro testConguaglio.mjs
titolo "costo e pareggio";        giro testPareggio.mjs
titolo "corse da verificare";     giro testVerifica.mjs
titolo "corse fuori misura";      giro testCorsaStrana.mjs
titolo "riassegna a una voce";    giro testAssegna.mjs
titolo "scadenze dal budget";     giro testScadenzeBudget.mjs
titolo "confronto anno su anno";  giro testConfronto.mjs
titolo "scadenze";                giro testScadenze.mjs
titolo "spese spalmate";          giro testSpalmate.mjs
titolo "incasso coperto";         giro testCoperto.mjs
titolo "spazio e archivio";       giro testSpazio.mjs
titolo "media fuori budget";      giro mediaAltre.mjs
titolo "iniezione dal backup";    giro testIniezione.mjs
titolo "iniezione da id e date";  giro testIniezioneDate.mjs
titolo "backup coi tipi storti";  giro testBackupTipi.mjs
titolo "protezione indirizzi";    giro testCspViva.mjs
titolo "archivi sincronizzati";   giro testArchivi.mjs
titolo "modifiche in attesa del Cloud"; giro testSospesi.mjs
titolo "senza campo, col Cloud finto"; giro testOffline.mjs
titolo "cambio di account, col Cloud finto"; giro testAccount.mjs
titolo "quando il Cloud o il disco dicono no"; giro testSpedizione.mjs
titolo "righe rifiutate e blocchi smontati"; giro testRifiuti.mjs
titolo "grafica e misure";        giro testGrafica.mjs
titolo "modo scuro";              giro testScuro.mjs
titolo "il logo";                 giro testLogo.mjs
titolo "annullare un modulo";     giro testAnnulla.mjs
titolo "annulla dopo corsa e spesa veloci"; giro testAnnullaVeloce.mjs
titolo "campi, tastiera e tasti sull'iPhone"; giro testIphone.mjs
titolo "tasti sopra l'importo";        giro testTastiSopra.mjs
titolo "rendimento vuoto e date storte"; giro testRendimento.mjs
titolo "turno di notte e cambio d'ora"; giro testNotte.mjs
titolo "ore del turno";           giro testOreTurno.mjs
titolo "navigazione da tastiera"; giro testTastiera.mjs
titolo "il tasto Oggi";           giro testOggi.mjs
titolo "manutenzione programmata"; giro testManutenzione.mjs
titolo "registro a turno chiuso"; giro testTurnoChiuso.mjs
titolo "la pausa dello spezzato"; giro testSpezzato.mjs
titolo "disegni accodati";        giro testDisegni.mjs
titolo "si installa come app";    giro installabile.mjs
titolo "service worker";          giro testSW.mjs
titolo "arrivo degli aggiornamenti"; giro testAggiorna.mjs
titolo "prestazioni";             giro avvio.mjs
titolo "profilo delle schermate"; giro profilo2.mjs
echo
echo "=== riepilogo ==="
if [ "$rosse" -gt 0 ]; then
  echo "*** $rosse prove si sono interrotte:$interrotte ***"
fi
if [ "$segnate" -gt 0 ]; then
  echo "*** $segnate prove hanno segnato qualcosa che non torna:$con_stelle ***"
fi
if [ "$rosse" -eq 0 ] && [ "$segnate" -eq 0 ]; then
  echo "nessuna prova interrotta, nessun «***»."
fi
echo "fine. Cerca «***» qui sopra: e' il segno di qualcosa che non torna."
[ "$rosse" -eq 0 ] && [ "$segnate" -eq 0 ]
