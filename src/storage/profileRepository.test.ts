import { deleteDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStimulus } from '../calibration/stimulus'
import type {
  CalibrationSession,
  DisplayConditions,
  TrialResponse,
} from '../domain/calibration'
import type { CalibrationProfileV1 } from '../domain/profile'
import {
  createProfileRepository,
  createDisplayFingerprint,
  migrateProfile,
  type ProfileRepository,
} from './profileRepository'

const display: DisplayConditions = {
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
}

function trial(): TrialResponse {
  const stimulus = createStimulus({ seed: 1, axis: 'deutan', delta: 0.08 })
  return {
    id: 'trial-1',
    stimulus,
    selectedDirection: stimulus.direction,
    correct: true,
    reactionTimeMs: 750,
    answeredAt: '2026-08-10T00:01:00.000Z',
  }
}

function profile(): CalibrationProfileV1 {
  return {
    schemaVersion: 1,
    id: 'profile-1',
    algorithmVersion: '1.0.0',
    createdAt: '2026-08-10T00:02:00.000Z',
    displayFingerprint: 'display-abc',
    displayConditions: display,
    sourceSessionId: 'session-1',
    rawTrials: [trial()],
    thresholds: [],
    compensation: {
      deficiency: 'deutan',
      severity: 0.6,
      recommendedStrength: 0.75,
      chromaGain: 0.5,
      lightnessGain: 0.01,
    },
    confidence: 0.84,
    lut: { size: 2, data: [0, 0, 0, 1, 1, 1] },
  }
}

describe('ProfileRepository', () => {
  const databaseName = 'color-master-repository-test'
  let repository: ProfileRepository

  beforeEach(async () => {
    await deleteDB(databaseName)
    repository = await createProfileRepository(databaseName)
  })

  afterEach(async () => {
    repository.close()
    await deleteDB(databaseName)
  })

  it('saves and loads a draft session', async () => {
    const session: CalibrationSession = {
      id: 'session-1',
      seed: 42,
      status: 'draft',
      startedAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:01:00.000Z',
      displayConditions: display,
      staircases: [],
      trials: [trial()],
    }

    await repository.saveDraft(session)
    expect(await repository.loadDraft('session-1')).toEqual(session)
  })

  it('promotes and finds one active profile per display', async () => {
    const value = profile()
    await repository.promoteValidatedProfile(value)

    expect(await repository.loadActiveProfile('display-abc')).toEqual(value)
  })

  it('loads the most recent validated profile when the display fingerprint changed', async () => {
    const older = profile()
    const newer = {
      ...profile(),
      id: 'profile-2',
      createdAt: '2026-08-11T00:02:00.000Z',
      displayFingerprint: 'display-newer',
    }
    await repository.promoteValidatedProfile(older)
    await repository.promoteValidatedProfile(newer)
    expect(await repository.loadMostRecentProfile()).toEqual(newer)
  })

  it('builds a stable fingerprint only from permitted display values', () => {
    expect(createDisplayFingerprint(display)).toBe(
      'studio display|1920x1080|24|2',
    )
  })

  it('migrates legacy data without losing raw trials and rejects unknown versions', () => {
    const value = profile()
    const migrated = migrateProfile({
      ...value,
      schemaVersion: 0,
      algorithmVersion: undefined,
    })
    expect(migrated.rawTrials).toEqual(value.rawTrials)
    expect(migrated.schemaVersion).toBe(1)
    expect(() => migrateProfile({ ...value, schemaVersion: 99 })).toThrow(
      /unsupported/i,
    )
  })
})
