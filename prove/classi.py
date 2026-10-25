import pathlib
# Una classe usata ma non definita non da' errore: semplicemente non fa niente,
# in silenzio. E' successo con tre classi della striscia in cima.
import io, re, sys
testo = io.open(pathlib.Path(__file__).resolve().parent.parent / 'index.html', encoding='utf-8').read()
css = '\n'.join(re.findall(r'<style>(.*?)</style>', testo, re.S))
def coperta(c):
    nome = c.replace('[','\\[').replace(']','\\]').replace('/','\\/').replace('.','\\.').replace(':','\\:').replace('%','\\%')
    return re.search(r'\.' + re.escape(nome) + r'(?=[{,:\s>\.])', css) is not None
righe = testo.split('\n')
idx = max(range(len(righe)), key=lambda i: len(righe[i]))   # il foglio di stile
usate = set()
for i, r in enumerate(righe):
    if i == idx: continue
    for m in re.finditer(r'class="([^"]*)"', r):
        dentro = m.group(1)
        # Le classi scritte dentro un pezzo calcolato - class="${pari ? '' :
        # 'bg-yellow-100'}" - prima sparivano insieme al pezzo, e una classe
        # inesistente li' dentro non la vedeva nessuno. Adesso si guardano
        # anche quelle: si prendono i pezzi fra apici e si tengono solo le
        # parole che possono essere una classe (con un trattino o due punti),
        # cosi' un «si»/«no» di un ternario non viene scambiato per una.
        for lett in re.findall(r"'([^']*)'|`([^`]*)`", dentro):
            for pezzo in lett:
                for c in pezzo.split():
                    if re.fullmatch(r'[a-z0-9:\[\]/.%\-]+', c) and ('-' in c or ':' in c): usate.add(c)
        t = re.sub(r'\$\{[^}]*\}', ' ', dentro)
        for c in t.split():
            if c and '$' not in c and '{' not in c: usate.add(c)
# Le classi non stanno solo negli attributi class="...": alcune vivono in una
# costante JS (CLASSE_MINIATURA e simili) e di li' finiscono nel disegno. Senza
# guardarle anche qui, una classe inesistente dentro una costante passerebbe
# liscia - ed e' successo con w-14 e h-14 alle miniature delle foto.
for m in re.finditer(r"const CLASSE_[A-Z_]+ = '([^']*)'", testo):
    for c in m.group(1).split():
        if c and '$' not in c and '{' not in c: usate.add(c)
manca = sorted(c for c in usate if not coperta(c))
if manca:
    print(f'*** {len(manca)} CLASSI USATE MA NON DEFINITE: {", ".join(manca)}')
    sys.exit(1)
print(f'classi: {len(usate)} usate, tutte definite')
