import { expect, test } from '@playwright/test';
import { DRAMA_ID, DRAMA_SLUG } from '../../shared/test-data';
import { DramaPage } from '../pages/DramaPage';
import { EpisodePage } from '../pages/EpisodePage';
import { PlayerPage } from '../pages/PlayerPage';

/**
 * The same series is described in three places: the series page, the per-episode
 * landing page (built for search engines) and the player. They should agree.
 *
 * Known issue, see docs/FINDINGS.md #1: on 2026-10-20 "Room Service" showed 86
 * episodes on the series page and in the player, but "1 of 114" on the episode
 * page. Marked test.fail() so the suite stays green while the bug is open, and
 * turns red ("expected to fail, but passed") the day it is fixed, as a reminder
 * to drop the marker.
 */
test('episode count agrees across series page, episode page and player', async ({ page }) => {
  test.fail(DRAMA_SLUG === 'room-service-193', 'FINDINGS #1: episode page shows a different total');

  const drama = new DramaPage(page, DRAMA_SLUG);
  await drama.open();
  const onSeriesPage = await drama.declaredEpisodeCount();

  const episodePage = new EpisodePage(page, DRAMA_SLUG);
  await episodePage.open(1);
  const onEpisodePage = await episodePage.declaredTotal();

  const player = new PlayerPage(page);
  await player.open(DRAMA_ID, 1);
  const inPlayer = (await player.counterValues()).total;

  expect({ onEpisodePage, inPlayer }).toEqual({ onEpisodePage: onSeriesPage, inPlayer: onSeriesPage });
});

/**
 * Episode landing pages are what search and ads send people to. A locked episode
 * whose title promises "Watch Free" and whose body says "Unlock with coins or VIP"
 * sets up a paywall surprise. Known issue, see docs/FINDINGS.md #2.
 */
test('locked episode page does not promise free viewing in its title', async ({ page }) => {
  test.fail(DRAMA_SLUG === 'room-service-193', 'FINDINGS #2: locked episodes titled "Watch Free"');

  const drama = new DramaPage(page, DRAMA_SLUG);
  await drama.open();
  const firstLocked = (await drama.lastFreeEpisode()) + 1;

  const episodePage = new EpisodePage(page, DRAMA_SLUG);
  await episodePage.open(firstLocked);
  await expect(episodePage.lockedNotice()).toBeVisible();
  await expect(page).not.toHaveTitle(/watch free/i);
});
