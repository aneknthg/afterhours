#!/usr/bin/env node
/**
 * backfill-avatar-sizes.mjs — re-compress the avatars already in Storage.
 *
 * Fixing the upload paths only helps the next photo. Every avatar uploaded
 * before that fix stays at full camera resolution, and those are the ones the
 * current members are waiting on: measured on the live bucket, 1.5 MB average
 * and 3.4 MB largest, roughly 15 MB for a screen of ten faces.
 *
 * Downloads each avatar, re-encodes it to at most 640px wide, and overwrites it
 * in place only when the result is genuinely smaller. The public URL does not
 * change, so no profile row is touched and nothing has to be re-pointed.
 *
 * NEEDS THE SERVICE ROLE KEY. The anon key can read the bucket but not write to
 * someone else's folder. Do not paste the key into a chat window or a shell
 * that records history:
 *
 *   read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
 *   node scripts/backfill-avatar-sizes.mjs --dry-run
 *   node scripts/backfill-avatar-sizes.mjs
 *
 * --dry-run reports what it would save and writes nothing. Run it first.
 *
 * Needs `sharp` for the re-encode. --no-save deliberately: this is a one-off
 * script and sharp is a large native dependency that CI should not install.
 *
 *   npm i --no-save sharp
 */
import { readFileSync, writeFileSync, readFileSync as rf, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry-run');
const MAX_WIDTH = 640;
const QUALITY = 85;

function env(name) {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;
  try {
    const line = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim();
  } catch { /* no .env.local */ }
  return '';
}

const URL_BASE = env('VITE_SUPABASE_URL');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON = env('VITE_SUPABASE_PUBLISHABLE_KEY');

if (!URL_BASE) { console.error('VITE_SUPABASE_URL not found'); process.exit(2); }
if (!DRY && !SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set. Writing needs it; --dry-run does not.');
  console.error('  read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('sharp is not installed. Run: npm i --no-save sharp');
  process.exit(2);
}

// Some avatars are HEIC files saved with a .jpg name — iOS hands the picker a
// .heic and the old upload path stored the bytes verbatim. sharp's bundled
// libheif refuses them ("bad seek"). macOS ships sips, which decodes HEIC
// natively, so on a Mac we transcode first and let sharp do the resize. These
// are the two largest avatars in the bucket, so skipping them would leave the
// worst offenders in place.
let SIPS = false;
try { execFileSync('sips', ['--version'], { stdio: 'ignore' }); SIPS = process.platform === 'darwin'; } catch { /* no sips */ }

function transcodeWithSips(buf) {
  const inp = join(tmpdir(), `ah-av-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const outp = `${inp}.jpg`;
  try {
    writeFileSync(inp, buf);
    execFileSync('sips', ['-s', 'format', 'jpeg', inp, '--out', outp], { stdio: 'ignore' });
    return rf(outp);
  } finally {
    for (const f of [inp, outp]) { try { unlinkSync(f); } catch { /* already gone */ } }
  }
}

/** Downscale to MAX_WIDTH and re-encode as JPEG. Throws if the input cannot be decoded. */
async function encode(buf) {
  const meta = await sharp(buf).metadata();
  const pipeline = sharp(buf).rotate(); // honour EXIF orientation
  if ((meta.width ?? 0) > MAX_WIDTH) pipeline.resize({ width: MAX_WIDTH });
  return pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
}

const readKey = SERVICE_KEY || ANON;
const rest = (path, init = {}) =>
  fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: { apikey: readKey, Authorization: `Bearer ${readKey}`, ...(init.headers || {}) },
  });

// Every avatar the app actually renders, read from the profiles view rather
// than by listing the bucket: an orphaned object nobody points at is not worth
// rewriting, and the view is the same thing the clients read.
const res = await rest('/rest/v1/public_profiles?select=id,avatar_url&limit=2000');
if (!res.ok) { console.error('could not list profiles:', res.status, await res.text()); process.exit(2); }
const rows = (await res.json()).filter((r) => r.avatar_url);

console.log(`${rows.length} profiles have an avatar${DRY ? '  (dry run, nothing will be written)' : ''}\n`);

let before = 0, after = 0, rewritten = 0, skipped = 0, failed = 0;

for (const row of rows) {
  // Strip the ?t= cache-buster to get the storage path.
  const clean = row.avatar_url.split('?')[0];
  const marker = '/storage/v1/object/public/avatars/';
  const at = clean.indexOf(marker);
  if (at === -1) { skipped++; continue; }
  const objectPath = clean.slice(at + marker.length);

  let original;
  try {
    const img = await fetch(clean);
    if (!img.ok) { failed++; continue; }
    original = Buffer.from(await img.arrayBuffer());
    before += original.length;

    // The retry has to wrap the whole encode, not just the metadata read: sharp
    // parses a HEIF container's header happily and only fails later, at decode
    // ("bad seek"), so a metadata-only try never sees the error.
    let out;
    try {
      out = await encode(original);
    } catch (err) {
      if (!SIPS) throw err;
      out = await encode(transcodeWithSips(original));
      console.log(`  (HEIC, transcoded via sips)`);
    }

    // Only ever shrink. Re-encoding an already-small avatar can grow it.
    if (out.length >= original.length) {
      after += original.length;
      skipped++;
      console.log(`  keep    ${objectPath.padEnd(46)} ${(original.length / 1024).toFixed(0)} KB`);
      continue;
    }

    after += out.length;
    console.log(
      `  ${DRY ? 'would' : 'write'}   ${objectPath.padEnd(46)} ` +
      `${(original.length / 1024).toFixed(0)} KB -> ${(out.length / 1024).toFixed(0)} KB`,
    );

    if (!DRY) {
      const put = await fetch(`${URL_BASE}/storage/v1/object/avatars/${objectPath}`, {
        method: 'PUT',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true',
        },
        body: out,
      });
      if (!put.ok) { console.error(`    FAILED ${put.status} ${await put.text()}`); failed++; continue; }
    }
    rewritten++;
  } catch (err) {
    // It stays in the bucket at its current size, so count it as such rather
    // than reporting a saving that did not happen.
    after += original?.length ?? 0;
    console.error(`    error on ${objectPath}: ${err.message}`);
    failed++;
  }
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`\n${DRY ? 'would rewrite' : 'rewrote'} ${rewritten}, kept ${skipped}, failed ${failed}`);
if (failed) console.log('failed avatars stay at their current size; the member can fix hers by re-uploading.');
console.log(`total ${mb(before)} MB -> ${mb(after)} MB` +
  (before ? `  (${(100 - (after / before) * 100).toFixed(0)}% smaller)` : ''));
if (DRY) console.log('\nDry run. Re-run without --dry-run to write.');
