/**
 * Offline check of the Android setup: the WDIO config loads, its spec glob
 * matches files, and the capability names the app. No device needed. Spec
 * files themselves are covered by tsc and ESLint (Mocha globals only exist
 * inside the WDIO runner, so they can't be imported here).
 */
import { readdirSync } from 'node:fs';
import { config } from '../mobile/wdio.android.conf';

const specs = readdirSync('mobile/specs').filter((f) => f.endsWith('.spec.ts'));
const cap = (config.capabilities as WebdriverIO.Capabilities[])[0];
const problems: string[] = [];

if (specs.length === 0) problems.push('no spec files in mobile/specs');
if (!cap?.['appium:appPackage']) problems.push('capability has no appium:appPackage');
if (cap?.['appium:automationName'] !== 'UiAutomator2') problems.push('automationName is not UiAutomator2');

if (problems.length) {
  for (const p of problems) console.error(`wdio config: ${p}`);
  process.exit(1);
}
console.log(`wdio config: ok, ${specs.length} spec files, app ${cap!['appium:appPackage']}`);
