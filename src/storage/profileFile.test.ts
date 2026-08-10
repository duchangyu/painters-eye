import { describe, expect, it } from 'vitest'
import type { CalibrationProfileV1 } from '../domain/profile'
import { exportProfileFile, importProfileFile } from './profileFile'

function profile(): CalibrationProfileV1 {
  return {
    schemaVersion: 1,
    id: 'profile-file-1',
    algorithmVersion: '1.0.0',
    createdAt: '2026-08-10T00:00:00.000Z',
    displayFingerprint: 'display-file',
    displayConditions: {
      displayNickname: 'Fixed display',
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
    sourceSessionId: 'session-file',
    rawTrials: [
      {
        id: 'raw-trial',
        stimulus: {
          id: 'stimulus-file',
          seed: 1,
          axis: 'deutan',
          direction: 'up',
          delta: 0.08,
          foregroundColor: [0.5, 0.4, 0.3],
          backgroundColor: [0.4, 0.5, 0.3],
          foregroundLuminance: 0.2,
          backgroundLuminance: 0.2,
          dots: [],
        },
        selectedDirection: 'up',
        correct: true,
        reactionTimeMs: 700,
        answeredAt: '2026-08-10T00:01:00.000Z',
      },
    ],
    thresholds: [],
    compensation: {
      deficiency: 'deutan',
      severity: 0.5,
      recommendedStrength: 0.7,
      chromaGain: 0.4,
      lightnessGain: 0.01,
    },
    confidence: 0.8,
    lut: { size: 2, data: Array.from({ length: 24 }, () => 0.5) },
  }
}

describe('profile files', () => {
  it('round-trips a checksummed UTF-8 profile and validation summary', async () => {
    const validation = {
      passed: true,
      personalizedAccuracy: 0.82,
      originalAccuracy: 0.5,
    }
    const value = { ...profile(), validation }
    const exported = await exportProfileFile(value, validation)
    const imported = await importProfileFile(exported)

    expect(imported.profile).toEqual(value)
    expect(imported.validation).toEqual(validation)
  })

  it('rejects malformed, unsupported, incomplete, and tampered files', async () => {
    await expect(importProfileFile('{')).rejects.toThrow(/JSON/i)

    const exported = await exportProfileFile(profile(), { passed: true })
    const unsupported = JSON.parse(exported)
    unsupported.fileSchemaVersion = 99
    await expect(importProfileFile(JSON.stringify(unsupported))).rejects.toThrow(
      /unsupported/i,
    )

    const incomplete = JSON.parse(exported)
    delete incomplete.payload.profile.rawTrials
    // Re-sign so schema validation (not the checksum) is what rejects it.
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(incomplete.payload)),
    )
    incomplete.checksum = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    await expect(importProfileFile(JSON.stringify(incomplete))).rejects.toThrow(
      /rawTrials/,
    )

    const tampered = JSON.parse(exported)
    tampered.payload.profile.confidence = 0.1
    await expect(importProfileFile(JSON.stringify(tampered))).rejects.toThrow(
      /checksum/i,
    )
  })
})
