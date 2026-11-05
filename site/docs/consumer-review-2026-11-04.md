# Pengyu consumer review — November 4, 2026

## Phase 1 — recorded before app-source changes

Perspective: an 18-year-old first-time visitor who wants to get fit and does not know what Fish are. Baseline: `16c9ac873dc60d58b1aabbe58a31b16e707d2493` on `pengyu/unified-app`. Tested in a fresh local browser origin. The real-date walkthrough was Wednesday, November 4; a separate disposable preview simulated Monday, November 2, at 6 PM without changing app source or the computer clock.

Ranked by how much each issue would stop me:

1. **“Begin” unexpectedly completes my workout.** After making a Monday/Wednesday/Friday plan for three workouts, I tap Begin expecting a workout or a start screen. Instead, Monday is immediately marked done, I receive 10 Fish, and the button becomes Logged today. I have not been told that tapping it is a completion record. This makes me distrust my progress. The same happened in the Wednesday walkthrough.
2. **I cannot explain the app after ten seconds.** I understand Plan my week and see a friendly pink character and train. “No stations yet this week” and the fish icon with 0 do not tell me what to do after planning or why Fish matter. The planner is otherwise manageable: choose 3 workouts, Mon/Wed/Fri, evening, home, then review and Start my week. The summary introduces 10 Fish per workout and 25 for the week but still does not explain their purpose. Pengu eventually reveals that Fish buy gear and train upgrades. This should be understandable before investing in setup.
3. **My data controls are hidden behind another tab.** I look in Settings to export or reset. It tells me to go to History → Your data and only offers Open History. Save a backup works and shows Backup saved; the browser downloads a JSON file. Reset offers Continue, a backup opportunity, a final irreversible warning and Keep my data. Those safeguards are clear once found. I cancelled at the final warning in this read-only consumer pass.
4. **Privacy is truthful but sounds technical.** “Pengyu saves your plans and progress in this browser’s localStorage,” “A separate sessionStorage flag,” “export ... as JSON,” and “hosting request logs” make me work to understand where my data lives. “Comeback stamps ... free covers” also assumes app knowledge. The no-account, no-tracking, no-ads and no-selling promises are reassuring; preserve the real storage, offline-file, hosting and backup qualifications.
5. **I want to get fit, but there is no workout instruction.** The app records a habit and gives a character reward; it does not teach a routine. I could quit if I expected coached exercises. Do not add routines, health advice or fitness claims in this bounded pass; clarify the existing loop in issue 2.
6. **Starting midweek raises a small planning question.** On Wednesday, Monday and Tuesday are disabled and no next-week selector is offered. On the simulated Monday all seven days are available and my three-day plan works. It is a smaller blocker than the issues above; do not add future-week planning in this pass.

**What makes me quit:** a completion recorded when I expected to begin; not knowing how a train and Fish help me keep a workout habit; hunting for control of my saved data. **What brings me back:** the pink lamp Pengu, a simple next planned day, visible 1-of-3 progress and a predictable gear goal with no account or payment pressure. Rest-day visits do not need another reward system.

## Phase 2 — selected scope

Fix only ranked issues 1–4. Preserve the existing visual design and plan → log → train moves → upgrade loop. No new workout guidance or future-week feature. All repository changes must stay in `site/`; no `netlify.toml`, root MFP checker, ClearPulse or Pharmahealthtech changes. No merge or publication.

## Fixes and changed locations

1. **Make logging explicit.** `site/js/pengyu/route.js:69` changes all completion actions to “Log finished workout” with “Finished exercising?” guidance; line 199 changes the reward title to “Workout logged.” `site/privacy.html:44` names the same action. This preserves one-tap logging without implying a workout timer or exercise session.
2. **Explain the existing loop before setup.** `site/js/pengyu/route.js:96` names the route in workout language for assistive technology; line 364 replaces the empty-state “stations” wording; line 372 shows the word Fish alongside the balance; line 378 explains planning, logging, train movement and gear. Line 342 states Monday–Sunday and the existing 10 / 25 / 15 / zero-extra / one-daily rules in the week sheet. No economy or state logic changed.
3. **Put existing data controls in Settings.** `site/js/pengyu/settings.js:5` renders the existing shared backup, restore and reset controls directly. `site/js/pengyu/history.js:101` explains that backup downloads data; lines 166 and 171 share the same card, callbacks, confirmation steps and focus handling. `site/js/pengyu/app.js:110` wires Settings to the existing rerender/reset/restore callbacks. `site/sw.js:13` bumps the cache to `pengyu-v2` to install the matching modules together, because Settings and History now share an exported renderer. Existing History access remains.
4. **Explain privacy in ordinary language.** `site/privacy.html:32` explains browser storage and backend; lines 47 and 51 explain local game records and the temporary splash note; line 57 explains the offline copy; line 75 preserves possible host request logs; lines 80–99 explain the backup file, direct Settings controls, restore, and reset exclusions. `site/tests/offline.test.mjs:77` updates the existing privacy heading assertion to match “Save a backup (JSON).”

## Issues deliberately left unchanged

- **Rank 5 — workout instruction.** Adding exercise routines, coaching or fitness claims would be a new feature. The revised home copy explains the existing habit loop instead.
- **Rank 6 — midweek past days.** Past dates remain unavailable. Monday planning works; future-week selection or backdating would change planning behavior beyond the selected fixes.
- **Visual design and reward system.** No redesign, palette, art, gear prices, Fish amounts, extra rewards, stats or currencies were added or changed. The warm off-white, charcoal, coral and pink glossy lamp Pengu remain.
- **Privacy-dependent ideas.** No account, cloud backup, notifications service, analytics, backend or remote workout service was added. No selected fix required making a privacy statement untrue.

## Validation

- **63 tests passed, zero failed:** data 9, home 8, offline/privacy 6, Fish rules 24, upgrades 9 and weeks 7. Tests ran once more after the final cache version change, using one file per process: `node --test --test-isolation=none <site/tests/file.test.mjs>`. The usual isolation mode encounters sandbox `spawn EPERM`; this is why the equivalent per-file mode was used.
- **Syntax and diff:** JavaScript syntax checks passed for the changed app modules; `git diff --check` passed.
- **Supplemental Monday rule check:** fresh Nov 2 Mon/Wed/Fri plan starts at train position 0; Monday log gives 10 Fish, done 1 of 3, train position 1; reload rejects another same-day log. The full week totals 55 Fish, a 40-Fish scarf purchase leaves 15 and equips it, a beyond-plan workout gives zero, and reset returns to an empty plan and zero balance. This disposable check was outside repository source.
- **Browser, Monday scenario:** fresh three-workout Mon/Wed/Fri plan completed through all planner screens. New Log finished workout action produced 10 Fish and 1 of 3; reload preserved progress and disabled another log. Before/after screenshots show the train at the depot and first completed station. The temporary Monday fixture initially froze Date.now and therefore animations; it was corrected to advance normally. The final animation check below uses the unmodified real clock.
- **Browser, final build and real clock:** fresh Wed/Fri/Sun plan → Log finished workout → train visibly moved to its first completed station → 10 Fish / 1 of 3. Reward sheet opened and closed; Pengu opened with the correct “Scarf · 40 Fish / 30 more Fish” goal; the changed week sheet showed the exact Fish rules and closed normally.
- **Browser, changed data/privacy screens:** final Settings showed backup, restore and reset directly. Save a backup downloaded `pengyu-backup-2026-11-02.json` and showed Backup saved. Reset was checked through its second warning and backup option, then cancelled with Keep my data. Final Privacy was read and visually checked. Actual reset and restore semantics are covered by the automated data tests; the final destructive reset and restore-file picker were not exercised in browser QA.
- **Privacy source review:** user progress remains in localStorage; the existing sessionStorage splash flag and Cache Storage offline files remain disclosed. No account, app backend, tracking, ads or selling were added. Same-origin file requests and possible host logs remain disclosed.
- **Scope:** repository changes are confined to `site/`. No `netlify.toml`, root MFP checker, ClearPulse or Pharmahealthtech edits. No merge, publication or purchase.

## Verification limits

Browser QA used the desktop browser viewport, not a physical phone. The service-worker version bump installs a coherent new cache, but an already-open app can still use the old controller while the update downloads; a reload after activation uses the new cache. No production deployment or hosted smoke test was performed.

## Delivery

This report was completed before committing. Commit SHA and verified push result are supplied in the final chat response. Target: `bachnguyen888-bn/Pengyu`, `pengyu/unified-app` only.
