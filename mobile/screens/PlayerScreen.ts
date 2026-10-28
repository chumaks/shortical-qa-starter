import { S } from './selectors';

/**
 * The For You feed: full-screen vertical videos, one card per series, playing
 * as soon as the tab opens. Inspected on 0.5.68: the card shows the series
 * title, a description, "Watch Now", and side buttons (likes, Episodes,
 * Share); there is no ExoPlayer `player_view` here (that one belongs to the
 * series player behind "Watch Now").
 *
 * Playback state comes from helpers/playback.ts, not from the screen.
 */
export class PlayerScreen {
  get feed() {
    return $(S.feed);
  }

  async waitForFeed(timeout = 15_000) {
    await this.feed.waitForDisplayed({ timeout, timeoutMsg: 'For You feed (scrollable video area) not shown' });
  }

  /** Tap in the middle of the video area (left of the side buttons): toggles pause. */
  async tapVideo() {
    const { x, y, width, height } = await browser.getElementRect(await this.feed.elementId);
    await browser.execute('mobile: clickGesture', { x: Math.round(x + width * 0.4), y: Math.round(y + height * 0.45) });
  }

  /** Swipe up on the feed: the next card (next series). */
  async swipeToNext() {
    await browser.execute('mobile: swipeGesture', {
      elementId: await this.feed.elementId,
      direction: 'up',
      percent: 0.75,
    });
  }
}

export const player = new PlayerScreen();
