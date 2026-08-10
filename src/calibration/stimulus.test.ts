import { describe, expect, it } from 'vitest'
import { createStimulus } from './stimulus'

describe('createStimulus', () => {
  it('is reproducible and selects a valid target direction', () => {
    const first = createStimulus({ seed: 9, axis: 'deutan', delta: 0.04 })
    const second = createStimulus({ seed: 9, axis: 'deutan', delta: 0.04 })
    expect(first).toEqual(second)
    expect(['up', 'right', 'down', 'left']).toContain(first.direction)
  })

  it('keeps foreground and background luminance within tolerance', () => {
    const stimulus = createStimulus({
      seed: 3,
      axis: 'protan',
      delta: 0.03,
    })
    expect(
      Math.abs(
        stimulus.foregroundLuminance - stimulus.backgroundLuminance,
      ),
    ).toBeLessThan(0.02)
  })
})
