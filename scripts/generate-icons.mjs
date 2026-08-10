import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const iconDirectory = join(projectRoot, 'public', 'icons')

function iconSvg(size) {
  const inset = Math.round(size * 0.08)
  const radius = Math.round(size * 0.18)
  const fontSize = Math.round(size * 0.31)
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${radius}" fill="#171812"/>
      <circle cx="${Math.round(size * 0.34)}" cy="${Math.round(size * 0.35)}" r="${Math.round(size * 0.2)}" fill="#c84f3e"/>
      <circle cx="${Math.round(size * 0.65)}" cy="${Math.round(size * 0.35)}" r="${Math.round(size * 0.2)}" fill="#78945e" fill-opacity="0.92"/>
      <rect x="${inset}" y="${Math.round(size * 0.57)}" width="${size - inset * 2}" height="${Math.round(size * 0.28)}" rx="${Math.round(size * 0.06)}" fill="#efe8d9"/>
      <text x="50%" y="${Math.round(size * 0.79)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="${Math.round(size * 0.025)}" fill="#171812">CM</text>
    </svg>
  `)
}

await mkdir(iconDirectory, { recursive: true })
for (const size of [192, 512]) {
  await sharp(iconSvg(size))
    .png()
    .toFile(join(iconDirectory, `icon-${size}.png`))
}
