"""Bundle original user sprite sheets and game sources into one offline HTML."""
from pathlib import Path
import base64
import zipfile
import json
import hashlib

root = Path(__file__).resolve().parent
sheets={str(n):'data:image/png;base64,'+base64.b64encode((root/f'assets/custom/sheet-{n}.png').read_bytes()).decode() for n in range(3,11)}
sprites=json.loads((root/'assets/custom/sprites.json').read_text(encoding='utf8'))
assets='window.TAVERN_SHEETS='+json.dumps(sheets)+';\nwindow.TAVERN_SPRITES='+json.dumps(sprites)+';'
(root / 'assets.js').write_text(assets, encoding='utf-8')
html = (root / 'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="layout.css">','<style>'+(root/'layout.css').read_text(encoding='utf8')+'</style>')
html=html.replace('<link rel="stylesheet" href="clarity.css">','<style>'+(root/'clarity.css').read_text(encoding='utf8')+'</style>')
scripts=['assets.js','art.js','assembly.js','scene.js','dashboard.js','game.js']
for name in scripts:
    html=html.replace(f'<script src="{name}"></script>','<script>'+(root/name).read_text(encoding='utf8')+'</script>')
(root / 'Tavern.html').write_text(html, encoding='utf-8')
print('Built Tavern.html:', (root / 'Tavern.html').stat().st_size, 'bytes')
version=(root/'VERSION').read_text(encoding='utf8').strip()
files=['Tavern.html','index.html','layout.css','clarity.css','README.md','VERSION','.gitignore','build.py','prepare_assets.py','smoke-test.cjs',*scripts]
files += [f'assets/custom/sheet-{n}.png' for n in range(3,11)] + ['assets/custom/sprites.json']
files += sorted(path.relative_to(root).as_posix() for path in (root/'docs').rglob('*.md'))
manifest={'project':'Monster Tavern Tycoon','version':version,'snapshot_date':'2026-09-11','files':{}}
for name in files:
    data=(root/name).read_bytes()
    manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(root/'RELEASE-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
archive_path=root/f'Monster-Tavern-v{version}.zip'
with zipfile.ZipFile(archive_path,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in files+['RELEASE-MANIFEST.json']:
        archive.write(root/name,'monster-tavern/'+name)
print('Built',archive_path.name,'with',len(files)+1,'files and SHA-256 manifest')
