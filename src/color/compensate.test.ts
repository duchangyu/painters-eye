import { describe, expect, it } from 'vitest'
import type { SrgbColor } from '../domain/calibration'
import type { CompensationParameters } from '../domain/profile'
import { simulateCvd } from './machado'
import {
  compensateColor,
  deltaEOk,
  relativeLuminance,
} from './compensate'

const parameters: CompensationParameters = {
  deficiency: 'deutan',
  severity: 0.75,
  recommendedStrength: 0.8,
  chromaGain: 0.7,
  lightnessGain: 0.015,
}

describe('compensateColor', () => {
  it('is exact identity at strength zero and keeps output displayable', () => {
    const color: SrgbColor = [0.37, 0.58, 0.22]
    expect(compensateColor(color, parameters, 0)).toEqual(color)

    for (const channel of compensateColor(color, parameters, 1)) {
      expect(Number.isFinite(channel)).toBe(true)
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(1)
    }
  })

  it('keeps black, white, and neutral grays neutral', () => {
    for (const level of [0, 0.25, 0.5, 0.75, 1]) {
      expect(compensateColor([level, level, level], parameters, 1)).toEqual([
        level,
        level,
        level,
      ])
    }
  })

  it('keeps reference luminance within tolerance', () => {
    const colors: readonly SrgbColor[] = [
      [0.65, 0.28, 0.2],
      [0.25, 0.62, 0.34],
      [0.32, 0.42, 0.72],
    ]
    for (const color of colors) {
      const compensated = compensateColor(
        color,
        parameters,
        parameters.recommendedStrength,
      )
      expect(
        Math.abs(relativeLuminance(color) - relativeLuminance(compensated)),
      ).toBeLessThan(0.03)
    }
  })

  it('increases simulated separation for a confusing held-out pair', () => {
    const pair: readonly [SrgbColor, SrgbColor] = [
      [0.58, 0.42, 0.2],
      [0.35, 0.53, 0.2],
    ]
    const before = deltaEOk(
      simulateCvd(pair[0], 'deutan', parameters.severity),
      simulateCvd(pair[1], 'deutan', parameters.severity),
    )
    const after = deltaEOk(
      simulateCvd(
        compensateColor(pair[0], parameters, parameters.recommendedStrength),
        'deutan',
        parameters.severity,
      ),
      simulateCvd(
        compensateColor(pair[1], parameters, parameters.recommendedStrength),
        'deutan',
        parameters.severity,
      ),
    )

    expect(after).toBeGreaterThan(before)
  })

  it('does not reduce a blue-yellow control pair by more than five percent', () => {
    const pair: readonly [SrgbColor, SrgbColor] = [
      [0.2, 0.36, 0.82],
      [0.86, 0.75, 0.18],
    ]
    const before = deltaEOk(pair[0], pair[1])
    const after = deltaEOk(
      compensateColor(pair[0], parameters, parameters.recommendedStrength),
      compensateColor(pair[1], parameters, parameters.recommendedStrength),
    )

    expect(after).toBeGreaterThanOrEqual(before * 0.95)
  })
})
