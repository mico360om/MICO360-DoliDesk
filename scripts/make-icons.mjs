// Generates app icons + the in-app logo from assets/logo-source.png.
//   build/icon.ico      → Windows app + installer icon (multi-size)
//   build/icon.png      → 512px master (mac/linux)
//   src/assets/logo.png → trimmed transparent logo bundled into the UI
//
// Run with: npm run icons
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { mkdirSync, writeFileSync } from 'fs'

const SRC = 'assets/logo-source.png' // transparent master logo
mkdirSync('src/assets', { recursive: true })
mkdirSync('build', { recursive: true })

// 1) Trimmed transparent logo for in-app use.
const logo = await sharp(SRC).trim().png().toBuffer()
writeFileSync('src/assets/logo.png', logo)
const meta = await sharp(logo).metadata()
console.log(`logo trimmed → src/assets/logo.png (${meta.width}x${meta.height})`)

// 2) Square icon: rounded white card so the dark "360" stays visible on any
//    taskbar, with the logo letterboxed inside.
async function squareIcon(size) {
  const pad = Math.round(size * 0.08)
  const inner = size - pad * 2
  const fitted = await sharp(logo).resize({ width: inner, height: inner, fit: 'inside' }).toBuffer()
  // Solid white background guarantees the dark "360" stays visible on any taskbar.
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: fitted, gravity: 'center' }])
    .png()
    .toBuffer()
}

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = await Promise.all(sizes.map(squareIcon))
writeFileSync('build/icon.ico', await pngToIco(pngs))
writeFileSync('build/icon.png', await squareIcon(512))
console.log('icons → build/icon.ico (16–256) + build/icon.png (512)')
