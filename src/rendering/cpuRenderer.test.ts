import { describe, expect, it } from 'vitest'
import { generateLut } from '../color/lut'
import { applyLutToPixels } from './cpuRenderer'

describe('applyLutToPixels', () => {
  it('keeps identity bytes and alpha exactly', () => {
    const input = new Uint8ClampedArray([0, 64, 255, 17, 255, 128, 32, 240])
    const result = applyLutToPixels(
      input,
      generateLut(2, (color) => color),
      1,
    )
    expect([...result]).toEqual([...input])
    expect(result).not.toBe(input)
  })

  it('matches a known channel transform and strength blend', () => {
    const input = new Uint8ClampedArray([255, 0, 128, 99])
    const swapped = generateLut(2, ([red, green, blue]) => [green, blue, red])
    expect([...applyLutToPixels(input, swapped, 1)]).toEqual([
      0, 128, 255, 99,
    ])
    expect([...applyLutToPixels(input, swapped, 0.5)]).toEqual([
      128, 64, 192, 99,
    ])
  })

  it('rejects incomplete pixels and strength outside 0–1', () => {
    const identity = generateLut(2, (color) => color)
    expect(() => applyLutToPixels(new Uint8ClampedArray(3), identity, 1)).toThrow(
      RangeError,
    )
    expect(() =>
      applyLutToPixels(new Uint8ClampedArray(4), identity, 1.1),
    ).toThrow(RangeError)
  })
})
