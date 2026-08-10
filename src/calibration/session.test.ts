import { describe, expect, it } from 'vitest'
import type { TrialResponse } from '../domain/calibration'
import type { ThresholdEstimate } from '../domain/profile'
import {
  assessSessionQuality,
  createCalibrationSchedule,
  toPublicTrial,
} from './session'

describe('calibration session scheduling', () => {
  it('is deterministic, interleaves axes, and balances original orientations', () => {
    const first = createCalibrationSchedule({
      seed: 23,
      trialsPerAxis: 4,
      repeatCount: 4,
    })
    const second = createCalibrationSchedule({
      seed: 23,
      trialsPerAxis: 4,
      repeatCount: 4,
    })
    expect(first).toEqual(second)

    const originals = first.filter((trial) => !trial.repeatedFromTrialId)
    expect(originals.slice(0, 4).map((trial) => trial.stimulus.axis)).toEqual([
      'protan',
      'deutan',
      'blue-yellow-control',
      'luminance-control',
    ])

    const directionCounts = ['up', 'right', 'down', 'left'].map(
      (direction) =>
        originals.filter((trial) => trial.stimulus.direction === direction)
          .length,
    )
    expect(directionCounts).toEqual([4, 4, 4, 4])
    expect(first.filter((trial) => trial.repeatedFromTrialId)).toHaveLength(4)
    expect(toPublicTrial(first.at(-1)!)).not.toHaveProperty('repeatedFromTrialId')
  })
})

describe('assessSessionQuality', () => {
  const threshold: ThresholdEstimate = {
    axis: 'deutan',
    delta: 0.05,
    reversalDeltas: [0.04, 0.05, 0.06],
    confidenceInterval: [0.04, 0.06],
  }

  it('requests more data when repeat answers disagree', () => {
    const responses = [
      { id: 'trial-1', correct: true },
      { id: 'trial-2', correct: false, repeatedFromTrialId: 'trial-1' },
    ] as TrialResponse[]

    expect(assessSessionQuality(responses, [threshold]).status).toBe(
      'needs-more-data',
    )
  })
})
