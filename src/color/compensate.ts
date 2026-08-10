import Color from 'colorjs.io'
import type { SrgbColor } from '../domain/calibration'
import type { CompensationParameters } from '../domain/profile'
import { simulateCvd } from './machado'
import { decodeSrgb } from './srgb'

function assertUnit(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number in [0, 1]`)
  }
}

function colorFromSrgb(color: SrgbColor): Color {
  return new Color('srgb', [color[0], color[1], color[2]])
}

function coordinates(color: Color): readonly [number, number, number] {
  const [first, second, third] = color.coords
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(second) ||
    !Number.isFinite(third)
  ) {
    throw new RangeError('color conversion produced non-finite coordinates')
  }
  return [Number(first), Number(second), Number(third)]
}

export function deltaEOk(first: SrgbColor, second: SrgbColor): number {
  return colorFromSrgb(first).deltaE(colorFromSrgb(second), { method: 'OK' })
}

export function relativeLuminance(color: SrgbColor): number {
  return (
    0.2126 * decodeSrgb(color[0]) +
    0.7152 * decodeSrgb(color[1]) +
    0.0722 * decodeSrgb(color[2])
  )
}

export function compensateColor(
  color: SrgbColor,
  parameters: CompensationParameters,
  strength = parameters.recommendedStrength,
): SrgbColor {
  color.forEach((channel, index) => assertUnit(channel, `color[${index}]`))
  assertUnit(strength, 'strength')

  if (strength === 0 || (color[0] === color[1] && color[1] === color[2])) {
    return color
  }

  const deficiency =
    parameters.deficiency === 'protan' ? 'protan' : 'deutan'
  const simulated = simulateCvd(color, deficiency, parameters.severity)
  const originalLab = coordinates(colorFromSrgb(color).to('oklab'))
  const simulatedLab = coordinates(colorFromSrgb(simulated).to('oklab'))
  const lostRedGreen = originalLab[1] - simulatedLab[1]
  const lostBlueYellow = originalLab[2] - simulatedLab[2]
  const candidate = new Color('oklab', [
    originalLab[0] + lostRedGreen * parameters.lightnessGain * strength,
    originalLab[1],
    originalLab[2] +
      (lostRedGreen + lostBlueYellow * 0.15) *
        parameters.chromaGain *
        strength,
  ])
    .to('srgb')
    .toGamut('srgb')
  const output = coordinates(candidate)

  return [output[0], output[1], output[2]]
}

type ColorPair = readonly [SrgbColor, SrgbColor]

const REFERENCE_PAIRS: readonly ColorPair[] = [
  [
    [0.58, 0.42, 0.2],
    [0.35, 0.53, 0.2],
  ],
  [
    [0.7, 0.32, 0.25],
    [0.42, 0.5, 0.25],
  ],
  [
    [0.45, 0.62, 0.35],
    [0.62, 0.48, 0.35],
  ],
]

const CONTROL_PAIRS: readonly ColorPair[] = [
  [
    [0.2, 0.36, 0.82],
    [0.86, 0.75, 0.18],
  ],
]

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export interface OptimizeCompensationOptions {
  readonly deficiency: CompensationParameters['deficiency']
  readonly severity: number
  readonly recommendedStrength: number
  readonly referencePairs?: readonly ColorPair[]
  readonly controlPairs?: readonly ColorPair[]
}

export function optimizeCompensation({
  deficiency,
  severity,
  recommendedStrength,
  referencePairs = REFERENCE_PAIRS,
  controlPairs = CONTROL_PAIRS,
}: OptimizeCompensationOptions): CompensationParameters {
  const simulationDeficiency = deficiency === 'protan' ? 'protan' : 'deutan'
  let best: CompensationParameters | null = null

  for (const chromaGain of [0, 0.25, 0.5, 0.75]) {
    for (const lightnessGain of [0, 0.01, 0.02]) {
      const candidate: CompensationParameters = {
        deficiency,
        severity,
        recommendedStrength,
        chromaGain,
        lightnessGain,
      }
      const compensatedReferenceColors = referencePairs.flatMap((pair) =>
        pair.map((color) =>
          compensateColor(color, candidate, recommendedStrength),
        ),
      )
      const simulatedSeparation = mean(
        referencePairs.map((pair) =>
          deltaEOk(
            simulateCvd(
              compensateColor(pair[0], candidate, recommendedStrength),
              simulationDeficiency,
              severity,
            ),
            simulateCvd(
              compensateColor(pair[1], candidate, recommendedStrength),
              simulationDeficiency,
              severity,
            ),
          ),
        ),
      )
      const naturalnessCost = mean(
        referencePairs
          .flatMap((pair) => pair)
          .map((color, index) =>
            deltaEOk(color, compensatedReferenceColors[index]!),
          ),
      )
      const luminancePenalty = mean(
        referencePairs
          .flatMap((pair) => pair)
          .map((color, index) =>
            Math.max(
              0,
              Math.abs(
                relativeLuminance(color) -
                  relativeLuminance(compensatedReferenceColors[index]!),
              ) - 0.03,
            ) * 4,
          ),
      )
      const controlAxisPenalty = mean(
        controlPairs.map((pair) => {
          const before = deltaEOk(pair[0], pair[1])
          const after = deltaEOk(
            compensateColor(pair[0], candidate, recommendedStrength),
            compensateColor(pair[1], candidate, recommendedStrength),
          )
          return Math.max(0, before * 0.95 - after) * 2
        }),
      )
      const total =
        -simulatedSeparation +
        0.25 * naturalnessCost +
        luminancePenalty +
        controlAxisPenalty
      const evaluated: CompensationParameters = {
        ...candidate,
        objective: {
          simulatedSeparation,
          naturalnessCost,
          luminancePenalty,
          controlAxisPenalty,
          total,
        },
      }

      if (!best || total < best.objective!.total) {
        best = evaluated
      }
    }
  }

  if (!best) {
    throw new RangeError('optimization requires at least one candidate')
  }
  return best
}
