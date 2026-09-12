// Generates PWA icons from public/logo.svg → public/icons/*.png
// Run: node scripts/gen-pwa-icons.mjs
//
// Two 512px assets (cubic P3, PR #176): icon-512.png is the "any" icon and
// fills the canvas at 0.72x like the 192px icon; icon-512-maskable.png is
// dedicated to `purpose: maskable`, where Android launchers may crop to the
// inscribed circle, so its artwork stays within the central ~60% safe zone.
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
// 192: standard "any" icon, fills the canvas. 512: standard "any" icon, fills the canvas.
// 512-maskable: used specifically as maskable, artwork shrunk to the 60% safe zone.
await Promise.all([
  makeIcon(192, 'public/icons/icon-192.png', 0.72),
  makeIcon(512, 'public/icons/icon-512.png', 0.72),
  makeIcon(512, 'public/icons/icon-512-maskable.png', 0.6),
])
