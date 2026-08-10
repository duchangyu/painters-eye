import { describe, expect, it } from 'vitest'
import { generateLut } from '../color/lut'
import { sampleLut } from './trilinearLut'

describe('sampleLut', () => {
  const identity = generateLut(2, (color) => color)

  it.each([
    [0, 0, 0],
    [1, 1, 1],
    [1, 0, 1],
    [0, 1, 0],
    [0.5, 0.5, 0.5],
    [0.25, 0.75, 0.125],
  ] as const)('preserves identity color %j', (red, green, blue) => {
    expect(sampleLut(identity, [red, green, blue])).toEqual([
      expect.closeTo(red, 6),
      expect.closeTo(green, 6),
      expect.closeTo(blue, 6),
    ])
  })

  it('interpolates all eight corners with red as the fastest coordinate', () => {
    const lut = generateLut(2, ([red, green, blue]) => [blue, red, green])
    expect(sampleLut(lut, [0.25, 0.5, 0.75])).toEqual([
      expect.closeTo(0.75, 6),
      expect.closeTo(0.25, 6),
      expect.closeTo(0.5, 6),
    ])
  })

  it('rejects malformed LUTs and out-of-range input', () => {
    expect(() => sampleLut(identity, [-0.01, 0, 0])).toThrow(RangeError)
    expect(() => sampleLut(identity, [0, 1.01, 0])).toThrow(RangeError)
    expect(() => sampleLut({ size: 2, data: [0, 0, 0] }, [0, 0, 0])).toThrow(
      RangeError,
    )
  })
})
