import { describe, expect, it } from 'vitest'
import type { CompensationParameters } from '../domain/profile'
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
})
