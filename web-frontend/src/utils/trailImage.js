/**
 * trailImage.js — Canonical image URL resolver for trail/rifugio objects.
 *
 * Handles two schemas:
 *   NEW: trail.images = [{ thumb, card, hero, alt, uploaded_at }, ...]
 *   OLD: trail.wallpaper | trail.image_url | trail.thumbnail | trail.gallery[]
 *
 * Usage:
 *   import { trailImg } from '../utils/trailImage';
 *   <img src={trailImg(trail, 'card')} alt={trailImgAlt(trail)} />
 */

// Local, always-available fallback (bundled in /public). Used both as the
// last resort when a trail/rifugio has no image, and by onImgError() below
// when a remote image URL fails to load (e.g. a dead Unsplash link).
export const IMG_FALLBACK = '/hero-alpine-summer.webp';
const FALLBACK = IMG_FALLBACK;

/**
 * onError handler for <img> tags showing trail/rifugio photos.
 * Swaps a broken remote image for the local fallback, guarding against loops.
 *
 * Usage:  <img src={trailImg(trail, 'card')} onError={onImgError} />
 */
export function onImgError(e) {
  const el = e?.currentTarget || e?.target;
  if (!el || el.dataset.fallbackApplied) return;
  el.dataset.fallbackApplied = '1';
  el.src = IMG_FALLBACK;
}

/**
 * @param {object} trail  - trail or rifugio object from the API
 * @param {'thumb'|'card'|'hero'} variant - desired size
 * @returns {string} - absolute URL suitable for <img src>
 */
export function trailImg(trail, variant = 'card') {
  if (!trail) return FALLBACK;

  // New schema: trail.images is an array of image objects
  const imgs = trail.images;
  if (Array.isArray(imgs) && imgs.length > 0) {
    for (const img of imgs) {
      if (img && img[variant]) return img[variant];
      // Fallback within the new schema (any size beats nothing)
      for (const v of ['card', 'hero', 'thumb']) {
        if (img && img[v]) return img[v];
      }
    }
  }

  // Legacy fields
  return (
    trail.wallpaper ||
    trail.image_url ||
    trail.thumbnail ||
    (Array.isArray(trail.gallery) ? trail.gallery[0] : undefined) ||
    trail.hero_image ||
    FALLBACK
  );
}

/**
 * @param {object} trail
 * @returns {string} - accessible alt text
 */
export function trailImgAlt(trail) {
  if (!trail) return '';
  const imgs = trail.images;
  if (Array.isArray(imgs) && imgs.length > 0 && imgs[0]?.alt) {
    return imgs[0].alt;
  }
  return `${trail.name || ''}${trail.region ? ' — ' + trail.region : ''}`.trim();
}

/**
 * Return all gallery images for a trail (used in detail view lightbox/carousel).
 * Merges new images[] array with legacy gallery[] strings.
 *
 * @param {object} trail
 * @returns {Array<{thumb, card, hero, alt}>}
 */
export function trailGallery(trail) {
  if (!trail) return [];

  const result = [];

  // New schema
  if (Array.isArray(trail.images)) {
    for (const img of trail.images) {
      if (img && (img.card || img.hero || img.thumb)) {
        result.push(img);
      }
    }
  }

  // Legacy gallery strings — wrap in compatible shape
  if (Array.isArray(trail.gallery)) {
    for (const url of trail.gallery) {
      if (url && typeof url === 'string') {
        result.push({ thumb: url, card: url, hero: url, alt: trail.name || '' });
      }
    }
  }

  // Primary image as first if gallery is empty
  if (result.length === 0) {
    const primary = trailImg(trail, 'hero');
    if (primary && primary !== '') {
      result.push({ thumb: primary, card: primary, hero: primary, alt: trailImgAlt(trail) });
    }
  }

  return result;
}
