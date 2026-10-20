import { playerUrl } from '../../shared/test-data';
import { ANDROID_PACKAGE } from '../constants';

/** Cold start: kill the process and launch from the launcher. */
export async function coldStart() {
  await browser.execute('mobile: terminateApp', { appId: ANDROID_PACKAGE });
  await browser.execute('mobile: activateApp', { appId: ANDROID_PACKAGE });
}

/**
 * Opens an episode through the same link the web "Watch free" button uses.
 * Works if the app handles shortical.com links (App Links / OneLink). If the
 * link opens the browser instead, `npm run inspect:android` shows it; the fix is
 * a QA build that registers the link, or an internal deep link scheme.
 */
export async function openEpisodeByLink(dramaId: number, episode: number) {
  await browser.execute('mobile: deepLink', { url: playerUrl(dramaId, episode), package: ANDROID_PACKAGE });
}

export async function sendToBackgroundFor(seconds: number) {
  await browser.execute('mobile: backgroundApp', { seconds });
}

export async function isAppInForeground(): Promise<boolean> {
  const state = (await browser.execute('mobile: queryAppState', { appId: ANDROID_PACKAGE })) as number;
  return state === 4; // RUNNING_IN_FOREGROUND
}

/** Vertical swipe on the middle of the screen, the feed's "next episode" gesture. */
export async function swipeUp() {
  const { width, height } = await browser.getWindowSize();
  await browser.execute('mobile: swipeGesture', {
    left: Math.round(width * 0.2),
    top: Math.round(height * 0.3),
    width: Math.round(width * 0.6),
    height: Math.round(height * 0.5),
    direction: 'up',
    percent: 0.8,
  });
}
