import { relativeLuminance, compensateColor } from '../color/compensate'
import { createStimulus } from '../calibration/stimulus'
import type {
  ConfusionAxis,
  SrgbColor,
  Stimulus,
} from '../domain/calibration'
import type {
  CompensationParameters,
  ThresholdEstimate,
} from '../domain/profile'
import { createSeededRandom } from '../lib/random'

export type ValidationCondition = 'original' | 'generic' | 'personalized'

export interface ValidationTrial {
  readonly id: string
  readonly stimulus: Stimulus
  readonly condition: ValidationCondition
}

export interface PublicValidationTrial {
  readonly id: string
  readonly stimulus: Stimulus
}

export interface CreateValidationSessionOptions {
  readonly seed: number
  readonly personalized: CompensationParameters
  /**
   * Fitted per-axis thresholds from calibration. Each paired stimulus is
   * rendered at a fixed multiple of the user's own threshold for that axis,
   * so difficulty tracks the individual instead of a population constant.
   */
  readonly thresholds: readonly ThresholdEstimate[]
  readonly trialsPerCondition?: number
  readonly excludedSeeds?: readonly number[]
}

const CONDITIONS: readonly ValidationCondition[] = [
  'original',
  'generic',
  'personalized',
]

const AXES: readonly ConfusionAxis[] = [
  'protan',
  'deutan',
  'blue-yellow-control',
  'luminance-control',
]

/**
 * Paired trials sit just above the measured threshold: hard enough to
 * discriminate the conditions, easy enough to stay answerable.
 */
const DIFFICULTY_FACTOR = 1.25
const MIN_DELTA = 0.005
const MAX_DELTA = 0.25

function mapStimulus(
  stimulus: Stimulus,
  transform: (color: SrgbColor) => SrgbColor,
): Stimulus {
  const foregroundColor = transform(stimulus.foregroundColor)
  const backgroundColor = transform(stimulus.backgroundColor)
  return {
    ...stimulus,
    foregroundColor,
    backgroundColor,
    foregroundLuminance: relativeLuminance(foregroundColor),
    backgroundLuminance: relativeLuminance(backgroundColor),
    dots: stimulus.dots.map((dot) => ({
      ...dot,
      color: transform(dot.color),
    })),
  }
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ]
  }
  return shuffled
}

export function createValidationSession({
  seed,
  personalized,
  thresholds,
  trialsPerCondition = 8,
  excludedSeeds = [],
}: CreateValidationSessionOptions): readonly ValidationTrial[] {
  const thresholdByAxis = new Map(
    thresholds.map((threshold) => [threshold.axis, threshold.delta]),
  )
  const excluded = new Set(excludedSeeds)
  const generic: CompensationParameters = {
    deficiency: personalized.deficiency,
    severity: 0.6,
    recommendedStrength: 0.7,
    chromaGain: 0.35,
    lightnessGain: 0.01,
  }
  let stimulusSeed = (seed >>> 0) * 1000 + 1_000_000
  const trials: ValidationTrial[] = []

  // Paired design: every slot contributes the SAME underlying stimulus under
  // all three conditions (identical seed, axis, delta, gap direction, dot
  // geometry; only the color transform differs). Accuracy differences then
  // reflect the transform, not the luck of drawing different stimuli.
  for (let slot = 0; slot < trialsPerCondition; slot += 1) {
    while (excluded.has(stimulusSeed)) {
      stimulusSeed += 1
    }
    const axis = AXES[slot % AXES.length]!
    const threshold = thresholdByAxis.get(axis)
    if (threshold === undefined) {
      throw new RangeError(`no fitted threshold available for ${axis}`)
    }
    const delta = Math.min(
      MAX_DELTA,
      Math.max(MIN_DELTA, threshold * DIFFICULTY_FACTOR),
    )
    const original = createStimulus({ seed: stimulusSeed, axis, delta })
    for (const condition of CONDITIONS) {
      const stimulus =
        condition === 'original'
          ? original
          : mapStimulus(original, (color) =>
              compensateColor(
                color,
                condition === 'generic' ? generic : personalized,
              ),
            )
      trials.push({
        id: `validation-${slot}-${condition}`,
        stimulus,
        condition,
      })
    }
    stimulusSeed += 1
  }

  return shuffle(trials, createSeededRandom(seed + 17))
}

export function toPublicValidationTrial(
  trial: ValidationTrial,
): PublicValidationTrial {
  return { id: trial.id, stimulus: trial.stimulus }
}
