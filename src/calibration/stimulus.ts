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

/**
 * Confusion-axis directions in linear sRGB, taken from the null spaces of the
 * Machado et al. 2009 100%-severity simulation matrices (the direction v with
 * M·v = 0, i.e. the color difference a dichromat cannot see).
 * Verified against src/color/machadoMatrices.ts (protan/deutan) and the
 * colour-science dataset (tritan); see stimulus.test.ts for the <2°
 * ground-truth assertions. All vectors are unit length so one delta unit
 * means the same displacement on every axis.
 *
 * Note: the true protan/deutan directions carry a small luminance component
 * for normal observers. We keep the true directions and mask the residual
 * luminance cue with per-dot jitter (LUMINANCE_JITTER) instead of bending
 * the axis onto the isoluminant plane.
 */
export const AXIS_VECTORS: Readonly<Record<ConfusionAxis, SrgbColor>> = {
  protan: [0.989611, -0.143744, -0.002923],
  deutan: [0.922055, -0.386019, 0.02836],
  'blue-yellow-control': [0.130828, -0.144511, 0.980816],
  'luminance-control': [0.57735, 0.57735, 0.57735],
}

/** Half-amplitude of the per-dot achromatic jitter, in encoded sRGB units. */
export const LUMINANCE_JITTER = 0.035

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
  const jitter = (random() - 0.5) * LUMINANCE_JITTER
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
  // Draw the gap direction from the seeded random stream so it stays
  // independent of the axis and the caller's seed numbering (previously
  // `seed % 4`, which made direction a pure function of trial order).
  const direction = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)]
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
