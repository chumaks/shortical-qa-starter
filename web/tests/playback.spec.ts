import { expect, test } from '@playwright/test';
import { DRAMA_ID, HLS_MANIFEST, HLS_SEGMENT, isMediaFor } from '../../shared/test-data';
import { PlayerPage } from '../pages/PlayerPage';

/**
 * Playback is checked by behaviour, not by the presence of a <video> element:
 * the position has to advance, and the HLS traffic has to succeed on the CDN.
 */
test.describe('Playback (free episode)', () => {
  test('episode 1 starts playing and keeps playing', async ({ page }) => {
    const player = new PlayerPage(page);
    await player.open(DRAMA_ID, 1);

    expect(await player.counterValues()).toMatchObject({ current: 1 });
    await player.waitForPlaybackPast(3);

    const { paused, readyState } = await player.activeVideo();
    expect(paused).toBe(false);
    expect(readyState, 'HAVE_ENOUGH_DATA or close to it').toBeGreaterThanOrEqual(3);
  });

  test('HLS: manifest and segments for episode 1 load from the CDN without errors', async ({ page }) => {
    const player = new PlayerPage(page);
    await player.open(DRAMA_ID, 1);
    await player.waitForPlaybackPast(3);

    const ep1 = player.media.filter((m) => isMediaFor(m.url, DRAMA_ID, 1));
    const manifests = ep1.filter((m) => HLS_MANIFEST.test(m.url));
    const segments = ep1.filter((m) => HLS_SEGMENT.test(m.url));

    expect(manifests.length, 'at least one rendition manifest').toBeGreaterThanOrEqual(1);
    expect(segments.length, 'several segments, not just the first').toBeGreaterThanOrEqual(2);
    expect(ep1.filter((m) => m.status >= 400), 'no failed media requests').toEqual([]);
  });

  test('next episode is preloaded while the current one plays', async ({ page }) => {
    // Instant start of the next episode is the core of the micro-drama
    // experience; the web player fetches episode 2's manifest during episode 1.
    const player = new PlayerPage(page);
    await player.open(DRAMA_ID, 1);
    await player.waitForPlaybackPast(3);

    await expect
      .poll(() => player.media.some((m) => isMediaFor(m.url, DRAMA_ID, 2) && HLS_MANIFEST.test(m.url)), {
        message: 'episode 2 manifest should be requested while episode 1 plays',
      })
      .toBe(true);
  });
});
