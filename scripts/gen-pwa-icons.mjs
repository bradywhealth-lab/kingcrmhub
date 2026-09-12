// Generates PWA icons from public/logo.svg → public/icons/*.png
// Run: node scripts/gen-pwa-icons.mjs
//
// Maskable safe zone (cubic P2, PR #176): Android launchers may crop the
// canvas to the inscribed circle, so artwork must stay within the central
// ~60% of the icon. The 512px icon is rendered at 0.6x — safe for BOTH
// `purpose: any` and `purpose: maskable` without a second asset.
import { readFileSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const logo = readFileSync('public/logo.svg')

async function makeIcon(size, out, contentRatio) {
  const bg = sharp({
    create: { width: size, height: size, channels: 4, background: '#127c66' },
  })
  const resized = await sharp(logo, { density: 300 })
    .resize(Math.round(size * contentRatio), Math.round(size * contentRatio), { fit: 'contain', background: { r: 18, g: 124, b: 102, alpha: 0 } })
    .png()
    .toBuffer()
  await bg.composite([{ input: resized, gravity: 'center' }]).png().toFile(out)
  console.log('WROTE', out)
}

mkdirSync('public/icons', { recursive: true })
// 192: standard "any" icon, fills the canvas. 512: also used as maskable,
// artwork shrunk to the 60% safe zone.
await Promise.all([
  makeIcon(192, 'public/icons/icon-192.png', 0.72),
  makeIcon(512, 'public/icons/icon-512.png', 0.6),
])
