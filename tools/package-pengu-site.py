"""Build pengu-site.zip: a Netlify-ready site with the Pengu page as its homepage.

    python3 tools/package-pengu-site.py

Unzip it and drag the pengu-site folder onto app.netlify.com/drop (or onto the Deploys tab of an
existing Netlify site to update it).
"""
import pathlib
import shutil
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
OUT = ROOT / 'pengu-site.zip'

with tempfile.TemporaryDirectory() as tmp:
    dest = pathlib.Path(tmp) / 'pengu-site'
    (dest / 'img').mkdir(parents=True)
    shutil.copy(SITE / 'clearhealth-pengu.html', dest / 'index.html')
    for name in ['pengu.css', 'favicon.svg', 'og-pengu.jpg', '_headers']:
        shutil.copy(SITE / name, dest / name)
    shutil.copytree(SITE / 'fonts', dest / 'fonts')
    shutil.copytree(SITE / 'js', dest / 'js')
    for img in SITE.glob('img/*.webp'):
        if img.name.startswith(('stage-pengu-', 'station-', 'pengu-lamp-')):
            shutil.copy(img, dest / 'img' / img.name)
    shutil.copy(SITE / '404.html', dest / '404.html')
    shutil.make_archive(str(OUT.with_suffix('')), 'zip', tmp, 'pengu-site')

print('wrote', OUT, OUT.stat().st_size, 'bytes')
