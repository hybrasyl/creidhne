#!/usr/bin/env node
/**
 * generate-sprite-meta.js
 * Generates creature_sprites.json from MPF animation data + PNG dimensions.
 *
 * Usage: node scripts/generate-sprite-meta.js
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MPF_DIR = 'E:/Hybrasyl Dev/Client Assets/dat extracts/hades.dat';
const PNG_DIR = 'E:/Hybrasyl Dev/Client Assets/Unity Assets/Monster';
const OUTPUT  = path.join(__dirname, '../resources/creatures/creature_sprites.json');
const MAGICK  = 'F:\\Applications\\ImageMagick-7.1.0-Q16-HDRI\\magick.exe';

// ── MPF parser ────────────────────────────────────────────────────────────────

function parseMpf(buf) {
  let pos = 0;

  // Probe header type (Int32 LE); if not Unknown (-1), seek back and read normally
  const headerType = buf.readInt32LE(pos); pos += 4;
  if (headerType === -1) {
    const extra = buf.readInt32LE(pos); pos += 4;
    if (extra === 4) pos += 8;
  } else {
    pos = 0;
  }

  /* frameCount  */ pos += 1;
  const pixelWidth  = buf.readInt16LE(pos); pos += 2;
  /* pixelHeight */ pos += 2;
  /* dataLength  */ pos += 4;

  /* walkFrameIndex */ pos += 1;
  /* walkFrameCount */ pos += 1;

  const formatType = buf.readInt16LE(pos); pos += 2;

  let standingFrameIndex, standingFrameCount, attackFrameIndex, attackFrameCount;

  if (formatType === -1) {
    // MultipleAttacks
    standingFrameIndex = buf.readUInt8(pos++);
    standingFrameCount = buf.readUInt8(pos++);
    pos += 2; // optionalAnimationFrameCount, optionalAnimationRatio
    attackFrameIndex   = buf.readUInt8(pos++);
    attackFrameCount   = buf.readUInt8(pos++);
  } else {
    // SingleAttack — DALib seeks back 2 before reading
    pos -= 2;
    attackFrameIndex   = buf.readUInt8(pos++);
    attackFrameCount   = buf.readUInt8(pos++);
    standingFrameIndex = buf.readUInt8(pos++);
    standingFrameCount = buf.readUInt8(pos++);
  }

  return { pixelWidth, standingFrameIndex, standingFrameCount, attackFrameIndex, attackFrameCount };
}

// ── Frame derivation (all indices 1-based to match JSON convention) ───────────

function deriveFrames(meta, totalFrames) {
  const { standingFrameIndex: si, standingFrameCount: sc,
          attackFrameIndex:   ai, attackFrameCount:   ac } = meta;

  // Forward-facing frames are the second half of each animation group
  const still = si + sc + 1;

  const use = [];
  for (let f = si + sc + 1; f <= Math.min(si + sc * 2, totalFrames); f++) use.push(f);
  for (let f = ai + ac + 1; f <= Math.min(ai + ac * 2, totalFrames); f++) use.push(f);

  return { still, use };
}

// ── Batch PNG dimensions via ImageMagick ──────────────────────────────────────

function batchPngDimensions(pngPaths) {
  const dims = {};
  const BATCH = 100;

  for (let i = 0; i < pngPaths.length; i += BATCH) {
    const batch = pngPaths.slice(i, i + BATCH);
    const args  = batch.map(p => `"${p}"`).join(' ');
    try {
      const out = execSync(`"${MAGICK}" identify -format "%f|%w|%h\\n" ${args}`, { encoding: 'utf8' });
      for (const line of out.trim().split('\n')) {
        const [file, w, h] = line.trim().split('|');
        if (file && w && h) dims[path.basename(file)] = { w: Number(w), h: Number(h) };
      }
    } catch (e) {
      console.error(`ImageMagick batch error (batch ${i / BATCH + 1}):`, e.message);
    }
  }
  return dims;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const mpfFiles = fs.readdirSync(MPF_DIR).filter(f => /\.mpf$/i.test(f));
console.error(`${mpfFiles.length} MPF files`);

// Match each MPF to its PNG (MNS001 → monster0001)
const pairs = [];
for (const mpf of mpfFiles) {
  const num     = parseInt(mpf.match(/\d+/)[0], 10);
  const pngName = `monster${String(num).padStart(4, '0')}.png`;
  const pngPath = path.join(PNG_DIR, pngName);
  if (fs.existsSync(pngPath)) pairs.push({ mpf, pngName, pngPath });
}
console.error(`${pairs.length} matched pairs (${mpfFiles.length - pairs.length} skipped)`);

const pngDims = batchPngDimensions(pairs.map(p => p.pngPath));

const result = {};
const errors  = [];

for (const { mpf, pngName } of pairs) {
  const key  = pngName.replace('.png', '');
  const dims = pngDims[pngName];
  if (!dims) { errors.push(`No dimensions: ${pngName}`); continue; }

  let meta;
  try {
    meta = parseMpf(fs.readFileSync(path.join(MPF_DIR, mpf)));
  } catch (e) {
    errors.push(`Parse error ${mpf}: ${e.message}`);
    continue;
  }

  const frames       = meta.pixelWidth > 0 ? Math.round(dims.w / meta.pixelWidth) : 1;
  const { still, use } = deriveFrames(meta, frames);

  result[key] = { w: dims.w, h: dims.h, frames, still, use };
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.error(`Written: ${OUTPUT}`);

if (errors.length) {
  console.error(`\n${errors.length} warnings:`);
  errors.forEach(e => console.error(' ', e));
}
