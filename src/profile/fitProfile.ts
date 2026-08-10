import type {
  ConfusionAxis,
  StaircaseState,
  TrialResponse,
} from '../domain/calibration'
import type {
  CompensationParameters,
  ThresholdEstimate,
} from '../domain/profile'
import { optimizeCompensation } from '../color/compensate'

const TARGET_AXES = ['protan', 'deutan'] as const
const CONTROL_AXES = [
  'blue-yellow-control',
  'luminance-control',
] as const

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError('cannot compute a median without values')
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Estimates the threshold for one axis from the staircase that drove it.
 *
 * The staircase's recorded reversal deltas are the evidence (median of the
 * last six); when the staircase reversed fewer than twice, we fall back to
 * per-trial performance estimates nudged by half of the staircase's own step
 * size. Trials are only used here for the fallback and sanity checks — the
 * 2-down-1-up rule is NOT replayed (that logic lives in staircase.ts).
 */
function estimateAxis(
  trials: readonly TrialResponse[],
  staircase: StaircaseState,
): ThresholdEstimate {
  const axis = staircase.axis
  const selected = trials.filter(
    (trial) => trial.stimulus.axis === axis && !trial.repeatedFromTrialId,
  )
  if (selected.length === 0) {
    throw new RangeError(`cannot estimate ${axis} without trials`)
  }
  const performanceEstimates = selected.slice(-6).map((trial) =>
    Math.min(
      0.25,
      Math.max(
        0.005,
        trial.stimulus.delta +
          (trial.correct ? -1 : 1) * staircase.stepSize * 0.5,
      ),
    ),
  )
  const reversalDeltas = staircase.reversals
  const evidence =
    reversalDeltas.length >= 2
      ? reversalDeltas.slice(-6)
      : performanceEstimates
  const delta = median(evidence)
  const absoluteDeviations = evidence.map((value) => Math.abs(value - delta))
  const margin = Math.max(0.005, median(absoluteDeviations))

  return {
    axis,
    delta,
    reversalDeltas,
    confidenceInterval: [
      Math.max(0, delta - margin),
      Math.min(0.25, delta + margin),
    ],
  }
}

export function calculateRepeatConsistency(
  trials: readonly TrialResponse[],
): number {
  const trialsById = new Map(trials.map((trial) => [trial.id, trial]))
  const repeats = trials.flatMap((trial) => {
    if (!trial.repeatedFromTrialId) {
      return []
    }
    const original = trialsById.get(trial.repeatedFromTrialId)
    return original ? [original.correct === trial.correct] : []
  })

  return repeats.length === 0
    ? 0.75
    : repeats.filter(Boolean).length / repeats.length
}

export interface FittedBehavioralProfile extends CompensationParameters {
  readonly confidence: number
  readonly classification: 'behavioral-personalization'
  readonly thresholds: readonly ThresholdEstimate[]
}

export function fitProfile(
  trials: readonly TrialResponse[],
  staircases: readonly StaircaseState[],
): FittedBehavioralProfile {
  const staircaseByAxis = new Map(
    staircases.map((staircase) => [staircase.axis, staircase]),
  )
  const thresholds = [...TARGET_AXES, ...CONTROL_AXES].map((axis) => {
    const staircase = staircaseByAxis.get(axis)
    if (!staircase) {
      throw new RangeError(`no staircase recorded for ${axis}`)
    }
    return estimateAxis(trials, staircase)
  })
  const protan = thresholds[0]!
  const deutan = thresholds[1]!
  const controlThreshold = median([thresholds[2]!.delta, thresholds[3]!.delta])
  const protanSeparated =
    protan.confidenceInterval[0] > deutan.confidenceInterval[1]
  const deutanSeparated =
    deutan.confidenceInterval[0] > protan.confidenceInterval[1]
  const deficiency = protanSeparated
    ? 'protan'
    : deutanSeparated
      ? 'deutan'
      : 'mixed'
  const dominantThreshold = Math.max(protan.delta, deutan.delta)
  const normalizedExcess = dominantThreshold / Math.max(controlThreshold, 0.005) - 1
  const severity = clampUnit(normalizedExcess / 3)
  const repeatScore = calculateRepeatConsistency(trials)
  const sampleScore = clampUnit(
    trials.filter(
      (trial) =>
        trial.stimulus.axis === 'protan' || trial.stimulus.axis === 'deutan',
    ).length / 24,
  )
  const reversalScore = mean(
    thresholds.map((threshold) =>
      clampUnit(threshold.reversalDeltas.length / 4),
    ),
  )
  const confidence = clampUnit(
    0.55 * repeatScore + 0.25 * sampleScore + 0.2 * reversalScore,
  )
  const optimized = optimizeCompensation({
    deficiency,
    severity,
    recommendedStrength: 0.5 + severity * 0.4,
  })

  return {
    ...optimized,
    confidence,
    classification: 'behavioral-personalization',
    thresholds,
  }
}
