import { describe, expect, it } from 'vitest'
import {
  createStaircase,
  estimateThreshold,
  updateStaircase,
} from './staircase'

describe('adaptive staircase', () => {
  it('reduces delta after two consecutive correct answers', () => {
    const initial = createStaircase({ axis: 'deutan', startDelta: 0.12 })
    const once = updateStaircase(initial, true)
    const twice = updateStaircase(once, true)

    expect(once.delta).toBe(initial.delta)
    expect(twice.delta).toBeLessThan(initial.delta)
    expect(initial.consecutiveCorrect).toBe(0)
  })

  it('records a reversal when movement changes direction', () => {
    const initial = createStaircase({ axis: 'protan', startDelta: 0.12 })
    const descending = updateStaircase(updateStaircase(initial, true), true)

    expect(updateStaircase(descending, false).reversals).toHaveLength(1)
  })

  it('finishes at the safety limit and estimates the median final reversals', () => {
    let state = createStaircase({
      axis: 'deutan',
      startDelta: 0.12,
      maxTrials: 2,
    })
    state = updateStaircase(state, false)
    state = updateStaircase(state, false)
    expect(state.status).toBe('complete')

    expect(estimateThreshold([0.08, 0.04, 0.07, 0.05, 0.06, 0.09])).toBe(
      0.065,
    )
  })
})
