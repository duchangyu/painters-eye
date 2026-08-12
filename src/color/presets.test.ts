import { describe, expect, it } from 'vitest'
import type { SrgbColor } from '../domain/calibration'
import { buildCompensationLut } from './lut'
import { compensateColor } from './compensate'
import { deltaEOk } from './compensate'
import { simulateCvd } from './machado'
import { findPreset, getPresetCompensation, PRESETS } from './presets'

describe('presets', () => {
  it('covers protan, deutan and mixed across three severity bands', () => {
    expect(PRESETS).toHaveLength(9)
    for (const deficiency of ['protan', 'deutan', 'mixed'] as const) {
      for (const band of ['severe', 'moderate', 'mild'] as const) {
        const preset = findPreset(`${deficiency}-${band}`)
        expect(preset).toBeDefined()
        expect(preset!.labelZh.length).toBeGreaterThan(0)
      }
    }
  })

  it('assigns higher severity and strength to heavier bands', () => {
    const severe = getPresetCompensation('deutan-severe')
    const mild = getPresetCompensation('deutan-mild')
    expect(severe.severity).toBe(1)
    expect(mild.severity).toBeLessThan(severe.severity)
    expect(severe.recommendedStrength).toBeGreaterThan(
      mild.recommendedStrength,
    )
  })

  it('improves simulated separation on red-green reference pairs', () => {
    const compensation = getPresetCompensation('protan-moderate')
    const first: SrgbColor = [0.7, 0.32, 0.25]
    const second: SrgbColor = [0.42, 0.5, 0.25]
    const before = deltaEOk(
      simulateCvd(first, 'protan', compensation.severity),
      simulateCvd(second, 'protan', compensation.severity),
    )
    const after = deltaEOk(
      simulateCvd(
        compensateColor(first, compensation),
        'protan',
        compensation.severity,
      ),
      simulateCvd(
        compensateColor(second, compensation),
        'protan',
        compensation.severity,
      ),
    )
    expect(after).toBeGreaterThan(before)
  })

  it('builds a usable LUT for every preset', () => {
    for (const preset of PRESETS) {
      const lut = buildCompensationLut(getPresetCompensation(preset.id))
      expect(lut.data.length).toBe(lut.size ** 3 * 3)
    }
  })

  it('caches compensation per preset id', () => {
    expect(getPresetCompensation('mixed-mild')).toBe(
      getPresetCompensation('mixed-mild'),
    )
  })

  it('rejects unknown preset ids', () => {
    expect(() => getPresetCompensation('tritan-severe')).toThrow(RangeError)
  })
})
