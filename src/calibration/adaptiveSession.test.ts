import { describe, expect, it } from 'vitest'
import { createAdaptiveCalibrationSession } from './adaptiveSession'

function directionFor(session: ReturnType<typeof createAdaptiveCalibrationSession>, id: string) {
  return session.trials.find((trial) => trial.id === id)!.stimulus.direction
}

describe('adaptive calibration session', () => {
  it('feeds answers back into later trials on the same axis', () => {
    const session = createAdaptiveCalibrationSession({
      seed: 17,
      trialsPerAxis: 3,
      repeatCount: 0,
    })
    const protan = session.trials.filter(
      (trial) => trial.stimulus.axis === 'protan',
    )
    const firstDelta = protan[0]!.stimulus.delta

    session.recordAnswer({
      trialId: protan[0]!.id,
      selectedDirection: directionFor(session, protan[0]!.id),
      reactionTimeMs: 500,
    })
    expect(protan[1]!.stimulus.delta).toBe(firstDelta)

    session.recordAnswer({
      trialId: protan[1]!.id,
      selectedDirection: directionFor(session, protan[1]!.id),
      reactionTimeMs: 500,
    })
    expect(protan[2]!.stimulus.delta).toBeLessThan(firstDelta)
  })

  it('raises the next delta after an incorrect answer', () => {
    const session = createAdaptiveCalibrationSession({
      seed: 18,
      trialsPerAxis: 2,
      repeatCount: 0,
    })
    const deutan = session.trials.filter(
      (trial) => trial.stimulus.axis === 'deutan',
    )
    const firstDelta = deutan[0]!.stimulus.delta
    const correct = directionFor(session, deutan[0]!.id)
    const incorrect = correct === 'up' ? 'right' : 'up'

    session.recordAnswer({
      trialId: deutan[0]!.id,
      selectedDirection: incorrect,
      reactionTimeMs: 500,
    })
    expect(deutan[1]!.stimulus.delta).toBeGreaterThan(firstDelta)
  })

  it('keeps seeded repeats pixel-identical to their hidden source', () => {
    const session = createAdaptiveCalibrationSession({
      seed: 19,
      trialsPerAxis: 3,
      repeatCount: 4,
    })

    for (const repeat of session.scheduledTrials.filter(
      (trial) => trial.repeatedFromTrialId,
    )) {
      const source = session.scheduledTrials.find(
        (trial) => trial.id === repeat.repeatedFromTrialId,
      )
      expect(repeat.stimulus).toEqual(source?.stimulus)
    }
  })
})
