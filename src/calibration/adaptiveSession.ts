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

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] }
type MutableScheduledTrial = Mutable<ScheduledCalibrationTrial>
type MutablePublicTrial = Mutable<PublicCalibrationTrial>

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
  const scheduled = createCalibrationSchedule({
    seed,
    trialsPerAxis,
    repeatCount,
  }).map((trial) => ({ ...trial })) as MutableScheduledTrial[]
  const publicTrials = scheduled.map((trial) => ({
    id: trial.id,
    stimulus: trial.stimulus,
  })) as MutablePublicTrial[]
  const scheduledById = new Map(scheduled.map((trial) => [trial.id, trial]))
  const publicById = new Map(publicTrials.map((trial) => [trial.id, trial]))
  const indexById = new Map(scheduled.map((trial, index) => [trial.id, index]))
  const states = new Map(
    AXES.map((axis) => [axis, createAxisStaircase(axis, trialsPerAxis)]),
  )
  const answered = new Set<string>()

  function replaceStimulus(trialId: string, delta: number) {
    const trial = scheduledById.get(trialId)
    const publicTrial = publicById.get(trialId)
    if (!trial || !publicTrial) return
    const stimulus = createStimulus({
      seed: trial.stimulus.seed,
      axis: trial.stimulus.axis,
      delta,
    })
    trial.stimulus = stimulus
    publicTrial.stimulus = stimulus

    scheduled
      .filter((candidate) => candidate.repeatedFromTrialId === trialId)
      .forEach((repeat) => {
        repeat.stimulus = stimulus
        const publicRepeat = publicById.get(repeat.id)
        if (publicRepeat) publicRepeat.stimulus = stimulus
      })
  }

  for (const axis of AXES) {
    const first = scheduled.find(
      (trial) =>
        !trial.repeatedFromTrialId && trial.stimulus.axis === axis,
    )
    if (first) replaceStimulus(first.id, START_DELTA[axis])
  }

  function recordAnswer(answer: AdaptiveAnswer): TrialResponse | undefined {
    const trial = scheduledById.get(answer.trialId)
    if (!trial || answered.has(answer.trialId)) return undefined
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
      const currentIndex = indexById.get(trial.id)!
      const next = scheduled.find(
        (candidate, index) =>
          index > currentIndex &&
          !candidate.repeatedFromTrialId &&
          candidate.stimulus.axis === trial.stimulus.axis,
      )
      if (next) replaceStimulus(next.id, nextState.delta)
    }

    return response
  }

  return {
    trials: publicTrials,
    scheduledTrials: scheduled,
    recordAnswer,
    staircases: () => AXES.map((axis) => states.get(axis)!),
  }
}
