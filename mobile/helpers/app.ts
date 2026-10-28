import { ANDROID_PACKAGE } from '../constants';

/** Cold start: kill the process and launch it from the launcher. */
export async function coldStart() {
  await browser.execute('mobile: terminateApp', { appId: ANDROID_PACKAGE });
  await browser.execute('mobile: activateApp', { appId: ANDROID_PACKAGE });
}

/** Home key: the app goes to the background and stays there. */
export async function pressHome() {
  await browser.execute('mobile: pressKey', { keycode: 3 }); // KEYCODE_HOME
}

/** Brings the app back to the foreground from wherever it is. */
export async function bringToFront() {
  await browser.execute('mobile: activateApp', { appId: ANDROID_PACKAGE });
}

export async function isAppInForeground(): Promise<boolean> {
  const state = (await browser.execute('mobile: queryAppState', { appId: ANDROID_PACKAGE })) as number;
  return state === 4; // RUNNING_IN_FOREGROUND
}
