import { S } from './selectors';

export type Counter = { current: number; total: number };

/** The full-screen vertical player: the screen the app opens on and lives in. */
export class PlayerScreen {
  get counter() {
    return $(S.episodeCounter);
  }

  get gate() {
    return $(S.gate);
  }

  async waitForPlayer(timeout = 20_000) {
    await this.counter.waitForDisplayed({ timeout, timeoutMsg: 'player episode counter (N/M) not shown' });
  }

  async readCounter(): Promise<Counter> {
    const [current, total] = (await this.counter.getText()).split('/').map(Number);
    return { current: current!, total: total! };
  }

  async isGateShown(): Promise<boolean> {
    return this.gate.isDisplayed().catch(() => false);
  }

  /** Closes a promo or gate overlay, if one is up, with the system back gesture. */
  async dismissOverlay() {
    if (await this.isGateShown()) {
      await browser.back();
      await this.gate.waitForDisplayed({ reverse: true, timeout: 5_000 }).catch(() => undefined);
    }
  }
}

export const player = new PlayerScreen();
