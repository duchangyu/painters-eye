import type { TrialResponse } from '../domain/calibration'

export const CALIBRATION_DRAFT_KEY = 'color-master:calibration-draft'

/**
 * Bump whenever schedule or stimulus generation changes (schedule layout,
 * axis vectors, direction draws, start deltas). A draft written under another
 * version replays against a different schedule and must be discarded.
 */
export const CALIBRATION_SCHEDULE_VERSION = 2

export interface StoredCalibrationDraft {
  readonly version: number
  readonly seed: number
  readonly completedTrials: number
  readonly responses: readonly TrialResponse[]
}

const DIRECTIONS: ReadonlySet<string> = new Set(['up', 'right', 'down', 'left'])

/**
 * The schedule assigns deterministic sequential ids (trial-1, trial-2, ...),
 * so a response whose id does not match its position would replay onto a
 * different trial. Rejecting here keeps replay from silently drifting.
 */
function isReplayableResponse(
  value: unknown,
  index: number,
): value is TrialResponse {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<TrialResponse>
  return (
    candidate.id === `trial-${index + 1}` &&
    typeof candidate.selectedDirection === 'string' &&
    DIRECTIONS.has(candidate.selectedDirection) &&
    typeof candidate.reactionTimeMs === 'number' &&
    Number.isFinite(candidate.reactionTimeMs)
  )
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): DraftStorage | undefined {
  try {
    return globalThis.window?.localStorage
  } catch {
    return undefined
  }
}

export function loadCalibrationDraft(
  storage: DraftStorage | undefined = defaultStorage(),
): StoredCalibrationDraft | null {
  const serialized = storage?.getItem(CALIBRATION_DRAFT_KEY)
  if (!serialized) return null
  try {
    const value = JSON.parse(serialized) as Partial<StoredCalibrationDraft>
    if (
      value.version !== CALIBRATION_SCHEDULE_VERSION ||
      !Number.isInteger(value.seed) ||
      !Number.isInteger(value.completedTrials) ||
      value.completedTrials! <= 0 ||
      !Array.isArray(value.responses) ||
      value.responses.length < value.completedTrials!
    ) {
      return null
    }
    // Never trust responses past completedTrials: they were answered against
    // stimuli the staircase had not finalized and would skew threshold fits.
    const responses = value.responses.slice(0, value.completedTrials)
    if (!responses.every(isReplayableResponse)) return null
    return {
      version: CALIBRATION_SCHEDULE_VERSION,
      seed: value.seed!,
      completedTrials: value.completedTrials!,
      responses,
    }
  } catch {
    return null
  }
}

export function saveCalibrationDraft(
  draft: StoredCalibrationDraft,
  storage: DraftStorage | undefined = defaultStorage(),
): void {
  storage?.setItem(CALIBRATION_DRAFT_KEY, JSON.stringify(draft))
}

export function clearCalibrationDraft(
  storage: DraftStorage | undefined = defaultStorage(),
): void {
  storage?.removeItem(CALIBRATION_DRAFT_KEY)
}
