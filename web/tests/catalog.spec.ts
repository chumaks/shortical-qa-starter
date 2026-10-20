import { expect, test } from '@playwright/test';
import { DRAMA_SLUG } from '../../shared/test-data';
import { DramaPage } from '../pages/DramaPage';

test.describe('Catalog', () => {
  test('home page lists dramas that link to series pages', async ({ page }) => {
    await page.goto('/');
    const dramas = page.locator('a[href^="/drama/"]');
    await expect(dramas.first()).toBeVisible();
    expect(await dramas.count(), 'home should show a real catalogue, not an empty shell').toBeGreaterThanOrEqual(10);
  });

  test('series page: episode grid matches the declared episode count', async ({ page }) => {
    const drama = new DramaPage(page, DRAMA_SLUG);
    await drama.open();

    const declared = await drama.declaredEpisodeCount();
    await expect(drama.episodeLinks()).toHaveCount(declared);
  });

  test('series page: free range is stated and the CTA opens the player on episode 1', async ({ page }) => {
    const drama = new DramaPage(page, DRAMA_SLUG);
    await drama.open();

    const lastFree = await drama.lastFreeEpisode();
    expect(lastFree).toBeGreaterThanOrEqual(1);
    expect(lastFree).toBeLessThan(await drama.declaredEpisodeCount());

    await expect(drama.watchFreeLink()).toHaveAttribute('href', /\/player\?.*deep_link_sub2=1(&|$)/);
  });
});
