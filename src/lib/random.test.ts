import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './random'

describe('createSeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createSeededRandom(42)
    const b = createSeededRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('returns values in [0, 1)', () => {
    const random = createSeededRandom(7)
    expect(
      Array.from({ length: 100 }, random).every(
        (value) => value >= 0 && value < 1,
      ),
    ).toBe(true)
  })
})
