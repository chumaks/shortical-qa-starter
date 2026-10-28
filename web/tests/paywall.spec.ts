import { expect, test } from '@playwright/test';
import { DRAMA_ID, DRAMA_SLUG } from '../../shared/test-data';
import { DramaPage } from '../pages/DramaPage';
import { PlayerPage } from '../pages/PlayerPage';

/**
 * Monetisation boundary. Read-only on purpose: the gate is checked for being
 * shown, nothing is typed into it and nothing is bought.
 *
 * Both tests assert that something did NOT happen (no media requested, nothing
 * played). An absence passes just as well when the measurement is broken, so
 * each one first proves the measurement works on something that must be there:
 * the network log has captured real media, and there is a <video> to read.
 */
test.describe('Paywall boundary (signed-out viewer)', () => {
  let lastFree: number;

  test.beforeEach(async ({ page }) => {
    const drama = new DramaPage(page, DRAMA_SLUG);
    await drama.open();
    lastFree = await drama.lastFreeEpisode();
  });

  test('last free episode plays without a gate', async ({ page }) => {
    const player = new PlayerPage(page);
    await player.open(DRAMA_ID, lastFree);

    await player.waitForPlaybackPast(5);
    await expect(player.gate().heading).toBeHidden();

    // Positive control: the network log sees this episode's own media.
    expect(player.mediaFor(DRAMA_ID, lastFree).length, 'network log captured the playing episode').toBeGreaterThanOrEqual(2);

    // Episode 1 preloads episode 2, but the last free episode must not preload
    // the first locked one: that would hand paid media to a signed-out client.
    expect(player.mediaFor(DRAMA_ID, lastFree + 1), 'no preload of the first locked episode').toEqual([]);
  });

  test('first locked episode shows the gate and does not stream media', async ({ page }) => {
    // The heaviest test in the suite: series page, two player loads, a gate that
    // animates in after several seconds, and a 3 s observation window. On CI
    // runners it measured 27-58 s and once crossed the default 60 s.
    test.setTimeout(90_000);

    const firstLocked = lastFree + 1;
    const player = new PlayerPage(page);

    // Positive control in the same page and listener: free media is captured.
    // Waiting for the first media response is enough to prove the listener
    // works; playback itself is covered by the other tests.
    await player.open(DRAMA_ID, lastFree);
    await expect
      .poll(() => player.mediaFor(DRAMA_ID, lastFree).length, { message: 'network log captured the free episode' })
      .toBeGreaterThanOrEqual(1);

    // ...then the locked episode.
    await player.open(DRAMA_ID, firstLocked);
    expect(await player.counterValues()).toMatchObject({ current: firstLocked });

    const gate = player.gate();
    await expect(gate.heading).toBeVisible();
    await expect(gate.email).toBeVisible();
    await expect(gate.continue).toBeEnabled();

    // Give the player time to (wrongly) start streaming behind the gate.
    await page.waitForTimeout(3_000); // lint-allow: negative check needs a fixed observation window
    expect(await player.videoElementCount(), 'a player is on the page to observe').toBeGreaterThanOrEqual(1);
    expect((await player.activeVideo()).currentTime, 'nothing should play behind the gate').toBe(0);
    expect(player.mediaFor(DRAMA_ID, firstLocked), 'locked episode media should not be requested').toEqual([]);
  });
});
