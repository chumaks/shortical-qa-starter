import { expect, test } from '@playwright/test';
import { DRAMA_ID, DRAMA_SLUG, isMediaFor } from '../../shared/test-data';
import { DramaPage } from '../pages/DramaPage';
import { PlayerPage } from '../pages/PlayerPage';

/**
 * Monetisation boundary. Read-only on purpose: the gate is checked for being
 * shown, nothing is typed into it and nothing is bought.
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

    // Episode 1 preloads episode 2, but the last free episode must not preload
    // the first locked one: that would hand paid media to a signed-out client.
    expect(
      player.media.filter((m) => isMediaFor(m.url, DRAMA_ID, lastFree + 1)),
      'no preload of the first locked episode',
    ).toEqual([]);
  });

  test('first locked episode shows the gate and does not stream media', async ({ page }) => {
    const firstLocked = lastFree + 1;
    const player = new PlayerPage(page);
    await player.open(DRAMA_ID, firstLocked);

    expect(await player.counterValues()).toMatchObject({ current: firstLocked });

    const gate = player.gate();
    await expect(gate.heading).toBeVisible();
    await expect(gate.email).toBeVisible();
    await expect(gate.continue).toBeEnabled();

    // Give the player time to (wrongly) start streaming behind the gate.
    await page.waitForTimeout(3_000); // lint-allow: negative check needs a fixed observation window
    const video = await player.activeVideo();
    expect(video.currentTime, 'nothing should play behind the gate').toBe(0);
    expect(
      player.media.filter((m) => isMediaFor(m.url, DRAMA_ID, firstLocked)),
      'locked episode media should not be requested',
    ).toEqual([]);
  });
});
