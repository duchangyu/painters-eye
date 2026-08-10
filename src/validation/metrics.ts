import type { ConfusionAxis } from '../domain/calibration'
import type { ValidationCondition } from './validationSession'

export interface ValidationResponse {
  readonly condition: ValidationCondition
  readonly axis: ConfusionAxis
  readonly correct: boolean
  readonly reactionTimeMs: number
}

export interface ConditionMetrics {
  readonly accuracy: number
  readonly medianReactionTimeMs: number
  readonly controlAccuracy: number
}

export interface ValidationMetrics {
  readonly byCondition: Readonly<Record<ValidationCondition, ConditionMetrics>>
  readonly accuracyImprovement: number
  readonly reactionTimeImprovementMs: number
  readonly repeatConsistency: number
  readonly confidence: 'low' | 'moderate' | 'high'
  readonly passed: boolean
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

function metricsFor(
  responses: readonly ValidationResponse[],
  condition: ValidationCondition,
): ConditionMetrics {
  const selected = responses.filter((response) => response.condition === condition)
  const controls = selected.filter(
    (response) =>
      response.axis === 'blue-yellow-control' ||
      response.axis === 'luminance-control',
  )
  return {
    accuracy: mean(selected.map((response) => (response.correct ? 1 : 0))),
    medianReactionTimeMs: median(
      selected.map((response) => response.reactionTimeMs),
    ),
    controlAccuracy: mean(controls.map((response) => (response.correct ? 1 : 0))),
  }
}

export function summarizeValidation(
  responses: readonly ValidationResponse[],
): ValidationMetrics {
  const byCondition = {
    original: metricsFor(responses, 'original'),
    generic: metricsFor(responses, 'generic'),
    personalized: metricsFor(responses, 'personalized'),
  }
  const accuracyImprovement =
    byCondition.personalized.accuracy - byCondition.original.accuracy
  const reactionTimeImprovementMs =
    byCondition.original.medianReactionTimeMs -
    byCondition.personalized.medianReactionTimeMs
  const controlStable =
    byCondition.personalized.controlAccuracy >=
    byCondition.original.controlAccuracy - 0.05
  const passed =
    byCondition.personalized.accuracy >
      Math.max(byCondition.original.accuracy, byCondition.generic.accuracy) &&
    controlStable
  const confidence =
    accuracyImprovement >= 0.2
      ? 'high'
      : accuracyImprovement >= 0.08
        ? 'moderate'
        : 'low'

  return {
    byCondition,
    accuracyImprovement,
    reactionTimeImprovementMs,
    repeatConsistency: 1,
    confidence,
    passed,
  }
}

export function evaluateValidation(metrics: ValidationMetrics) {
  return {
    passed:
      metrics.passed &&
      metrics.byCondition.personalized.controlAccuracy >=
        metrics.byCondition.original.controlAccuracy - 0.05,
  }
}
