# Pengyu — Google Play Data safety form (draft, not submitted)

Play Console → Policy → App content → Data safety. Answers below are true of the app as built on
branch `pengyu/unified-app` (November 1, 2026). Google defines "collected" as data sent off the
device; data used only on the device does not need to be declared.

## What the app does with data

- Everything (plan, workouts, Fish, unlocks, an events diary) is saved in the browser's
  localStorage on the phone, under one key, `pengyu.v1`. Nothing is uploaded.
- No account, no analytics, no ads SDK, no crash reporting, no cookies, no advertising ID.
- The app's code makes no network requests of its own. The service worker only fetches Pengyu's own
  files from Pengyu's own site so the app works offline.
- Backups and calendar files are made on the phone and saved where the user chooses.

## Form answers

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not asked once the answer above is No. If shown: the site is HTTPS only. |
| Do you provide a way for users to request that their data is deleted? | Not asked once the answer above is No. If shown: users delete everything in the app (History → Your data → Reset everything), or by clearing the app's site data. |
| Data shared with third parties | None |
| Ads | **No ads** (also answer No under App content → Ads) |
| Data selling | None. Pengyu never receives user data, so there is nothing to sell. |

Expected labels on the listing: **No data collected · No data shared with third parties.**

## Check before submitting (could not be verified here)

- **Hosting logs.** Netlify, the web host, receives standard request details (IP address, browser
  type) when the app loads its files. Pengyu's code never sees them. Google lets you leave out data
  that is processed only ephemerally (in memory, not kept). I could not confirm how long Netlify
  keeps request logs. Read Netlify's privacy statement (https://www.netlify.com/privacy/) and, if you
  are unsure, ask Netlify support, before choosing "No".
- **The Android package.** The final Android bundle (built with PWABuilder or Bubblewrap) must not add
  analytics or ad libraries. A plain Trusted Web Activity build does not, but check the generated
  project before uploading.

## Related declarations

- Privacy policy URL: `https://<chosen domain>/privacy`
- Health apps declaration: Pengyu records that a workout happened on a day (no body metrics). Google
  lists "activity and fitness" for apps that record workouts, so select that category and confirm the
  wording in Play Console.
- Advertising ID: Pengyu does not use it.
