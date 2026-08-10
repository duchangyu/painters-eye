import { describe, expect, it } from 'vitest'
import { createStimulus } from '../calibration/stimulus'
import type {
  ConfusionAxis,
  StaircaseState,
  TrialResponse,
} from '../domain/calibration'
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

function staircase(
  axis: ConfusionAxis,
  reversals: readonly number[] = [],
): StaircaseState {
  return {
    axis,
    delta: reversals.at(-1) ?? 0.12,
    minDelta: 0.005,
    maxDelta: 0.25,
    stepSize: 0.018,
    consecutiveCorrect: 0,
    lastMovement: null,
    reversals,
    trialCount: 12,
    maxTrials: 12,
    targetReversals: 8,
    status: 'complete',
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

const baseStaircases = [
  staircase('protan', [0.06, 0.04, 0.05, 0.045]),
  staircase('deutan', [0.12, 0.1, 0.11, 0.09]),
  staircase('blue-yellow-control', [0.04, 0.03, 0.035, 0.03]),
  staircase('luminance-control', [0.035, 0.03, 0.03, 0.025]),
]

describe('fitProfile', () => {
  it('selects a bounded behavioral deutan profile', () => {
    const profile = fitProfile(
      [...baseTrials, response('repeat-1', 'deutan', 0.12, true, 'd1')],
      baseStaircases,
    )

    expect(profile.deficiency).toBe('deutan')
    expect(profile.severity).toBeGreaterThan(0)
    expect(profile.severity).toBeLessThanOrEqual(1)
    expect(profile.chromaGain).toBeGreaterThanOrEqual(0)
    expect(profile.chromaGain).toBeLessThanOrEqual(1)
    expect(profile.classification).toBe('behavioral-personalization')
    expect(profile.objective?.total).toBeTypeOf('number')
  })

  it('takes threshold evidence from the staircase reversals', () => {
    const profile = fitProfile(baseTrials, baseStaircases)
    const deutan = profile.thresholds.find(
      (threshold) => threshold.axis === 'deutan',
    )!
    const protan = profile.thresholds.find(
      (threshold) => threshold.axis === 'protan',
    )!

    expect(deutan.reversalDeltas).toEqual([0.12, 0.1, 0.11, 0.09])
    expect(deutan.delta).toBeGreaterThan(0.09)
    expect(deutan.delta).toBeLessThan(0.12)
    expect(protan.delta).toBeLessThan(deutan.delta)
  })

  it('reports lower confidence for inconsistent repeats', () => {
    const consistent = fitProfile(
      [...baseTrials, response('repeat-1', 'deutan', 0.12, true, 'd1')],
      baseStaircases,
    )
    const inconsistent = fitProfile(
      [...baseTrials, response('repeat-2', 'deutan', 0.12, false, 'd1')],
      baseStaircases,
    )

    expect(consistent.confidence).toBeGreaterThan(inconsistent.confidence)
  })

  it('estimates a higher threshold when the same color differences are missed', () => {
    const seen = [0.12, 0.1, 0.08, 0.06, 0.04, 0.03].map((delta, index) =>
      response(`seen-${index}`, 'deutan', delta, true),
    )
    const missed = [0.12, 0.1, 0.08, 0.06, 0.04, 0.03].map(
      (delta, index) => response(`missed-${index}`, 'deutan', delta, false),
    )
    const controls = [
      response('control-b', 'blue-yellow-control', 0.03, true),
      response('control-l', 'luminance-control', 0.03, true),
      response('protan-a', 'protan', 0.04, true),
    ]
    // No reversal evidence: thresholds come from the per-trial fallback.
    const fallbackStaircases = [
      staircase('protan'),
      staircase('deutan'),
      staircase('blue-yellow-control'),
      staircase('luminance-control'),
    ]

    const seenThreshold = fitProfile(
      [...controls, ...seen],
      fallbackStaircases,
    ).thresholds.find((threshold) => threshold.axis === 'deutan')!
    const missedThreshold = fitProfile(
      [...controls, ...missed],
      fallbackStaircases,
    ).thresholds.find((threshold) => threshold.axis === 'deutan')!

    expect(missedThreshold.delta).toBeGreaterThan(seenThreshold.delta)
  })

  it('rejects fitting without a staircase for every axis', () => {
    expect(() => fitProfile(baseTrials, [staircase('protan')])).toThrow(
      RangeError,
    )
  })
})
