# How the tests work

What each folder is for, how a test run flows, and what every test checks and
why. For setup and commands see the [README](../README.md).

## Project structure

```
shortical-qa-starter/
├── shared/
│   └── test-data.ts            Drama under test, player URL builder, HLS URL matchers
├── web/                        Playwright suite for shortical.com
│   ├── playwright.config.ts    Projects (Pixel 7, desktop), branded Chrome, reports
│   ├── pages/                  Page objects
│   │   ├── HomePage.ts         Home: links to series pages
│   │   ├── DramaPage.ts        Series page: episode count, free range, "Watch free" CTA
│   │   ├── EpisodePage.ts      Episode landing page: "N of M", locked notice
│   │   └── PlayerPage.ts       Player: episode counter, video state, gate, HLS traffic log
│   └── tests/                  Specs, one file per risk area
│       ├── catalog.spec.ts
│       ├── playback.spec.ts
│       ├── paywall.spec.ts
│       └── consistency.spec.ts
├── mobile/                     WebdriverIO + Appium suite for the Android app
│   ├── wdio.android.conf.ts    Device capabilities, Appium service, failure screenshots
│   ├── constants.ts            App package id (shortical.com)
│   ├── screens/                Screen objects
│   │   ├── selectors.ts        Every Android locator, in one file
│   │   └── PlayerScreen.ts     Player: episode counter, gate, overlay dismissal
│   ├── helpers/
│   │   ├── app.ts              App lifecycle: cold start, deep link, background, swipe
│   │   └── playback.ts         Visual "is the video playing" check
│   ├── specs/
│   │   ├── playback.spec.ts
│   │   └── paywall.spec.ts
│   └── scripts/
│       └── inspect-android.ts  Dumps the view hierarchy and a testability report
├── scripts/                    Quality gates (see "Quality gates" below)
│   ├── rules.ts, check-rules.ts    Project rules linter
│   ├── selftest.ts + selftest-fixtures/   Planted defects the linter must catch
│   ├── earned.ts, check-earned.ts  PASS / FAIL / NOT-EARNED for a finished run
│   ├── mutation-check.ts       Breaks one thing, requires the test to fail
│   ├── check-wdio-config.ts    Offline check of the Android config
│   └── setup-git-hooks.mjs     Points git at .githooks/ on npm install
├── .claude/                    Agent harness: hooks, test-reviewer subagent, skills
├── .githooks/pre-commit        npm run verify before every commit
├── AGENTS.md, CLAUDE.md        Rules and definition of done for AI agents
├── docs/                       Strategy, findings, this file
├── .github/workflows/web.yml   CI for the web suite
└── artifacts/                  Reports, traces, screenshots (created by runs, not committed)
```

### Layers

The two suites follow the same three layers, so a change lands in one place:

| Layer | Web | Android | Knows about |
|---|---|---|---|
| **Specs** | `web/tests/` | `mobile/specs/` | What the user should experience. No selectors, no URLs. |
| **Page / screen objects** | `web/pages/` | `mobile/screens/` | How to find and read things on a screen. |
| **Helpers and data** | `shared/` | `mobile/helpers/`, `shared/` | URLs, test data, device actions, the playback check. |

`shared/test-data.ts` is used by both suites: the web player and the Android
deep link open the same URL (`/player?deep_link_sub1=<drama>&deep_link_sub2=<episode>`),
and HLS media on the CDN is recognised the same way (`/<drama>/<episode>/...m3u8|.ts`).

## Test data

Everything starts from one series slug, `room-service-193` by default
(override with `SHORTICAL_DRAMA`). The number at the end is the drama id used by
the player and the CDN. Nothing else is hard-coded on the web side: the free
range ("Episodes 1–13 are free") and the episode total are read from the series
page at run time, so the same tests work for any series. The Android suite
can't read the website, so its free range comes from `SHORTICAL_LAST_FREE`
(default 13).

## Web suite (Playwright)

### How a run works

1. `playwright.config.ts` starts **branded Google Chrome** (`channel: 'chrome'`).
   The episodes are H.264, which Playwright's bundled Chromium cannot decode, so
   with the default browser every playback test would fail for the wrong reason.
   Autoplay is allowed by a launch flag, as on a real phone after a tap.
2. Every test runs twice: as a **Pixel 7** (the main audience is on phones) and
   as **desktop Chrome**.
3. `PlayerPage` subscribes to network responses **as soon as it is created**,
   before the page loads, and keeps every HLS manifest (`.m3u8`) and segment
   (`.ts`) URL with its status. The video element only shows a `blob:` URL (the
   player feeds media through Media Source Extensions), so the network log is
   the only way to see what was really streamed.
4. On failure: screenshot, video and a Playwright trace are kept in
   `artifacts/`; the HTML report is in `artifacts/web-report`.

### What each test checks

**catalog.spec.ts**: the catalogue a viewer lands on is complete.

| Test | Logic |
|---|---|
| home page lists dramas | Home has at least 10 links to `/drama/...`. Catches an empty or broken catalogue. |
| episode grid matches the declared count | The number in "All N episodes" equals the number of episode links on the page. |
| free range is stated, CTA opens episode 1 | The "Episodes 1–N are free" text exists and N is less than the total; "Watch episode 1 free" links to the player with episode 1. |

**playback.spec.ts**: the video really plays. A visible `<video>` proves
nothing (a frozen player has one too), so every check is about behaviour.

| Test | Logic |
|---|---|
| episode 1 starts and keeps playing | Polls the video's `currentTime` until it passes 3 s, then checks it is not paused and has enough data buffered. The player keeps two `<video>` elements (current and preloaded next), so the helper reads the one that has advanced furthest. |
| HLS loads without errors | From the network log, for episode 1 only: at least one manifest, at least two segments (not just the first one), and no response with status 400+. |
| next episode is preloaded | While episode 1 plays, episode 2's manifest must be requested. Instant "next" is the core of micro-drama UX; this catches a regression in preloading. |

**paywall.spec.ts**: the free/paid boundary, for a signed-out viewer. Read only:
the gate is checked for being shown; nothing is typed into it.

| Test | Logic |
|---|---|
| last free episode plays without a gate | Reads the free range from the series page, opens the last free episode, waits for 5 s of playback, checks the gate is not shown. **Positive control:** the network log holds at least two media requests for this episode, proving the capture works. Only then checks that **no media of the first locked episode** was requested. The player preloads the next episode, so this guards against preloading paid content to a client that hasn't paid. |
| first locked episode is gated | **Positive control first:** in the same page, plays the last free episode for 2 s and checks its media was captured. Then opens episode N+1: the counter shows N+1, the email gate is visible: a "Sign in" heading (earlier copy: "Save your progress"), an email field and a "Continue with Email" button. Watches for 3 s, checks a `<video>` element exists (otherwise "currentTime is 0" would be true of nothing), that playback stays at 0, and that **no media for that episode was requested at all**. The 3 s window is the one fixed wait in the suite, marked with `lint-allow` and its reason. |

Why the positive controls: an assertion that something did **not** happen
passes just as well when the measurement is broken. If the network listener
stopped recording, "no requests for the locked episode" would stay green
forever. Each negative check first proves, in the same test, that the
measurement can see something.

**consistency.spec.ts**: the same facts agree everywhere they are shown. Both
tests pin live bugs ([FINDINGS.md](FINDINGS.md)) and are marked `test.fail()`.

| Test | Logic |
|---|---|
| episode count agrees across surfaces | Reads the total from the series page ("All 86 episodes"), the episode landing page ("1 of 114") and the player header ("1/86"), and expects all three to be equal. |
| locked episode doesn't promise free viewing | Opens the first locked episode's landing page, confirms the page says "Unlock with coins or VIP", and expects the `<title>` not to say "Watch Free". |

How `test.fail()` behaves: while the bug exists the test fails and Playwright
reports it as **passed (expected failure)**, so CI stays green. When the bug
is fixed the test passes, Playwright reports **"expected to fail, but passed"**
and CI goes red: a reminder to remove the marker and keep the test as a
regular regression check. The marker is applied only to the series where the
bug was seen.

## Android suite (WebdriverIO + Appium)

### Who talks to whom

```
 PC                                                         Android device (USB or emulator)
┌──────────────────────────────────────────────┐          ┌──────────────────────────────────┐
│ spec (Mocha)                                 │          │                                  │
│   ↓ page/screen objects, helpers             │          │                                  │
│ WebdriverIO client                           │          │                                  │
│   ↓ HTTP, W3C WebDriver protocol             │          │                                  │
│ Appium server :4723 (started by WDIO)        │   adb    │ UiAutomator2 server (test APK)   │
│   └ UiAutomator2 driver ─────────────────────┼─────────►│   ↓ Android UiAutomator APIs     │
│                                              │ port fwd │ Shortical app (shortical.com)    │
│ pixelmatch (playback check, runs on the PC)  │◄─────────┤ screenshots as base64 PNG        │
└──────────────────────────────────────────────┘          └──────────────────────────────────┘
```

The test code never touches the phone directly. Every command (find element,
read text, swipe, screenshot) goes spec → WebdriverIO → Appium → UiAutomator2
server on the device → the app, and the answer comes back the same way.

### A run, step by step

**0. One-time preparation**

| Step | What happens |
|---|---|
| Device | USB debugging on (or an emulator with Google Play). Shortical installed from the Play Store. `adb devices` shows the device as `device`, not `unauthorized`. |
| `npm ci` | Installs WebdriverIO, the Appium server itself (as a project dependency, so no global install) and the image libraries for the playback check. |
| `npm run setup:android` | `appium driver install uiautomator2`: downloads the Android driver into Appium's home folder. Needed once per machine. |

**1. Start: `ANDROID_UDID=<id> npm run test:android`**

`wdio run mobile/wdio.android.conf.ts` reads the config and:

- runs the `onPrepare` hook, which creates `artifacts/`;
- starts **the Appium server through `@wdio/appium-service`** on
  `127.0.0.1:4723`, writing its log to `artifacts/`. There is no need to start
  Appium by hand for the test run (only the inspect script needs that);
- finds the spec files (`mobile/specs/**/*.spec.ts`) and starts a worker
  process. `maxInstances: 1`: one device, one spec file at a time.

**2. Session start (once per spec file)**

The worker sends the capabilities to Appium. The UiAutomator2 driver then:

1. connects to the device over `adb` using `ANDROID_UDID`;
2. on the first run, installs two helper APKs on the device
   (`io.appium.uiautomator2.server` and its test package). This is the
   UiAutomator2 server that executes commands on the phone; later runs reuse it;
3. starts that server and forwards a local port to it over `adb`;
4. prepares the app under test. `noReset: true` and no `app` capability means
   **nothing is installed and app data is not cleared**: the Play Store build
   is used as is. With `ANDROID_APP=path.apk`, Appium installs that APK instead;
5. launches `shortical.com` and grants runtime permissions automatically
   (`autoGrantPermissions`), so a permission dialog doesn't block the run.

`waitForIdleTimeout: 0` matters for this app: by default UiAutomator waits for
the UI to be idle before each command, and a screen with playing video is
never idle, so every command would wait for the timeout first.

**3. Tests run (Mocha)**

Inside a spec, each `it` is one scenario. What the typical commands turn into:

| In the code | On the device |
|---|---|
| `openEpisodeByLink(193, 1)` → `mobile: deepLink` | `am start -a android.intent.action.VIEW -d https://shortical.com/player?...` for package `shortical.com`: Android opens the player on that episode, as if the link were tapped in an ad |
| `$(S.episodeCounter)` → `android=new UiSelector().textMatches(...)` | UiAutomator searches the current screen's view tree for a node with that text |
| `player.readCounter()` | Reads the node's text, e.g. `"14/86"`, parsed into `{ current: 14, total: 86 }` |
| `swipeUp()` → `mobile: swipeGesture` | A real finger-like swipe in the middle of the screen |
| `sendToBackgroundFor(5)` → `mobile: backgroundApp` | Home button, wait 5 s, bring the app back |
| `coldStart()` → `terminateApp` + `activateApp` | Force-stops the process and launches it from the launcher |
| `expectVideoPlaying()` | Takes screenshots on the device; they come to the PC as PNG and **pixelmatch compares them locally** (see below) |

Timeouts: an element wait gives up after 15 s (`waitforTimeout`), a single test
after 120 s (Mocha), and Appium closes a session that receives no command for
240 s (`newCommandTimeout`), so a hung run frees the device.

**4. After each test**

The `afterTest` hook checks the result. On failure it saves a screenshot of
the device screen to `artifacts/android-fail-<test-title>.png`, so you see what
was on screen at the moment of failure (a popup, the browser instead of the
app, a black screen).

**5. Session end (after each spec file)**

WebdriverIO closes the session. The app stays installed with its data
(`noReset`), and the UiAutomator2 server APKs stay on the device for the next
run. The next spec file opens a new session from step 2.

**6. End of run**

The Appium service stops the server, WebdriverIO prints the summary and exits
with code **0** if every test passed and **1** otherwise. CI uses this exit code
to mark the job green or red.

### Reports and artifacts (current state)

| Output | Where | What it shows |
|---|---|---|
| Spec reporter | Console | Every spec file, every test with ✓/✗, the error and stack for failures, totals and duration |
| Failure screenshots | `artifacts/android-fail-*.png` | Device screen at the moment a test failed |
| Appium server log | `artifacts/` | Every command Appium received and what the driver did on the device: the first place to look when a session doesn't start |
| Cold start metric | Console line `[metric] cold start to playing video: N ms` | Time from launch to confirmed playback, for trend tracking |
| Inspect output | `artifacts/inspect/*.xml`, `*.png` | View hierarchy and screenshot from `npm run inspect:android` |

There is **no HTML report for Android yet**. The next step is
`@wdio/allure-reporter` (history, screenshots attached to the failed step) and
a JUnit XML reporter for CI, as one config change each.

### The inspect script is a separate flow

`npm run inspect:android` does not use the WDIO runner or the Appium service.
It connects to an Appium server you start yourself (`npx appium`), opens a
session with `autoLaunch: false` so it doesn't restart the app, and reads
whatever screen you left the app on. It saves the hierarchy and a screenshot,
prints the testability numbers and closes the session. That is why it needs
Appium running in a second terminal and the test run doesn't.

### Locators

All locators live in `screens/selectors.ts`. Right now they are **text based**
(the "14/86" counter format, gate wording from the web client), because they
were written without access to the app's view hierarchy. The intended order,
once the app exposes them, is: accessibility id / Compose `testTag` →
resource-id → text. Switching is a change to that one file.

`scripts/inspect-android.ts` is the first thing to run on a device: it saves the
current screen's XML and a screenshot, and prints how many elements have a
resource-id or content-desc and how many clickable elements have neither.
That number is the testability report to discuss with the developers.

### How "is the video playing" works

A native player has no `currentTime` in the view hierarchy, and "player is
displayed" is also true when it is frozen. `helpers/playback.ts` checks the
picture instead:

1. Takes a screenshot and crops the centre of the screen (leaving out the status
   bar, side buttons and subtitles, which change on their own).
2. Waits 1.5 s, takes a second one, and counts the share of changed pixels with
   `pixelmatch`.
3. Repeats three times. **Playing** = at least two of three windows changed by
   more than 2%. **Not playing** = every window changed by less than 2%.

If the screenshots are black, the app sets `FLAG_SECURE` (screen capture
blocked, common for paid video). **Both** checks then fail with that message,
and for "not playing" this matters most: two black frames never differ, so
without the check "nothing plays behind the gate" would pass without looking
at anything. A QA build without the flag fixes it.

### What each test checks

**playback.spec.ts**

| Test | Logic |
|---|---|
| cold start lands in the player and video starts within 10 s | Kills the app, launches it, waits up to 10 s for the episode counter, closes a first-run overlay if one is up, checks the video is playing, and logs the time to first playing video as a metric. |
| free episode opened by link plays | Deep link to episode 1: counter shows 1, video is playing. |
| swipe up moves to the next episode | Reads the counter, swipes up, waits for the counter to change, expects exactly +1, and checks the new episode plays. |
| playback resumes after backgrounding | Plays episode 2, sends the app to the background for 5 s, checks it comes back to the foreground on the same episode and is still playing. |

**paywall.spec.ts**: same boundary as on the web, read only.

| Test | Logic |
|---|---|
| last free episode plays without a gate | Deep link to episode `SHORTICAL_LAST_FREE`: no gate, video playing. |
| first locked episode is gated | Deep link to the next episode: a gate appears (sign-in, coins or VIP wording) and nothing plays behind it. |

## CI

`.github/workflows/web.yml` runs on every push and pull request, daily at
05:17 UTC as a production check, and on demand:

1. `npm ci`, then `npm run verify` (the same offline gate as the pre-commit hook);
2. install branded Chrome, run the web suite;
3. `npm run earned` reads `artifacts/web-results.json` and fails the job unless
   the run is **PASS**: tests executed, none failed, none skipped. A run where
   nothing executed exits 0 from Playwright but is **NOT-EARNED** here;
4. upload the HTML and JSON reports as artifacts.

Android is not in CI: it needs an APK the pipeline is allowed to install.

## Quality gates

Checks that run before any test touches the product. All offline.

| Gate | Catches | Command |
|---|---|---|
| TypeScript | Type errors in specs, page objects, helpers, scripts | `npm run typecheck` |
| ESLint (type-aware) | Missing `await` (`no-floating-promises`, `missing-playwright-await`), `.only`/`.skip`, tests without assertions | `npm run lint` |
| Project rules | Fixed waits without a reason, waits over 30 s, locators in specs, Android locators outside `selectors.ts`, `.only`, `test.fail` without a FINDINGS number, any write to production | `npm run rules` |
| Selftest | The rules linter missing one of 20 planted defects; wrong PASS/FAIL/NOT-EARNED logic | `npm run selftest` |
| Spec compilation | Specs that don't load (syntax, imports) | `npm run list:web`, `npm run check:wdio` |

`npm run verify` runs all of them in that order and stops at the first
failure. The git pre-commit hook runs it on every commit, for people and
agents alike.

Two more, which need the network:

- `npm run mutate -- <file> "<from>" "<to>" "<test title>"` applies one
  breaking change, runs that test, and passes only if the test **fails**. The
  file is restored either way. Example: the paywall test must fail if it looks
  one episode too early
  (`"const firstLocked = lastFree + 1;"` -> `"const firstLocked = lastFree;"`).
- `npm run earned` after a run, as in CI.

How AI agents fit into this (hooks, the reviewer subagent, skills, the
definition of done) is in [AGENTS.md](../AGENTS.md) and the README.
