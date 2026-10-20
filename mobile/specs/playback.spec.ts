import { DRAMA_ID } from '../../shared/test-data';
import { coldStart, isAppInForeground, openEpisodeByLink, sendToBackgroundFor, swipeUp } from '../helpers/app';
import { expectVideoPlaying } from '../helpers/playback';
import { player } from '../screens/PlayerScreen';

describe('Android: playback', () => {
  it('cold start lands in the player and video starts within 10 s', async () => {
    const started = Date.now();
    await coldStart();
    await player.waitForPlayer(10_000);
    await player.dismissOverlay(); // first-run promos are out of scope here
    await expectVideoPlaying();
    console.log(`[metric] cold start to playing video: ${Date.now() - started} ms`);
  });

  it('free episode opened by link plays', async () => {
    await openEpisodeByLink(DRAMA_ID, 1);
    await player.waitForPlayer();
    expect((await player.readCounter()).current).toBe(1);
    await expectVideoPlaying();
  });

  it('swipe up moves to the next episode and it plays', async () => {
    await openEpisodeByLink(DRAMA_ID, 1);
    await player.waitForPlayer();
    const before = await player.readCounter();

    await swipeUp();

    await browser.waitUntil(async () => (await player.readCounter()).current !== before.current, {
      timeout: 10_000,
      timeoutMsg: 'episode counter did not change after swipe',
    });
    expect((await player.readCounter()).current).toBe(before.current + 1);
    await expectVideoPlaying();
  });

  it('playback resumes after the app is backgrounded', async () => {
    await openEpisodeByLink(DRAMA_ID, 2);
    await player.waitForPlayer();
    await expectVideoPlaying();

    await sendToBackgroundFor(5);

    expect(await isAppInForeground()).toBe(true);
    expect((await player.readCounter()).current).toBe(2);
    await expectVideoPlaying();
  });
});
