import { describe, expect, it } from 'vitest'
import type {
  CompensationParameters,
  ThresholdEstimate,
} from '../domain/profile'
import {
  createValidationSession,
  toPublicValidationTrial,
} from './validationSession'

const personalized: CompensationParameters = {
  deficiency: 'deutan',
  severity: 0.7,
  recommendedStrength: 0.8,
  chromaGain: 0.5,
  lightnessGain: 0.01,
}

const thresholds: readonly ThresholdEstimate[] = [
  { axis: 'protan', delta: 0.08, reversalDeltas: [], confidenceInterval: [0.06, 0.1] },
  { axis: 'deutan', delta: 0.1, reversalDeltas: [], confidenceInterval: [0.08, 0.12] },
  { axis: 'blue-yellow-control', delta: 0.04, reversalDeltas: [], confidenceInterval: [0.03, 0.05] },
  { axis: 'luminance-control', delta: 0.02, reversalDeltas: [], confidenceInterval: [0.015, 0.025] },
]

describe('validation session', () => {
  it('uses unseen balanced stimuli in deterministic blind order', () => {
    const options = {
      seed: 91,
      trialsPerCondition: 4,
      excludedSeeds: [91000, 91001],
      personalized,
      thresholds,
    }
    const first = createValidationSession(options)
    const second = createValidationSession(options)

    expect(first).toEqual(second)
    expect(first.some((trial) => options.excludedSeeds.includes(trial.stimulus.seed))).toBe(
      false,
    )
    for (const condition of ['original', 'generic', 'personalized']) {
      expect(first.filter((trial) => trial.condition === condition)).toHaveLength(4)
    }
    expect(toPublicValidationTrial(first[0]!)).not.toHaveProperty('condition')
  })

  it('pairs identical base stimuli across the three conditions', () => {
    const session = createValidationSession({
      seed: 92,
      trialsPerCondition: 4,
      personalized,
      thresholds,
    })
    const bySeed = new Map<number, typeof session>()
    for (const trial of session) {
      const group = bySeed.get(trial.stimulus.seed) ?? []
      bySeed.set(trial.stimulus.seed, [...group, trial])
    }

    expect(bySeed.size).toBe(4)
    for (const group of bySeed.values()) {
      expect(group.map((trial) => trial.condition).sort()).toEqual([
        'generic',
        'original',
        'personalized',
      ])
      const [reference, ...rest] = group
      for (const trial of rest) {
        expect(trial.stimulus.axis).toBe(reference!.stimulus.axis)
        expect(trial.stimulus.delta).toBe(reference!.stimulus.delta)
        expect(trial.stimulus.direction).toBe(reference!.stimulus.direction)
        expect(trial.stimulus.dots.map((dot) => dot.center)).toEqual(
          reference!.stimulus.dots.map((dot) => dot.center),
        )
      }
    }
  })

  it('scales stimulus difficulty from the fitted per-axis thresholds', () => {
    const session = createValidationSession({
      seed: 93,
      trialsPerCondition: 4,
      personalized,
      thresholds,
    })
    const deltaByAxis = new Map(
      session
        .filter((trial) => trial.condition === 'original')
        .map((trial) => [trial.stimulus.axis, trial.stimulus.delta]),
    )

    expect(deltaByAxis.get('protan')).toBeCloseTo(0.08 * 1.25, 5)
    expect(deltaByAxis.get('deutan')).toBeCloseTo(0.1 * 1.25, 5)
    expect(deltaByAxis.get('luminance-control')).toBeCloseTo(0.02 * 1.25, 5)
  })

  it('rejects sessions without a threshold for every axis', () => {
    expect(() =>
      createValidationSession({
        seed: 94,
        trialsPerCondition: 4,
        personalized,
        thresholds: thresholds.slice(0, 2),
      }),
    ).toThrow(RangeError)
  })
})
