import { bringToFront, coldStart, isAppInForeground, pressHome } from '../helpers/app';
import { expectVideoNotPlaying, expectVideoPlaying, waitForAnotherPlayer } from '../helpers/playback';
import { home } from '../screens/HomeScreen';
import { player } from '../screens/PlayerScreen';

/**
 * Playback on the Play Store build, on the For You feed (it plays right away,
 * no specific series needed). "Playing" is read from the app's audio player
 * state in Android (helpers/playback.ts): screenshots are black (FLAG_SECURE).
 *
 * Every test starts from a cold start, so no test depends on where the previous one left the app. */
async function openFeed() {
  await coldStart();
  await home.waitForHome();
  await home.openForYou();
  await player.waitForFeed();
}

describe('Android: playback', () => {
  it('cold start lands on Home with the bottom navigation', async () => {
    const started = Date.now();
    await coldStart();
    await home.waitForHome();
    console.log(`[metric] cold start to Home: ${Date.now() - started} ms`);
  });

  it('For You opens the feed and video starts within 10 s', async () => {
    await coldStart();
    await home.waitForHome();
    const tapped = Date.now();
    await home.openForYou();
    await player.waitForFeed();
    await expectVideoPlaying(10_000);
    console.log(`[metric] For You tap to playing: ${Date.now() - tapped} ms`);
  });

  it('tap on the video pauses it, a second tap resumes', async () => {
    await openFeed();
    await expectVideoPlaying();

    await player.tapVideo();
    await expectVideoNotPlaying();

    await player.tapVideo();
    await expectVideoPlaying();
  });

  it('swipe up starts a different video (next series card)', async () => {
    await openFeed();
    const before = await expectVideoPlaying();

    await player.swipeToNext();

    const after = await waitForAnotherPlayer(before);
    expect(after).not.toBe(before);
    await expectVideoPlaying();
  });

  it('going to the background stops playback, coming back resumes it', async () => {
    await openFeed();
    await expectVideoPlaying();

    await pressHome();
    expect(await isAppInForeground()).toBe(false);
    // The app may release its players in the background; the "playing" check
    // above is the proof that this measurement sees them when they exist.
    await expectVideoNotPlaying({ requirePlayers: false });

    await bringToFront();
    await player.waitForFeed();
    await expectVideoPlaying();
  });
});
