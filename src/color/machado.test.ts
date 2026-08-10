import { describe, expect, it } from 'vitest'
import { getMachadoMatrix, simulateCvd } from './machado'
import { decodeSrgb, encodeSrgb } from './srgb'

describe('sRGB transfer functions', () => {
  it('round-trips representative channels', () => {
    for (const channel of [0, 0.02, 0.18, 0.5, 1]) {
      expect(encodeSrgb(decodeSrgb(channel))).toBeCloseTo(channel, 7)
    }
  })
})

describe('Machado CVD model', () => {
  it('interpolates between the surrounding published severity samples', () => {
    const row = getMachadoMatrix('protan', 0.15)[0]
    expect(row[0]).toBeCloseTo(0.7954665, 6)
    expect(row[1]).toBeCloseTo(0.258455, 6)
    expect(row[2]).toBeCloseTo(-0.053921, 6)
  })

  it('keeps black and white neutral', () => {
    expect(simulateCvd([0, 0, 0], 'protan', 1)).toEqual([0, 0, 0])
    for (const channel of simulateCvd([1, 1, 1], 'deutan', 0.8)) {
      expect(channel).toBeCloseTo(1, 6)
    }
  })

  it('is the identity at severity zero', () => {
    const color = [0.12, 0.48, 0.91] as const
    const simulated = simulateCvd(color, 'deutan', 0)
    simulated.forEach((channel, index) => {
      expect(channel).toBeCloseTo(color[index], 7)
    })
  })

  it('keeps primary-color outputs finite and displayable', () => {
    for (const color of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as const) {
      for (const channel of simulateCvd(color, 'protan', 1)) {
        expect(Number.isFinite(channel)).toBe(true)
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(1)
      }
    }
  })

  it('rejects invalid severities and input channels', () => {
    expect(() => getMachadoMatrix('protan', -0.01)).toThrow(RangeError)
    expect(() => getMachadoMatrix('deutan', 1.01)).toThrow(RangeError)
    expect(() => getMachadoMatrix('protan', Number.NaN)).toThrow(RangeError)
    expect(() => simulateCvd([Number.NaN, 0, 0], 'deutan', 0.5)).toThrow(
      RangeError,
    )
  })
})
