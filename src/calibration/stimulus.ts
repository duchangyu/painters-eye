import { decodeSrgb, encodeSrgb, clampUnit } from '../color/srgb'
import type {
  ConfusionAxis,
  SrgbColor,
  Stimulus,
  StimulusDot,
  TargetDirection,
} from '../domain/calibration'
import { createSeededRandom } from '../lib/random'
import { isInsideLandoltC } from './landoltMask'

const DIRECTIONS: readonly TargetDirection[] = ['up', 'right', 'down', 'left']
const DOT_COUNT = 260
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const

const COLOR_CENTERS: readonly SrgbColor[] = [
  [0.58, 0.5, 0.34],
  [0.42, 0.58, 0.5],
  [0.62, 0.46, 0.56],
  [0.48, 0.54, 0.64],
]

const AXIS_VECTORS: Readonly<Record<ConfusionAxis, SrgbColor>> = {
  protan: [0.9, -0.267533, 0],
  deutan: [0.2, -0.2, 1.392521],
  'blue-yellow-control': [0, -0.1, 0.990582],
  'luminance-control': [0.5, 0.5, 0.5],
}

export interface CreateStimulusOptions {
  readonly seed: number
  readonly axis: ConfusionAxis
  readonly delta: number
}

function relativeLuminance(color: SrgbColor): number {
  return (
    LUMINANCE_WEIGHTS[0] * decodeSrgb(color[0]) +
    LUMINANCE_WEIGHTS[1] * decodeSrgb(color[1]) +
    LUMINANCE_WEIGHTS[2] * decodeSrgb(color[2])
  )
}

function offsetColor(
  center: SrgbColor,
  vector: SrgbColor,
  amount: number,
): SrgbColor {
  return [
    clampUnit(encodeSrgb(decodeSrgb(center[0]) + vector[0] * amount)),
    clampUnit(encodeSrgb(decodeSrgb(center[1]) + vector[1] * amount)),
    clampUnit(encodeSrgb(decodeSrgb(center[2]) + vector[2] * amount)),
  ]
}

function jitterColor(
  color: SrgbColor,
  random: () => number,
): SrgbColor {
  const jitter = (random() - 0.5) * 0.035
  return [
    clampUnit(color[0] + jitter),
    clampUnit(color[1] + jitter),
    clampUnit(color[2] + jitter),
  ]
}

export function createStimulus({
  seed,
  axis,
  delta,
}: CreateStimulusOptions): Stimulus {
  if (!Number.isFinite(delta) || delta <= 0 || delta > 0.25) {
    throw new RangeError('delta must be a finite number in (0, 0.25]')
  }

  const random = createSeededRandom(seed)
  const direction = DIRECTIONS[(seed >>> 0) % DIRECTIONS.length]
  const center = COLOR_CENTERS[Math.floor(random() * COLOR_CENTERS.length)]
  const vector = AXIS_VECTORS[axis]

  if (!direction || !center || !vector) {
    throw new RangeError('stimulus parameters are outside the supported range')
  }

  const foregroundColor = offsetColor(center, vector, delta / 2)
  const backgroundColor = offsetColor(center, vector, -delta / 2)
  const dots: StimulusDot[] = []

  for (let index = 0; index < DOT_COUNT; index += 1) {
    const x = 0.04 + random() * 0.92
    const y = 0.04 + random() * 0.92
    const role = isInsideLandoltC(x * 2 - 1, y * 2 - 1, direction)
      ? 'foreground'
      : 'background'
    const baseColor = role === 'foreground' ? foregroundColor : backgroundColor

    dots.push({
      center: [x, y],
      radius: 0.007 + random() * 0.011,
      role,
      color: jitterColor(baseColor, random),
    })
  }

  return {
    id: `stimulus-${seed >>> 0}-${axis}-${delta.toFixed(4)}`,
    seed: seed >>> 0,
    axis,
    direction,
    delta,
    foregroundColor,
    backgroundColor,
    foregroundLuminance: relativeLuminance(foregroundColor),
    backgroundLuminance: relativeLuminance(backgroundColor),
    dots,
  }
}
