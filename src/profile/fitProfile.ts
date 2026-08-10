import type {
  ConfusionAxis,
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

function estimateAxis(
  trials: readonly TrialResponse[],
  axis: ConfusionAxis,
): ThresholdEstimate {
  const deltas = trials
    .filter((trial) => trial.stimulus.axis === axis)
    .map((trial) => trial.stimulus.delta)
  const delta = median(deltas)
  const absoluteDeviations = deltas.map((value) => Math.abs(value - delta))
  const margin = Math.max(0.005, median(absoluteDeviations))

  return {
    axis,
    delta,
    reversalDeltas: deltas,
    confidenceInterval: [
      Math.max(0, delta - margin),
      Math.min(0.25, delta + margin),
    ],
  }
}

function repeatConsistency(trials: readonly TrialResponse[]): number {
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
): FittedBehavioralProfile {
  const thresholds = [...TARGET_AXES, ...CONTROL_AXES].map((axis) =>
    estimateAxis(trials, axis),
  )
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
  const repeatScore = repeatConsistency(trials)
  const sampleScore = clampUnit(
    trials.filter(
      (trial) =>
        trial.stimulus.axis === 'protan' || trial.stimulus.axis === 'deutan',
    ).length / 24,
  )
  const confidence = clampUnit(0.8 * repeatScore + 0.2 * sampleScore)
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
