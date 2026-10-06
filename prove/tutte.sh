#!/bin/sh
# Il giro completo delle prove di TaxiManager.
# Si lancia dalla cartella del repository:   sh prove/tutte.sh
# Serve node con Playwright. Se sta in un posto suo:  PLAYWRIGHT=/percorso/index.mjs sh prove/tutte.sh
cd "$(dirname "$0")/.." || exit 1
P=prove
rosso=0
titolo() { echo; echo "=== $1 ==="; }
giro()   { node "$P/$1" 2>&1 | grep -v agent-proxy; }

titolo "sintassi";                python3 "$P/verifica.py" || exit 1
titolo "classi CSS";              python3 "$P/classi.py"   || exit 1
titolo "le dieci schermate";      giro smoke.mjs
titolo "impaginazione";           giro sbordo.mjs
titolo "testo tagliato";          giro troncati.mjs
titolo "uso vero dell'app";       giro testUso.mjs
titolo "casi limite";             giro testLimiti.mjs
titolo "coerenza dei conti";      giro coerenza.mjs
titolo "coerenza del report";     giro coerenza2.mjs
titolo "coerenza a video";        giro coerenzaVideo.mjs
titolo "integrita' dei dati";     giro testIntegrita.mjs
titolo "il giro dei giorni";      giro testGiorni.mjs
titolo "previsione e realta'";    giro testPrevisioneRealta.mjs
titolo "indice dei pagamenti";    giro testIndiceVivo.mjs
titolo "budget e proposte";       giro testBudget118.mjs
titolo "budget compatto";         giro testBudgetCompatto.mjs
titolo "conguaglio apribile";     giro testConguaglio.mjs
titolo "costo e pareggio";        giro testPareggio.mjs
titolo "corse da verificare";     giro testVerifica.mjs
titolo "riassegna a una voce";    giro testAssegna.mjs
titolo "scadenze dal budget";     giro testScadenzeBudget.mjs
titolo "confronto anno su anno";  giro testConfronto.mjs
titolo "scadenze";                giro testScadenze.mjs
titolo "spese spalmate";          giro testSpalmate.mjs
titolo "incasso coperto";         giro testCoperto.mjs
titolo "spazio e archivio";       giro testSpazio.mjs
titolo "media fuori budget";      giro mediaAltre.mjs
titolo "iniezione dal backup";    giro testIniezione.mjs
titolo "protezione indirizzi";    giro testCspViva.mjs
titolo "disegni accodati";        giro testDisegni.mjs
titolo "service worker";          giro testSW.mjs
titolo "arrivo degli aggiornamenti"; giro testAggiorna.mjs
titolo "prestazioni";             giro avvio.mjs
titolo "profilo delle schermate"; giro profilo2.mjs
echo
echo "fine. Cerca «***» qui sopra: e' il segno di qualcosa che non torna."
