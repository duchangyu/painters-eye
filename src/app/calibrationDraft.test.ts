import { describe, expect, it } from 'vitest'
import type { TrialResponse } from '../domain/calibration'
import {
  CALIBRATION_DRAFT_KEY,
  CALIBRATION_SCHEDULE_VERSION,
  clearCalibrationDraft,
  loadCalibrationDraft,
  saveCalibrationDraft,
  type StoredCalibrationDraft,
} from './calibrationDraft'

function memoryStorage(initial?: string) {
  let stored = initial ?? null
  return {
    getItem: (key: string) => (key === CALIBRATION_DRAFT_KEY ? stored : null),
    setItem: (key: string, value: string) => {
      if (key === CALIBRATION_DRAFT_KEY) stored = value
    },
    removeItem: (key: string) => {
      if (key === CALIBRATION_DRAFT_KEY) stored = null
    },
  }
}

function draftResponse(index: number): TrialResponse {
  return {
    id: `trial-${index + 1}`,
    stimulus: {} as TrialResponse['stimulus'],
    selectedDirection: 'up',
    correct: true,
    reactionTimeMs: 700,
    answeredAt: '2026-08-10T00:00:00.000Z',
  }
}

function validDraft(overrides?: Partial<StoredCalibrationDraft>) {
  return {
    version: CALIBRATION_SCHEDULE_VERSION,
    seed: 20260810,
    completedTrials: 2,
    responses: [draftResponse(0), draftResponse(1)],
    ...overrides,
  }
}

describe('calibration draft persistence', () => {
  it('round-trips a valid draft', () => {
    const storage = memoryStorage()
    saveCalibrationDraft(validDraft(), storage)
    expect(loadCalibrationDraft(storage)).toEqual(validDraft())
  })

  it('returns null for missing or malformed payloads', () => {
    expect(loadCalibrationDraft(memoryStorage())).toBeNull()
    expect(loadCalibrationDraft(memoryStorage('not json'))).toBeNull()
    expect(loadCalibrationDraft(undefined)).toBeNull()
  })

  it('rejects drafts from another schedule version', () => {
    const storage = memoryStorage(
      JSON.stringify(validDraft({ version: CALIBRATION_SCHEDULE_VERSION - 1 })),
    )
    expect(loadCalibrationDraft(storage)).toBeNull()
  })

  it('rejects drafts from before versioning existed', () => {
    const legacy = validDraft() as Partial<StoredCalibrationDraft>
    delete legacy.version
    expect(loadCalibrationDraft(memoryStorage(JSON.stringify(legacy)))).toBeNull()
  })

  it('discards responses beyond completedTrials', () => {
    const storage = memoryStorage(
      JSON.stringify(
        validDraft({ responses: [draftResponse(0), draftResponse(1), draftResponse(2)] }),
      ),
    )
    const draft = loadCalibrationDraft(storage)
    expect(draft?.responses).toHaveLength(2)
  })

  it('rejects responses whose ids do not match the schedule order', () => {
    const swapped = validDraft({
      responses: [draftResponse(1), draftResponse(0)],
    })
    expect(
      loadCalibrationDraft(memoryStorage(JSON.stringify(swapped))),
    ).toBeNull()
  })

  it('rejects responses with implausible answers', () => {
    const bad = validDraft()
    ;(bad.responses[0] as { selectedDirection: string }).selectedDirection =
      'sideways'
    expect(loadCalibrationDraft(memoryStorage(JSON.stringify(bad)))).toBeNull()
  })

  it('clears the stored draft', () => {
    const storage = memoryStorage()
    saveCalibrationDraft(validDraft(), storage)
    clearCalibrationDraft(storage)
    expect(loadCalibrationDraft(storage)).toBeNull()
  })
})
