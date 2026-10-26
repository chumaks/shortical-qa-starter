import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * Is the video actually playing?
 *
 * A native player exposes no currentTime to UiAutomator2, and "player view is
 * displayed" is true for a frozen frame too. So the check is visual: two
 * screenshots of the centre of the screen, `intervalMs` apart, and the share of
 * pixels that changed. Moving video changes a lot of pixels; a frozen frame,
 * a spinner or a gate changes almost none.
 *
 * The centre crop skips the status bar, the overlay buttons on the right and
 * the subtitle/caption area at the bottom.
 *
 * Limits, stated up front: if the app sets FLAG_SECURE every screenshot is
 * black and this returns 0 (the suite then reports it clearly instead of
 * passing). A dark, static shot can read as "not moving"; that is why the
 * threshold is low and the observation window repeats.
 */
const CROP = { left: 0.15, right: 0.85, top: 0.25, bottom: 0.7 };

async function centreFrame(): Promise<PNG> {
  const full = PNG.sync.read(Buffer.from(await browser.takeScreenshot(), 'base64'));
  const x = Math.round(full.width * CROP.left);
  const y = Math.round(full.height * CROP.top);
  const w = Math.round(full.width * (CROP.right - CROP.left));
  const h = Math.round(full.height * (CROP.bottom - CROP.top));
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(full, out, x, y, w, h, 0, 0);
  return out;
}

export async function changedPixelRatio(intervalMs = 1_500): Promise<number> {
  const a = await centreFrame();
  await browser.pause(intervalMs); // lint-allow: sampling interval between two frames, not a wait for state
  const b = await centreFrame();
  const diff = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
  return diff / (a.width * a.height);
}

export async function isBlackFrame(): Promise<boolean> {
  const f = await centreFrame();
  let sum = 0;
  for (let i = 0; i < f.data.length; i += 4) sum += f.data[i]! + f.data[i + 1]! + f.data[i + 2]!;
  return sum / (f.width * f.height * 3) < 4;
}

const PLAYING = 0.02;

/**
 * Both checks refuse to run on black frames. For "playing" a black frame would
 * fail anyway; for "not playing" it would PASS without checking anything,
 * because two black screenshots never differ. Zero change measured on a picture
 * we can't see is not evidence.
 */
async function assertFrameVisible() {
  if (await isBlackFrame()) {
    throw new Error('Screenshots are black: the app probably sets FLAG_SECURE. Visual playback check needs a QA build without it.');
  }
}

/** Playing = the picture keeps changing over several consecutive windows. */
export async function expectVideoPlaying(windows = 3) {
  await assertFrameVisible();
  const ratios: number[] = [];
  for (let i = 0; i < windows; i++) ratios.push(await changedPixelRatio());
  const moving = ratios.filter((r) => r > PLAYING).length;
  expect(moving).toBeGreaterThanOrEqual(windows - 1);
}

export async function expectVideoNotPlaying(windows = 2) {
  await assertFrameVisible();
  for (let i = 0; i < windows; i++) {
    expect(await changedPixelRatio()).toBeLessThanOrEqual(PLAYING);
  }
}
