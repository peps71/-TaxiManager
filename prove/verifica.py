import pathlib
# Controlla che i blocchi <script> di index.html siano sintatticamente validi.
import re, subprocess, sys, pathlib
sorgente = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').read_text(encoding='utf-8')
blocchi = re.findall(r'<script(?P<attr>[^>]*)>(?P<corpo>.*?)</script>', sorgente, re.S)
interni = [(a, c) for a, c in blocchi if 'src=' not in a]
tmp = pathlib.Path(str(pathlib.Path(__file__).resolve().parent / '_blocchi'))
tmp.mkdir(exist_ok=True)
for i, (attr, corpo) in enumerate(interni):
    f = tmp / f'b{i}.mjs'
    f.write_text(corpo, encoding='utf-8')
    r = subprocess.run(['node', '--check', str(f)], capture_output=True, text=True)
    if r.returncode:
        print(f'BLOCCO {i} NON VALIDO'); print(r.stderr[:1500]); sys.exit(1)
print(f'sintassi ok · {len(interni)} blocchi · {sorgente.count(chr(10))+1} righe')
