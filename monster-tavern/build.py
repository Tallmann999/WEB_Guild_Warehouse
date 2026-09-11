"""Bundle original user sprite sheets and game sources into one offline HTML."""
from pathlib import Path
import base64
import zipfile
import json

root = Path(__file__).resolve().parent
sheets={str(n):'data:image/png;base64,'+base64.b64encode((root/f'assets/custom/sheet-{n}.png').read_bytes()).decode() for n in range(3,11)}
sprites=json.loads((root/'assets/custom/sprites.json').read_text(encoding='utf8'))
assets='window.TAVERN_SHEETS='+json.dumps(sheets)+';\nwindow.TAVERN_SPRITES='+json.dumps(sprites)+';'
(root / 'assets.js').write_text(assets, encoding='utf-8')
html = (root / 'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="layout.css">','<style>'+(root/'layout.css').read_text(encoding='utf8')+'</style>')
scripts=['assets.js','art.js','assembly.js','scene.js','dashboard.js','game.js']
for name in scripts:
    html=html.replace(f'<script src="{name}"></script>','<script>'+(root/name).read_text(encoding='utf8')+'</script>')
(root / 'Tavern.html').write_text(html, encoding='utf-8')
print('Built Tavern.html:', (root / 'Tavern.html').stat().st_size, 'bytes')
with zipfile.ZipFile(root / 'Monster-Tavern-Prototype.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['Tavern.html','index.html','layout.css','README.md','build.py','prepare_assets.py','smoke-test.cjs',*scripts]:
        archive.write(root / name, 'monster-tavern/' + name)
    for source in (root/'assets/custom').glob('*'):
        archive.write(source,'monster-tavern/assets/custom/'+source.name)
print('Built source archive')
