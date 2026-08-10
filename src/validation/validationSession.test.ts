import { describe, expect, it } from 'vitest'
import type { CompensationParameters } from '../domain/profile'
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

describe('validation session', () => {
  it('uses unseen balanced stimuli in deterministic blind order', () => {
    const options = {
      seed: 91,
      trialsPerCondition: 4,
      excludedSeeds: [91000, 91001],
      personalized,
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
})
