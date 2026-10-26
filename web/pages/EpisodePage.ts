import type { Page } from '@playwright/test';

/**
 * Per-episode landing page: /drama/<slug>/episode-N. Server-rendered for
 * search and ads; shows "N of <total>" and the access status.
 */
export class EpisodePage {
  constructor(private readonly page: Page, private readonly slug: string) {}

  async open(episode: number) {
    await this.page.goto(`/drama/${this.slug}/episode-${episode}`);
  }

  /** "1 of 114" -> 114 */
  async declaredTotal(): Promise<number> {
    const text = await this.page.getByText(/^\d+ of \d+$/).first().innerText();
    return Number(text.match(/of (\d+)/)![1]);
  }

  /** "Unlock with coins or VIP" on locked episodes, "Free to watch" on free ones. */
  lockedNotice() {
    return this.page.getByText('Unlock with coins or VIP').first();
  }
}
