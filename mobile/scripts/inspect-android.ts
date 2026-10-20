/**
 * First thing to run on a new device: attaches to the installed app, saves the
 * view hierarchy and a screenshot for the current screen, and prints a short
 * testability report (how many elements a test could target by a stable id).
 *
 *   1) npx appium                       (separate terminal)
 *   2) ANDROID_UDID=<id> npm run inspect:android [label]
 *
 * Run it on each screen you care about (player, episode list, gate) by moving
 * the app there by hand and re-running with a label. Output goes to artifacts/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { remote } from 'webdriverio';
import { ANDROID_PACKAGE } from '../constants';

const label = process.argv[2] ?? 'screen';
const outDir = 'artifacts/inspect';
mkdirSync(outDir, { recursive: true });

const driver = await remote({
  hostname: process.env.APPIUM_HOST ?? '127.0.0.1',
  port: Number(process.env.APPIUM_PORT ?? 4723),
  logLevel: 'error',
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': process.env.ANDROID_UDID,
    'appium:appPackage': ANDROID_PACKAGE,
    'appium:noReset': true,
    'appium:dontStopAppOnReset': true,
    'appium:autoLaunch': false,
    'appium:waitForIdleTimeout': 0,
  },
});

try {
  const xml = await driver.getPageSource();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(`${outDir}/${label}-${stamp}.xml`, xml);
  await driver.saveScreenshot(`${outDir}/${label}-${stamp}.png`);

  const nodes = [...xml.matchAll(/<[\w.]+ [^>]*>/g)].map((m) => m[0]);
  const attr = (n: string, a: string) => n.match(new RegExp(`${a}="([^"]*)"`))?.[1] ?? '';
  const inApp = nodes.filter((n) => attr(n, 'package') === ANDROID_PACKAGE);
  const withId = inApp.filter((n) => attr(n, 'resource-id'));
  const withDesc = inApp.filter((n) => attr(n, 'content-desc'));
  const clickable = inApp.filter((n) => attr(n, 'clickable') === 'true');
  const clickableNoHandle = clickable.filter((n) => !attr(n, 'resource-id') && !attr(n, 'content-desc'));
  const foreground = await driver.getCurrentPackage();

  console.log(`\nScreen "${label}" (foreground package: ${foreground})`);
  if (foreground !== ANDROID_PACKAGE) console.log(`  ! foreground is not ${ANDROID_PACKAGE}: a link may have opened the browser`);
  console.log(`  elements in app:              ${inApp.length}`);
  console.log(`  with resource-id / testTag:   ${withId.length}`);
  console.log(`  with content-desc:            ${withDesc.length}`);
  console.log(`  clickable without any handle: ${clickableNoHandle.length} of ${clickable.length}`);
  console.log('\n  ids:   ', [...new Set(withId.map((n) => attr(n, 'resource-id')))].slice(0, 25).join(', ') || '(none)');
  console.log('  descs: ', [...new Set(withDesc.map((n) => attr(n, 'content-desc')))].slice(0, 25).join(' | ') || '(none)');
  console.log(`\n  saved: ${outDir}/${label}-${stamp}.{xml,png}\n`);
} finally {
  await driver.deleteSession();
}
