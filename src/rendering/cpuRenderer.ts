import type { Lut3D } from '../color/lut'
import { sampleLut } from './trilinearLut'

function validateStrength(strength: number) {
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
    throw new RangeError('strength must be in [0, 1]')
  }
}

export function applyLutToPixels(
  pixels: Uint8ClampedArray,
  lut: Lut3D,
  strength: number,
): Uint8ClampedArray {
  validateStrength(strength)
  if (pixels.length % 4 !== 0) {
    throw new RangeError('pixel data must be complete RGBA tuples')
  }
  const output = new Uint8ClampedArray(pixels.length)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const original = [
      pixels[offset]! / 255,
      pixels[offset + 1]! / 255,
      pixels[offset + 2]! / 255,
    ] as const
    const transformed = sampleLut(lut, original)
    for (let channel = 0; channel < 3; channel += 1) {
      output[offset + channel] = Math.round(
        (original[channel]! +
          (transformed[channel]! - original[channel]!) * strength) *
          255,
      )
    }
    output[offset + 3] = pixels[offset + 3]!
  }
  return output
}

export function renderImageWithCpu(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  lut: Lut3D,
  strength: number,
) {
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (!width || !height) {
    throw new RangeError('source image has not loaded')
  }
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('2D canvas is unavailable')
  }
  context.drawImage(image, 0, 0, width, height)
  const frame = context.getImageData(0, 0, width, height)
  frame.data.set(applyLutToPixels(frame.data, lut, strength))
  context.putImageData(frame, 0, 0)
}
