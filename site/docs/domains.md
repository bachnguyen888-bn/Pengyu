# Pengyu — domain shortlist (research only; nothing bought, no DNS changed)

Written November 1, 2026. **Availability is not verified for any new name**: this build environment
could not reach a registry lookup (rdap.org was blocked), and a web search found no website on these
names, which is not proof they are free. Check at the registrar before deciding. Prices are
third-party estimates; confirm at checkout.

Why choose before launch: browsers keep Pengyu's saved progress per address, and the Android app is
bound to one address. Moving later means every player has to save a backup and restore it.

## The options

| | Domain | Why it fits | What it could confuse | Estimated cost |
|---|---|---|---|---|
| 1 | **bachnguyenclearhealth.com** (keep) | Already owned and live on Netlify. Nothing to set up. | It says ClearHealth, not Pengyu: a health brand next to ClearHealth and ClearPulse. Long (25 characters), hard to say aloud. | $0 extra (current renewal continues) |
| 2 | **pengyu.app** (recommended) | The exact brand, short (10 characters), and ".app" tells people it is an app. `.app` is HTTPS-only, which Netlify's free certificates cover. | "Pengyou" (Chinese for "friend"; also Tencent's closed Pengyou network) and a "Pengy" meme coin. The "Pengu" pet apps are spelled differently. | About $14–20 a year (Cloudflare at cost; renewals listed near $14.20) |
| 3 | **getpengyu.com** (or playpengyu.com) | .com is what people type by default; "get" is a common app-site pattern. "play" leans into the game feel. | Same Pengyou/Pengy notes. "play…" may read as a game rather than a workout planner. | About $10–12 a year (Cloudflare at cost was about $10.1–10.5; the .com wholesale price may have gone up on Nov 1, 2026) |
| 4 | **pengyu.fit** (short fallback) | Very short and says fitness. | Unfamiliar ending; "fit" can suggest body tracking, which Pengyu deliberately does not do. | First-year promos can be $1–2, but renewals run about $16–26 a year. Cloudflare may not sell .fit. |

## Recommendation

**pengyu.app**, if it registers at a normal price. Fallback: **getpengyu.com**. Waiting for Bach to
choose; no purchase and no DNS change until he approves.

## Exact steps once Bach picks one

### Keep bachnguyenclearhealth.com
Nothing to change. After `pengyu/unified-app` is published, the privacy URL is
`https://bachnguyenclearhealth.com/privacy`.

### A new domain bought at Cloudflare Registrar (pengyu.app, getpengyu.com)
1. Cloudflare dashboard → Domain Registration → Register Domains → search and buy (Bach's approval).
   The domain's DNS is on Cloudflare automatically.
2. Netlify → the Pengyu site → Domain management → **Add a domain** → enter the domain → confirm.
   Netlify waits for external DNS.
3. Cloudflare → the domain → DNS → Records → **Add record**, twice:
   - Type `CNAME`, name `@`, target `apex-loadbalancer.netlify.com`, proxy status **DNS only**
     (grey cloud). Cloudflare flattens a CNAME at the root. (Netlify's alternative: an `A` record
     for `@` pointing to `75.2.60.5`.)
   - Type `CNAME`, name `www`, target `<site-name>.netlify.app`, proxy status **DNS only**.
   Keep the proxy off so Netlify can issue the HTTPS certificate and serve the site itself.
4. Netlify → Domain management → choose the **primary domain** (the other one redirects to it).
5. Netlify → Domain management → HTTPS → **Verify DNS configuration**, then provision the
   certificate. A `.app` address loads only over HTTPS, so wait for this step. DNS changes can take
   up to 48 hours.
6. Then, in the code: update the canonical links and share-image address on the app page and the
   privacy page, the privacy URL in the store listing, and the Android package host.
7. Optional: keep bachnguyenclearhealth.com as a domain alias that redirects to the new primary.
   Progress saved under the old address stays there; players move it with a backup.

### A domain bought elsewhere (pengyu.fit)
Add the domain to Cloudflare (Add a domain), switch the registrar's nameservers to the two
Cloudflare gives you, wait for Cloudflare to show it active, then follow steps 2–7 above.
