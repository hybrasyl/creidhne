import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { crc32, deflateRawSync, deflateSync } from 'zlib'
import { launchApp, getMainWindow } from './helpers.js'

// Item icons from an item_icons pack (HTOO-695), through the built app. The
// world has one item at sprite 20001, a modern id that only a pack has; the
// pack has that icon (red) and item 5 (green). The app has no client path, so
// legend.dat cannot draw anything: each pixel the spec reads comes from the pack.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const ITEM = `<?xml version="1.0"?>
<Item xmlns="${XMLNS}">
  <Name>Pack Helm</Name>
  <Properties>
    <Appearance Sprite="20001" />
    <Stackable Max="1" />
    <Physical Value="1" Weight="1" Durability="1" />
  </Properties>
</Item>
`

/** A solid-colour RGBA PNG. */
function png(width, height, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 4)])
  for (let x = 0; x < width; x++) row.set([r, g, b, 255], 1 + x * 4)
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** A zip archive (deflate, no data descriptors) of name → bytes. */
function zip(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, data] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8')
    const packed = deflateRawSync(data)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    locals.push(local, nameBuf, packed)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + packed.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(centrals.length / 2, 8)
  eocd.writeUInt16LE(centrals.length / 2, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, eocd])
}

const RED = [220, 20, 20]
const GREEN = [20, 200, 20]

/** The centre pixel of the n-th item sprite canvas inside `root`. */
async function centrePixel(page, rootSelector, n = 0) {
  return page.evaluate(
    ([sel, i]) => {
      const canvas = document.querySelectorAll(`${sel} [data-testid="item-sprite-canvas"]`)[i]
      if (!canvas) return null
      const d = canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data
      return [d[0], d[1], d[2], d[3]]
    },
    [rootSelector, n]
  )
}

test.describe('Item icon packs', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('a pack icon shows in the Sprite field and can be picked', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    mkdirSync(join(lib, 'items'), { recursive: true })
    const itemFile = join(lib, 'items', 'pack_helm.xml')
    writeFileSync(itemFile, ITEM)
    const packs = mkdtempSync(join(tmpdir(), 'creidhne-e2e-packs-'))
    const manifest = {
      schema_version: 1,
      pack_id: 'e2e-items',
      pack_version: '1.0.0',
      content_type: 'item_icons',
      covers: { item_icons: {} }
    }
    writeFileSync(
      join(packs, 'e2e-items.datf'),
      zip({
        '_manifest.json': Buffer.from(JSON.stringify(manifest)),
        'item20001.png': png(16, 16, RED),
        'item00005.png': png(16, 16, GREEN)
      })
    )

    ;({ electronApp } = await launchApp({
      seedSettings: {
        libraries: [lib],
        activeLibrary: lib,
        theme: 'hybrasyl',
        brigidAssetsPath: packs
      }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Items', exact: true }).first().click()
    await page.getByText('Pack Helm', { exact: true }).first().click()

    // The Sprite field draws the pack's modern icon, with no legend.dat.
    const sprite = page.getByRole('spinbutton', { name: 'Sprite', exact: true })
    await expect(sprite).toHaveValue('20001')
    await expect.poll(() => centrePixel(page, 'body')).toEqual([...RED, 255])

    // The picker opens with packs alone and lists both pack ids.
    await page.getByLabel('Browse item sprites').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByTestId('item-sprite-cell-20001')).toBeVisible()
    await expect(dialog.getByTestId('item-sprite-cell-5')).toBeVisible()
    await dialog.getByTestId('item-sprite-cell-5').click()

    await expect(sprite).toHaveValue('5')
    await expect.poll(() => centrePixel(page, 'body')).toEqual([...GREEN, 255])

    // The pick saves.
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => readFileSync(itemFile, 'utf-8')).toContain('Sprite="5"')
  })
})
