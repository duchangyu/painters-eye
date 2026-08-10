import type {
  ConfusionAxis,
  Stimulus,
  TrialResponse,
} from '../domain/calibration'
import type { ThresholdEstimate } from '../domain/profile'
import { createStimulus } from './stimulus'

const AXES: readonly ConfusionAxis[] = [
  'protan',
  'deutan',
  'blue-yellow-control',
  'luminance-control',
]

export interface ScheduledCalibrationTrial {
  readonly id: string
  readonly stimulus: Stimulus
  readonly repeatedFromTrialId?: string
}

export interface PublicCalibrationTrial {
  readonly id: string
  readonly stimulus: Stimulus
}

export interface CreateCalibrationScheduleOptions {
  readonly seed: number
  readonly trialsPerAxis?: number
  readonly repeatCount?: number
}

export function createCalibrationSchedule({
  seed,
  trialsPerAxis = 12,
  repeatCount = 8,
}: CreateCalibrationScheduleOptions): readonly ScheduledCalibrationTrial[] {
  const originals: ScheduledCalibrationTrial[] = []
  const seedBase = (seed >>> 0) * 1000

  for (let round = 0; round < trialsPerAxis; round += 1) {
    AXES.forEach((axis, axisIndex) => {
      const index = round * AXES.length + axisIndex
      originals.push({
        id: `trial-${index + 1}`,
        stimulus: createStimulus({
          seed: seedBase + index,
          axis,
          delta: axis === 'luminance-control' ? 0.035 : 0.08,
        }),
      })
    })
  }

  const repeatCandidates = ['up', 'right', 'down', 'left'].map(
    (direction) =>
      originals.find((trial) => trial.stimulus.direction === direction)!,
  )
  const repeats = Array.from({ length: repeatCount }, (_, index) => {
    const source = repeatCandidates[index % repeatCandidates.length]!
    return {
      id: `trial-${originals.length + index + 1}`,
      stimulus: source.stimulus,
      repeatedFromTrialId: source.id,
    }
  })

  return [...originals, ...repeats]
}

export function toPublicTrial(
  trial: ScheduledCalibrationTrial,
): PublicCalibrationTrial {
  return { id: trial.id, stimulus: trial.stimulus }
}

export interface SessionQuality {
  readonly status: 'complete' | 'needs-more-data'
  readonly repeatDisagreementRate: number
  readonly maxThresholdSpread: number
}

export function assessSessionQuality(
  responses: readonly TrialResponse[],
  thresholds: readonly ThresholdEstimate[],
  repeatDisagreementLimit = 0.25,
  thresholdSpreadLimit = 0.05,
): SessionQuality {
  const responsesById = new Map(
    responses.map((response) => [response.id, response]),
  )
  const repeatPairs = responses.flatMap((response) => {
    if (!response.repeatedFromTrialId) {
      return []
    }
    const original = responsesById.get(response.repeatedFromTrialId)
    return original ? [[original, response] as const] : []
  })
  const disagreements = repeatPairs.filter(
    ([original, repeated]) => original.correct !== repeated.correct,
  ).length
  const repeatDisagreementRate =
    repeatPairs.length === 0 ? 0 : disagreements / repeatPairs.length
  const maxThresholdSpread = Math.max(
    0,
    ...thresholds.map((threshold) => {
      if (threshold.reversalDeltas.length === 0) {
        return 0
      }
      return (
        Math.max(...threshold.reversalDeltas) -
        Math.min(...threshold.reversalDeltas)
      )
    }),
  )
  const needsMoreData =
    repeatDisagreementRate > repeatDisagreementLimit ||
    maxThresholdSpread > thresholdSpreadLimit

  return {
    status: needsMoreData ? 'needs-more-data' : 'complete',
    repeatDisagreementRate,
    maxThresholdSpread,
  }
}
