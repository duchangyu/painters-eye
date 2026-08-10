import type {
  ConfusionAxis,
  TrialResponse,
} from '../domain/calibration'
import type { CalibrationProfileV1, ThresholdEstimate } from '../domain/profile'
import type { PublicCalibrationTrial } from './session'
import { createStimulus } from './stimulus'

const CONTROL_AXES = [
  'blue-yellow-control',
  'luminance-control',
] as const satisfies readonly ConfusionAxis[]

export interface QuickCheckResponse {
  readonly trialId: string
  readonly axis: ConfusionAxis
  readonly correct: boolean
}

export interface QuickCheckAssessment {
  readonly status: 'pass' | 'review-display-settings' | 'recalibrate'
  readonly dominantAccuracy: number
  readonly controlAccuracy: number
}

function thresholdFor(
  profile: CalibrationProfileV1,
  axis: ConfusionAxis,
): ThresholdEstimate | undefined {
  return profile.thresholds.find((threshold) => threshold.axis === axis)
}

function dominantAxis(profile: CalibrationProfileV1): 'protan' | 'deutan' {
  const protan = thresholdFor(profile, 'protan')?.delta ?? 0
  const deutan = thresholdFor(profile, 'deutan')?.delta ?? 0
  if (protan === deutan) {
    return profile.compensation.deficiency === 'protan' ? 'protan' : 'deutan'
  }
  return protan > deutan ? 'protan' : 'deutan'
}

function easyDelta(
  profile: CalibrationProfileV1,
  axis: ConfusionAxis,
): number {
  const threshold = thresholdFor(profile, axis)
  const upper = threshold?.confidenceInterval[1] ?? threshold?.delta ?? 0.06
  return Math.min(0.25, Math.max(0.025, upper * 1.25))
}

export function createQuickCheckTrials(
  profile: CalibrationProfileV1,
  seed: number,
): readonly PublicCalibrationTrial[] {
  const axis = dominantAxis(profile)
  const axes: readonly ConfusionAxis[] = [
    axis,
    axis,
    axis,
    axis,
    CONTROL_AXES[0],
    CONTROL_AXES[0],
    CONTROL_AXES[1],
    CONTROL_AXES[1],
  ]
  const seedBase = (seed >>> 0) * 100
  return axes.map((trialAxis, index) => ({
    id: `quick-check-${index + 1}`,
    stimulus: createStimulus({
      seed: seedBase + index,
      axis: trialAxis,
      delta: easyDelta(profile, trialAxis),
    }),
  }))
}

function accuracy(responses: readonly QuickCheckResponse[]): number {
  return responses.length === 0
    ? 0
    : responses.filter((response) => response.correct).length / responses.length
}

export function assessQuickCheck(
  profile: CalibrationProfileV1,
  responses: readonly QuickCheckResponse[],
): QuickCheckAssessment {
  const axis = dominantAxis(profile)
  const dominantAccuracy = accuracy(
    responses.filter((response) => response.axis === axis),
  )
  const controlAccuracy = accuracy(
    responses.filter((response) =>
      CONTROL_AXES.some((axis) => axis === response.axis),
    ),
  )
  const passFloor = Math.max(0.6, profile.confidence - 0.2)
  const reviewFloor = Math.max(0.4, passFloor - 0.25)
  const status =
    dominantAccuracy >= passFloor && controlAccuracy >= passFloor
      ? 'pass'
      : dominantAccuracy >= reviewFloor && controlAccuracy >= reviewFloor
        ? 'review-display-settings'
        : 'recalibrate'

  return { status, dominantAccuracy, controlAccuracy }
}

export interface QuickCheckRequirementOptions {
  readonly profile: CalibrationProfileV1
  readonly currentDisplayFingerprint: string
  readonly lastCheckedAt: string | null
  readonly now?: Date
  readonly intervalDays?: number
}

export function quickCheckRequirement({
  profile,
  currentDisplayFingerprint,
  lastCheckedAt,
  now = new Date(),
  intervalDays = 30,
}: QuickCheckRequirementOptions):
  | 'not-due'
  | 'display-changed'
  | 'interval-elapsed' {
  if (currentDisplayFingerprint !== profile.displayFingerprint) {
    return 'display-changed'
  }
  const reference = Date.parse(lastCheckedAt ?? profile.createdAt)
  const elapsedMs = now.getTime() - reference
  return !Number.isFinite(reference) || elapsedMs >= intervalDays * 86_400_000
    ? 'interval-elapsed'
    : 'not-due'
}

export function toQuickCheckResponse(
  trial: PublicCalibrationTrial,
  answer: Pick<TrialResponse, 'selectedDirection'>,
): QuickCheckResponse {
  return {
    trialId: trial.id,
    axis: trial.stimulus.axis,
    correct: answer.selectedDirection === trial.stimulus.direction,
  }
}
