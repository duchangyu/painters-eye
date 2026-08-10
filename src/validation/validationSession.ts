import { relativeLuminance, compensateColor } from '../color/compensate'
import { createStimulus } from '../calibration/stimulus'
import type {
  ConfusionAxis,
  SrgbColor,
  Stimulus,
} from '../domain/calibration'
import type { CompensationParameters } from '../domain/profile'
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
  trialsPerCondition = 8,
  excludedSeeds = [],
}: CreateValidationSessionOptions): readonly ValidationTrial[] {
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

  CONDITIONS.forEach((condition, conditionIndex) => {
    for (let index = 0; index < trialsPerCondition; index += 1) {
      while (excluded.has(stimulusSeed)) {
        stimulusSeed += 1
      }
      const axis = AXES[index % AXES.length]!
      const original = createStimulus({
        seed: stimulusSeed,
        axis,
        delta: axis === 'luminance-control' ? 0.03 : 0.065,
      })
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
        id: `validation-${conditionIndex}-${index}`,
        stimulus,
        condition,
      })
      stimulusSeed += 1
    }
  })

  return shuffle(trials, createSeededRandom(seed + 17))
}

export function toPublicValidationTrial(
  trial: ValidationTrial,
): PublicValidationTrial {
  return { id: trial.id, stimulus: trial.stimulus }
}
