import type { ConfusionAxis, StaircaseState } from '../domain/calibration'

export interface CreateStaircaseOptions {
  readonly axis: ConfusionAxis
  readonly startDelta: number
  readonly minDelta?: number
  readonly maxDelta?: number
  readonly stepSize?: number
  readonly maxTrials?: number
  readonly targetReversals?: number
}

export function createStaircase({
  axis,
  startDelta,
  minDelta = 0.005,
  maxDelta = 0.25,
  stepSize = 0.015,
  maxTrials = 80,
  targetReversals = 8,
}: CreateStaircaseOptions): StaircaseState {
  if (
    !Number.isFinite(startDelta) ||
    startDelta < minDelta ||
    startDelta > maxDelta
  ) {
    throw new RangeError('startDelta must lie inside the staircase bounds')
  }

  return {
    axis,
    delta: startDelta,
    minDelta,
    maxDelta,
    stepSize,
    consecutiveCorrect: 0,
    lastMovement: null,
    reversals: [],
    trialCount: 0,
    maxTrials,
    targetReversals,
    status: 'running',
  }
}

export function updateStaircase(
  state: StaircaseState,
  correct: boolean,
): StaircaseState {
  if (state.status === 'complete') {
    return state
  }

  const trialCount = state.trialCount + 1
  const consecutiveCorrect = correct ? state.consecutiveCorrect + 1 : 0
  const movement = correct
    ? consecutiveCorrect >= 2
      ? 'down'
      : null
    : 'up'

  if (!movement) {
    return {
      ...state,
      consecutiveCorrect,
      trialCount,
      status: trialCount >= state.maxTrials ? 'complete' : 'running',
    }
  }

  const isReversal =
    state.lastMovement !== null && state.lastMovement !== movement
  const reversals = isReversal
    ? [...state.reversals, state.delta]
    : state.reversals
  const stepSize = isReversal
    ? Math.max(state.stepSize * 0.75, 0.001)
    : state.stepSize
  const signedStep = movement === 'down' ? -stepSize : stepSize
  const delta = Math.min(
    state.maxDelta,
    Math.max(state.minDelta, state.delta + signedStep),
  )
  const complete =
    reversals.length >= state.targetReversals || trialCount >= state.maxTrials

  return {
    ...state,
    delta,
    stepSize,
    consecutiveCorrect: 0,
    lastMovement: movement,
    reversals,
    trialCount,
    status: complete ? 'complete' : 'running',
  }
}

export function estimateThreshold(reversals: readonly number[]): number {
  if (reversals.length === 0) {
    throw new RangeError('at least one reversal is required')
  }

  const finalReversals = reversals.slice(-6).sort((a, b) => a - b)
  const middle = Math.floor(finalReversals.length / 2)

  return finalReversals.length % 2 === 0
    ? (finalReversals[middle - 1]! + finalReversals[middle]!) / 2
    : finalReversals[middle]!
}
