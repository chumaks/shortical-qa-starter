# Test strategy (first draft)

What I would put in place as the first QA engineer, written from the outside:
from the public web client, the Play Store build and the job description. It
will change after the first week with the team; the point is to show where I
would start and why.

## What the product has to get right

A micro-drama viewer decides in seconds. The product promise is: open the app,
a story is already playing, the next episode starts instantly, and paying is
easy at the right moment. So quality risk ranks by how directly it breaks that
loop:

| # | Risk | Why it ranks here | First coverage |
|---|---|---|---|
| 1 | **Playback start and continuity**: slow first frame, stalls, black screen, audio/video desync, next episode not instant | Every session starts here; retention dies first | Automated: playing = position advances (web) / picture changes (Android); HLS manifest and segments succeed; next episode preloaded. Manual: real devices on poor networks |
| 2 | **Paywall boundary**: free episodes gated, or locked ones playable; wrong free range per series | Direct revenue in both directions | Automated: last free plays with no gate, first locked shows gate and streams nothing |
| 3 | **Purchases**: coins, VIP subscription, restore, renewal, refunds, StoreKit / Play Billing / web (Stripe, Paddle) state sync | Money and support load; three payment stacks share one entitlement | Manual + sandbox accounts first; automate entitlement checks at API level once there is a test backend |
| 4 | **Lifecycle**: background/foreground, interruptions (call, notification), network switch, offline, process death | Short sessions on the go; this is where mobile players break | Automated: background/resume. Manual matrix for the rest |
| 5 | **Content and catalogue consistency**: counts, free ranges, metadata, dubbing languages and subtitles across web, landing pages, apps | Already one mismatch found (FINDINGS #1, #2); dubbing multiplies the surface | Automated cross-surface checks (web now; API later) |
| 6 | **Deep links and attribution**: OneLink / ad links land on the right episode in app or web | Paid acquisition depends on it | Automated deep link → correct episode; manual install-then-open flows |
| 7 | **Analytics and experiments**: events and A/B variants fire once and correctly | Product decisions run on this data | Network-level event assertions on web; event log checks on Android |

## Levels

- **API / contract** (most tests, fastest): catalogue, entitlements, episode
  access by user state. Not in this starter: it needs a non-production
  environment and auth. It is the first thing I would add with the team.
- **Web E2E (Playwright)**: user-visible flows plus network assertions (HLS,
  analytics). Runs on every PR and on a schedule against production read-only.
- **Android/iOS UI (Appium via WebdriverIO, TypeScript)**: a small set of
  critical journeys on real devices: start, swipe, gate, resume. The KMP shared
  code is tested at the API and web levels; UI tests cover what is platform-specific
  (player, gestures, billing, lifecycle).
- **Manual and exploratory**: video quality, gestures feel, purchase flows,
  new features before they are worth automating. Charters per release.

Why Appium rather than Espresso/XCUITest or Maestro as the starting point: one
TypeScript codebase for Android, iOS and web helpers, black-box against store
builds, and it runs the same suite on a device farm. Maestro is a strong
candidate for fast smoke flows once the app exposes test tags; worth a spike
side by side.

## Release criteria (draft)

- All automated checks green on the release candidate (web suite, Android and
  iOS smoke on at least one real device each).
- Exploratory pass on the changed areas, plus the purchase flow in sandbox.
- No open critical/major in playback, paywall or purchases.
- Crash-free sessions in the beta/staged rollout at or above the agreed bar
  before expanding the rollout; staged rollout on Google Play and phased
  release on the App Store.

## What I need from the team in week one

1. A QA build for Android and iOS (debuggable, test tags exposed, no FLAG_SECURE
   on video, sandbox billing, a way to reset entitlements).
2. A non-production backend, or at least test accounts in production with known
   entitlement states (signed out, free, coins balance, VIP).
3. Test tags (`Modifier.testTag` exposed as resource-id on Android, accessibility
   identifiers on iOS) on: player container, episode counter, episode list,
   gate, paywall, purchase buttons. A short list, and the UI suite stops
   depending on copy.

## Metrics to report

Pass rate and duration per suite, flaky tests (retries that passed) and their
trend, escaped defects by area, crash-free sessions per release, time to first
frame from the automated runs.
