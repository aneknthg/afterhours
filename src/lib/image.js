/**
 * image.js — shrink a picked image before it goes to Storage.
 *
 * Counterpart to lib/image.ts in Afterhours-App-main. Both buckets are shared,
 * so a photo uploaded oversized from either client is served oversized to both.
 *
 * Why this exists: avatars were being uploaded at full camera resolution and
 * then downloaded in full to render as a small circle. Measured on the live
 * bucket, the average avatar was 1.5 MB and the largest 3.4 MB.
 *
 * Supabase can do this server-side with /render/image transforms, which would
 * be the better answer, but that endpoint returns FeatureNotEnabled on this
 * project's plan. So the shrink has to happen before the bytes are stored.
 */

/** Rendered at 32-56px in lists, up to ~128px on a profile. 640 covers @3x. */
export const AVATAR_MAX_WIDTH = 640;

/** Full-bleed card art, so it needs more than an avatar but not the original. */
export const COVER_MAX_WIDTH = 1280;

/**
 * Returns a JPEG Blob no wider than maxWidth, re-compressed.
 *
 * Downscales only. Widening a picture that is already narrower would re-encode
 * an upscaled image and cost bytes for no added detail, so a small input is
 * compressed at its own size.
 *
 * Falls back to the input untouched if anything in the decode/encode path
 * fails. An oversized avatar is a slow list; a failed upload is a member who
 * cannot set a photo at all, and the second is worse.
 */
export async function resizeForUpload(input, maxWidth, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(input);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return input;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    // Keep whichever is actually smaller. Re-encoding an already-small JPEG can
    // come out bigger, and uploading the larger of the two would be silly.
    if (!blob) return input;
    return blob.size < input.size ? blob : input;
  } catch {
    return input;
  }
}
