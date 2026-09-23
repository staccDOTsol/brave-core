// Regenerate native icon renditions from the FairCreators vector master.
// Usage: node generate-icons.mjs /absolute/path/to/sharp
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const sharp = require(process.argv[2] || 'sharp')
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const master = readFileSync(resolve(here, 'mark.svg'), 'utf8')
const glyph = '<path d="M76 60H188V100H116V122H172V162H116V204H76Z" fill="COLOR"/>'
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)])
const asset = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
const colored = (color) => master.replaceAll('#6554e8', color)
const raster = (svg, width, height) => sharp(Buffer.from(svg)).resize(width, height).png().toBuffer()
let count = 0

for (const path of walk(resolve(root, 'app/theme'))) {
  if (!/(?:\/brave(?:_origin)?\/)/.test(path)) continue
  const name = path.split('/').at(-1)
  const color = /nightly/.test(path) ? '#263453' : /beta/.test(path) ? '#a13a86' : '#6554e8'
  if (path.endsWith('.png') && /^(product_logo|app_icon|layered_app_icon|fre_product_logo|SmallLogo|Logo)/.test(name)) {
    const { width, height } = await sharp(path).metadata()
    let svg = colored(color)
    if (name.includes('background')) svg = asset(256, 256, `<path fill="${color}" d="M0 0H256V256H0Z"/>`)
    else if (name.startsWith('layered_app_icon')) svg = asset(256, 256, glyph.replace('COLOR', '#ffffff'))
    else if (name.includes('mono')) svg = asset(256, 256, glyph.replace('COLOR', '#000000'))
    else if (width > height * 1.5) {
      const size = Math.min(height * .55, (width - height) / 7.4)
      svg = asset(width, height, `<svg width="${height}" height="${height}" viewBox="0 0 256 256">${master.replace(/^.*?<svg[^>]*>/s, '').replace('</svg>', '')}</svg><text x="${height + 3}" y="${height / 2}" dominant-baseline="central" font-family="Arial, sans-serif" font-size="${size}" font-weight="700" fill="${name.includes('white') ? '#ffffff' : '#242236'}">FairCreators</text>`)
    }
    writeFileSync(path, await raster(svg, width, height)); count++
  } else if (path.endsWith('.ico')) {
    const sizes = [16, 24, 32, 48, 64, 128, 256]
    const images = await Promise.all(sizes.map((size) => raster(colored(color), size, size)))
    const header = Buffer.alloc(6 + 16 * sizes.length)
    header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
    let offset = header.length
    images.forEach((png, i) => {
      const p = 6 + 16 * i
      header[p] = sizes[i] % 256; header[p + 1] = sizes[i] % 256
      header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6)
      header.writeUInt32LE(png.length, p + 8); header.writeUInt32LE(offset, p + 12)
      offset += png.length
    })
    writeFileSync(path, Buffer.concat([header, ...images])); count++
  } else if (path.endsWith('.icns')) {
    const chunks = []
    for (const [type, size] of [['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]) {
      const png = await raster(colored(color), size, size), header = Buffer.alloc(8)
      header.write(type); header.writeUInt32BE(png.length + 8, 4)
      chunks.push(header, png)
    }
    const header = Buffer.alloc(8); header.write('icns')
    header.writeUInt32BE(8 + chunks.reduce((n, b) => n + b.length, 0), 4)
    writeFileSync(path, Buffer.concat([header, ...chunks])); count++
  } else if (/product_logo(?:_animation)?\.svg$/.test(path)) {
    writeFileSync(path, colored(color)); count++
  } else if (name === 'themed_app_icon.xml') {
    const old = readFileSync(path, 'utf8')
    writeFileSync(path, old.replace(/android:pathData="[^"]*"/,
      'android:pathData="M32,25H79V42H49V51H73V68H49V86H32Z"')); count++
  }
}

for (const path of walk(resolve(root, 'ios/brave-ios/App/iOS/AppIcons'))) {
  if (!path.endsWith('/icon.json')) continue
  const config = JSON.parse(readFileSync(path, 'utf8'))
  const color = path.includes('Nightly') ? '#263453' : path.includes('Beta') ? '#a13a86' : '#6554e8'
  const svgPath = resolve(dirname(path), 'Assets/faircreators.svg')
  writeFileSync(svgPath, colored(color).replace('x="8" y="8" width="240" height="240" rx="56"', 'width="256" height="256"'))
  config.groups = [{ layers: [{ 'image-name': 'faircreators.svg', name: 'FairCreators',
    position: { scale: 1, 'translation-in-points': [0, 0] }, glass: false }], name: 'FairCreators' }]
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n'); count++
}
writeFileSync(resolve(here, 'preview.png'), await raster(master, 256, 256))
console.log(`Generated ${count} native icon assets from ${relative(root, here)}/mark.svg`)
