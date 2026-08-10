/** A normalized, gamma-encoded sRGB color. Each channel is in [0, 1]. */
export type SrgbColor = readonly [red: number, green: number, blue: number]

/** An ISO 8601 timestamp. */
export type IsoTimestamp = string

export type ConfusionAxis =
  | 'protan'
  | 'deutan'
  | 'blue-yellow-control'
  | 'luminance-control'

export type TargetDirection = 'up' | 'right' | 'down' | 'left'

export interface StimulusDot {
  readonly center: readonly [x: number, y: number]
  readonly radius: number
  readonly role: 'foreground' | 'background'
  readonly color: SrgbColor
}

export interface Stimulus {
  readonly id: string
  readonly seed: number
  readonly axis: ConfusionAxis
  readonly direction: TargetDirection
  readonly delta: number
  readonly foregroundColor: SrgbColor
  readonly backgroundColor: SrgbColor
  readonly foregroundLuminance: number
  readonly backgroundLuminance: number
  readonly dots: readonly StimulusDot[]
}

export interface TrialResponse {
  readonly id: string
  readonly stimulus: Stimulus
  readonly selectedDirection: TargetDirection
  readonly correct: boolean
  readonly reactionTimeMs: number
  readonly answeredAt: IsoTimestamp
  readonly repeatedFromTrialId?: string
}

export interface StaircaseState {
  readonly axis: ConfusionAxis
  readonly delta: number
  readonly minDelta: number
  readonly maxDelta: number
  readonly stepSize: number
  readonly consecutiveCorrect: number
  readonly lastMovement: 'up' | 'down' | null
  readonly reversals: readonly number[]
  readonly trialCount: number
  readonly maxTrials: number
  readonly status: 'running' | 'complete'
}

export interface DisplayConditions {
  readonly displayNickname: string
  readonly brightnessDescription: string
  readonly nightShiftOff: boolean
  readonly trueToneOff: boolean
  readonly colorFiltersOff: boolean
  readonly screenWidthPx: number
  readonly screenHeightPx: number
  readonly colorDepth: number
  readonly pixelRatio: number
  readonly recordedAt: IsoTimestamp
}

export interface CalibrationSession {
  readonly id: string
  readonly seed: number
  readonly status:
    | 'draft'
    | 'running'
    | 'paused'
    | 'needs-more-data'
    | 'complete'
  readonly startedAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
  readonly displayConditions: DisplayConditions
  readonly staircases: readonly StaircaseState[]
  readonly trials: readonly TrialResponse[]
}
