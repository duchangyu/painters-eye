import { describe, expect, it } from 'vitest'
import {
  evaluateValidation,
  summarizeValidation,
  type ValidationResponse,
} from './metrics'

const responses: readonly ValidationResponse[] = [
  { condition: 'original', axis: 'deutan', correct: true, reactionTimeMs: 1100 },
  { condition: 'original', axis: 'deutan', correct: false, reactionTimeMs: 1300 },
  { condition: 'generic', axis: 'deutan', correct: true, reactionTimeMs: 1050 },
  { condition: 'generic', axis: 'deutan', correct: false, reactionTimeMs: 1150 },
  { condition: 'personalized', axis: 'deutan', correct: true, reactionTimeMs: 800 },
  { condition: 'personalized', axis: 'deutan', correct: true, reactionTimeMs: 900 },
  {
    condition: 'original',
    axis: 'blue-yellow-control',
    correct: true,
    reactionTimeMs: 900,
  },
  {
    condition: 'personalized',
    axis: 'blue-yellow-control',
    correct: true,
    reactionTimeMs: 850,
  },
]

describe('validation metrics', () => {
  it('computes accuracy, median time, and improvement deltas', () => {
    const summary = summarizeValidation(responses, 0.9)
    expect(summary.byCondition.original.accuracy).toBeCloseTo(2 / 3)
    expect(summary.byCondition.personalized.medianReactionTimeMs).toBe(850)
    expect(summary.accuracyImprovement).toBeGreaterThan(0)
    expect(summary.confidence).toBe('high')
  })

  it('passes only when personalization wins without damaging controls', () => {
    expect(evaluateValidation(summarizeValidation(responses, 0.9)).passed).toBe(true)
  })

  it('does not let the generic reference veto a genuinely helpful transform', () => {
    const responses: readonly ValidationResponse[] = [
      { condition: 'original', axis: 'deutan', correct: false, reactionTimeMs: 1100 },
      { condition: 'original', axis: 'deutan', correct: false, reactionTimeMs: 1200 },
      { condition: 'generic', axis: 'deutan', correct: true, reactionTimeMs: 900 },
      { condition: 'generic', axis: 'deutan', correct: true, reactionTimeMs: 950 },
      { condition: 'personalized', axis: 'deutan', correct: true, reactionTimeMs: 800 },
      { condition: 'personalized', axis: 'deutan', correct: false, reactionTimeMs: 900 },
      { condition: 'original', axis: 'blue-yellow-control', correct: true, reactionTimeMs: 900 },
      { condition: 'personalized', axis: 'blue-yellow-control', correct: true, reactionTimeMs: 850 },
    ]
    // generic 100% > personalized 50%, but personalized 50% > original 0%:
    // the tiny generic sample no longer vetoes a helpful transform.
    expect(summarizeValidation(responses, 0.9).passed).toBe(true)
  })

  it('fails when personalization does not beat the original', () => {
    const tied: readonly ValidationResponse[] = [
      { condition: 'original', axis: 'deutan', correct: true, reactionTimeMs: 1100 },
      { condition: 'personalized', axis: 'deutan', correct: true, reactionTimeMs: 800 },
    ]
    expect(summarizeValidation(tied, 0.9).passed).toBe(false)
  })

  it('fails when personalization damages control colors', () => {
    const damaged: readonly ValidationResponse[] = [
      { condition: 'original', axis: 'deutan', correct: false, reactionTimeMs: 1100 },
      { condition: 'original', axis: 'blue-yellow-control', correct: true, reactionTimeMs: 900 },
      { condition: 'personalized', axis: 'deutan', correct: true, reactionTimeMs: 800 },
      { condition: 'personalized', axis: 'blue-yellow-control', correct: false, reactionTimeMs: 850 },
    ]
    expect(summarizeValidation(damaged, 0.9).passed).toBe(false)
  })
})
