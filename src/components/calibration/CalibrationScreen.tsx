import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PublicCalibrationTrial,
} from '../../calibration/session'
import type { TargetDirection } from '../../domain/calibration'
import { ProgressBar } from '../common/ProgressBar'
import { PlateCanvas } from './PlateCanvas'
import { isE2eMode } from '../../config/runtime'

export interface CalibrationAnswer {
  readonly trialId: string
  readonly selectedDirection: TargetDirection
  readonly reactionTimeMs: number
}

export interface CalibrationEngine {
  readonly trials: readonly PublicCalibrationTrial[]
  readonly recordAnswer: (answer: CalibrationAnswer) => void | Promise<void>
  readonly saveDraft: (completedTrials: number) => void | Promise<void>
}

export interface CalibrationScreenProps {
  readonly engine: CalibrationEngine
  readonly onComplete: () => void
  readonly eyebrow?: string
  readonly title?: string
  readonly note?: string
  readonly progressName?: string
  readonly testConditionByTrialId?: ReadonlyMap<string, string>
}

const KEY_DIRECTIONS: Readonly<Record<string, TargetDirection>> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
}

export function CalibrationScreen({
  engine,
  onComplete,
  eyebrow = '自适应辨色校准',
  title = '辨认开口方向',
  note = '看不清时请凭第一感觉选择；测量过程中不会显示正确答案。',
  progressName = '校准进度',
  testConditionByTrialId,
}: CalibrationScreenProps) {
  const [trialIndex, setTrialIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const startedAt = useRef<number | null>(null)
  const trial = engine.trials[trialIndex]

  useEffect(() => {
    startedAt.current = performance.now()
  }, [])

  const answer = useCallback(
    (direction: TargetDirection) => {
      if (paused || !trial) {
        return
      }

      const now = performance.now()
      const nextIndex = trialIndex + 1
      void engine.recordAnswer({
        trialId: trial.id,
        selectedDirection: direction,
        reactionTimeMs:
          startedAt.current === null
            ? 0
            : Math.max(0, Math.round(now - startedAt.current)),
      })
      void engine.saveDraft(nextIndex)
      setTrialIndex(nextIndex)
      startedAt.current = now
      if (nextIndex >= engine.trials.length) {
        onComplete()
      }
    },
    [engine, onComplete, paused, trial, trialIndex],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const direction = KEY_DIRECTIONS[event.key]
      if (direction && !event.repeat) {
        event.preventDefault()
        answer(direction)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [answer])

  if (!trial) {
    return (
      <main className="calibration-page completion-pause">
        <p className="folio">测量阶段完成</p>
        <h1>正在整理结果…</h1>
      </main>
    )
  }

  return (
    <main className="calibration-page">
      <header className="calibration-header">
        <div>
          <p className="folio">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <button
          className="quiet-button"
          type="button"
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? '继续' : '暂停'}
        </button>
      </header>

      <ProgressBar
        value={trialIndex}
        max={engine.trials.length}
        label={`${progressName} ${trialIndex}/${engine.trials.length}`}
      />

      <section
        className="instrument-stage"
        aria-live="polite"
        data-e2e-trial-id={isE2eMode ? trial.id : undefined}
        data-e2e-direction={isE2eMode ? trial.stimulus.direction : undefined}
        data-e2e-condition={
          isE2eMode ? testConditionByTrialId?.get(trial.id) : undefined
        }
      >
        {paused && (
          <div className="pause-overlay">
            <p>校准已暂停</p>
            <span>准备好后继续，显示设置请保持不变。</span>
          </div>
        )}
        <PlateCanvas
          stimulus={trial.stimulus}
          width={520}
          height={520}
          onAnswer={answer}
          disabled={paused}
        />
      </section>

      <p className="measurement-note">
        {note}
      </p>
    </main>
  )
}
