import type {
  CalibrationSession,
  ConfusionAxis,
  DisplayConditions,
  IsoTimestamp,
  TrialResponse,
} from './calibration'

export interface ThresholdEstimate {
  readonly axis: ConfusionAxis
  readonly delta: number
  readonly reversalDeltas: readonly number[]
  readonly confidenceInterval: readonly [lower: number, upper: number]
}

export interface CompensationParameters {
  readonly deficiency: 'protan' | 'deutan' | 'mixed'
  readonly severity: number
  readonly recommendedStrength: number
  readonly chromaGain: number
  readonly lightnessGain: number
  readonly objective?: {
    readonly simulatedSeparation: number
    readonly naturalnessCost: number
    readonly luminancePenalty: number
    readonly controlAxisPenalty: number
    readonly total: number
  }
}

export interface ProfileValidationSummary {
  readonly passed: boolean
  readonly personalizedAccuracy?: number
  readonly originalAccuracy?: number
  readonly genericAccuracy?: number
  readonly medianReactionTimeMs?: number
  readonly originalMedianReactionTimeMs?: number
  readonly genericMedianReactionTimeMs?: number
  readonly personalizedMedianReactionTimeMs?: number
  readonly originalControlAccuracy?: number
  readonly personalizedControlAccuracy?: number
  readonly repeatConsistency?: number
}

export interface CalibrationProfileV1 {
  readonly schemaVersion: 1
  readonly id: string
  readonly algorithmVersion: string
  readonly createdAt: IsoTimestamp
  readonly displayFingerprint: string
  readonly displayConditions: DisplayConditions
  readonly sourceSessionId: CalibrationSession['id']
  readonly rawTrials: readonly TrialResponse[]
  readonly thresholds: readonly ThresholdEstimate[]
  readonly compensation: CompensationParameters
  readonly confidence: number
  readonly validation?: ProfileValidationSummary
  readonly lut: {
    readonly size: number
    readonly data: readonly number[]
  }
}

export type CalibrationProfile = CalibrationProfileV1
