import { describe, expect, it } from 'vitest'
import type { CalibrationProfileV1 } from '../domain/profile'
import {
  assessQuickCheck,
  createQuickCheckTrials,
  quickCheckRequirement,
  type QuickCheckResponse,
} from './quickCheck'

function profile(): CalibrationProfileV1 {
  return {
    schemaVersion: 1,
    id: 'profile-quick',
    algorithmVersion: '1.0.0',
    createdAt: '2026-07-20T00:00:00.000Z',
    displayFingerprint: 'studio|1920x1080|24|2',
    displayConditions: {
      displayNickname: 'Studio',
      brightnessDescription: '50%',
      nightShiftOff: true,
      trueToneOff: true,
      colorFiltersOff: true,
      screenWidthPx: 1920,
      screenHeightPx: 1080,
      colorDepth: 24,
      pixelRatio: 2,
      recordedAt: '2026-07-20T00:00:00.000Z',
    },
    sourceSessionId: 'session-quick',
    rawTrials: [],
    thresholds: [
      {
        axis: 'protan',
        delta: 0.04,
        reversalDeltas: [0.04],
        confidenceInterval: [0.03, 0.05],
      },
      {
        axis: 'deutan',
        delta: 0.1,
        reversalDeltas: [0.1],
        confidenceInterval: [0.08, 0.12],
      },
      {
        axis: 'blue-yellow-control',
        delta: 0.04,
        reversalDeltas: [0.04],
        confidenceInterval: [0.03, 0.05],
      },
      {
        axis: 'luminance-control',
        delta: 0.03,
        reversalDeltas: [0.03],
        confidenceInterval: [0.02, 0.04],
      },
    ],
    compensation: {
      deficiency: 'deutan',
      severity: 0.6,
      recommendedStrength: 0.75,
      chromaGain: 0.5,
      lightnessGain: 0.01,
    },
    confidence: 0.84,
    lut: { size: 2, data: Array.from({ length: 24 }, () => 0) },
  }
}

describe('quick checks', () => {
  it('creates a short seeded dominant-axis and control set', () => {
    const first = createQuickCheckTrials(profile(), 91)
    const second = createQuickCheckTrials(profile(), 91)
    expect(first).toEqual(second)
    expect(first).toHaveLength(8)
    expect(first.filter((trial) => trial.stimulus.axis === 'deutan')).toHaveLength(
      4,
    )
    expect(
      first.filter((trial) => trial.stimulus.axis.includes('control')),
    ).toHaveLength(4)
  })

  it.each([
    [[true, true, true, true, true, true, true, true], 'pass'],
    [[true, true, false, false, true, true, false, false], 'review-display-settings'],
    [[true, false, false, false, true, false, false, false], 'recalibrate'],
  ] as const)('classifies performance %j as %s', (answers, expected) => {
    const trials = createQuickCheckTrials(profile(), 91)
    const responses: QuickCheckResponse[] = trials.map((trial, index) => ({
      trialId: trial.id,
      axis: trial.stimulus.axis,
      correct: answers[index]!,
    }))
    expect(assessQuickCheck(profile(), responses).status).toBe(expected)
  })

  it('runs only after the interval, except when the display changes', () => {
    expect(
      quickCheckRequirement({
        profile: profile(),
        currentDisplayFingerprint: profile().displayFingerprint,
        lastCheckedAt: '2026-08-01T00:00:00.000Z',
        now: new Date('2026-08-10T00:00:00.000Z'),
        intervalDays: 30,
      }),
    ).toBe('not-due')
    expect(
      quickCheckRequirement({
        profile: profile(),
        currentDisplayFingerprint: 'other|1920x1080|24|2',
        lastCheckedAt: '2026-08-09T00:00:00.000Z',
        now: new Date('2026-08-10T00:00:00.000Z'),
      }),
    ).toBe('display-changed')
    expect(
      quickCheckRequirement({
        profile: profile(),
        currentDisplayFingerprint: profile().displayFingerprint,
        lastCheckedAt: '2026-06-01T00:00:00.000Z',
        now: new Date('2026-08-10T00:00:00.000Z'),
        intervalDays: 30,
      }),
    ).toBe('interval-elapsed')
  })
})
