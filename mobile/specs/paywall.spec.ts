/**
 * Free/locked boundary for a signed-out user (episode 13 free, 14 locked for
 * "Room Service"). Covered on the web; on Android it is blocked, and the tests
 * are kept as pending so the gap shows in every report instead of being silent.
 *
 * Why blocked (docs/FINDINGS.md, testability): a test has to open one specific
 * episode, and the Play Store build offers no way to do that:
 * - https://shortical.com/player?... links are not handled by the app;
 * - OneLink (shortical.onelink.me/o2gt) and shortical://series/... open Home,
 *   whatever parameters are passed (format undocumented);
 * - navigating there through the UI needs locators the player screen lacks.
 *
 * Unblocked by any one of: the deep link format from the team, Compose test
 * tags exposed as resource ids, or a QA build with a debug entry point.
 */
describe('Android: paywall boundary (signed out)', () => {
  it('last free episode plays without a gate (pending: cannot open a given episode, see FINDINGS)');
  it('first locked episode shows a gate and nothing plays behind it (pending: cannot open a given episode, see FINDINGS)');
});
