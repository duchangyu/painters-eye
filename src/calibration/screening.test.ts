import { describe, expect, it } from 'vitest'
import type { ConfusionAxis } from '../domain/calibration'
import { findPreset } from '../color/presets'
import {
  assessScreening,
  createScreeningTrials,
  toScreeningResponse,
  type ScreeningResponse,
} from './screening'

function response(
  axis: ConfusionAxis,
  delta: number,
  correct: boolean,
): ScreeningResponse {
  return { trialId: `${axis}-${delta}`, axis, delta, correct }
}

function fullSet(answers: {
  protan: readonly boolean[]
  deutan: readonly boolean[]
  controls?: readonly boolean[]
}): ScreeningResponse[] {
  const deltas = [0.1, 0.05, 0.025]
  return [
    ...answers.protan.map((correct, index) =>
      response('protan', deltas[index]!, correct),
    ),
    ...answers.deutan.map((correct, index) =>
      response('deutan', deltas[index]!, correct),
    ),
    ...(answers.controls ?? [true, true]).map((correct, index) =>
      response(index === 0 ? 'blue-yellow-control' : 'luminance-control', 0.06, correct),
    ),
  ]
}

describe('createScreeningTrials', () => {
  it('creates 8 trials covering both target axes and controls', () => {
    const trials = createScreeningTrials(42)
    expect(trials).toHaveLength(8)
    const byAxis = new Map<string, number>()
    for (const trial of trials) {
      byAxis.set(
        trial.stimulus.axis,
        (byAxis.get(trial.stimulus.axis) ?? 0) + 1,
      )
    }
    expect(byAxis.get('protan')).toBe(3)
    expect(byAxis.get('deutan')).toBe(3)
    expect(byAxis.get('blue-yellow-control')).toBe(1)
    expect(byAxis.get('luminance-control')).toBe(1)
  })

  it('is deterministic for a fixed seed', () => {
    const first = createScreeningTrials(42)
    const second = createScreeningTrials(42)
    expect(first.map((trial) => trial.stimulus.id)).toEqual(
      second.map((trial) => trial.stimulus.id),
    )
  })
})

describe('assessScreening', () => {
  it('routes a dichromat pattern to the severe preset', () => {
    const outcome = assessScreening(
      fullSet({ protan: [false, false, false], deutan: [true, true, true] }),
    )
    expect(outcome).toEqual({ kind: 'preset', presetId: 'protan-severe' })
    expect(findPreset('protan-severe')).toBeDefined()
  })

  it('routes a moderate pattern to the moderate preset', () => {
    const outcome = assessScreening(
      fullSet({ protan: [true, true, true], deutan: [true, false, false] }),
    )
    expect(outcome).toEqual({ kind: 'preset', presetId: 'deutan-moderate' })
  })

  it('routes a mild pattern to the mild preset', () => {
    const outcome = assessScreening(
      fullSet({ protan: [true, true, false], deutan: [true, true, true] }),
    )
    expect(outcome).toEqual({ kind: 'preset', presetId: 'protan-mild' })
  })

  it('does not let lucky hard-level guesses mask a severe axis', () => {
    const outcome = assessScreening(
      fullSet({ protan: [false, false, true], deutan: [true, true, true] }),
    )
    expect(outcome).toEqual({ kind: 'preset', presetId: 'protan-severe' })
  })

  it('uses mixed when both axes are equally weak', () => {
    const outcome = assessScreening(
      fullSet({ protan: [true, false, false], deutan: [true, false, false] }),
    )
    expect(outcome).toEqual({ kind: 'preset', presetId: 'mixed-moderate' })
  })

  it('recognizes normal red-green discrimination', () => {
    const outcome = assessScreening(
      fullSet({ protan: [true, true, true], deutan: [true, true, true] }),
    )
    expect(outcome).toEqual({ kind: 'normal-vision' })
  })

  it('flags sessions that miss both control trials as unreliable', () => {
    const outcome = assessScreening(
      fullSet({
        protan: [true, true, true],
        deutan: [false, false, false],
        controls: [false, false],
      }),
    )
    expect(outcome).toEqual({ kind: 'unreliable' })
  })

  it('tolerates a single control miss', () => {
    const outcome = assessScreening(
      fullSet({
        protan: [true, true, true],
        deutan: [false, false, false],
        controls: [true, false],
      }),
    )
    expect(outcome).toEqual({ kind: 'preset', presetId: 'deutan-severe' })
  })
})

describe('toScreeningResponse', () => {
  it('records correctness against the stimulus direction', () => {
    const [trial] = createScreeningTrials(7)
    const correct = toScreeningResponse(trial!, {
      selectedDirection: trial!.stimulus.direction,
    })
    expect(correct.correct).toBe(true)
    expect(correct.axis).toBe(trial!.stimulus.axis)
    expect(correct.delta).toBe(trial!.stimulus.delta)
  })
})
