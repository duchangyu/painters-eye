import { z } from 'zod'
import type { CalibrationProfileV1 } from '../domain/profile'

const unitInterval = z.number().min(0).max(1)
const srgbColor = z.tuple([unitInterval, unitInterval, unitInterval])

const confusionAxis = z.enum([
  'protan',
  'deutan',
  'blue-yellow-control',
  'luminance-control',
])

const targetDirection = z.enum(['up', 'right', 'down', 'left'])

const stimulusDot = z.object({
  center: z.tuple([z.number(), z.number()]),
  radius: z.number().positive(),
  role: z.enum(['foreground', 'background']),
  color: srgbColor,
})

const stimulus = z.object({
  id: z.string().min(1),
  seed: z.number().int().nonnegative(),
  axis: confusionAxis,
  direction: targetDirection,
  delta: z.number().positive().max(0.25),
  foregroundColor: srgbColor,
  backgroundColor: srgbColor,
  foregroundLuminance: z.number().nonnegative(),
  backgroundLuminance: z.number().nonnegative(),
  dots: z.array(stimulusDot),
})

const trialResponse = z.object({
  id: z.string().min(1),
  stimulus,
  selectedDirection: targetDirection,
  correct: z.boolean(),
  reactionTimeMs: z.number().nonnegative(),
  answeredAt: z.string().min(1),
  repeatedFromTrialId: z.string().min(1).optional(),
})

const displayConditions = z.object({
  displayNickname: z.string(),
  brightnessDescription: z.string(),
  nightShiftOff: z.boolean(),
  trueToneOff: z.boolean(),
  colorFiltersOff: z.boolean(),
  screenWidthPx: z.number().positive(),
  screenHeightPx: z.number().positive(),
  colorDepth: z.number().positive(),
  pixelRatio: z.number().positive(),
  recordedAt: z.string().min(1),
})

const thresholdEstimate = z.object({
  axis: confusionAxis,
  delta: z.number().positive().max(0.25),
  reversalDeltas: z.array(z.number()),
  confidenceInterval: z.tuple([z.number().nonnegative(), z.number()]),
})

const compensationParameters = z.object({
  deficiency: z.enum(['protan', 'deutan', 'mixed']),
  severity: unitInterval,
  recommendedStrength: unitInterval,
  chromaGain: unitInterval,
  lightnessGain: unitInterval,
  objective: z
    .object({
      simulatedSeparation: z.number(),
      naturalnessCost: z.number(),
      luminancePenalty: z.number(),
      controlAxisPenalty: z.number(),
      total: z.number(),
    })
    .optional(),
})

const validationSummary = z.object({
  passed: z.boolean(),
  personalizedAccuracy: z.number().optional(),
  originalAccuracy: z.number().optional(),
  genericAccuracy: z.number().optional(),
  medianReactionTimeMs: z.number().optional(),
  originalMedianReactionTimeMs: z.number().optional(),
  genericMedianReactionTimeMs: z.number().optional(),
  personalizedMedianReactionTimeMs: z.number().optional(),
  originalControlAccuracy: z.number().optional(),
  personalizedControlAccuracy: z.number().optional(),
  repeatConsistency: z.number().optional(),
})

const lutSchema = z
  .object({
    size: z.number().int().min(2).max(65),
    data: z.array(unitInterval),
  })
  .refine((lut) => lut.data.length === lut.size ** 3 * 3, {
    message: 'LUT data length must be size^3 * 3',
  })

export const calibrationProfileSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  algorithmVersion: z.string().min(1),
  createdAt: z.string().min(1),
  displayFingerprint: z.string().min(1),
  displayConditions,
  sourceSessionId: z.string().min(1),
  rawTrials: z.array(trialResponse).min(1),
  thresholds: z.array(thresholdEstimate),
  compensation: compensationParameters,
  confidence: unitInterval,
  validation: validationSummary.optional(),
  lut: lutSchema,
})

export const profileValidationSummarySchema = validationSummary

/**
 * Validates an unknown value against the profile schema. Throws a ZodError
 * with the full issue list so callers can surface a single friendly message
 * while keeping the details loggable.
 */
export function parseCalibrationProfile(value: unknown): CalibrationProfileV1 {
  return calibrationProfileSchema.parse(value) as CalibrationProfileV1
}
