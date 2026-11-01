# Pengyu on Google Play — checklist for Bach (prepared, not submitted)

Nothing here has been submitted, published or paid for. Every step that costs money, picks a name
or publishes something waits for Bach.

## In this folder

| File | What it is |
|---|---|
| `store-listing.md` | App name, short and full description, category, release notes, screenshot captions |
| `data-safety.md` | Data safety form answers (nothing collected, nothing shared, no ads), and what to double-check |
| `android-package.md` | Settings for the Android package (PWABuilder or Bubblewrap) and the Digital Asset Links step |
| `assetlinks.template.json` | Fill in after Play gives you the app signing SHA-256 |
| `store-icon-512.png` | Play app icon, 512 × 512, 32-bit PNG |
| `feature-graphic-1024x500.png` | Play feature graphic, 1024 × 500, no alpha |
| `screenshots/phone-*.jpg` | Six phone screenshots, 1080 × 1920 |
| `test-backup-900-fish.json` | TEST ONLY: restore on a test phone to try unlocks quickly |

## Before Play (Bach)

1. **Pick the domain** (see `../domains.md`). The privacy URL, the Android package and players'
   saved progress are all tied to it, so choose before anyone installs the app.
2. **Publish the site there**: merge `pengyu/unified-app` into the branch Netlify publishes. After
   that, `https://<domain>/privacy` is the privacy policy URL Play asks for.
3. **Add a public support email** to the privacy page and the listing (Play shows it publicly).

## Google Play developer account (Bach, needs approval to pay)

4. Go to https://play.google.com/console and sign up.
   - **Personal** account: new personal accounts must run a closed test with at least 12 testers for
     14 days before they can publish to production. Internal testing works right away.
   - **Organization** account: needs a D-U-N-S number, and is exempt from the 12-tester rule.
5. Pay the one-time **$25** registration fee (only with your approval) and finish identity checks.

## Create the app

6. Play Console → **Create app**: name "Pengyu", default language English (United States), App,
   Free, accept the declarations.
7. **App content** (Policy → App content):
   - Privacy policy: `https://<domain>/privacy`
   - App access: all features work without an account
   - Ads: No
   - Content rating: fill the questionnaire honestly (no violence, no gambling, no user chat)
   - Target audience: your call. Choosing ages under 13 brings Google's Families policy.
   - Data safety: from `data-safety.md`
   - Health apps: activity and fitness (Pengyu records workouts, no body data)
   - Government, financial, news: No
8. **Store listing**: paste from `store-listing.md`, upload the icon, feature graphic and screenshots.

## Build and upload to internal testing

9. Build the Android package with the settings in `android-package.md`. Keep the signing key safe.
10. Testing → **Internal testing** → Create new release → accept Play App Signing → upload the
    `.aab` → add release notes → Save → Review → **Start rollout**.
11. Testers tab: add your email list (up to 100 people), copy the opt-in link, open it on your phone.
12. App integrity → App signing: copy the SHA-256 and send it over. It goes into
    `assetlinks.json` on the site so the app opens full screen without Chrome's address bar.

## Test on a real Android phone

- [ ] Installs from the internal testing link; opens with the PENGYU splash, then Today.
- [ ] No browser address bar at the top (after step 12 is live).
- [ ] Plan a week in about 30 seconds; log a workout; the train rolls; Fish count up.
- [ ] Restore `test-backup-900-fish.json`, then unlock the scarf (two taps): it drops onto Pengu.
- [ ] Colors: the swatch picker repaints the train. Extra car appears.
- [ ] Airplane mode: close the app fully, turn on airplane mode, reopen. Plan, log, gear, History
      and the privacy page all work.
- [ ] Save a backup: where the file lands. Restore from a backup: the file picker finds it.
- [ ] Add reminders (.ics): what Android does with the calendar file.
- [ ] Back button, rotation, the largest system font size, and a quick TalkBack pass on Today.
- [ ] Reset everything (two steps) gives a fresh first run.
- [ ] Uninstall and reinstall: note whether saved progress stays (it lives in Chrome's storage).

## Later: production

After internal testing, a personal account runs the closed test (12+ testers, 14 days), then
applies for production access in Play Console.
