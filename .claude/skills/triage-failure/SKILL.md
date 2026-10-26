---
name: triage-failure
description: Investigate a failed or suspicious test run (local or the daily CI run) and classify it. Use when a run is red, flaky, or NOT-EARNED.
---

# Triage a failed run

## 1. Is the run earned?

`npm run earned` (or the CI step "earned"). NOT-EARNED (0 executed, skipped
tests, missing report) is a problem in itself: find why tests didn't run
before looking at any assertion.

## 2. Reproduce once, then measure

- Rerun only the failing test: `npx playwright test -c web/playwright.config.ts -g "<title>" --retries 0`.
- Read the evidence before forming a theory: trace (`npx playwright show-trace
  artifacts/web-results/.../trace.zip`), screenshot, video, the HLS log in the
  error message; Android: `artifacts/android-fail-*.png` and the Appium log.
- Two wrong hypotheses = stop guessing. Collect more data (another run, the
  network tab, an `inspect:android` dump) before the third.

## 3. Classify

| Class | Signs | Action |
|---|---|---|
| Product bug | Reproduces by hand on the site/app; evidence shows wrong behaviour | Draft in `docs/FINDINGS.md` > Drafts: steps, expected, actual, evidence. Human confirms and files it. |
| Test bug | Wrong locator, wrong assumption, race in the test | Fix via `write-web-test` / `write-android-test`, full definition of done. |
| Flaky | Passes and fails on the same build without changes | Record in the report with the evidence of both outcomes. Do not add waits to shared helpers to hide it; propose a fix and let the human decide. |
| Environment | CDN/network outage, site down, device offline | Note it; no code change. |
| Expected change | Site changed on purpose (copy, layout, free range) | Update the page object / data; confirm with the human that the change is intended. |

## 4. Report

Per failed test: class, one-line cause, the evidence (file paths or output
lines), proposed action. Do not change a shared helper or page object as part
of triage without listing every caller and running them.
