import type { CompensationParameters } from '../domain/profile'
import { optimizeCompensation } from './compensate'

/**
 * Generic preset profiles for the fast-track screening flow. Presets trade
 * accuracy for a lower entry barrier: a dichromat's deficiency is well
 * modelled, so a severity-1.0 preset comes close to a personalized profile;
 * anomalous trichromats get an approximation that may over- or
 * under-compensate for their exact severity. Presets never enter the
 * validated-profile store — they carry no fitted thresholds or blind
 * validation, and the UI labels them "approximate" wherever they surface.
 */

export type PresetSeverityBand = 'severe' | 'moderate' | 'mild'

export interface PresetDefinition {
  readonly id: string
  readonly deficiency: CompensationParameters['deficiency']
  readonly band: PresetSeverityBand
  readonly severity: number
  /** Short plain-language label, e.g. "中度绿色弱". */
  readonly labelZh: string
}

const SEVERITY_BY_BAND: Readonly<Record<PresetSeverityBand, number>> = {
  severe: 1,
  moderate: 0.6,
  mild: 0.35,
}

const DEFICIENCY_LABELS = {
  protan: {
    severe: '红色盲档',
    moderate: '中度红色弱',
    mild: '轻度红色弱',
  },
  deutan: {
    severe: '绿色盲档',
    moderate: '中度绿色弱',
    mild: '轻度绿色弱',
  },
  mixed: {
    severe: '红绿混合重度',
    moderate: '红绿混合中度',
    mild: '红绿混合轻度',
  },
} as const

const DEFICIENCIES = ['protan', 'deutan', 'mixed'] as const
const BANDS = ['severe', 'moderate', 'mild'] as const

export const PRESETS: readonly PresetDefinition[] = DEFICIENCIES.flatMap(
  (deficiency) =>
    BANDS.map((band) => ({
      id: `${deficiency}-${band}`,
      deficiency,
      band,
      severity: SEVERITY_BY_BAND[band],
      labelZh: DEFICIENCY_LABELS[deficiency][band],
    })),
)

export function findPreset(id: string): PresetDefinition | undefined {
  return PRESETS.find((preset) => preset.id === id)
}

const compensationCache = new Map<string, CompensationParameters>()

/**
 * Compensation parameters for a preset, computed with the same optimizer
 * that personalizes fitted profiles. Results are cached per preset id — the
 * grid search is small but there is no reason to repeat it on every render.
 */
export function getPresetCompensation(id: string): CompensationParameters {
  const cached = compensationCache.get(id)
  if (cached) {
    return cached
  }
  const preset = findPreset(id)
  if (!preset) {
    throw new RangeError(`unknown preset: ${id}`)
  }
  const compensation = optimizeCompensation({
    deficiency: preset.deficiency,
    severity: preset.severity,
    // Same strength heuristic as fitProfile: stronger deficiencies tolerate
    // and need a stronger default push.
    recommendedStrength: 0.5 + preset.severity * 0.4,
  })
  compensationCache.set(id, compensation)
  return compensation
}
