import type { Lut3D } from '../color/lut'
import type { SrgbColor } from '../domain/calibration'

function validate(lut: Lut3D, color: SrgbColor) {
  if (!Number.isInteger(lut.size) || lut.size < 2) {
    throw new RangeError('LUT size must be an integer of at least 2')
  }
  if (lut.data.length !== lut.size ** 3 * 3) {
    throw new RangeError('LUT data length does not match its dimensions')
  }
  if (color.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 1)) {
    throw new RangeError('RGB input must contain finite channels in [0, 1]')
  }
}

function channelAt(
  lut: Lut3D,
  red: number,
  green: number,
  blue: number,
  channel: number,
): number {
  const index = ((blue * lut.size + green) * lut.size + red) * 3 + channel
  return lut.data[index]!
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

export function sampleLut(lut: Lut3D, color: SrgbColor): SrgbColor {
  validate(lut, color)
  const scaled = color.map((channel) => channel * (lut.size - 1))
  const lower = scaled.map(Math.floor)
  const upper = lower.map((value) => Math.min(lut.size - 1, value + 1))
  const fraction = scaled.map((value, index) => value - lower[index]!)

  const output = [0, 1, 2].map((channel) => {
    const c000 = channelAt(lut, lower[0]!, lower[1]!, lower[2]!, channel)
    const c100 = channelAt(lut, upper[0]!, lower[1]!, lower[2]!, channel)
    const c010 = channelAt(lut, lower[0]!, upper[1]!, lower[2]!, channel)
    const c110 = channelAt(lut, upper[0]!, upper[1]!, lower[2]!, channel)
    const c001 = channelAt(lut, lower[0]!, lower[1]!, upper[2]!, channel)
    const c101 = channelAt(lut, upper[0]!, lower[1]!, upper[2]!, channel)
    const c011 = channelAt(lut, lower[0]!, upper[1]!, upper[2]!, channel)
    const c111 = channelAt(lut, upper[0]!, upper[1]!, upper[2]!, channel)
    const x00 = mix(c000, c100, fraction[0]!)
    const x10 = mix(c010, c110, fraction[0]!)
    const x01 = mix(c001, c101, fraction[0]!)
    const x11 = mix(c011, c111, fraction[0]!)
    const y0 = mix(x00, x10, fraction[1]!)
    const y1 = mix(x01, x11, fraction[1]!)
    return mix(y0, y1, fraction[2]!)
  })

  return [output[0]!, output[1]!, output[2]!]
}
