/* Configurazione per rifare il foglio di stile incorporato in index.html.
   Tailwind legge index.html, tiene solo le classi che ci trova davvero e
   scrive un CSS di una trentina di kilobyte invece dei due megabyte del
   pacchetto intero. Le istruzioni sono nel README, "Rifare il foglio di stile". */
module.exports = {
  content: ['./index.html'],
  theme: { extend: {} },
  plugins: []
};
