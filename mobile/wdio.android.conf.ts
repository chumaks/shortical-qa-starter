import { mkdirSync, writeFileSync } from 'node:fs';
import { ANDROID_PACKAGE } from './constants';

/**
 * Android run against the Shortical build installed from Google Play.
 *
 * Without the team's debug/QA build there is no APK to install, so the session
 * attaches to the app already on the device (`noReset`). With an internal build,
 * set ANDROID_APP=/path/to/app.apk and the same suite installs and runs it.
 *
 *   ANDROID_UDID=<adb device id> npm run test:android
 */

const capability: WebdriverIO.Capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:udid': process.env.ANDROID_UDID,
  'appium:appPackage': ANDROID_PACKAGE,
  // Omitted by default: UiAutomator2 resolves the launcher activity itself.
  ...(process.env.ANDROID_APP_ACTIVITY ? { 'appium:appActivity': process.env.ANDROID_APP_ACTIVITY } : {}),
  ...(process.env.ANDROID_APP ? { 'appium:app': process.env.ANDROID_APP } : { 'appium:noReset': true }),
  'appium:autoGrantPermissions': true,
  'appium:newCommandTimeout': 240,
  // Video keeps the main thread busy; don't wait for an idle UI that never comes.
  'appium:waitForIdleTimeout': 0,
};

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./specs/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [capability],
  logLevel: 'warn',
  waitforTimeout: 15_000,
  connectionRetryCount: 1,
  services: [['appium', { args: { relaxedSecurity: true }, logPath: './artifacts' }]],
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 120_000 },
  reporters: ['spec'],

  onPrepare: () => {
    mkdirSync('./artifacts', { recursive: true });
  },

  // Evidence on failure. The screenshot is black for this app (FLAG_SECURE), so
  // the view hierarchy at the moment of failure is the useful part: it shows
  // which screen the app was on and what could be located there.
  afterTest: async (test, _context, { passed }) => {
    if (!passed) {
      const name = test.title.replace(/[^\w-]+/g, '_');
      writeFileSync(`./artifacts/android-fail-${name}.xml`, await browser.getPageSource());
      await browser.saveScreenshot(`./artifacts/android-fail-${name}.png`);
    }
  },
};
