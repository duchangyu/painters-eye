import { useMemo, useRef } from 'react'
import {
  createCalibrationSchedule,
  toPublicTrial,
} from '../calibration/session'
import type { TrialResponse } from '../domain/calibration'
import {
  CalibrationScreen,
  type CalibrationAnswer,
  type CalibrationEngine,
} from '../components/calibration/CalibrationScreen'
import { DisplaySetup } from '../components/setup/DisplaySetup'
import { useAppFlow } from './useAppFlow'

export function AppFlow() {
  const flow = useAppFlow()
  const responses = useRef<TrialResponse[]>([])
  const schedule = useMemo(
    () => createCalibrationSchedule({ seed: 20260810 }),
    [],
  )
  const engine = useMemo<CalibrationEngine>(() => {
    const scheduleById = new Map(schedule.map((trial) => [trial.id, trial]))
    return {
      trials: schedule.map(toPublicTrial),
      recordAnswer(answer: CalibrationAnswer) {
        const scheduled = scheduleById.get(answer.trialId)
        if (!scheduled) {
          return
        }
        responses.current.push({
          id: scheduled.id,
          stimulus: scheduled.stimulus,
          selectedDirection: answer.selectedDirection,
          correct: answer.selectedDirection === scheduled.stimulus.direction,
          reactionTimeMs: answer.reactionTimeMs,
          answeredAt: new Date().toISOString(),
          repeatedFromTrialId: scheduled.repeatedFromTrialId,
        })
      },
      saveDraft(completedTrials: number) {
        localStorage.setItem(
          'color-master:calibration-draft',
          JSON.stringify({ completedTrials, responses: responses.current }),
        )
      },
    }
  }, [schedule])

  if (flow.phase === 'setup') {
    return <DisplaySetup onComplete={flow.beginCalibration} />
  }
  if (flow.phase === 'calibration') {
    return (
      <CalibrationScreen engine={engine} onComplete={flow.beginValidation} />
    )
  }

  return (
    <main className="calibration-page completion-pause">
      <p className="folio">校准数据已记录</p>
      <h1>下一步：独立盲测</h1>
      <p>我们会使用从未出现过的刺激验证个人增强是否确实有效。</p>
    </main>
  )
}
