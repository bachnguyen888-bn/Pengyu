"""Build pengu-site.zip: a Netlify-ready site with the Pengu page as its homepage.

    python3 tools/package-pengu-site.py

Unzip it and drag the pengu-site folder onto app.netlify.com/drop (or onto the Deploys tab of an
existing Netlify site to update it).

The zip carries everything the app needs to install and work offline: the service worker (sw.js),
the web manifest and its icons, the privacy page, and site/_redirects (for /privacy). The app page
becomes index.html; sw.js keeps it as "./", so both layouts work.
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
    for name in ['pengu.css', 'favicon.svg', 'og-pengu.jpg', '_headers', '_redirects',
                 'sw.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'privacy.html']:
        shutil.copy(SITE / name, dest / name)
    shutil.copytree(SITE / 'fonts', dest / 'fonts')
    shutil.copytree(SITE / 'icons', dest / 'icons')
    shutil.copytree(SITE / 'js', dest / 'js')
    for img in SITE.glob('img/*.webp'):
        if img.name.startswith(('stage-pengu-', 'station-', 'pengu-lamp-')):
            shutil.copy(img, dest / 'img' / img.name)
    shutil.copy(SITE / '404.html', dest / '404.html')
    shutil.make_archive(str(OUT.with_suffix('')), 'zip', tmp, 'pengu-site')

print('wrote', OUT, OUT.stat().st_size, 'bytes')
