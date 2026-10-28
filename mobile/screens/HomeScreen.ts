import { S } from './selectors';

/** Home with the bottom navigation: where a cold start lands. */
export class HomeScreen {
  get tabHome() {
    return $(S.tabHome);
  }

  get tabForYou() {
    return $(S.tabForYou);
  }

  async waitForHome(timeout = 15_000) {
    await this.tabHome.waitForDisplayed({ timeout, timeoutMsg: 'bottom navigation (Home tab) not shown' });
  }

  /** "For You": the vertical feed that starts playing right away. */
  async openForYou() {
    await this.tabForYou.click();
  }
}

export const home = new HomeScreen();
