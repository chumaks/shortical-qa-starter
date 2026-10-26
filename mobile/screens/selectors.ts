/**
 * Every Android locator lives here, so swapping text-based fallbacks for real
 * test tags is a one-file change.
 *
 * STATUS: provisional. Written without access to the app's view hierarchy, from
 * the labels the web client uses (the apps share a KMP codebase, so copy is
 * likely shared). `npm run inspect:android` dumps the real hierarchy; replace
 * each entry with the resource-id / content-desc it reports.
 *
 * Preferred order once the app has them:
 *   1. ~accessibility id (content-desc) or Compose testTag exposed as resource-id
 *   2. resource-id
 *   3. UiSelector text match (current fallback; breaks on copy and locale changes)
 */
const ui = (expr: string) => `android=new UiSelector().${expr}`;
const textMatches = (re: string) => ui(`textMatches("${re}")`);

export const S = {
  /** "14/86": episode counter in the player header (web: same format). */
  episodeCounter: textMatches('^\\d+/\\d+$'),

  /**
   * Anything that blocks a locked episode: sign-in/email gate, coins or
   * subscription paywall. Kept broad on purpose until the real ids are known.
   */
  gate: textMatches(
    '(?i).*(sign in|save your progress|continue with email|unlock|subscribe|coins|get vip|vip|continue with google).*',
  ),
} as const;
