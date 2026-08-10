import { describe, expect, it } from 'vitest'
import { createStimulus } from '../calibration/stimulus'
import type { ConfusionAxis, TrialResponse } from '../domain/calibration'
import { fitProfile } from './fitProfile'

function response(
  id: string,
  axis: ConfusionAxis,
  delta: number,
  correct: boolean,
  repeatedFromTrialId?: string,
): TrialResponse {
  const stimulus = createStimulus({
    seed: Number(id.replace(/\D/g, '')) || 1,
    axis,
    delta,
  })
  return {
    id,
    stimulus,
    selectedDirection: correct ? stimulus.direction : 'left',
    correct,
    reactionTimeMs: 800,
    answeredAt: '2026-08-10T00:00:00.000Z',
    repeatedFromTrialId,
  }
}

const baseTrials = [
  response('p1', 'protan', 0.04, true),
  response('p2', 'protan', 0.05, true),
  response('d1', 'deutan', 0.12, true),
  response('d2', 'deutan', 0.13, true),
  response('c1', 'blue-yellow-control', 0.03, true),
  response('c2', 'luminance-control', 0.03, true),
]

describe('fitProfile', () => {
  it('selects a bounded behavioral deutan profile', () => {
    const profile = fitProfile([
      ...baseTrials,
      response('repeat-1', 'deutan', 0.12, true, 'd1'),
    ])

    expect(profile.deficiency).toBe('deutan')
    expect(profile.severity).toBeGreaterThan(0)
    expect(profile.severity).toBeLessThanOrEqual(1)
    expect(profile.chromaGain).toBeGreaterThanOrEqual(0)
    expect(profile.chromaGain).toBeLessThanOrEqual(1)
    expect(profile.classification).toBe('behavioral-personalization')
    expect(profile.objective?.total).toBeTypeOf('number')
  })

  it('reports lower confidence for inconsistent repeats', () => {
    const consistent = fitProfile([
      ...baseTrials,
      response('repeat-1', 'deutan', 0.12, true, 'd1'),
    ])
    const inconsistent = fitProfile([
      ...baseTrials,
      response('repeat-2', 'deutan', 0.12, false, 'd1'),
    ])

    expect(consistent.confidence).toBeGreaterThan(inconsistent.confidence)
  })
})
