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
│   ├── wdio.android.conf.ts    Device capabilities, Appium service, failure evidence, report hooks
│   ├── report.ts               Writes artifacts/android-report.md after every run
│   ├── constants.ts            App package id (shortical.com)
│   ├── screens/                Screen objects
│   │   ├── selectors.ts        Every Android locator, in one file (taken from the real app)
│   │   ├── HomeScreen.ts       Home: bottom navigation, open the For You feed
│   │   └── PlayerScreen.ts     For You feed: wait for it, tap to pause, swipe to next card
│   ├── helpers/
│   │   ├── app.ts              App lifecycle: cold start, Home key, bring to front
│   │   └── playback.ts         "Is the video playing" from Android's audio player state
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

`shared/test-data.ts` holds the series under test, the web player URL
(`/player?deep_link_sub1=<drama>&deep_link_sub2=<episode>`) and how HLS media on
the CDN is recognised (`/<drama>/<episode>/...m3u8|.ts`). The Android app does
not open that URL (see "Locators" below), so the Android suite doesn't use it.

## Test data

Everything starts from one series slug, `room-service-193` by default
(override with `SHORTICAL_DRAMA`). The number at the end is the drama id used by
the player and the CDN. Nothing else is hard-coded on the web side: the free
range ("Episodes 1–13 are free") and the episode total are read from the series
page at run time, so the same tests work for any series. The Android tests
don't depend on a particular series: they use whatever the For You feed plays.

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
| episode grid matches the declared count | The number in "All N episodes" is above 0 (otherwise the check would pass as 0 = 0) and equals the number of episode links on the page. |
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
| first locked episode is gated | **Positive control first:** in the same page, opens the last free episode and waits until the network log has captured its media (proof the listener works; playback itself is covered elsewhere). Then opens episode N+1: the counter shows N+1, the email gate is visible: a "Sign in" heading (earlier copy: "Save your progress"), an email field and a "Continue with Email" button. Watches for 3 s, checks a `<video>` element exists (otherwise "currentTime is 0" would be true of nothing), that playback stays at 0, and that **no media for that episode was requested at all**. The 3 s window is the one fixed wait in the suite, marked with `lint-allow` and its reason. The test has a 90 s budget instead of the default 60 s: on CI it measured 27-58 s and once timed out. |

Why the positive controls: an assertion that something did **not** happen
passes just as well when the measurement is broken. If the network listener
stopped recording, "no requests for the locked episode" would stay green
forever. Each negative check first proves, in the same test, that the
measurement can see something.

**consistency.spec.ts**: the same facts agree everywhere they are shown. Both
Two tests pin live bugs ([FINDINGS.md](FINDINGS.md)) and are marked `test.fail()`;
two plain tests prove their measurements still work.

| Test | Logic |
|---|---|
| episode count agrees across surfaces | Reads the total from the series page ("All 86 episodes"), the episode landing page ("1 of 114") and the player header ("1/86"), and expects all three to be equal. |
| locked episode doesn't promise free viewing | Opens the first locked episode's landing page, confirms the page says "Unlock with coins or VIP", and expects the `<title>` not to say "Watch Free". |
| known-bug measurements work: totals readable | Not `test.fail`. Reads the same three totals and requires each to be a number above 0. |
| known-bug measurements work: lock notice and title | Not `test.fail`. The locked page shows its lock notice and has a non-empty title. |

Why the companion tests: a `test.fail()` test is green whenever it fails, for
any reason. If a locator stopped matching, the known-bug test would fail for
the wrong reason and still be green. The companion tests fail in that case.

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
│ playback check (parses the result on the PC) │◄─────────┤ `dumpsys audio` via mobile: shell│
└──────────────────────────────────────────────┘          └──────────────────────────────────┘
```

The test code never touches the phone directly. Every command (find element,
read text, swipe, a shell command) goes spec → WebdriverIO → Appium → UiAutomator2
server on the device → the app, and the answer comes back the same way.

### A run, step by step

**0. One-time preparation**

| Step | What happens |
|---|---|
| Device | USB debugging on (or an emulator with Google Play). Shortical installed from the Play Store. `adb devices` shows the device as `device`, not `unauthorized`. |
| `npm ci` | Installs WebdriverIO and the Appium server itself (as a project dependency, so no global install). |
| Android driver | `appium-uiautomator2-driver` is a dev dependency, so `npm ci` installs the pinned version with the project. `npm run setup:android` (re)installs it if needed. `npx appium driver doctor uiautomator2` checks that `ANDROID_HOME`, `JAVA_HOME` and `adb` are in place. |

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
| `home.openForYou()` → `$('~For You').click()` | UiAutomator finds the tab by its accessibility label and taps it |
| `player.waitForFeed()` → `UiSelector().scrollable(true)` | Waits for the For You video area (the one scrollable element there) |
| `player.tapVideo()` → `mobile: clickGesture` | A tap in the middle of the video (pause / resume) |
| `player.swipeToNext()` → `mobile: swipeGesture` on the feed | A finger-like swipe up on the feed: the next series card |
| `pressHome()` / `bringToFront()` | Home key, then `activateApp` to come back |
| `coldStart()` → `terminateApp` + `activateApp` | Force-stops the process and launches it from the launcher |
| `expectVideoPlaying()` → `mobile: shell dumpsys audio` | Runs `dumpsys audio` on the phone and reads the state of the app's audio players (see below) |

Timeouts: an element wait gives up after 15 s (`waitforTimeout`), a single test
after 120 s (Mocha), and Appium closes a session that receives no command for
240 s (`newCommandTimeout`), so a hung run frees the device.

**4. After each test**

The `afterTest` hook records the result (title, passed, time, error) to
`artifacts/android-results.jsonl`. On failure it also saves the view hierarchy
to `artifacts/android-fail-<test-title>.xml` (which screen the app was on and
what could be located there) and a screenshot (black for this app because of
FLAG_SECURE, useful with a QA build).

**5. Session end (after each spec file)**

WebdriverIO closes the session. The app stays installed with its data
(`noReset`), and the UiAutomator2 server APKs stay on the device for the next
run. The next spec file opens a new session from step 2.

**6. End of run**

The `onComplete` hook writes `artifacts/android-report.md` (see below). The
Appium service stops the server, WebdriverIO prints the summary and exits
with code **0** if every test passed and **1** otherwise. CI uses this exit code
to mark the job green or red.

### Reports and artifacts (current state)

| Output | Where | What it shows |
|---|---|---|
| Spec reporter | Console | Every spec file, every test with ✓/✗, the error and stack for failures, totals and duration |
| **Run report** | `artifacts/android-report.md` | Verdict (PASS / FAIL / NOT-EARNED if nothing ran), every test with ✅/❌ and time, pending tests with the reason, metrics, each failure's error and its hierarchy file |
| Failure evidence | `artifacts/android-fail-*.xml`, `*.png` | View hierarchy and device screen at the moment a test failed |
| Appium server log | `artifacts/` | Every command Appium received and what the driver did on the device: the first place to look when a session doesn't start |
| Timing metrics | Console lines `[metric] ...` and the report's Metrics section | Cold start to Home, For You tap to playing |
| Inspect output | `artifacts/inspect/*.xml`, `*.png` | View hierarchy and screenshot from `npm run inspect:android` |

The report is markdown, not HTML, and Android doesn't run in CI yet (no
installable build, see the README). The next step is
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

All locators live in `screens/selectors.ts`, taken from the real view hierarchy
of Shortical 0.5.68 with `npm run inspect:android`. What the app exposes:

| Screen | Usable | Not usable |
|---|---|---|
| Home | Bottom navigation icons have accessibility labels (`Home`, `For You`, `My List`, `Rewards`, `Profile`); section titles are text | Cards have no ids |
| For You (trailer feed, one card per series) | The video area is the one scrollable node; title, description, "Watch Now", "Episodes" are text | No ExoPlayer view here |
| Series player (behind "Watch Now") | ExoPlayer's view has a resource-id (`player_view`) | The overlay (episode counter, buttons) is Compose with **no semantics**: no text, no label, no id |

Preferred order once the app exposes more: Compose `testTag` as resource-id →
accessibility label → text. Switching is a change to that one file.

`scripts/inspect-android.ts` saves the current screen's XML and a screenshot,
and prints how many elements have a resource-id or content-desc and how many
clickable elements have neither: the testability report to discuss with the
developers.

### How "is the video playing" works

The two obvious ways don't work on this build:

- **Screenshots are black.** The app's window has `FLAG_SECURE` (confirmed with
  `dumpsys window`): Android blocks every capture of it, Appium's included.
  Normal for paid video, but it rules out comparing frames.
- **The overlay exposes nothing**: no playback time, no counter.

Android itself knows, though. Every audio player an app creates is listed by
`dumpsys audio` with the app's uid and a state. Measured on the phone:

| Moment | Shortical's players |
|---|---|
| Playing | `piid:231 state:started` (48 kHz stereo), plus two `idle` (preloaded next episodes) |
| Paused (tap) | `piid:231 state:paused`, two `idle` |
| On Home | none: the app releases its players when it leaves the player |

`helpers/playback.ts` runs `dumpsys audio` through Appium's `mobile: shell`
(allowed by `relaxedSecurity`) and reads that state:

- **Playing** = one of the app's players is `started`, still started 1.5 s later.
- **Not playing** = none is `started`, over three samples. As a positive
  control it requires the app's players to be visible (a paused player is
  still listed). In the background test the app may release them, so there the
  positive control is the "playing" check just before pressing Home.
- **A new episode** = a different player (`piid`) is `started` after the swipe.

Device volume doesn't matter: a muted track is still `started`.

### What each test checks

**playback.spec.ts** (every test starts from a cold start, so none depends on
where the previous one left the app)

| Test | Logic |
|---|---|
| cold start lands on Home with the bottom navigation | Kills the app, launches it, waits for the `Home` tab and checks `For You` is displayed. Logs the time as a metric. |
| For You opens the feed and video starts within 10 s | Taps `For You`, waits for the feed, then requires a `started` audio player within 10 s. Logs tap-to-playing time. |
| tap on the video pauses it, a second tap resumes | Playing → tap → no started player (players still listed) → tap → playing again. Proves both directions of the signal on the same player. |
| swipe up starts a different video (next series card) | Remembers the playing `piid`. **Control:** 2 s without a swipe, the same `piid` is still the one playing (so a change later is caused by the swipe, not by a trailer ending). Then swipes up and waits for a different `piid` to be `started`. |
| going to the background stops playback, coming back resumes it | Playing → Home key → app not in the foreground and nothing `started` → bring to front → feed shown and playing again. |

**Can these tests fail?** Checked by hand with a mutant spec (2026-10-28, on
the phone): the pause test with the pause tap removed fails ("not playing" sees
`piid 503 state:started`), and with the resume tap removed fails ("no audio
player reached started within 15 s"). Both mutants killed.

**paywall.spec.ts**: **pending**. The boundary needs one specific episode
(13 free, 14 locked) and the Play Store build gives no way to open it:
`https://shortical.com/player?...` is not handled by the app, and OneLink and
`shortical://series/...` open Home whatever parameters are passed. The tests
are declared without a body, so every report lists them as pending with the
reason instead of hiding the gap (docs/FINDINGS.md).

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
