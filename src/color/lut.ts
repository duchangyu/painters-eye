import type { SrgbColor } from '../domain/calibration'
import type { CompensationParameters } from '../domain/profile'
import { compensateColor } from './compensate'

export interface Lut3D {
  readonly size: number
  readonly data: readonly number[]
}

export function generateLut(
  size: number,
  transform: (color: SrgbColor) => SrgbColor,
): Lut3D {
  if (!Number.isInteger(size) || size < 2 || size > 65) {
    throw new RangeError('LUT size must be an integer in [2, 65]')
  }

  const data: number[] = []
  const denominator = size - 1

  // Red is the fastest-changing coordinate, matching WebGL 3D texture layout.
  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        const output = transform([
          red / denominator,
          green / denominator,
          blue / denominator,
        ])
        output.forEach((channel) => {
          if (!Number.isFinite(channel) || channel < 0 || channel > 1) {
            throw new RangeError('LUT transform returned an invalid channel')
          }
          data.push(channel)
        })
      }
    }
  }

  return { size, data }
}

export function buildCompensationLut(
  parameters: CompensationParameters,
  size = 17,
): Lut3D {
  return generateLut(size, (color) =>
    compensateColor(color, parameters, parameters.recommendedStrength),
  )
}
