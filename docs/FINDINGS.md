# Findings

Observed on the public web client (shortical.com) on 2026-10-20 while writing
the suite, signed out, desktop Chrome. Read-only observation: nothing was
submitted or purchased. Each finding has a test that documents it with
`test.fail()`, so the suite stays green while the issue is open and flags the
day it is fixed.

## 1. Episode count differs between the series page and the episode pages

**Where:** "Room Service" (`/drama/room-service-193`)

| Surface | Total shown |
|---|---|
| Series page, "All N episodes" and episode grid | 86 |
| Player header (`1/86`) and its episode list | 86 |
| Episode landing page (`/drama/room-service-193/episode-1`): "1 of 114", "All 114 episodes", meta description "114 episodes total" | 114 |

Episode pages 87 to 114 return 200 with full content (`/episode-100` is titled
"Room Service Episode 100"), but the player stops at 86.

**Why it matters:** episode landing pages exist for search traffic. A viewer
who arrives on episode 100 from Google is sent into a player where that
episode doesn't exist. It also suggests the landing pages are generated from a
different source (or an older snapshot) than the app catalogue, which is worth
knowing for every other field they show.

**Test:** `web/tests/consistency.spec.ts` › episode count agrees across series page, episode page and player

**Question for the team:** which number is right, and what generates the landing pages?

## 2. Locked episodes are titled "Watch Free"

**Where:** `/drama/room-service-193/episode-14` and every episode after the free
range (1-13 for this series).

- `<title>`: "Room Service Episode 14 — Watch Free | Shortical"
- meta description: "Watch Room Service episode 14 free on Shortical ..."
- page body: "Access: Unlock with coins or VIP"

**Why it matters:** the title and description are what appear in search results
and link previews. Promising "free" and then showing a paywall is a conversion
and trust problem, and for paid traffic it can be an ad-policy problem.

**Test:** `web/tests/consistency.spec.ts` › locked episode page does not promise free viewing in its title

## Testability notes (not bugs)

- The web client has no `data-testid` (or similar) attributes. Tests use roles
  and visible text, which works today but breaks on copy changes and
  localisation (the catalogue is being dubbed into several languages). Adding
  test ids to the player header, episode list, gate and paywall would be the
  cheapest stability win.
  It already mattered once: between 2026-10-20 and 2026-10-26 the gate's copy
  changed from "Save your progress" / "Continue" to "Sign in" / "Continue with
  Email". The paywall test went red in CI on the first run after the change;
  the behaviour (locked episode gated, nothing streamed) was unchanged. The
  locator now accepts both wordings; a test id would make it independent of copy.
- Things that already work well and the suite now protects: the next episode's
  manifest is preloaded during playback (fast "next"), and no media for a
  locked episode is requested: neither on the locked episode itself nor as a
  preload during the first seconds of the last free one. (Whether the CDN
  itself refuses locked media to an unauthorised client is a question for the
  team, not something this suite probes on production.)

## Drafts

Unconfirmed issues found by test runs or agents, waiting for a human to
reproduce, number and file them. Format: steps, expected, actual, evidence.

_None._
