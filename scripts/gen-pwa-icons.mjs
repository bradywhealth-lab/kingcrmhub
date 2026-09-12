// Generates PWA icons from public/logo.svg → public/icons/*.png
// Run: node scripts/gen-pwa-icons.mjs
import { readFileSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const logo = readFileSync('public/logo.svg')

async function makeIcon(size, out) {
  const bg = sharp({
    create: { width: size, height: size, channels: 4, background: '#127c66' },
  })
  const resized = await sharp(logo, { density: 300 }).resize(Math.round(size * 0.72), Math.round(size * 0.72), { fit: 'contain', background: { r: 18, g: 124, b: 102, alpha: 0 } }).png().toBuffer()
  await bg.composite([{ input: resized, gravity: 'center' }]).png().toFile(out)
  console.log('WROTE', out)
}

mkdirSync('public/icons', { recursive: true })
await Promise.all([makeIcon(192, 'public/icons/icon-192.png'), makeIcon(512, 'public/icons/icon-512.png')])
