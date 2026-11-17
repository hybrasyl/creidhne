import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes } from 'crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { crc32, deflateRawSync } from 'zlib'
import unzipper from 'unzipper'
import { _loadPackForTests } from '../index.js'
import { PACK_LIMITS, packLimitViolation, readEntryBounded } from '../limits.js'

// Asset-pack resource limits (HTOO-684), against real zip files on disk and the
// real zip reader. Each case uses small limits so that a refusal needs only a
// small file; the production limits are checked for headroom separately.

// A minimal zip writer: deflate, no data descriptors. `declaredSize` lets a
// case write a central directory that lies about an entry's size.
function buildZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, data, declaredSize } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const packed = deflateRawSync(data)
    const crc = crc32(data)
    const size = declaredSize ?? data.length
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(size, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    locals.push(local, nameBuf, packed)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(size, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + packed.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, eocd])
}

const MANIFEST = Buffer.from(
  JSON.stringify({
    schema_version: 1,
    pack_id: 'limits-test',
    pack_version: '0.1.0',
    content_type: 'ability_icons',
    priority: 100,
    covers: { skill_icons: { dimensions: [32, 32] } }
  })
)

const SMALL = Object.freeze({
  maxPackBytes: 64 * 1024,
  maxEntries: 4,
  maxManifestBytes: 1024,
  maxEntryBytes: 4096,
  maxTotalBytes: 8192,
  maxRatio: 20,
  ratioFloorBytes: 1024
})

let dir
let n = 0
function pack(entries) {
  const p = join(dir, `p${n++}.datf`)
  writeFileSync(p, buildZip(entries))
  return p
}
const icon = (id, bytes = 100) => ({
  name: `skill${String(id).padStart(4, '0')}.png`,
  // Random bytes do not compress, so only the limit a case names can refuse it.
  data: randomBytes(bytes)
})

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'creidhne-packlimits-'))
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('pack limits on load', () => {
  it('loads a valid pack that is inside every limit', async () => {
    const p = pack([{ name: '_manifest.json', data: MANIFEST }, icon(1), icon(2)])
    const loaded = await _loadPackForTests(p, SMALL)
    expect(loaded).not.toBeNull()
    expect([...loaded.coverage.get('skill')]).toEqual([1, 2])
  })

  it('loads a pack with entries exactly at the limits', async () => {
    const p = pack([
      { name: '_manifest.json', data: MANIFEST },
      icon(1, SMALL.maxEntryBytes),
      icon(2),
      icon(3)
    ])
    expect(await _loadPackForTests(p, SMALL)).not.toBeNull()
  })

  it('refuses a pack with too many entries', async () => {
    const p = pack([
      { name: '_manifest.json', data: MANIFEST },
      ...[1, 2, 3, 4].map((i) => icon(i))
    ])
    expect(await _loadPackForTests(p, SMALL)).toBeNull()
  })

  it('refuses an oversized manifest', async () => {
    const big = Buffer.from(
      JSON.stringify({ ...JSON.parse(MANIFEST), description: 'x'.repeat(2000) })
    )
    const p = pack([{ name: '_manifest.json', data: big }, icon(1)])
    expect(await _loadPackForTests(p, SMALL)).toBeNull()
  })

  it('refuses an oversized asset', async () => {
    const p = pack([{ name: '_manifest.json', data: MANIFEST }, icon(1, SMALL.maxEntryBytes + 1)])
    expect(await _loadPackForTests(p, SMALL)).toBeNull()
  })

  it('refuses a high-ratio entry', async () => {
    const zeros = { name: 'skill0001.png', data: Buffer.alloc(4000) }
    const p = pack([{ name: '_manifest.json', data: MANIFEST }, zeros])
    expect(await _loadPackForTests(p, SMALL)).toBeNull()
  })

  it('refuses a pack file above the size limit before it opens it', async () => {
    const p = pack([{ name: '_manifest.json', data: MANIFEST }, icon(1, 3000)])
    expect(await _loadPackForTests(p, { ...SMALL, maxPackBytes: 1000 })).toBeNull()
  })

  it('refuses entries that together pass the total limit', async () => {
    const p = pack([
      { name: '_manifest.json', data: MANIFEST },
      icon(1, 3000),
      icon(2, 3000),
      icon(3, 3000)
    ])
    expect(await _loadPackForTests(p, SMALL)).toBeNull()
  })
})

describe('readEntryBounded', () => {
  it('stops an entry that inflates past its declared size at the limit', async () => {
    // The central directory says 10 bytes; the entry inflates to 100 000.
    const p = pack([{ name: 'skill0001.png', data: Buffer.alloc(100_000, 7), declaredSize: 10 }])
    const directory = await unzipper.Open.file(p)
    const entry = directory.files[0]
    expect(Number(entry.uncompressedSize)).toBe(10)
    await expect(readEntryBounded(entry, 4096)).rejects.toThrow(/inflates past the limit/)
  })

  it('reads an entry at the limit', async () => {
    const data = icon(1, 4096).data
    const p = pack([{ name: 'skill0001.png', data }])
    const directory = await unzipper.Open.file(p)
    const buf = await readEntryBounded(directory.files[0], 4096)
    expect(buf.equals(data)).toBe(true)
  })

  it('refuses an entry whose declared size is above the limit without reading it', async () => {
    let opened = false
    const entry = {
      path: 'x',
      uncompressedSize: 5000,
      stream: () => {
        opened = true
        throw new Error('opened')
      }
    }
    await expect(readEntryBounded(entry, 4096)).rejects.toThrow(/above the limit/)
    expect(opened).toBe(false)
  })
})

describe('packLimitViolation', () => {
  it('refuses a size that is not a valid number', () => {
    const files = [{ path: 'a', uncompressedSize: -1, compressedSize: 1 }]
    expect(packLimitViolation(10, files, SMALL)).toMatch(/not valid/)
  })

  it('leaves the production limits far above the measured packs', () => {
    // Measured 2026-11-17: 5.9 MB pack, 799 entries, 327-byte manifest, 4.7 MB
    // entry, ratio 6.8. See limits.js.
    expect(PACK_LIMITS.maxPackBytes).toBeGreaterThan(100 * 5.9e6)
    expect(PACK_LIMITS.maxEntries).toBeGreaterThan(100 * 799)
    expect(PACK_LIMITS.maxEntryBytes).toBeGreaterThan(50 * 4.7e6)
    expect(PACK_LIMITS.maxRatio).toBeGreaterThan(10 * 6.8)
  })
})
