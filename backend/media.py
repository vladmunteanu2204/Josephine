"""
media.py — Image upload, resizing, and Cloudflare R2 delivery.

Environment variables required for R2:
    R2_ACCOUNT_ID        — Cloudflare account ID
    R2_ACCESS_KEY_ID     — R2 API token (Access Key ID)
    R2_SECRET_ACCESS_KEY — R2 API token (Secret Access Key)
    R2_BUCKET            — R2 bucket name (e.g. "trail-media")
    R2_PUBLIC_URL        — Public CDN base URL (e.g. "https://media.yourdomain.com")
                           Enable "Public access" on the bucket in Cloudflare, or
                           put Cloudflare in front with a custom domain.

If any R2 env var is missing, upload falls back to Replit Object Storage (legacy).

Image variant sizes produced on every upload:
    thumb  — 300 px wide  (trail cards, Josephine picks, catalog list)
    card   — 800 px wide  (detail hero on mobile / medium screens)
    hero   — 1600 px wide (full-bleed desktop hero)

All variants are WebP at quality 82, progressive where applicable.
Original is discarded after variants are created (save storage + bandwidth).

Stored as:
    {bucket}/trails/{trail_id}/thumb_{uuid}.webp
    {bucket}/trails/{trail_id}/card_{uuid}.webp
    {bucket}/trails/{trail_id}/hero_{uuid}.webp

Returned structure (stored in trail.images[]):
    {
        "thumb": "https://media.yourdomain.com/trails/abc/thumb_xyz.webp",
        "card":  "https://media.yourdomain.com/trails/abc/card_xyz.webp",
        "hero":  "https://media.yourdomain.com/trails/abc/hero_xyz.webp",
        "alt":   "Trail name — Region",
        "uploaded_at": "2025-06-01T12:00:00Z"
    }
"""

import io
import os
import uuid
import time
from datetime import datetime, timezone
from PIL import Image

# ── R2 client (boto3 with Cloudflare endpoint) ────────────────────────────

R2_ACCOUNT_ID        = os.environ.get('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID     = os.environ.get('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET            = os.environ.get('R2_BUCKET', '')
R2_PUBLIC_URL        = os.environ.get('R2_PUBLIC_URL', '').rstrip('/')

R2_AVAILABLE = bool(R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_BUCKET)

_r2_client = None

def _get_r2():
    global _r2_client
    if _r2_client is not None:
        return _r2_client
    if not R2_AVAILABLE:
        return None
    try:
        import boto3
        _r2_client = boto3.client(
            's3',
            endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name='auto',
        )
        return _r2_client
    except Exception as e:
        print(f"[media] R2 client init failed: {e}")
        return None


# ── Image variant config ──────────────────────────────────────────────────

VARIANTS = {
    'thumb': 300,
    'card':  800,
    'hero':  1600,
}

WEBP_QUALITY = 82  # sweet spot: visually lossless for photos, ~60% of JPEG


def _resize_to_webp(img: Image.Image, max_width: int) -> bytes:
    """Resize image to max_width (preserving aspect ratio) and encode as WebP."""
    if img.width > max_width:
        ratio = max_width / img.width
        new_size = (max_width, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    # Ensure RGB (WebP doesn't need alpha for photos)
    if img.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    buf = io.BytesIO()
    img.save(buf, format='WEBP', quality=WEBP_QUALITY, method=4)
    return buf.getvalue()


def _upload_to_r2(key: str, data: bytes) -> str:
    """Upload bytes to R2 and return the public CDN URL."""
    client = _get_r2()
    if client is None:
        raise RuntimeError("R2 not configured")
    client.put_object(
        Bucket=R2_BUCKET,
        Key=key,
        Body=data,
        ContentType='image/webp',
        CacheControl='public, max-age=31536000, immutable',
    )
    if R2_PUBLIC_URL:
        return f"{R2_PUBLIC_URL}/{key}"
    # Fallback: use R2 dev URL (not for production — no CDN, rate-limited)
    return f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{R2_BUCKET}/{key}"


def _delete_from_r2(key: str):
    """Delete a key from R2. Swallow errors (idempotent cleanup)."""
    try:
        client = _get_r2()
        if client:
            client.delete_object(Bucket=R2_BUCKET, Key=key)
    except Exception as e:
        print(f"[media] R2 delete failed for {key}: {e}")


# ── Public API ────────────────────────────────────────────────────────────

def upload_trail_image(
    file_bytes: bytes,
    trail_id: str,
    alt_text: str = '',
    legacy_storage_client=None,
) -> dict:
    """
    Process an uploaded image: generate 3 WebP variants, upload to R2.

    Args:
        file_bytes: Raw bytes of the uploaded image file.
        trail_id:   Trail identifier (used as folder name in the bucket).
        alt_text:   Accessible alt text stored alongside URLs.
        legacy_storage_client: Replit Object Storage client as fallback.

    Returns:
        dict with keys: thumb, card, hero, alt, uploaded_at
        All URL values point to the CDN.

    Raises:
        RuntimeError: if neither R2 nor legacy storage is available.
        ValueError: if file_bytes is not a valid image.
    """
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.load()  # Force decode — catches corrupt files early
    except Exception as e:
        raise ValueError(f"Invalid image file: {e}")

    uid = str(uuid.uuid4())
    folder = f"trails/{trail_id}"
    result = {}

    if R2_AVAILABLE:
        for variant, max_width in VARIANTS.items():
            data = _resize_to_webp(img, max_width)
            key  = f"{folder}/{variant}_{uid}.webp"
            url  = _upload_to_r2(key, data)
            result[variant] = url
            print(f"[media] R2 upload: {key} ({len(data)//1024}KB)")
    elif legacy_storage_client is not None:
        # Fallback: upload single WebP to Replit Object Storage
        data = _resize_to_webp(img, VARIANTS['card'])
        key  = f"photos/{trail_id}_{uid}.webp"
        legacy_storage_client.upload_from_bytes(key, data)
        try:
            url = legacy_storage_client.get_url(key)
        except Exception:
            url = f"/api/media/{key}"
        result['thumb'] = url
        result['card']  = url
        result['hero']  = url
        print(f"[media] Replit Object Storage upload: {key} ({len(data)//1024}KB)")
    else:
        raise RuntimeError("No image storage configured. Set R2_* env vars or install replit package.")

    result['alt']         = alt_text
    result['uploaded_at'] = datetime.now(timezone.utc).isoformat()
    return result


def delete_trail_images(images: dict):
    """
    Delete all R2 objects referenced in an images dict.
    Pass the dict returned by upload_trail_image().
    """
    if not R2_AVAILABLE or not R2_PUBLIC_URL:
        return  # Can't derive keys without CDN URL prefix
    for variant in ('thumb', 'card', 'hero'):
        url = images.get(variant, '')
        if url and url.startswith(R2_PUBLIC_URL):
            key = url[len(R2_PUBLIC_URL):].lstrip('/')
            _delete_from_r2(key)


def best_url(images_or_trail: dict, variant: str = 'card') -> str:
    """
    Extract the best available image URL from a trail dict or images dict.
    Falls back gracefully through the old schema (wallpaper, image_url, thumbnail, gallery).

    Usage:
        url = best_url(trail, 'card')   # for trail card views
        url = best_url(trail, 'hero')   # for full-bleed hero
        url = best_url(trail, 'thumb')  # for small thumbnails
    """
    # New schema: trail.images is a list of image dicts
    images_list = images_or_trail.get('images') if isinstance(images_or_trail, dict) else None
    if images_list:
        for img in images_list:
            if isinstance(img, dict) and img.get(variant):
                return img[variant]
            # If only one size stored (legacy fallback), return whatever exists
            for v in ('card', 'hero', 'thumb'):
                if isinstance(img, dict) and img.get(v):
                    return img[v]

    # Legacy fields: wallpaper > image_url > thumbnail > gallery[0]
    if isinstance(images_or_trail, dict):
        t = images_or_trail
        return (
            t.get('wallpaper') or
            t.get('image_url') or
            t.get('thumbnail') or
            (t.get('gallery') or [None])[0] or
            ''
        )
    return ''


def status() -> dict:
    """Return storage configuration status for the health endpoint."""
    r2_ok = False
    if R2_AVAILABLE:
        try:
            _get_r2().head_bucket(Bucket=R2_BUCKET)
            r2_ok = True
        except Exception:
            pass
    return {
        'r2_configured': R2_AVAILABLE,
        'r2_reachable':  r2_ok,
        'cdn_url':        R2_PUBLIC_URL or None,
        'variants':       list(VARIANTS.keys()),
    }
