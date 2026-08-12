import type { ConfusionAxis, TrialResponse } from '../domain/calibration'
import { createSeededRandom } from '../lib/random'
import type { PublicCalibrationTrial } from './session'
import { createStimulus } from './stimulus'

/**
 * Fast-track screening: 8 graded Landolt-C trials that route a first-time
 * user to a generic preset instead of the full 56-trial calibration. This is
 * a triage, not a measurement — the result page always says so in plain
 * language and offers the precise path as an upgrade.
 *
 * Each target axis (protan/deutan) gets three trials at descending deltas.
 * The hardest level passed decides the severity band for that axis; the
 * worse of the two axes decides the deficiency type. Two control trials
 * (blue-yellow, luminance) catch unreliable sessions — a respondent who
 * misses both should re-check their display, not receive a preset.
 */

const TARGET_AXES = ['protan', 'deutan'] as const
type TargetAxis = (typeof TARGET_AXES)[number]

/** Easy → hard. 0.10 is visible to most anomalous trichromats; 0.025 is not. */
const GRADED_DELTAS = [0.1, 0.05, 0.025] as const

const CONTROL_TRIALS = [
  { axis: 'blue-yellow-control', delta: 0.06 },
  { axis: 'luminance-control', delta: 0.06 },
] as const satisfies readonly { axis: ConfusionAxis; delta: number }[]

export interface ScreeningResponse {
  readonly trialId: string
  readonly axis: ConfusionAxis
  readonly delta: number
  readonly correct: boolean
}

export type ScreeningOutcome =
  | { readonly kind: 'preset'; readonly presetId: string }
  | { readonly kind: 'normal-vision' }
  | { readonly kind: 'unreliable' }

export function createScreeningTrials(
  seed: number,
): readonly PublicCalibrationTrial[] {
  const specs: readonly { axis: ConfusionAxis; delta: number }[] = [
    ...TARGET_AXES.flatMap((axis) =>
      GRADED_DELTAS.map((delta) => ({ axis: axis as ConfusionAxis, delta })),
    ),
    ...CONTROL_TRIALS,
  ]
  // Seeded shuffle so the difficulty gradient and axis alternation are not
  // predictable from trial order.
  const random = createSeededRandom(seed >>> 0)
  const shuffled = [...specs]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1))
    const current = shuffled[index]!
    shuffled[index] = shuffled[swapWith]!
    shuffled[swapWith] = current
  }
  const seedBase = (seed >>> 0) * 100
  return shuffled.map((spec, index) => ({
    id: `screening-${index + 1}`,
    stimulus: createStimulus({
      seed: seedBase + index,
      axis: spec.axis,
      delta: spec.delta,
    }),
  }))
}

function isTargetAxis(axis: ConfusionAxis): axis is TargetAxis {
  return axis === 'protan' || axis === 'deutan'
}

/**
 * Hardest level passed per axis: 0 = none, 1 = 0.10, 2 = 0.05, 3 = 0.025.
 * Levels must be passed contiguously from the easiest: a respondent who
 * misses 0.10 but luckily guesses 0.025 (25% chance per trial) is still
 * band 0, not "normal".
 */
function axisLevel(
  axis: TargetAxis,
  responses: readonly ScreeningResponse[],
): number {
  const own = responses.filter((response) => response.axis === axis)
  let level = 0
  for (let index = 0; index < GRADED_DELTAS.length; index += 1) {
    const trial = own.find((response) => response.delta === GRADED_DELTAS[index])
    if (!trial?.correct) {
      break
    }
    level = index + 1
  }
  return level
}

const BAND_BY_LEVEL = ['severe', 'moderate', 'mild'] as const

export function assessScreening(
  responses: readonly ScreeningResponse[],
): ScreeningOutcome {
  const controlMisses = responses.filter(
    (response) => !isTargetAxis(response.axis) && !response.correct,
  ).length
  if (controlMisses >= CONTROL_TRIALS.length) {
    return { kind: 'unreliable' }
  }

  const levels = TARGET_AXES.map((axis) => axisLevel(axis, responses))
  const worst = Math.min(...levels)
  if (worst >= GRADED_DELTAS.length) {
    return { kind: 'normal-vision' }
  }
  const deficiency =
    levels[0] === levels[1]
      ? 'mixed'
      : levels[0]! < levels[1]!
        ? 'protan'
        : 'deutan'
  return {
    kind: 'preset',
    presetId: `${deficiency}-${BAND_BY_LEVEL[worst]!}`,
  }
}

export function toScreeningResponse(
  trial: PublicCalibrationTrial,
  answer: Pick<TrialResponse, 'selectedDirection'>,
): ScreeningResponse {
  return {
    trialId: trial.id,
    axis: trial.stimulus.axis,
    delta: trial.stimulus.delta,
    correct: answer.selectedDirection === trial.stimulus.direction,
  }
}
