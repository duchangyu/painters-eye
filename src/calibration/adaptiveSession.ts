import type {
  ConfusionAxis,
  StaircaseState,
  TargetDirection,
  TrialResponse,
} from '../domain/calibration'
import { createCalibrationSchedule } from './session'
import type {
  PublicCalibrationTrial,
  ScheduledCalibrationTrial,
} from './session'
import { createStaircase, updateStaircase } from './staircase'
import { createStimulus } from './stimulus'

const AXES: readonly ConfusionAxis[] = [
  'protan',
  'deutan',
  'blue-yellow-control',
  'luminance-control',
]

const START_DELTA: Readonly<Record<ConfusionAxis, number>> = {
  protan: 0.12,
  deutan: 0.12,
  'blue-yellow-control': 0.1,
  'luminance-control': 0.06,
}

export const AXIS_STEP_SIZE: Readonly<Record<ConfusionAxis, number>> = {
  protan: 0.018,
  deutan: 0.018,
  'blue-yellow-control': 0.015,
  'luminance-control': 0.01,
}

export interface AdaptiveAnswer {
  readonly trialId: string
  readonly selectedDirection: TargetDirection
  readonly reactionTimeMs: number
}

export interface AdaptiveCalibrationSession {
  readonly trials: readonly PublicCalibrationTrial[]
  readonly scheduledTrials: readonly ScheduledCalibrationTrial[]
  readonly recordAnswer: (answer: AdaptiveAnswer) => TrialResponse | undefined
  readonly staircases: () => readonly StaircaseState[]
}

export function createAxisStaircase(
  axis: ConfusionAxis,
  maxTrials = 12,
): StaircaseState {
  return createStaircase({
    axis,
    startDelta: START_DELTA[axis],
    stepSize: AXIS_STEP_SIZE[axis],
    maxTrials,
    targetReversals: 8,
  })
}

export interface CreateAdaptiveCalibrationSessionOptions {
  readonly seed: number
  readonly trialsPerAxis?: number
  readonly repeatCount?: number
}

export function createAdaptiveCalibrationSession({
  seed,
  trialsPerAxis = 12,
  repeatCount = 8,
}: CreateAdaptiveCalibrationSessionOptions): AdaptiveCalibrationSession {
  let scheduled: readonly ScheduledCalibrationTrial[] =
    createCalibrationSchedule({ seed, trialsPerAxis, repeatCount })
  let publicTrials: readonly PublicCalibrationTrial[] = scheduled.map(
    (trial) => ({ id: trial.id, stimulus: trial.stimulus }),
  )
  const states = new Map(
    AXES.map((axis) => [axis, createAxisStaircase(axis, trialsPerAxis)]),
  )
  const answered = new Set<string>()

  /**
   * Rebuilds the schedule with `trialId` (and its repeats) re-rendered at
   * `delta`. Produces new trial objects instead of mutating in place, so
   * consumers always read a consistent, immutable snapshot.
   */
  function replaceStimulus(trialId: string, delta: number) {
    const trial = scheduled.find((candidate) => candidate.id === trialId)
    if (!trial) return
    const stimulus = createStimulus({
      seed: trial.stimulus.seed,
      axis: trial.stimulus.axis,
      delta,
    })
    const replacedIds = new Set<string>([
      trialId,
      ...scheduled
        .filter((candidate) => candidate.repeatedFromTrialId === trialId)
        .map((repeat) => repeat.id),
    ])
    scheduled = scheduled.map((candidate) =>
      replacedIds.has(candidate.id) ? { ...candidate, stimulus } : candidate,
    )
    publicTrials = publicTrials.map((candidate) =>
      replacedIds.has(candidate.id) ? { ...candidate, stimulus } : candidate,
    )
  }

  for (const axis of AXES) {
    const first = scheduled.find(
      (trial) => !trial.repeatedFromTrialId && trial.stimulus.axis === axis,
    )
    if (first) replaceStimulus(first.id, START_DELTA[axis])
  }

  function recordAnswer(answer: AdaptiveAnswer): TrialResponse | undefined {
    if (answered.has(answer.trialId)) return undefined
    const index = scheduled.findIndex(
      (candidate) => candidate.id === answer.trialId,
    )
    if (index < 0) return undefined
    const trial = scheduled[index]!
    answered.add(answer.trialId)
    const correct = answer.selectedDirection === trial.stimulus.direction
    const response: TrialResponse = {
      id: trial.id,
      stimulus: trial.stimulus,
      selectedDirection: answer.selectedDirection,
      correct,
      reactionTimeMs: answer.reactionTimeMs,
      answeredAt: new Date().toISOString(),
      repeatedFromTrialId: trial.repeatedFromTrialId,
    }

    if (!trial.repeatedFromTrialId) {
      const state = states.get(trial.stimulus.axis)!
      const nextState = updateStaircase(state, correct)
      states.set(trial.stimulus.axis, nextState)
      const next = scheduled.find(
        (candidate, candidateIndex) =>
          candidateIndex > index &&
          !candidate.repeatedFromTrialId &&
          candidate.stimulus.axis === trial.stimulus.axis,
      )
      if (next) replaceStimulus(next.id, nextState.delta)
    }

    return response
  }

  return {
    get trials() {
      return publicTrials
    },
    get scheduledTrials() {
      return scheduled
    },
    recordAnswer,
    staircases: () => AXES.map((axis) => states.get(axis)!),
  }
}
