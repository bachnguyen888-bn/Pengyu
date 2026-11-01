# Pengyu: one app, one character, one job — unified design and build prompt

You are an Apple-level product designer and a careful front-end engineer working as one person. You don't ship generic, AI-looking apps. You make one thing feel perfect: every pixel, every word, every animation. This prompt combines all of Bach's Pengyu demos, prototypes, images and earlier prompts into **one app**. Build exactly what is written here. If something seems missing or wrong, ask before adding it.

**The app in one line:** players plan their workouts for the week, and each planned workout they log moves Pengu's train to the next station and earns Fish that upgrade Pengu. Workouts are the currency, and Pengu is the prize.

**The loop:** plan → log → train moves → upgrade. That is the whole product.

---

## 0. Repo, branch and boundaries

- **Repo:** `bachnguyen888-bn/Pengyu`. The app lives in `site/`, and Netlify publishes `site/` at bachnguyenclearhealth.com.
- **Base branch:** `claude/modest-hypatia-2u7uvj`. It has the working week planner (M1, M2 and Fixes 1–4). Check out `origin/claude/modest-hypatia-2u7uvj`, confirm that commit `594b509` ("Fix 4: the Pengyu home screen") is in the history, and create a new branch `pengyu/unified-app` from it.
  - If that branch has already been merged into the default branch, branch from the default branch instead, and tell me which you used.
- **Edit only inside `site/`:**
  - Don't touch the offline checker at the repo root (`index.html`).
  - Don't change `netlify.toml`. `publish = "site"` stays, and the `/` → `/clearhealth-pengu.html` redirect stays, so the app stays in `site/clearhealth-pengu.html`.
  - Read `prototypes/pengyu-home/` as a reference only. Never edit it.
- **Tooling:** dev tools (Playwright, axe, npm packages used to fetch fonts and anime.js) go in a temporary folder outside the repo. Never commit `node_modules` or lockfiles.
- **Git:** commit at the end of each milestone, with clear messages. Never push to or merge into the deploy branch, and never force-push. Push `pengyu/unified-app` only when I say so.
- **Pengyu only:**
  - **Branding:** the UI brand is Pengyu and the character is Pengu. No other product's name, colors, features or copy appears anywhere. The company credit "by ClearHealth" may stay in page metadata only.
  - **Removed features stay gone:** Stars, Sanctuary, leagues, the old purple theme and the old preview were removed in Fix 1. Don't bring any of them back.
- **Keep the spec:** save this prompt verbatim as `site/docs/build-spec.md` so later sessions can reread it.

### Step 0, before any code (then wait for my "go")
1. Read every file in `site/`, plus `prototypes/pengyu-home/index.html` and its four screens in `prototypes/pengyu-home/screens/`: `splash.png`, `home.png`, `home-after-begin.png` and `workout.png`.
2. Serve `site/` locally and take baseline screenshots at 390×844.
3. Reply with three things:
   - a plan for the home screen milestone in 15 lines or fewer;
   - anything in this spec that conflicts with the code;
   - any question you need answered.

Then wait.

---

## 1. Where each source piece ends up

| Source | Where it lives in the app |
|---|---|
| **Playable demo:** log a workout, upgrade Pengu, gear shop, history, reset | Today (log), the Pengu tab (gear shop and train upgrades), the History tab (history, backup, export, reset). The rules in `site/js/pengyu/state.js` are kept and tested. |
| **Home screen prototype** (`prototypes/pengyu-home/`): tapping Begin fills today's station, moves the train and updates the count | The Today screen. Begin logs in **one tap**, then the train rolls, the station fills and the count updates. |
| **Pink lamp Pengu** | The only character design, everywhere. On the Pengu tab Pengu stands in its warm brown lamp base, glowing. |
| **The 5-image train design** | The lowercase "good evening." stoic layout. The bold PENGYU wordmark on the splash. The Headspace-style sunny yellow session card and Pengu's simple face, used for the post-log reward sheet and this week's session cards. The dark navy steam train with red wheels that Pengu rides. |
| **anime.js interactive Pengu** | Every interactive Pengu: random blink, eyes that follow the pointer, a squash-and-stretch hop on tap, a scarf that lags behind, a waddle, and a celebration after a logged workout. |
| **Liquid glass material** | Interactive surfaces only (Begin, the tab bar, the Fish pill, sheets, chips), in Pengyu colors. Never purple. |

**Where the prototype changes:**
- **Removed from home:** the prototype's week strip, the yellow "Today's Workout" card and the 5-tab nav with placeholder tabs.
- **"Ready when you are":** that screen becomes the yellow reward sheet that rises after Begin.

Home is exactly: **"good evening." → train route → "Workouts this week: X of N" → one big Begin button.**

---

## 2. Game rules (keep exactly; `state.js` already implements them, so keep them and test them)

- **Weeks:** they run Monday to Sunday in the phone's local time.
- **Monday plan flow:**
  - the player picks 2, 3 or 4 workouts, which days, a time and a place, written as an if-then plan ("Tuesday, after class, at the gym");
  - planned days can be moved without penalty, to today or any later free day this week, never once a day has passed.
- **Fish:** Fish is the only currency. No Shards, XP, Power, Stamina or Agility.
  - **10 Fish** per planned workout.
  - **+25** full-week bonus, paid the moment the last station of the week is filled.
  - **+15** and a Comeback stamp for the first planned workout after a missed planned day.
  - **0 Fish** for workouts beyond the plan. They earn cosmetics only (hats and train decals in a fixed order), never power.
- **One per day:** one workout per day counts.
  - Logging on a day that isn't planned moves the next upcoming station to today, and it pays as planned.
  - With no stations left, the workout is an extra.
- **Missed-week cover:** one free missed-week cover per calendar month, counted by the week's Monday. It keeps a running week-streak alive without adding to it, and it applies automatically. **Never sell repairs.**
- **Gear, in order:** scarf (40) → cap (90) → backpack (150) → conductor outfit (240).
- **Train upgrades, any order:** headlamp (50), colors (80), extra car (130).
- **Unlocks:**
  - every unlock has a fixed, visible price and a "next unlock" preview;
  - unlocking takes a second confirming tap;
  - upgrades are permanent, and nothing ever decays, rusts or rolls back.
- **Week-streak only:** count consecutive weeks where the plan was hit. No daily workout streak.

### Hard rules (never break these)
- **No body or activity numbers as a score or ranking:** no calories, weight, steps, minutes, distance or pace. None are collected at all.
- **No rankings:** no global leaderboard, and never show a bottom rank. The only ranking ever allowed is by share of the player's own plan, and this build has no squads, so it ranks nothing.
- **No guilt or shame copy:** no "You missed", "Don't break your streak", "You promised" or countdown threats. A missed day reads "not logged", and the next workout reads as a welcome back.
- **No fake players or fake activity:** a first run starts at 0 Fish with no plan, and no demo data ever ships.
- **No random rewards:** no gacha, spins, mystery boxes or random drops. Randomness is allowed only in animation timing, like Pengu's blink.
- **Progress is the train, not charts:** no rings, graphs, 0–100 scores or progress bars anywhere. Distances to goals are written in words, like "15 more Fish".

### Not in this build (later, not now)
Squads, coach or nudge cards, mini-games, AI chat, accounts, a backend, push notifications and dark mode.

---

## 3. Design system

### 3.1 Three materials, and only three
1. **Paper:** the ground. Matte warm off-white with a faint grain and hand-drawn ink lines (the track, station rings, dividers).
2. **Glossy plastic:** Pengu and the train paint. Soft, slightly uneven light, like the pink lamp.
3. **Liquid glass:** only on things you can press.

If a surface isn't interactive, it isn't glass.

### 3.2 Palette (lock it; every color is a token in `pengu.css`)

| Token | Hex | Use and contrast |
|---|---|---|
| `--paper` | `#FAF6F0` | Page ground |
| `--paper-2` | `#F3ECE4` | Soft panels |
| `--card` | `#FFFFFF` | Sheets |
| `--ink` | `#2B2628` | Charcoal text, 13.8:1 on paper |
| `--ink-2` | `#5E5558` | Secondary text, 6.7:1 on paper |
| `--line` | `#E6DCD3` | Hairlines |
| `--line-strong` | `#9A8F88` | Rings that carry meaning |
| `--stage` | `#141213` | The one dark card (the route stage), with a radial lift to `#2B2829` |
| `--on-stage` | `#F7F2EE` | Text on the stage |
| `--on-stage-2` | `#D9D2CE` | Secondary text on the stage |
| `--coral` | `#FF6B4A` | The accent fill. Charcoal text on it is 5.3:1, white is not allowed |
| `--coral-strong` | `#E5532F` | Marks behind white icons |
| `--coral-ink` | `#C2391F` | Coral text on paper, 5.0:1 |
| `--coral-on-stage` | `#FF9673` | Coral text on the stage, 8.7:1 |
| `--coral-tint` | `#FFE3DA` | Coral tint |
| `--splash` | `#F2541B` | Splash ground. White wordmark only, large text |
| `--sun` / `--sun-2` / `--sun-3` | `#FFCE3A` / `#FFE07A` / `#FF9A52` | The Headspace-style sunny card bands. Charcoal text on sun is 10:1 |
| `--pengu-hi` / `--pengu` / `--pengu-shade` / `--pengu-edge` | `#FDE6F3` / `#F7BFDF` / `#E99BCB` / `#D9779F` | Pengu's glossy pink |
| `--belly` / `--belly-glow` | `#FFFFFF` / `#FFF0F8` | Glowing belly |
| `--eye` / `--beak` / `--blush` | `#6E3424` / `#A8622F` / `#F27FA8` at 45% | Dot eyes, beak, cheeks |
| `--base` / `--base-hi` / `--base-lo` | `#8A4E22` / `#B8763A` / `#5E3414` | The lamp's warm brown base |
| `--navy-1` / `--navy-2` / `--navy-3` / `--cab` / `--rim` | `#4A5876` / `#2F3A52` / `#1D2537` / `#3C4862` / `#5C6B8A` | The train |
| `--wheel-red` / `--brass` / `--lamp` | `#D9472C` / `#E9A825` / `#FFE08A` | Red spokes, brass trim, headlamp glow |

**Banned colors:** no purple and no green anywhere. That means removing the existing "Pengu purple" and "mint" train paints, and recoloring the mint backpack. No abstract swirl or blob backgrounds either.

**Gradients:** gradients appear only as light on glossy objects and glass, never as background washes.

**Light only:** `color-scheme: light`.

### 3.3 Type
- **Rubik, self-hosted** (OFL), replacing Public Sans.
  - Get the latin variable woff2 from npm `@fontsource-variable/rubik` and copy it to `site/fonts/` with its OFL license.
  - Preload it, and delete the Public Sans files once nothing uses them.
  - Fallback stack: `ui-rounded, "SF Pro Rounded", system-ui, sans-serif`.
- **Scale, in px:**

  | Element | Size and weight |
  |---|---|
  | Greeting | 34/40, weight 700, letter-spacing −0.02em |
  | Count | 22/28, weight 600 |
  | Card titles | 24, weight 700 |
  | Body | 16 |
  | Secondary | 15 |
  | Small | 13 |
  | Begin label | 19, weight 700 |

  Numbers use tabular figures.
- **Wordmark:** PENGYU in Rubik 900, uppercase, tracking −0.03em, `transform: skewX(-8deg)`, with Strava-style bold energy. Draw it as an SVG if text rendering isn't crisp.
- **Lowercase greeting with a period:** "good morning." (5:00–11:59), "good afternoon." (12:00–16:59), "good evening." (all other hours).

### 3.4 Space, shape, depth
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 / 48. Side gutter 20px.
- **Radii:** cards 28px, sheets 28px (top corners), chips and buttons pill.
- **Shadows:** soft only, for example `0 1px 2px rgba(43,38,40,.06), 0 12px 32px -16px rgba(43,38,40,.28)`. No harsh or black shadows.
- **Touch targets:** at least 44×44.
- **Safe areas:** honored everywhere through `env(safe-area-inset-*)`.

### 3.5 Liquid glass (in Pengyu colors)
This adapts Bach's 3D render reference to the app: smooth glossy surface, soft lighting with a vibrant glow, geometric minimal composition, modern and playful, high gloss. It also obeys that reference's negative list: no low contrast, harsh shadows, clutter, muted colors, pixelation, distorted shapes or excess detail.

Build it as reusable classes:
- **`.glass` (paper glass)** for the tab bar, Fish pill and chips:
  - `background: rgba(255,255,255,.55)`
  - `backdrop-filter: blur(18px) saturate(1.4)`
  - `border: 1px solid rgba(255,255,255,.7)`
  - `box-shadow: inset 0 1px 0 rgba(255,255,255,.9), inset 0 -10px 18px rgba(43,38,40,.04), 0 10px 28px -14px rgba(43,38,40,.30)`
  - a `::before` specular highlight: a soft white rounded shape across the top third, 35% opacity. It is hand-shaped and slightly off-center, not a perfect ellipse.
- **`.glass-coral`** for Begin and other primary buttons:
  - coral base, the same highlight and inner light, and a vibrant glow `0 14px 34px -10px rgba(255,107,74,.55)`;
  - the label is charcoal, never white.
- **`.glass-pink`** for the Pengu avatar: a pink glossy bubble.
- **Pressed state:** a squash to `scale(.97)` with the highlight shifting 2px down, released with a short spring. That's 120ms in and about 260ms out.
- **Fallbacks:**
  - when `backdrop-filter` isn't supported, or `prefers-reduced-transparency: reduce` is set, use solid surfaces (`--card` and `--coral`) with the same borders;
  - glass never sits on top of text that must stay readable.

### 3.6 Hand-drawn, slightly imperfect
Stock-perfect geometry is what makes an app look AI-made. Avoid it on purpose:
- **Line art** (the track, station rings, dividers, icons): author paths with small deliberate irregularities.
  - Station rings are slightly uneven, closed loops with a pencil feel.
  - The track is a gently wobbling line.
  - Ticks have varied lengths.
- **Jitter:** use a small **seeded** jitter helper (0.4–0.8px at 390px wide). Never `Math.random` in art, so every visit and every screenshot looks identical.
- **Roughen filter (optional):** a static SVG `feTurbulence` + `feDisplacementMap` at scale ≤ 1.2 on non-animated line art only. Never on Pengu, never on anything that moves.
- **Paper grain:** an SVG noise data-URI background at about 3.5% opacity on `--paper`. The CSP allows `img-src data:`.
- **Pengu stays clean glossy plastic,** but asymmetric: an egg that is slightly wider on one side, the highlight placed by hand, and the belly glow a soft blob rather than a perfect circle.

### 3.7 Icons
- Inline SVG symbols in the page sprite, drawn in the same hand-drawn line style: stroke 1.75–2, round caps.
- Needed icons: fish, check, lock, shield (cover), stamp, calendar, refresh, close, plus the tab icons for Today, Pengu and History.
- No emoji in the UI.

### 3.8 Motion principles
- **UI motion:** 120–220ms, ease-out `cubic-bezier(0.22,1,0.36,1)`. Springs for presses and Pengu.
- **The train:** about 1.4s, ease-in-out with a 3–4px overshoot settle.
- **Animate only `transform` and `opacity`.** Pause everything when the tab is hidden, and pause Pengu loops when Pengu is offscreen (use `IntersectionObserver`).
- **`prefers-reduced-motion: reduce`:**
  - no waddle, hop, eye-follow, wheel spin or steam;
  - states change instantly or with a 150ms fade;
  - the blink stays.
- **Haptics:** a light `navigator.vibrate(10)` on a log where supported, as a progressive enhancement. No sound.

---

## 4. Pengu, the pink lamp

**One character, drawn in code as layered SVG in `site/js/pengyu/art.js`.** Replace the current flat Pengu: Fix 3's "flat shapes only" rule is lifted for the two glossy-plastic objects, Pengu and the train's paint, and nothing else.

**Look:** soft glossy pink plastic, egg-shaped, with:
- a **glowing white belly**: a radial white center fading to `--belly-glow`, plus a soft outer glow;
- **dark brown dot eyes**, set wide, each with a tiny white catchlight;
- a **small brown beak**, a rounded triangle in `--beak`;
- **small pink flippers** tucked at the sides;
- faint blush.

**Never:** cat ears, whiskers, a black-and-white penguin, or orange beak or feet. Pengu has no visible feet in the lamp pose and tiny pink feet when standing.

**Reference:** if Bach has added `site/img/pengu-lamp.png`, match it: the egg body, the glow, the wide dot eyes and the brown base. Otherwise use this description and the gradients in `prototypes/pengyu-home/index.html` (`#pg-body` and `#pg-belly`).

**Poses:**
- `stand`: full body, used on the Pengu tab, in the lamp base;
- `cab`: head and shoulders in the train window, with one flipper free to wave;
- `bust`: the avatar and toasts;
- `face`: the big simple face that peeks up on the sunny reward sheet, with closed happy arcs for eyes.

**Layers** (separate `<g>` groups so anime.js can move them): `body`, `belly`, `belly-glow`, `eyes` (left and right, each separate), `beak`, `flipper-l`, `flipper-r`, `scarf` (the band, plus a `scarf-tail` that lags), `hat`, `backpack` (behind, with straps in front), `outfit`.
- Set `transform-box: fill-box` and a transform origin at the feet.

**Lamp base:** on the Pengu tab, Pengu sits in the warm brown lamp base (`--base` with `--base-hi` and `--base-lo` bands), with a soft halo glow behind. The digital Pengu should look like the lamp.

**Gear art:**
- **Scarf:** a coral knit band with two hand-drawn stripe lines and one tail.
- **Cap:** sunny yellow, with a coral button and a tilted brim.
- **Backpack:** warm brown canvas (`--base` and `--base-hi`) with a small round coral patch. This replaces the mint one.
- **Conductor outfit:** a navy jacket with brass buttons and a navy conductor cap with a brass badge. It replaces any hat while worn.

**Extras** (cosmetic, from workouts beyond the plan), all in palette colors:
- **Hats:** a bobble hat (pink and cream stripes), a sun hat (cream with a coral band) and a party hat (sun yellow with coral dots).
- **Train decals:** a star (sun), a wave (cream) and a lightning bolt (coral).

## 5. The train

- **Base drawing:** take the dark navy steam engine from `prototypes/pengyu-home/index.html`: boiler gradient `--navy-1` → `--navy-3`, a tall cab with a big window, brass handrail and bell, cowcatcher, chimney with steam puffs, and **red-spoked wheels**. Pengu rides in the cab (the `cab` pose).
- **Redraw it** with the hand-drawn rules above: slightly imperfect outlines and no perfect circles except the wheels, which may be true circles for spinning.
- **Upgrades:**
  - **Headlamp:** a warm `--lamp` glow cone, a little brighter after 7pm local time.
  - **Colors:** boiler and cab paint in Night navy (the default), Coral, Sunny, Pink or Charcoal. Wheels stay red and trim stays brass.
  - **Extra car:** a small navy car with a wooden crate stamped with a fish.
  - **Decals:** shown on the boiler side.
- **Migration:** a saved `paint` of `mint` or `purple` becomes `navy`.

## 6. Interactive Pengu (anime.js)

**Library:**
- Vendor **anime.js v4** locally as `site/js/vendor/anime.esm.min.js` with its MIT license file next to it, because the CSP allows only `'self'` scripts.
- Pin the exact version you install, choose one published at least two weeks ago, and record it in a comment.
- Read the API in the package docs rather than guessing names.
- Wrap it in `site/js/pengyu/motion.js` so nothing else imports anime.js directly.

**Behaviors**, wired up through a `bindPengu(svg, options)` function:

| Behavior | What happens | Where |
|---|---|---|
| Blink | Eyes scaleY 1 → 0.1 → 1 over about 140ms, at randomized 2.5–6s intervals, with an occasional double blink | Everywhere |
| Eyes follow the pointer | Each eye dot shifts up to about 1.6 units (in Pengu's 120-unit space) toward the pointer, smoothed per frame | On touch, follows the finger, then eases back to center after 1.5s idle |
| Hop on tap | Squash (scaleX 1.08, scaleY 0.9, 90ms) → rise (translateY −18, scaleY 1.08, scaleX 0.95, 180ms, ease-out) → fall (160ms, ease-in) → land squash (scaleY 0.92, 80ms) → spring settle | Pengu tab, home cab |
| Scarf lag | `scarf-tail` follows the body with an 80–120ms delay and a spring overshoot, then settles after the body. Runs on hop, waddle and train stops | Wherever the scarf is worn |
| Waddle | Idle loop every 4–7s: rotate −4° → +4° → 0 with ±6px steps, ease-in-out | Pengu tab |
| Celebrate | Two hops, flippers up (−30°), scarf flutter, belly glow pulse (opacity 0.85 → 1 → 0.9), and 8–12 small sparkles in coral, sun and white bursting with a stagger | After a logged workout and on an unlock |

- **Wave:** on home, the cab Pengu waves a flipper every 6–9s while idle.
- **Accessibility:** Pengu is decorative (`aria-hidden`), and the text around it says what happened. Taps on Pengu do nothing functional.

---

## 7. Screens

**Shell:**
- One page (`site/clearhealth-pengu.html`) and one column, mobile-first. Desktop shows the app centered at a 430px max width on paper, not stretched.
- Three tabs in a **glass tab bar:** Today, Pengu and History. The active tab has a charcoal icon and label with a small coral dot; inactive tabs use `--ink-2`.
- No placeholder tabs, no dead buttons, no spinners: everything is local and instant.

### 7.1 Splash
- PENGYU wordmark, white on `--splash`, centered.
- Shown once per browser session (a `sessionStorage` flag), about 900ms, then a fade to Today. A tap skips it.
- With reduced motion: a 300ms static frame and a fade.
- Never shown again within the session.

### 7.2 Today (home): exactly this, top to bottom
1. **Top bar** (44px):
   - **Left:** the glass **Fish pill**, with the fish icon in `--coral-ink` and the balance. It counts up with a small bump after a log.
   - **Right:** the **Pengu avatar**, a pink glass bubble with Pengu's `bust`. Tapping it opens the Pengu tab.
2. **Greeting:** "good evening." as a large, left-aligned, lowercase headline.
3. **The stage:** one dark card (`--stage` with a warm radial glow) holding everything below.
   - **Week streak chip** at the top-left, for example "Week streak 2". Shown only when the streak is 1 or more.
   - **The train** on a hand-drawn rail, with Pengu in the cab. Its front stops at the last filled station, or at the depot if none is filled.
   - **The route line:** a depot, then one station per planned day, evenly spaced and labeled by weekday ("Tue", "Thu", "Today").

     | Station state | How it looks |
     |---|---|
     | Done | Coral ring with a check |
     | Today | White ring with a soft halo |
     | Upcoming | Grey ring |
     | Missed | Dashed ring that **stays empty**: no red, no X |
     | Comeback | A small stamp mark on its ring |

   - **"Workouts this week: X of N"**, with a goal line under it:

     | Situation | Goal line |
     |---|---|
     | Still on track | "1 more to hit your week" (or "2 more…") |
     | Week hit | "You hit your week." |
     | A miss makes the full week impossible | "Every planned workout left still pays 10 Fish." |
     | No stations left | "A new route starts Monday." |

   - **One big Begin button**, full width, `.glass-coral`, 64px tall.
4. **Nothing else.** No week strip, no session cards, no Fish box, no calendar row and no progress bars.
   - Tapping the route opens the **Week sheet** (7.4).
   - The whole home screen must fit without scrolling at 375×667 and 390×844.

**Begin states** (a quiet caption under the button carries context):

| Situation | Button | Caption |
|---|---|---|
| Planned day, not logged | Begin | Today's if-then plan, e.g. "After class · at the gym" |
| Comeback is due | Begin | "Welcome back. This one earns a Comeback stamp." |
| Unplanned day, a station is still ahead | Begin | "Counts for Thursday's station." |
| No stations left | Begin | "Extra ride: looks only, no Fish." |
| Already logged today | Logged today ✓ (`aria-disabled`) | "See you Thursday." or "You hit your week." |
| No plan this week | Plan my week | "Takes about 30 seconds." |

**What Begin does, in order:**
1. The press squashes.
2. `logWorkout()` runs.
3. The train rolls from the previous station to the new one (about 1.4s): red spokes spin with the distance travelled, three steam puffs rise, and Pengu sways.
4. As the train arrives, the station ring fills (the check draws in over 300ms).
5. The count updates and the Fish pill counts up.
6. Cab Pengu celebrates.
7. About 600ms after arrival, the **sunny reward sheet** rises.
8. A polite live region announces the result, for example "Workout logged. 3 of 3. You hit your week. Plus 35 Fish."

### 7.3 Sunny reward sheet (the Headspace-style card)
- A bottom sheet at about 60% height with the sunny bands (`--sun`, `--sun-2`, `--sun-3` as soft curved bands).
- Pengu's big simple `face` peeks up from the bottom edge, happy closed eyes, rising like a sun.
- It shows a title, Fish lines, the next unlock in words, and a **"Nice"** button. Swiping down, tapping the backdrop or pressing Escape also closes it.
- Focus is trapped while it's open and returns to the count when it closes.

| Case | Title | Lines |
|---|---|---|
| Planned workout | "Station filled." | "+10 Fish" |
| Moved station | "Station filled." | "Thursday's station moved to today. +10 Fish" |
| Full week | "You hit your week." | "+10 Fish · +25 full-week bonus" and "Week streak 3" |
| Comeback | "Welcome back." | A Comeback stamp graphic, then "+10 Fish · +15 Comeback stamp" |
| Extra | "Extra ride logged." | "No Fish. You collected the Star decal (looks only)." |

When several cases apply (a comeback that also hits the week), show all their lines in one sheet, comeback first.

The last line is always the next unlock, for example "Scarf · 15 more Fish" or "Scarf is ready to unlock". The Pengu tab has a link there.

### 7.4 Week sheet (from tapping the route)
- **Sessions:** this week's sessions as **sunny session cards**, with today's card brightest. Each shows the weekday and date, the if-then line and its status (Done, Today, Planned or Not logged).
- **Move:** a "Move" link on each movable session opens chips for the free days left this week. Moving costs nothing, and the toast says "Moved to Friday. No penalty."
- **Calendar:** depending on the state, one of:
  - "Add reminders to my calendar (.ics)"
  - "You moved a workout. Get the updated file (.ics)."
  - "Download again"

  Keep `site/js/pengyu/ics.js`: floating local times, a 60-minute event and an alarm 15 minutes before.
- **Cover:** a one-line cover status, for example "Free cover ready this month."

### 7.5 Monday plan flow (when there's no plan this week)
A full-screen paper view in four quick steps, about 30 seconds, with a back arrow and step dots (dots, not a bar):
1. **"How many workouts this week?"** Big chips: 2, 3, 4.
2. **"Which days?"** Weekday chips. Past days are disabled, and the player picks exactly N.
3. **"When?"**
   - Before class (7:00)
   - After class (15:30)
   - Evening (18:00)
   - Pick a time
4. **"Where?"** Gym, Home, Outside, Rec center, or a typed place.

**Defaults:** pre-fill everything from last week's plan, keeping the same weekdays where they're still open, so returning players finish in a few taps.

**Summary:** a sunny card with the if-then sentence ("If it's Tuesday after class, I work out at the gym.") and the day list, then:
- a primary **"Start my week"** button;
- a secondary **"Add reminders to my calendar (.ics)"** button.

**Late in the week:** if fewer than 2 days are left this week, plan **next** week instead. Say "Your route starts Monday" and show next week's stations on the stage. This needs `createPlan` to accept the next week's Monday.

### 7.6 Pengu tab
- **Showcase:** Pengu (`stand`) in the warm brown lamp base with its halo, wearing everything switched on.
  - Interactive: blink, eyes follow, tap to hop, waddle.
  - The train sits behind on a short rail with its upgrades.
  - A screen-reader caption says what Pengu is wearing.
- **Next unlock:** Pengu previewed in the next gear piece, its name and fixed price, and "25 more Fish" or an **Unlock** button. Unlocking takes two taps ("Unlock the cap for 90 Fish?" → Unlock).
  - **Unlock moment:** the item drops onto Pengu with a hop and sparkles, and the Fish pill counts down.
- **Gear, in order:** a row per item with its art, name and price.

  | State | Row shows |
  |---|---|
  | Owned | A Wear toggle |
  | Ready | Unlock |
  | Saving | "40 more Fish" |
  | Locked | Lock icon and "After the cap" |

- **Train upgrades,** in any order: headlamp, colors (with a swatch picker once owned), extra car.
- **Extras:** "Earned from extra workouts. Looks only." Hats and decals in their fixed order, with Wear toggles. Not-yet-earned extras show as soft outlines with no prices.
- **Never** a progress bar or ring.

### 7.7 History tab
- **Weeks,** newest first, for example "Oct 26 – Nov 1". Each shows:
  - "3 of 3", plus the "Week hit" tag when the plan was met;
  - Fish earned that week;
  - Comeback stamps;
  - "Free cover used", when it applies;
  - extras collected.

  Words and small tags only, no charts.
- **Your data:**
  - **Save a backup:** downloads `pengyu-backup-YYYY-MM-DD.json`. This file is also the data export.
  - **Restore from a backup:** a file picker. Validate the file, show what it contains ("4 weeks, 230 Fish"), confirm, then replace.
  - **Reset everything:** two steps. The second asks the player to save a backup first and says what will be lost. Afterwards, show a fresh first run.

### 7.8 404 page
Restyle `site/404.html` to this system: paper ground, Pengu `bust` looking puzzled, "This page isn't on the route.", and a button back to Today.

---

## 8. Data, storage and the "nothing decays" promise

- **Keep `state.js`'s model** (key `pengyu.v1`) and every rule in it.
- **Changes:**
  1. **Injectable clock:** `setClock(fn)` for tests, and `?now=YYYY-MM-DDTHH:MM` for screenshots, honored **only** on `localhost` or `127.0.0.1`. All date logic goes through it.
  2. **Paints:** replace `mint` and `purple` with `pink` and `charcoal`, and migrate old saved values to `navy`. Update the item copy to match: the backpack becomes "A warm brown backpack for the long route.", and colors becomes "Repaint the engine coral, sunny, pink or charcoal, or keep it navy."
  3. **Next-week planning,** as in 7.5.
  4. **`importData(json)`:** validates `v === 1` and the shape, with clear error copy. Pair it with `exportData()`.
  5. **Events:** keep the existing ones (plan_created, workout_logged, comeback_earned, extra_earned, streak_cover_used, upgrade_purchased) and add plan_moved, backup_saved, backup_restored and app_opened (at most once a day).
- **Why backups matter:** Safari deletes a site's saved data after 7 days of Safari use without visiting it, and Home Screen web apps keep storage separate from Safari tabs. That would make Pengu "decay" to zero, so protect it:
  - **Home Screen tip:** after the **first** logged workout, show a one-time sunny card: "Keep Pengu safe: add Pengyu to your Home Screen." It gives the iPhone steps (Share → Add to Home Screen) and offers a "Save a backup" button.
    - Show it only on iOS Safari when not already running as an installed app.
    - Also say: "Already have progress here? Save a backup, then restore it in the Home Screen app."
  - **Persistent storage:** call `navigator.storage.persist()` only from a user tap (the tip's button or Save a backup). Firefox shows a prompt.
  - **Manifest:** add `site/manifest.webmanifest`:
    - `name` and `short_name` "Pengyu", `start_url` "/", `display` "standalone";
    - background and theme colors `#FAF6F0`;
    - icons rendered from the new Pengu art: 192, 512 and a 512 maskable, plus a 180 apple-touch-icon.
  - **CSP:** add `manifest-src 'self'` to **both** the page's meta CSP and `site/_headers`. Change nothing else in the CSP.
- **Brand files:** update `site/favicon.svg` (Pengu's face) and regenerate `site/og-pengu.jpg` at 1200×630 (Pengu in the cab on the stage, plus the PENGYU wordmark, on paper) to match.

---

## 9. Quality bar (every milestone)

- **CSP intact:**
  - no inline `<script>` or `style=""` attributes in markup;
  - CSSOM (`el.style.setProperty`) and anime.js inline transforms are fine;
  - fonts and scripts are self-hosted, and there are no external requests at all.
- **Accessibility (WCAG AA):**
  - real buttons, everything works by keyboard, visible focus (`--coral-ink` outline);
  - Pengu art is `aria-hidden` with text equivalents;
  - live regions for log results;
  - contrast as in the token table;
  - text zoomed to 200% still fits, with no overlap or clipping.
- **Performance:**
  - first load is 300KB or less of total transfer, including fonts and anime.js;
  - Lighthouse mobile Performance and Accessibility are 90 or higher;
  - 60fps train and Pengu animation on a mid-range phone (check with Playwright CPU throttling ×4);
  - no layout shift when fonts load.
- **Browsers:** iOS Safari 16.4+, Chrome and Edge 115+, Firefox 115+.
- **Copy:**
  - warm and short, with sentences under 15 words on screen;
  - at most one exclamation mark per screen;
  - "Fish" is always capitalized, the app is "Pengyu" and the character is "Pengu";
  - no invented claims or numbers.

**Verification after each milestone** (tooling outside the repo):
1. Run the unit tests: `node --test site/tests/`. Pure rule tests import `state.js` with the injected clock.
2. Take Playwright screenshots at 375×667, 390×844 and 430×932, plus reduced-motion versions, using the `?now=` clock to show the states listed in that milestone. Set states up with dev-only fixtures that live in your temporary tooling folder and never ship.
3. Check the console: zero errors and zero CSP violations.
4. Run an axe scan with zero serious or critical issues.
5. Record a 20-second screen recording (Playwright video) of the milestone's main flow.

---

## 10. Milestones (stop after each one)

### Home screen milestone: the design system, Pengu and the train, on the real data
1. Add the injectable clock first (section 8, change 1). The screenshots and tests below depend on it. Then set up the tokens, Rubik, paper grain, glass classes, the hand-drawn helpers and the icon sprite in `pengu.css` and the page.
2. Write `art.js`: Pengu (all poses and layers, glossy lamp look, gear art) and the train (base drawing and upgrades).
3. Vendor anime.js, write `motion.js` and wire `bindPengu`: blink, eyes, hop, scarf lag, waddle, celebrate and the cab wave.
4. Build the splash.
5. Build Today exactly as in 7.2, wired to the existing `state.js`: route, count, goal line, Begin states and the Begin sequence. Include the sunny reward sheet (7.3).
6. Build the glass tab bar (Today, Pengu, History). Pengu and History may keep their current screens until M1 and M2, but remove their progress bars now.
7. Update the favicon, the OG image and the 404 page.
8. Write tests for the greeting hours and the Begin preview states (`logPreview`).

**Screenshots:**
- the splash;
- Today with no plan;
- a planned day before Begin;
- just after Begin (the reward sheet);
- the week hit;
- a missed station followed by the Comeback caption;
- an extra ride.

**Done when:**
- the home stack is exactly the four items, and fits at 375×667 without scrolling;
- Begin fills the station, rolls the train and updates the count and Fish in one tap;
- Pengu matches the lamp description, with no banned colors anywhere;
- reduced motion works;
- the checks in section 9 pass.

**Commit, report and STOP.**

### M1: plan, logging and the train
1. Build the Monday plan flow (7.5), with last-week pre-fill and next-week planning.
2. Build the Week sheet (7.4): sunny session cards, Move, the calendar file and cover status.
3. Cover every logging edge case: planned day, unplanned day moving the next station, extra ride, already logged, the comeback stamp on the station ring, the full-week bonus, and the cover toast once ("Your week streak is safe. Pengu used this month's free cover.").
4. Add `importData`, Save a backup and Restore, the Home Screen tip, `persist()`, the manifest and icons, and the CSP `manifest-src` change (section 8). Add the new events.
5. Write tests for:
   - **Week math:** across the clock change on Sunday Nov 1, 2026, weeks still run Monday to Sunday.
   - **Logging and Fish:** one log per day; 10 per planned workout, +25 per full week, +15 comeback; extras pay 0 and never trigger or use up a comeback.
   - **Moving:** moves are blocked for past or missed days.
   - **Cover:** at most one per calendar month, it keeps the streak alive without adding to it, and it is never sold.
   - **Planning:** next-week planning works late in the week.
   - **Data:** export and import round-trip; import rejects bad files; paint migration works.

**Screenshots:**
- each plan step and the summary;
- a mid-week plan;
- Sunday planning for next week;
- the Week sheet with a move;
- the calendar states;
- the Home Screen tip;
- restore confirmation.

Also test the calendar file by importing it into Google Calendar on desktop. In the report, ask Bach to try it on his iPhone.

**Done when:**
- every rule in section 2 has a passing test;
- the plan takes 30 seconds or less from a fresh start (you timed it);
- a restored backup reproduces the same Today screen.

**Commit, report and STOP.**

### M2: character upgrades
1. Build the Pengu tab (7.6):
   - the showcase in the lamp base with full interactivity;
   - the next unlock with a two-tap confirm and the unlock moment;
   - gear in fixed order with locked, saving, ready and owned states;
   - train upgrades in any order, with the paint picker;
   - extras with Wear toggles.
2. Make sure the wear rules render everywhere: the cab, avatar, toasts, reward sheet and showcase. One hat at a time, and the conductor outfit replaces the hat.
3. Build the History tab (7.7): weeks, stamps, cover tags, extras, and Your data (backup, restore, reset).
4. Write tests for:
   - fixed prices;
   - the gear order being enforced;
   - an unlock needing a balance at least equal to the price;
   - upgrades staying permanent across reload and restore;
   - Fish never going negative;
   - reset returning a true first run.

**Screenshots:**
- the Pengu tab with no gear;
- after the scarf (scarf lag visible in the recording);
- all gear with the conductor outfit;
- each train paint;
- the extras shelf;
- History with several weeks;
- both reset steps.

**Done when:** a player can go from a fresh start to owning the scarf within one hit week of 2–4 workouts, and everything in sections 2–9 holds.

**Commit, report and STOP.**

**Report format at each stop (keep it short):**
- what changed, as files with one line each;
- how to run it locally;
- the screenshot and recording paths;
- the checks you ran and their results;
- anything you couldn't verify, such as iPhone `.ics` import and Add to Home Screen, which need Bach's phone;
- open questions.

Then wait for "go".
