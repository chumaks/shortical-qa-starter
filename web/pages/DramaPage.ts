import { expect, type Page } from '@playwright/test';

/** Series page: /drama/<slug>. Description, free range and the episode grid. */
export class DramaPage {
  constructor(private readonly page: Page, private readonly slug: string) {}

  async open() {
    await this.page.goto(`/drama/${this.slug}`);
    await expect(this.episodesHeading()).toBeVisible();
  }

  /** "All 86 episodes" */
  episodesHeading() {
    return this.page.getByRole('heading', { name: /^All \d+ episodes$/ });
  }

  async declaredEpisodeCount(): Promise<number> {
    return Number((await this.episodesHeading().innerText()).match(/\d+/)![0]);
  }

  /** Links in the episode grid: /drama/<slug>/episode-N */
  episodeLinks() {
    return this.page.locator(`a[href^="/drama/${this.slug}/episode-"]`);
  }

  /** "Episodes 1–13 are free." -> 13 */
  async lastFreeEpisode(): Promise<number> {
    const text = await this.page.getByText(/Episodes 1[–-]\d+ are free/).first().innerText();
    return Number(text.match(/1[–-](\d+)/)![1]);
  }

  /** The "Watch episode 1 free" call to action opens the player. */
  watchFreeLink() {
    return this.page.getByRole('link', { name: /watch episode 1 free/i });
  }
}
