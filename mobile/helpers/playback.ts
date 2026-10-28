import { ANDROID_PACKAGE } from '../constants';

/**
 * Is the video playing?
 *
 * Screenshots can't answer it: the app sets FLAG_SECURE, so every capture of
 * its window is black. The overlay exposes no playback time either.
 *
 * Android itself knows, though. Every audio player an app creates is listed by
 * `dumpsys audio` as an AudioPlaybackConfiguration with the app's uid and a
 * state: started, paused, stopped, idle. Measured on the real app:
 *
 *   playing:  piid:231 ... u/pid:10389/27280 state:started ... sampleRate=48000
 *   paused:   piid:231 ... u/pid:10389/27280 state:paused  ...
 *
 * plus two idle players (preloaded next episodes). So:
 *   playing        = at least one of the app's players is "started";
 *   which episode  = the piid of that player (a new episode gets a new player).
 *
 * Needs Appium's `mobile: shell`, enabled by relaxedSecurity in the WDIO config.
 * Device volume and mute don't matter: a muted track is still "started".
 */
export type AudioPlayer = { piid: number; state: string };

const shell = async (command: string, args: string[]) =>
  String(await browser.execute('mobile: shell', { command, args }));

let uid: number | undefined;
async function appUid(): Promise<number> {
  if (uid === undefined) {
    const out = await shell('cmd', ['package', 'list', 'packages', '-U', ANDROID_PACKAGE]);
    const match = out.match(new RegExp(`package:${ANDROID_PACKAGE.replace(/\./g, '\\.')}\\s+uid:(\\d+)`));
    if (!match) throw new Error(`Cannot find uid of ${ANDROID_PACKAGE}: ${out.trim()}`);
    uid = Number(match[1]);
  }
  return uid;
}

/** The app's current audio players, from the system's point of view. */
export async function appAudioPlayers(): Promise<AudioPlayer[]> {
  const id = await appUid();
  const dump = await shell('dumpsys', ['audio']);
  const re = new RegExp(`AudioPlaybackConfiguration piid:(\\d+) .*?u/pid:${id}/\\d+ state:(\\w+)`, 'g');
  return [...dump.matchAll(re)].map((m) => ({ piid: Number(m[1]), state: m[2]! }));
}

/** piid of the player that is playing now, or undefined. */
export async function playingPlayer(): Promise<number | undefined> {
  return (await appAudioPlayers()).find((p) => p.state === 'started')?.piid;
}

/**
 * Playing = a started player, still started a moment later (one sample could
 * catch the first frame of a track that stops right away).
 */
export async function expectVideoPlaying(timeout = 15_000): Promise<number> {
  let piid: number | undefined;
  await browser.waitUntil(async () => (piid = await playingPlayer()) !== undefined, {
    timeout,
    timeoutMsg: `no audio player of ${ANDROID_PACKAGE} reached "started" within ${timeout / 1000}s`,
  });
  await browser.pause(1_500); // lint-allow: second sample of the same state, not a wait for state
  expect(await playingPlayer()).toBeDefined();
  return piid!;
}

/**
 * Not playing = none of the app's players is started, over several samples.
 *
 * A negative check needs proof that the measurement works. By default that is
 * "the app's players are visible" (a paused player is still listed). When the
 * app may release its players entirely (it does when it leaves the player
 * screen, e.g. in the background), pass requirePlayers: false; the caller must
 * then have seen a started player just before.
 */
export async function expectVideoNotPlaying({ samples = 3, requirePlayers = true } = {}) {
  for (let i = 0; i < samples; i++) {
    const players = await appAudioPlayers();
    if (requirePlayers) expect(players.length).toBeGreaterThan(0);
    expect(players.filter((p) => p.state === 'started')).toEqual([]);
    await browser.pause(1_000); // lint-allow: sampling interval for a negative check
  }
}

/** Waits until a different player than `previous` is playing: a new episode started. */
export async function waitForAnotherPlayer(previous: number, timeout = 15_000): Promise<number> {
  let piid: number | undefined;
  await browser.waitUntil(async () => {
    piid = await playingPlayer();
    return piid !== undefined && piid !== previous;
  }, { timeout, timeoutMsg: `still playing the same track (piid ${previous}) ${timeout / 1000}s after the swipe` });
  return piid!;
}
