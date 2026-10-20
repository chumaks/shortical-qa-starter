# Shortical QA starter

A first cut of the test automation I would build as Shortical's first QA
engineer: a Playwright suite for the web client and a WebdriverIO + Appium
suite for the Android app, both in TypeScript, with a test strategy and the
issues found along the way.

Everything runs against **production, read-only**: no sign-in, nothing typed
into the paywall, no purchases.

- [docs/HOW_TESTS_WORK.md](docs/HOW_TESTS_WORK.md): project structure, how a run works, what each test checks and why
- [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md): risks, levels, release criteria, what I would ask for in week one
- [docs/FINDINGS.md](docs/FINDINGS.md): two issues on the live site, each pinned by a test

## What is covered

| Area | Web (Playwright) | Android (Appium) |
|---|---|---|
| Catalogue: home lists dramas, series page episode grid matches its count, free range stated | ✓ | |
| Playback actually progresses (not just "player is visible") | ✓ position advances | ✓ picture keeps changing |
| HLS: manifests and segments load from the CDN with no errors | ✓ | |
| Next episode preloaded during playback | ✓ | |
| Swipe to next episode | | ✓ |
| Cold start to playing video (time logged) | | ✓ |
| Background and resume | | ✓ |
| Paywall: last free episode plays, first locked one is gated and streams nothing | ✓ | ✓ |
| Episode count consistent across surfaces (known bug, `test.fail`) | ✓ | |
| Locked episode page doesn't promise "Watch Free" (known bug, `test.fail`) | ✓ | |

Web: 10 tests × 2 projects (Pixel 7 emulation and desktop Chrome). Android: 6 tests.

## Run the web suite

```bash
npm ci
npx playwright install chrome   # branded Chrome: episodes are H.264, bundled Chromium has no H.264
npm run test:web
npm run test:web:report         # HTML report, traces and videos for failures
```

Another series: `SHORTICAL_DRAMA=keys-to-my-heart-25 npm run test:web`. The free
range and episode counts are read from the site, not hard-coded.

## Run the Android suite

Prerequisites: Node 20+, JDK 17+, Android platform-tools (`adb`), a device or
emulator with Google Play and **Shortical installed from the Play Store**
(package `shortical.com`).

```bash
npm ci
npm run setup:android                     # installs the UiAutomator2 driver
adb devices                               # copy the device id
ANDROID_UDID=<id> npm run test:android    # Appium is started by the WDIO service
```

On Windows PowerShell: `$env:ANDROID_UDID="<id>"; npm run test:android`.

**First run on a new device: inspect.** The locators in
[`mobile/screens/selectors.ts`](mobile/screens/selectors.ts) are provisional:
they were written without the app's view hierarchy, from the labels the web
client uses. Before trusting a red or green result, dump the real hierarchy:

```bash
npx appium                                          # terminal 1
ANDROID_UDID=<id> npm run inspect:android player    # terminal 2, app open on the player
```

It saves the XML and a screenshot to `artifacts/inspect/` and prints a short
testability report: how many elements have a resource-id or content-desc, and
how many clickable elements have neither. Swap the text fallbacks for real ids
in `selectors.ts`; nothing else changes.

With an internal build instead of the store one: `ANDROID_APP=/path/app.apk`.

## iOS

Not included on purpose. An App Store build is encrypted and cannot run on a
simulator, and driving it on a real device needs a WebDriverAgent signed for
that device. With the team's iOS build (simulator `.app` or a development-signed
`.ipa`) the iOS run is a second WDIO config with `XCUITest` capabilities; the
specs, the screen objects and the playback helper are written to be shared,
and only `selectors.ts` gets an iOS variant (accessibility identifiers).

## Design decisions

- **Playback is checked by behaviour.** "A video element exists" is true for a
  frozen player. Web: `currentTime` must advance and HLS traffic must succeed.
  Android: there is no `currentTime` in the view hierarchy, so the helper
  compares the centre of two screenshots over several windows
  ([`mobile/helpers/playback.ts`](mobile/helpers/playback.ts)). If the app sets
  `FLAG_SECURE` (black screenshots), the check fails loudly rather than passing.
- **Known bugs are `test.fail()`, not skipped.** The suite stays green while an
  issue is open, and turns red the day it is fixed, so the marker gets removed.
- **No test data is hard-coded.** Free range and episode totals are read from
  the series page.
- **Locators prefer roles and stable ids;** the web client has no `data-testid`
  yet (noted in FINDINGS), the Android ones are provisional until inspected.
- **Production-safe.** Read-only flows only; two workers in CI to keep the load
  polite.

## CI

[`.github/workflows/web.yml`](.github/workflows/web.yml) runs the web suite on
every push and pull request and every morning on a schedule, and uploads the
HTML report. Android is not in CI here: it needs an APK the pipeline is allowed
to install. With one, the plan is an emulator job on pull requests (smoke) and
a nightly run on a device farm (BrowserStack or Firebase Test Lab) across a
small device/OS matrix.

## Project structure

```
shared/      test data and URL helpers used by both suites
web/         Playwright: config, page objects (pages/), specs (tests/)
mobile/      WebdriverIO + Appium: config, screen objects and selectors (screens/),
             device helpers and the visual playback check (helpers/), specs, inspect script
docs/        test strategy, findings, how the tests work
.github/     CI workflow for the web suite
```

Both suites use the same layers: specs describe what the user should
experience, page/screen objects know how to find things, helpers and shared
data know URLs and device actions. Folder-by-folder detail and the logic of
every test: [docs/HOW_TESTS_WORK.md](docs/HOW_TESTS_WORK.md).

## How it was built

I explored the web client with an AI assistant (Claude) driving a browser:
DOM structure, the HLS traffic on the CDN, how the gate behaves on locked
episodes. That is where the findings came from. Code drafts were AI-assisted;
each test was reviewed against the same checklist I use at work: the assertion
checks a user-visible outcome, the test fails when the behaviour breaks, no
fixed waits except a documented negative check, no mocking of the thing under
test.

---

Serhii Chumak · [LinkedIn](https://www.linkedin.com/in/serhii-chumak-a4142b92/)
