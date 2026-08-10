import { describe, expect, it } from 'vitest'
import type { CompensationParameters } from '../domain/profile'
import { compensateColor } from './compensate'
import { buildCompensationLut, generateLut } from './lut'

describe('generateLut', () => {
  it('creates a deterministic 17×17×17 identity LUT', () => {
    const first = generateLut(17, (color) => color)
    const second = generateLut(17, (color) => color)

    expect(first).toEqual(second)
    expect(first.data).toHaveLength(17 * 17 * 17 * 3)
    expect(first.data.slice(0, 3)).toEqual([0, 0, 0])
    expect(first.data.slice(-3)).toEqual([1, 1, 1])
  })

  it('rejects invalid dimensions', () => {
    expect(() => generateLut(1, (color) => color)).toThrow(RangeError)
    expect(() => generateLut(17.5, (color) => color)).toThrow(RangeError)
  })

  it('builds the declared 17×17×17 profile LUT', () => {
    const parameters: CompensationParameters = {
      deficiency: 'protan',
      severity: 0.6,
      recommendedStrength: 0.75,
      chromaGain: 0.4,
      lightnessGain: 0.01,
    }
    expect(buildCompensationLut(parameters).size).toBe(17)
  })

  it('bakes the LUT at full strength so the renderer owns the slider', () => {
    const parameters: CompensationParameters = {
      deficiency: 'deutan',
      severity: 0.6,
      recommendedStrength: 0.4,
      chromaGain: 0.5,
      lightnessGain: 0.01,
    }
    const lut = buildCompensationLut(parameters)
    // Node (r=8/16, g=4/16, b=0) in red-fastest layout.
    const index = ((0 * 17 + 4) * 17 + 8) * 3
    const expected = compensateColor([0.5, 0.25, 0], parameters, 1)
    expect(lut.data[index]).toBeCloseTo(expected[0], 6)
    expect(lut.data[index + 1]).toBeCloseTo(expected[1], 6)
    expect(lut.data[index + 2]).toBeCloseTo(expected[2], 6)
    // Baking at recommendedStrength would halve the effect.
    const halved = compensateColor([0.5, 0.25, 0], parameters, 0.4)
    expect(lut.data[index + 1]).not.toBeCloseTo(halved[1], 3)
  })
})
