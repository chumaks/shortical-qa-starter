import { DRAMA_ID } from '../../shared/test-data';
import { openEpisodeByLink } from '../helpers/app';
import { expectVideoNotPlaying, expectVideoPlaying } from '../helpers/playback';
import { player } from '../screens/PlayerScreen';

/**
 * Free/locked boundary for a signed-out user. The free range comes from the
 * web series page (episodes 1-13 for the default drama on 2026-10-20); override
 * with SHORTICAL_LAST_FREE if it changes.
 *
 * Read-only: the gate is checked for being shown. Nothing is typed into it and
 * no coins or subscription are bought, so the run is safe on a personal device.
 */
const LAST_FREE = Number(process.env.SHORTICAL_LAST_FREE ?? 13);

describe('Android: paywall boundary (signed out)', () => {
  it('last free episode plays without a gate', async () => {
    await openEpisodeByLink(DRAMA_ID, LAST_FREE);
    await player.waitForPlayer();
    expect(await player.isGateShown()).toBe(false);
    await expectVideoPlaying();
  });

  it('first locked episode shows a gate and nothing plays behind it', async () => {
    await openEpisodeByLink(DRAMA_ID, LAST_FREE + 1);
    await player.gate.waitForDisplayed({ timeout: 15_000, timeoutMsg: 'no gate on a locked episode' });
    await expectVideoNotPlaying();
  });
});
