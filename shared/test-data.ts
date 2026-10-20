/**
 * Test data shared by the web and Android suites.
 *
 * The suites run against production, so they only read: no sign-in, no email
 * submitted, no purchase. A drama is identified by the numeric id at the end of
 * its slug ("room-service-193" -> 193); the player and the app deep link use it.
 */
export const BASE_URL = process.env.SHORTICAL_BASE_URL ?? 'https://shortical.com';

export const DRAMA_SLUG = process.env.SHORTICAL_DRAMA ?? 'room-service-193';

export const dramaIdFromSlug = (slug: string): number => {
  const id = Number(slug.split('-').pop());
  if (!Number.isInteger(id)) throw new Error(`Cannot read drama id from slug "${slug}"`);
  return id;
};

export const DRAMA_ID = dramaIdFromSlug(DRAMA_SLUG);

/** Same URL the web "Watch free" button opens; also used as the Android deep link. */
export const playerUrl = (dramaId: number, episode: number): string =>
  `${BASE_URL}/player?deep_link_sub1=${dramaId}&deep_link_sub2=${episode}`;

/** HLS media served from the video CDN: manifests and MPEG-TS segments. */
export const HLS_MANIFEST = /\.m3u8(\?|$)/;
export const HLS_SEGMENT = /\.ts(\?|$)/;

/** Manifest and segment URLs carry "/<dramaId>/<episode>/" in the path. */
export const isMediaFor = (url: string, dramaId: number, episode: number): boolean =>
  url.includes(`/${dramaId}/${episode}/`);
