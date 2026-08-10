import { describe, expect, it } from 'vitest'
import type { CalibrationProfileV1 } from '../domain/profile'
import { parseCalibrationProfile } from './profileSchema'

function validProfile(): CalibrationProfileV1 {
  return {
    schemaVersion: 1,
    id: 'profile-1',
    algorithmVersion: '1.1.0-mvp-adaptive',
    createdAt: '2026-08-10T00:02:00.000Z',
    displayFingerprint: 'display-abc',
    displayConditions: {
      displayNickname: 'Studio Display',
      brightnessDescription: '50%',
      nightShiftOff: true,
      trueToneOff: true,
      colorFiltersOff: true,
      screenWidthPx: 1920,
      screenHeightPx: 1080,
      colorDepth: 24,
      pixelRatio: 2,
      recordedAt: '2026-08-10T00:00:00.000Z',
    },
    sourceSessionId: 'session-1',
    rawTrials: [
      {
        id: 'trial-1',
        stimulus: {
          id: 'stimulus-1',
          seed: 1,
          axis: 'deutan',
          direction: 'up',
          delta: 0.08,
          foregroundColor: [0.6, 0.4, 0.3],
          backgroundColor: [0.4, 0.6, 0.3],
          foregroundLuminance: 0.2,
          backgroundLuminance: 0.25,
          dots: [
            {
              center: [0.5, 0.5],
              radius: 0.01,
              role: 'foreground',
              color: [0.6, 0.4, 0.3],
            },
          ],
        },
        selectedDirection: 'up',
        correct: true,
        reactionTimeMs: 750,
        answeredAt: '2026-08-10T00:01:00.000Z',
      },
    ],
    thresholds: [
      {
        axis: 'deutan',
        delta: 0.08,
        reversalDeltas: [0.1, 0.08],
        confidenceInterval: [0.06, 0.1],
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
    lut: { size: 2, data: Array.from({ length: 24 }, () => 0.5) },
  }
}

describe('parseCalibrationProfile', () => {
  it('accepts a well-formed profile', () => {
    expect(parseCalibrationProfile(validProfile())).toEqual(validProfile())
  })

  it('rejects profiles missing rendering-critical fields', () => {
    const broken = validProfile() as unknown as Record<string, unknown>
    delete broken['compensation']
    expect(() => parseCalibrationProfile(broken)).toThrow()
  })

  it('rejects out-of-range compensation parameters', () => {
    const profile = validProfile()
    const broken = {
      ...profile,
      compensation: { ...profile.compensation, chromaGain: 7 },
    }
    expect(() => parseCalibrationProfile(broken)).toThrow()
  })

  it('rejects a LUT whose data does not match its size', () => {
    const broken = { ...validProfile(), lut: { size: 17, data: [0, 0, 0] } }
    expect(() => parseCalibrationProfile(broken)).toThrow()
  })

  it('rejects trials with malformed stimuli', () => {
    const profile = validProfile()
    const broken = {
      ...profile,
      rawTrials: [
        { ...profile.rawTrials[0]!, stimulus: { id: 'x' } as never },
      ],
    }
    expect(() => parseCalibrationProfile(broken)).toThrow()
  })

  it('rejects non-objects and empty trial lists', () => {
    expect(() => parseCalibrationProfile('nope')).toThrow()
    expect(() =>
      parseCalibrationProfile({ ...validProfile(), rawTrials: [] }),
    ).toThrow()
  })
})
