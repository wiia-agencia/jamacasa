#!/bin/sh
# Compila la vista previa privada y la deja lista para publicar como artefacto.
set -e
cd "$(dirname "$0")/.."
npx vite build --mode vista
python3 - <<'PY'
import re
src = open('dist-vista/index.html', encoding='utf-8').read()
s = re.sub(r'<!doctype html>\s*', '', src, flags=re.I)
s = re.sub(r'</?html[^>]*>', '', s, flags=re.I)
s = re.sub(r'</?head>', '', s, flags=re.I)
s = re.sub(r'</?body[^>]*>', '', s, flags=re.I)
s = re.sub(r'<meta charset="UTF-8"\s*/?>', '', s, flags=re.I)
s = re.sub(r'<meta name="viewport"[^>]*>', '', s, flags=re.I)
s = re.sub(r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>', '', s, flags=re.I)
s = s.replace('<title>La Jamacasa</title>', '<title>La Jamacasa</title>\n<meta name="claude:viewport-fit-sides" content="cover">', 1).strip()
open('dist-vista/jamacasa.html', 'w', encoding='utf-8').write(s)
print('dist-vista/jamacasa.html lista')
PY
