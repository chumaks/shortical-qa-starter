/**
 * Every Android locator lives here, so moving to test tags is a one-file change.
 *
 * Taken from the real view hierarchy of Shortical 0.5.68 (build 562) with
 * `npm run inspect:android` on 2026-10-28. What the app exposes:
 *
 * - Bottom navigation: icons have content-desc (Home, For You, My List,
 *   Rewards, Profile). Stable and copy-independent enough to use.
 * - For You (trailer feed, one card per series): the video area is the one
 *   scrollable node; the card's title, description and "Watch Now" are text.
 * - Series player (behind "Watch Now"): the ExoPlayer view has a resource-id
 *   (player_view). Its overlay (episode counter, buttons) is Compose with no
 *   semantics: no text, no desc, no id. Nothing on it can be located.
 *
 * See docs/FINDINGS.md (testability) for what would make this better.
 */
const ui = (expr: string) => `android=new UiSelector().${expr}`;

export const S = {
  tabHome: '~Home',
  tabForYou: '~For You',
  tabMyList: '~My List',
  tabProfile: '~Profile',

  /** ExoPlayer's view in the series player (not on the For You feed). */
  playerView: ui('resourceId("shortical.com:id/player_view")'),

  /** The For You video area: the only scrollable element on that screen. */
  feed: ui('scrollable(true)'),
} as const;
