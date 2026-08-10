import { describe, expect, it } from 'vitest'
import { createAdaptiveCalibrationSession } from './adaptiveSession'

function directionFor(session: ReturnType<typeof createAdaptiveCalibrationSession>, id: string) {
  return session.trials.find((trial) => trial.id === id)!.stimulus.direction
}

// Trials are replaced immutably as staircases adapt, so always re-read the
// session instead of holding on to an earlier snapshot.
function axisTrials(
  session: ReturnType<typeof createAdaptiveCalibrationSession>,
  axis: string,
) {
  return session.trials.filter((trial) => trial.stimulus.axis === axis)
}

describe('adaptive calibration session', () => {
  it('feeds answers back into later trials on the same axis', () => {
    const session = createAdaptiveCalibrationSession({
      seed: 17,
      trialsPerAxis: 3,
      repeatCount: 0,
    })
    const firstDelta = axisTrials(session, 'protan')[0]!.stimulus.delta

    const first = axisTrials(session, 'protan')[0]!
    session.recordAnswer({
      trialId: first.id,
      selectedDirection: directionFor(session, first.id),
      reactionTimeMs: 500,
    })
    expect(axisTrials(session, 'protan')[1]!.stimulus.delta).toBe(firstDelta)

    const second = axisTrials(session, 'protan')[1]!
    session.recordAnswer({
      trialId: second.id,
      selectedDirection: directionFor(session, second.id),
      reactionTimeMs: 500,
    })
    expect(axisTrials(session, 'protan')[2]!.stimulus.delta).toBeLessThan(
      firstDelta,
    )
  })

  it('raises the next delta after an incorrect answer', () => {
    const session = createAdaptiveCalibrationSession({
      seed: 18,
      trialsPerAxis: 2,
      repeatCount: 0,
    })
    const first = axisTrials(session, 'deutan')[0]!
    const firstDelta = first.stimulus.delta
    const correct = directionFor(session, first.id)
    const incorrect = correct === 'up' ? 'right' : 'up'

    session.recordAnswer({
      trialId: first.id,
      selectedDirection: incorrect,
      reactionTimeMs: 500,
    })
    expect(axisTrials(session, 'deutan')[1]!.stimulus.delta).toBeGreaterThan(
      firstDelta,
    )
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
