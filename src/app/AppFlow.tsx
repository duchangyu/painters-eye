import { useMemo, useRef, useState } from 'react'
import {
  createCalibrationSchedule,
  toPublicTrial,
} from '../calibration/session'
import type { TrialResponse } from '../domain/calibration'
import type { CalibrationProfileV1 } from '../domain/profile'
import { buildCompensationLut } from '../color/lut'
import {
  CalibrationScreen,
  type CalibrationAnswer,
  type CalibrationEngine,
} from '../components/calibration/CalibrationScreen'
import { ResultsScreen } from '../components/results/ResultsScreen'
import { DisplaySetup } from '../components/setup/DisplaySetup'
import { fitProfile, type FittedBehavioralProfile } from '../profile/fitProfile'
import {
  createDisplayFingerprint,
  createProfileRepository,
} from '../storage/profileRepository'
import {
  summarizeValidation,
  type ValidationMetrics,
  type ValidationResponse,
} from '../validation/metrics'
import {
  createValidationSession,
  toPublicValidationTrial,
} from '../validation/validationSession'
import { useAppFlow } from './useAppFlow'

export function AppFlow() {
  const flow = useAppFlow()
  const responses = useRef<TrialResponse[]>([])
  const validationResponses = useRef<ValidationResponse[]>([])
  const [profile, setProfile] = useState<FittedBehavioralProfile | null>(null)
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null)
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
  const validationTrials = useMemo(
    () =>
      profile
        ? createValidationSession({
            seed: 20260811,
            personalized: profile,
            excludedSeeds: schedule.map((trial) => trial.stimulus.seed),
          })
        : [],
    [profile, schedule],
  )
  const validationEngine = useMemo<CalibrationEngine>(() => {
    const trialsById = new Map(validationTrials.map((trial) => [trial.id, trial]))
    return {
      trials: validationTrials.map(toPublicValidationTrial),
      recordAnswer(answer: CalibrationAnswer) {
        const trial = trialsById.get(answer.trialId)
        if (!trial) {
          return
        }
        validationResponses.current.push({
          condition: trial.condition,
          axis: trial.stimulus.axis,
          correct: answer.selectedDirection === trial.stimulus.direction,
          reactionTimeMs: answer.reactionTimeMs,
        })
      },
      saveDraft(completedTrials: number) {
        localStorage.setItem(
          'color-master:validation-draft',
          JSON.stringify({
            completedTrials,
            responses: validationResponses.current,
          }),
        )
      },
    }
  }, [validationTrials])

  function completeCalibration() {
    setProfile(fitProfile(responses.current))
    flow.beginValidation()
  }

  function completeValidation() {
    setMetrics(summarizeValidation(validationResponses.current))
    flow.showResults()
  }

  async function saveProfileAndContinue() {
    if (!profile || !metrics || !flow.displayConditions) {
      return
    }

    if (metrics.passed) {
      const createdAt = new Date().toISOString()
      const value: CalibrationProfileV1 = {
        schemaVersion: 1,
        id: `profile-${createdAt}`,
        algorithmVersion: '1.0.0-mvp',
        createdAt,
        displayFingerprint: createDisplayFingerprint(flow.displayConditions),
        displayConditions: flow.displayConditions,
        sourceSessionId: 'local-calibration-session',
        rawTrials: responses.current,
        thresholds: profile.thresholds,
        compensation: profile,
        confidence: profile.confidence,
        lut: buildCompensationLut(profile),
      }
      const repository = await createProfileRepository()
      try {
        await repository.promoteValidatedProfile(value)
      } finally {
        repository.close()
      }
    }
    flow.openGallery()
  }

  if (flow.phase === 'setup') {
    return <DisplaySetup onComplete={flow.beginCalibration} />
  }
  if (flow.phase === 'calibration') {
    return (
      <CalibrationScreen engine={engine} onComplete={completeCalibration} />
    )
  }
  if (flow.phase === 'validation') {
    return (
      <CalibrationScreen
        engine={validationEngine}
        onComplete={completeValidation}
        eyebrow="独立验证 · 条件已隐藏"
        title="再辨认一组新图形"
        progressName="验证进度"
        note="三种显示方式会随机出现；界面不会提示当前条件或正确答案。"
      />
    )
  }
  if (flow.phase === 'results' && profile && metrics) {
    return (
      <ResultsScreen
        profile={profile}
        metrics={metrics}
        onContinue={saveProfileAndContinue}
      />
    )
  }
  if (flow.phase === 'gallery') {
    return (
      <main className="calibration-page completion-pause">
        <p className="folio">个人配置已准备</p>
        <h1>画廊正在载入</h1>
      </main>
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
