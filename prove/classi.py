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
        t = re.sub(r'\$\{[^}]*\}', ' ', m.group(1))
        for c in t.split():
            if c and '$' not in c and '{' not in c: usate.add(c)
manca = sorted(c for c in usate if not coperta(c))
if manca:
    print(f'*** {len(manca)} CLASSI USATE MA NON DEFINITE: {", ".join(manca)}')
    sys.exit(1)
print(f'classi: {len(usate)} usate, tutte definite')
