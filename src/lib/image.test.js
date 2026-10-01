import { describe, it, expect, vi, afterEach } from 'vitest';
import { resizeForUpload, AVATAR_MAX_WIDTH, COVER_MAX_WIDTH } from './image';

// The regression this guards.
//
// Avatars went to Storage at full camera resolution and were downloaded in full
// to draw a small circle. Measured on the live bucket: 1.5 MB average, 3.4 MB
// largest, ~15 MB for a screen of ten faces. Supabase's server-side transform
// would be the better fix but returns FeatureNotEnabled on this plan, so the
// shrink has to happen before the bytes are stored.
//
// There is no DOM here, so canvas and createImageBitmap are stubbed. What is
// actually under test is the decision logic: downscale only, never upscale,
// keep whichever blob is smaller, and never fail an upload because the resize
// broke.

function stubCanvas({ outSize, toBlobNull = false, noCtx = false }) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (noCtx ? null : { drawImage: () => {} }),
    toBlob: (cb) => cb(toBlobNull ? null : { size: outSize, __resized: true }),
  };
  globalThis.document = { createElement: () => canvas };
  return canvas;
}

function stubBitmap(width, height = width) {
  globalThis.createImageBitmap = vi.fn(async () => ({ width, height, close: () => {} }));
}

const file = (size) => ({ size, __original: true });

afterEach(() => {
  delete globalThis.document;
  delete globalThis.createImageBitmap;
  vi.restoreAllMocks();
});

describe('resizeForUpload', () => {
  it('downscales a wide photo and returns the smaller blob', async () => {
    stubBitmap(4032);
    const canvas = stubCanvas({ outSize: 90_000 });
    const out = await resizeForUpload(file(3_400_000), AVATAR_MAX_WIDTH);
    expect(out.__resized).toBe(true);
    expect(canvas.width).toBe(AVATAR_MAX_WIDTH);
  });

  it('preserves aspect ratio when it scales', async () => {
    stubBitmap(4000, 3000);
    const canvas = stubCanvas({ outSize: 1000 });
    await resizeForUpload(file(2_000_000), 640);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
  });

  it('never upscales — a small picture keeps its own size', async () => {
    stubBitmap(320, 240);
    const canvas = stubCanvas({ outSize: 5_000 });
    await resizeForUpload(file(9_000), AVATAR_MAX_WIDTH);
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
  });

  it('keeps the original when re-encoding would make it bigger', async () => {
    // Re-encoding an already-small JPEG often grows it. Uploading the larger of
    // the two would be the opposite of the point.
    stubBitmap(200);
    stubCanvas({ outSize: 50_000 });
    const original = file(9_000);
    expect(await resizeForUpload(original, AVATAR_MAX_WIDTH)).toBe(original);
  });

  it('uses the resized blob when it is genuinely smaller', async () => {
    stubBitmap(3000);
    stubCanvas({ outSize: 80_000 });
    const out = await resizeForUpload(file(2_500_000), AVATAR_MAX_WIDTH);
    expect(out.__resized).toBe(true);
  });
});

describe('resizeForUpload never blocks an upload', () => {
  it('returns the original if decoding throws', async () => {
    globalThis.createImageBitmap = vi.fn(async () => { throw new Error('bad image'); });
    stubCanvas({ outSize: 1 });
    const original = file(3_000_000);
    expect(await resizeForUpload(original, AVATAR_MAX_WIDTH)).toBe(original);
  });

  it('returns the original if the browser gives no 2d context', async () => {
    stubBitmap(4000);
    stubCanvas({ outSize: 1, noCtx: true });
    const original = file(3_000_000);
    expect(await resizeForUpload(original, AVATAR_MAX_WIDTH)).toBe(original);
  });

  it('returns the original if toBlob yields nothing', async () => {
    stubBitmap(4000);
    stubCanvas({ outSize: 1, toBlobNull: true });
    const original = file(3_000_000);
    expect(await resizeForUpload(original, AVATAR_MAX_WIDTH)).toBe(original);
  });
});

describe('width budgets', () => {
  it('avatars are capped well below cover art', () => {
    expect(AVATAR_MAX_WIDTH).toBe(640);
    expect(COVER_MAX_WIDTH).toBe(1280);
    expect(AVATAR_MAX_WIDTH).toBeLessThan(COVER_MAX_WIDTH);
  });
});
