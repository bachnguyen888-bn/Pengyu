# Pengyu — Android package for Google Play (prepare, do not publish)

Pengyu ships to Android as a **Trusted Web Activity**: a small Android app that opens the live Pengyu
site full screen in Chrome. Same code as the website, so every site update reaches the app. Build
the package only after the domain is chosen and the site is published there, because the package,
its signing key and the saved data are all tied to that one address.

## Settings to enter (PWABuilder or Bubblewrap)

| Setting | Value |
|---|---|
| Site URL | `https://<chosen domain>/` |
| Package ID | `app.pengyu.twa` if the domain is pengyu.app; otherwise the domain reversed, e.g. `com.getpengyu.twa`. **It can never change after the first upload.** |
| App name / launcher name | Pengyu / Pengyu |
| Version | 1.0.0, version code 1 |
| Start URL | `/` |
| Display | Standalone |
| Orientation | Default (any) |
| Theme color, background color, navigation bar color | `#FAF6F0` (the app is light only) |
| Icon | `https://<domain>/icons/pengu-512.png` |
| Maskable icon | `https://<domain>/icons/pengu-maskable-512.png` |
| Monochrome icon | `https://<domain>/icons/pengu-monochrome-512.png` |
| Splash screen fade | 300 ms |
| Notification delegation | Off (Pengyu sends no notifications) |
| Location delegation | Off |
| Google Play Billing | Off (Pengyu sells nothing) |
| Fallback | Custom Tabs |

## Building it

**Easiest, PWABuilder (no setup):**
1. Open https://www.pwabuilder.com and enter the live URL.
2. Choose **Package for stores → Android → Google Play**, enter the settings above.
3. For the signing key choose **Create new**. Download the zip. It holds the `.aab` to upload, an
   `.apk` for side-loading, the signing key and a ready `assetlinks.json`.
4. Keep the key file and its passwords in two safe places. Losing the key means asking Google to
   reset your upload key.

**Command line, Bubblewrap (needs Node.js; it offers to install the JDK and Android SDK):**
```
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://<domain>/manifest.webmanifest
bubblewrap build
```
`init` asks for the same settings; `build` writes `app-release-bundle.aab`.

## Digital Asset Links (removes Chrome's address bar)

Android shows the app full screen only when the site publishes a file proving it owns the app.
1. In Play Console open **App integrity → App signing** and copy the **SHA-256** of the app signing key.
2. Fill in `assetlinks.template.json` (this folder): the package ID, that SHA-256, and the upload
   key's SHA-256 (PWABuilder's zip lists it), so side-loaded test builds verify too.
3. Publish it as `site/.well-known/assetlinks.json` (it must be served at
   `https://<domain>/.well-known/assetlinks.json`), deploy, then reopen the app.

It is not in the site yet on purpose: a file with placeholder fingerprints would only fail.
