# Pengyu master audit · November 11, 2026

Scope: initial coding on `sol/review-7351e46`, starting from `122ed0a085603d69c4d55b9f9ae7df8ac1836b58`. All application and test changes are in `site/`. Existing features and the review corrections in `122ed0a` were preserved. No push, merge, publication, purchase, outreach or Play Store submission.

The goal remains 1,000 plan makers who return in both December windows. This audit removes concrete security and usability failures; it does not claim measured acquisition or retention gains.

## 1. Security findings

| Finding | Action and file/line |
| --- | --- |
| Invitation links were included automatically on the live host. | Fixed: `state.js:596` defaults `link` to false; `invite.js:50` provides explicit **Include Pengyu link**. Today initializers in `route.js:458` also start off. The existing live-host restriction remains. |
| Sharing choices and cached postcard art could carry across reset or restore. | Fixed: `history.js:36` clears personal-detail/link selections, image state and pending restore state for a new save. |
| Malformed backup appearance values could import successfully, then crash the renderer. | Fixed: `state.js:663` validates runtime-consumed backup fields before replacement; `state.js:94` repairs an invalid existing local hat without deleting progress. Appearance APIs reject non-string IDs at `state.js:395`. |
| Oversized or competing file reads could freeze the interface or surface an obsolete restore choice. | Fixed: `history.js:126` rejects files over 10 MiB before reading and accepts only the latest uncancelled selection. Navigation/reset cancels pending reads at `history.js:518` / `:36`. |
| Bare carriage returns in restored place/window text could add calendar properties. | Fixed: `ics.js:13` escapes CR, LF and CRLF as text. Existing 75-octet calendar folding remains. |
| Action records unnecessarily duplicated schedule details. | Reduced at `state.js:252`, `:274`, `:316`: new plan/move/log/comeback action records omit duplicate schedules and workout details. Actual plans, workout history and calendar data remain functional. Existing historical action records are preserved. |

Verified boundaries: progress is stored in `localStorage` under `pengyu.v1`; the splash flag uses `sessionStorage`; app files use service-worker Cache Storage. Active app code has no account/backend API, analytics, tracking, cookie writing, ads, beacons or data-selling integration. The worker requests same-origin app files. Host request logging remains disclosed rather than falsely claiming no network requests.

Default postcard/invitation payloads exclude personal details. Previews show the selected image/text before an explicit share action. User strings are appended as literal DOM text. Postcard captions are fixed authored options; no squad-name input exists. SVG markup comes from controlled drawings/allowlisted choices. Existing explicit reset and restore confirmations remain. Backup filenames remain generic, and JSON export contains the save plus export metadata, not browser credentials or unrelated storage.

Current tracked-tree credential/private-key pattern scans found no matches. The broader scan covered 67 tracked UTF-8 files, including root/tools/prototype text. This is not proof about every possible secret format, Git history, untracked files or binaries. No secret values were printed.

Privacy copy changed only at `privacy.html:108` (invitation link/detail opt-ins and reset/restore clearing) and `privacy.html:118` (10 MiB restore limit). The existing disclosures for localStorage, sessionStorage, cached files, host requests, calendar contents, backup/restore and user-initiated sharing remain truthful.

The required sentence is unchanged in Settings, History and Home Screen guidance:

> Progress is saved in this browser. Another browser or Home Screen app may have a separate save.

## 2. Design fixes

- `route.js:106`: the three first-screen rows now explicitly explain one train station per finished log and both gear/train upgrades. The shorter first heading at `route.js:583` makes room without reducing type size. First-goal math stays truthful and concise.
- `pengu.css:357`: onward/window/action links have separate 44px targets without overlapping negative margins. Move, calendar and invitation links also retain 44px height. The existing days control keeps its 32px box plus a 6px hit strip above and below.
- `pengu.css:365`: short/narrow phone rules reduce empty space and drawing height, keeping all controls, the palette and readable type. Pengu/train asset drawings are unchanged.
- `pengu.css:253` / `:282` and `route.js:166`: font-relative container queries switch crowded route labels to two-letter weekdays, including today's label. Full day/status text stays accessible; the week sheet retains full dates. This fixes actual label overlap at 200% text.
- `pengu.css:404` and `route.js:408`: reward sheets scroll vertically and initially focus the heading, so large text cannot clip the reward or jump straight to the bottom action.
- `pengu.css:687`: Privacy's grid can shrink and wrap long browser-storage names/URLs, fixing sideways overflow at 200% text.
- Shortened neutral comeback/remaining-workout lines preserve the real Fish amounts. **Scarf: 30 more Fish**, week streaks and **not logged** wording remain. No daily streak, health score, progress ring, palette replacement or redesign was added.

## 3. Core app audit

The existing first planner, returning review, train movement, Fish counter, celebration, previews, three-scene window, first-week postcard, invitation, backup/restore and reset were audited rather than presented as new features.

All logging and purchase states pass: planned, moved, eligible comeback, full-week, beyond-plan, duplicate, insufficient balance and already owned. Existing expired-draft and custom-time fixes still pass. Fish remains 10 / +25 / +15 / 0; one workout per day, Monday–Sunday weeks, fixed prices/order and 45/55/65 full weeks are unchanged. No automatic plan/calendar/notification creation was added. Atomic complete-set worker behavior remains unchanged; there are no new runtime assets to add to its file list.

Concrete app fixes are the malformed-backup/local-appearance handling, calendar escaping, restore-read race protection and share-default/reset boundaries described above. No broad new game system was built.

## 4. Missing spec pieces: R2 only

| Missing piece | Evidence and proposed future integration point; nothing built |
| --- | --- |
| Pengu coach/message cards | No runtime implementation or max-one/day, no-repeat/week, quiet-after-three-ignored policy. Candidate optional Today entry: `route.js:560`; future policy state: `state.js:64`. Any later copy must remain non-medical and non-prescriptive. |
| Facts-or-Cap | Absent. Candidate approved future game routing: `app.js:18` / `:111`; optional entry could join Today after the core flow. |
| Label Detective | Absent; same future routing points. No half-built quiz or diet advice added. |
| Manual squads of 3–5 | No squad workflow exists. Candidate external founder workflow: `docs/founder-distribution-playbook.md:76`. Keep this separate from app data; in-app squads remain prohibited in this release. |

The existing build spec explicitly excludes squads, coach/nudge cards and mini-games at `docs/build-spec.md:90`. Worlds, animal coaches, 3D/Blender, paid/random rewards, leaderboards, accounts and a backend remain outside this release.

## 5. Tests, browser evidence and limitations

- Baseline: **132/132**. Final: **149 passed, zero failed/skipped** with Node 24.20.0, normal isolated `node --test site/tests/*.test.mjs`. Normal isolation needed the existing sandbox subprocess restriction lifted. Added 17 tests: security 5, core audit 5, accessibility 7. Existing assertions were updated only where the new private defaults/minimal action records intentionally change behavior.
- Offline tests cover complete installation, interrupted/failed updates, old/new clients retaining complete sets and offline reads. Worker dependency coverage passes without a file-list change. Backup/export round trips, legacy saves, game rules, DST, calendar, share support/cancellation and reward timing remain covered.
- Ten synthetic Today states were measured at **375×667, 375×812, 390×844 and 320×640**. At normal text, every stage fits above the navigation without sideways page overflow. States: fresh, returning, planned, moved, comeback, full-week/beyond-plan, logged today, next-week ahead, ready-to-unlock and dense four-workout/all-upgrade/week-streak state.
- The same states were checked at **200% text** through a local test response setting the root font to 32px. Vertical scrolling is intentional at enlarged text; no sideways page overflow was measured. Actual dense-route label overlap and Privacy overflow were found, fixed and rechecked. Navigation labels retain their syllable break points.
- Browser journey: first three-workout plan → log → train → +10 Fish → reward within a three-second wait → scarf preview without spending → three finite window moments using keyboard Enter → full week at **55 Fish** → 1080×1080 postcard preview → private invitation preview → returning plan requiring a replacement for passed Monday → Settings backup/reset/restore → Privacy.
- At 200% text, the reward heading had focus, its sheet began at scrollTop 0, and the content was scrollable (1,146px content inside a 614px visible panel in the checked state).
- The backup download action showed its saved status; final OS filesystem delivery was not independently verified. A synthetic JSON backup was picked through the real file chooser and restored only after explicit confirmation, recovering **1 week and 10 Fish**. Reset was exercised on the disposable test save.
- Reduced-motion JavaScript branches were exercised via a local media-query test harness and deterministic tests. CSS retains its reduced-motion media rule. This does not replace physical iOS/Android testing or the actual OS accessibility setting.
- **Server-stopped browser check passed:** after installing/reloading the unmodified offline bundle, the local server was stopped. A fresh two-workout plan, log, moving train and reward still worked from the cache, showing **30 more Fish** for the scarf.
- No postcard/message was sent. Native share-target behavior and OS download delivery still need device QA. These are stated limits, not claims of completed phone tests. No captured JavaScript runtime errors on the checked online pages. Temporary tabs, viewport overrides and owned preview servers were cleaned up.

The fixture data, test-only server and large-text/media overrides live outside the repository and are not app features. Local screenshots, the viewport matrix and the full test output accompany the handoff. No real-user activity or retention result is claimed.

## 6. Local commit

The local commit SHA is supplied in the final handoff after committing this report. Push remains unapproved. Any later approved push must target `sol/review-7351e46` only, never `pengyu/unified-app` or a live branch.
