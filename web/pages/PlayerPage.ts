import { expect, type Page, type Response } from '@playwright/test';
import { HLS_MANIFEST, HLS_SEGMENT, playerUrl } from '../../shared/test-data';

export type VideoState = { currentTime: number; paused: boolean; readyState: number };

/**
 * Web player: /player?deep_link_sub1=<dramaId>&deep_link_sub2=<episode>.
 *
 * The page has no data-testid attributes, so locators use roles and visible
 * text (see docs/FINDINGS.md, testability). Media is HLS played through MSE,
 * so the <video> src is a blob: URL and the real traffic is on the CDN; the
 * page object records it from the moment it is created.
 */
export class PlayerPage {
  readonly media: { url: string; status: number }[] = [];

  constructor(private readonly page: Page) {
    page.on('response', (r: Response) => {
      const url = r.url();
      if (HLS_MANIFEST.test(url) || HLS_SEGMENT.test(url)) this.media.push({ url, status: r.status() });
    });
  }

  async open(dramaId: number, episode: number) {
    await this.page.goto(playerUrl(dramaId, episode));
    await expect(this.counter()).toBeVisible();
  }

  /** "14/86": current episode / total, top of the player. */
  counter() {
    return this.page.getByText(/^\d+\/\d+$/).first();
  }

  async counterValues(): Promise<{ current: number; total: number }> {
    const [current, total] = (await this.counter().innerText()).split('/').map(Number);
    return { current: current!, total: total! };
  }

  /**
   * The player keeps more than one <video> (the next episode is preloaded),
   * so "the" video is the one that has advanced furthest.
   */
  async activeVideo(): Promise<VideoState> {
    return this.page.evaluate(() => {
      const videos = [...document.querySelectorAll('video')].map((v) => ({
        currentTime: v.currentTime,
        paused: v.paused,
        readyState: v.readyState,
      }));
      return videos.sort((a, b) => b.currentTime - a.currentTime)[0] ?? { currentTime: 0, paused: true, readyState: 0 };
    });
  }

  /** Resolves once playback position reaches `seconds`. */
  async waitForPlaybackPast(seconds: number, timeout = 30_000) {
    await expect
      .poll(async () => (await this.activeVideo()).currentTime, {
        timeout,
        message: `video should play past ${seconds}s`,
      })
      .toBeGreaterThan(seconds);
  }

  /** Email gate shown on episodes past the free range for a signed-out viewer. */
  gate() {
    return {
      heading: this.page.getByRole('heading', { name: 'Save your progress' }),
      email: this.page.locator('input[type="email"]:visible').first(),
      continue: this.page.getByRole('button', { name: 'Continue', exact: true }),
    };
  }
}
