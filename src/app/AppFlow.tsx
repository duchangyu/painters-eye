import { useEffect, useMemo, useRef, useState } from 'react'
import { createAdaptiveCalibrationSession } from '../calibration/adaptiveSession'
import {
  assessQuickCheck,
  createQuickCheckTrials,
  quickCheckRequirement,
  toQuickCheckResponse,
  type QuickCheckAssessment,
  type QuickCheckResponse,
} from '../calibration/quickCheck'
import type { DisplayConditions, TrialResponse } from '../domain/calibration'
import type { CalibrationProfileV1 } from '../domain/profile'
import type { ProfileValidationSummary } from '../domain/profile'
import { buildCompensationLut, generateLut } from '../color/lut'
import {
  CalibrationScreen,
  type CalibrationAnswer,
  type CalibrationEngine,
} from '../components/calibration/CalibrationScreen'
import { GalleryScreen } from '../components/gallery/GalleryScreen'
import { ProfileSettings } from '../components/profile/ProfileSettings'
import { ResultsScreen } from '../components/results/ResultsScreen'
import { DisplaySetup } from '../components/setup/DisplaySetup'
import { ArtworkViewer } from '../components/viewer/ArtworkViewer'
import { ARTWORKS, findArtwork, type ArtworkRecord } from '../data/artworks'
import {
  calculateRepeatConsistency,
  fitProfile,
  type FittedBehavioralProfile,
} from '../profile/fitProfile'
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
import {
  CALIBRATION_SCHEDULE_VERSION,
  clearCalibrationDraft,
  loadCalibrationDraft,
  saveCalibrationDraft,
  type StoredCalibrationDraft,
} from './calibrationDraft'
import { useAppFlow } from './useAppFlow'
import { isE2eMode } from '../config/runtime'

const SELECTED_ARTWORK_KEY = 'color-master:selected-artwork'

function profileValidationSummary(
  metrics: ValidationMetrics,
): ProfileValidationSummary {
  return {
    passed: metrics.passed,
    personalizedAccuracy: metrics.byCondition.personalized.accuracy,
    originalAccuracy: metrics.byCondition.original.accuracy,
    genericAccuracy: metrics.byCondition.generic.accuracy,
    medianReactionTimeMs:
      metrics.byCondition.personalized.medianReactionTimeMs,
    originalMedianReactionTimeMs:
      metrics.byCondition.original.medianReactionTimeMs,
    genericMedianReactionTimeMs:
      metrics.byCondition.generic.medianReactionTimeMs,
    personalizedMedianReactionTimeMs:
      metrics.byCondition.personalized.medianReactionTimeMs,
    originalControlAccuracy: metrics.byCondition.original.controlAccuracy,
    personalizedControlAccuracy:
      metrics.byCondition.personalized.controlAccuracy,
    repeatConsistency: metrics.repeatConsistency,
  }
}

export function AppFlow() {
  const flow = useAppFlow()
  const [calibrationDraft, setCalibrationDraft] =
    useState<StoredCalibrationDraft | null>(loadCalibrationDraft)
  const responses = useRef<TrialResponse[]>([])
  const validationResponses = useRef<ValidationResponse[]>([])
  const quickCheckResponses = useRef<QuickCheckResponse[]>([])
  const customImageUrl = useRef<string | null>(null)
  const [profile, setProfile] = useState<FittedBehavioralProfile | null>(null)
  const [activeProfile, setActiveProfile] =
    useState<CalibrationProfileV1 | null>(null)
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null)
  const [quickCheckResult, setQuickCheckResult] =
    useState<QuickCheckAssessment | null>(null)
  const [originalOnly, setOriginalOnly] = useState(false)
  const [calibrationRun, setCalibrationRun] = useState(0)
  const [selectedArtwork, setSelectedArtwork] =
    useState<ArtworkRecord | null>(null)
  const calibrationSeed =
    calibrationRun === 0 && calibrationDraft
      ? calibrationDraft.seed
      : 20260810 + calibrationRun
  const calibrationSession = useMemo(() => {
    const session = createAdaptiveCalibrationSession({
        seed: calibrationSeed,
        ...(isE2eMode ? { trialsPerAxis: 1, repeatCount: 0 } : {}),
      })
    if (calibrationRun === 0 && calibrationDraft) {
      const replayed = calibrationDraft.responses
        .slice(0, calibrationDraft.completedTrials)
        .map((response) =>
          session.recordAnswer({
            trialId: response.id,
            selectedDirection: response.selectedDirection,
            reactionTimeMs: response.reactionTimeMs,
          }),
        )
      if (replayed.some((response) => response === undefined)) {
        // The schedule drifted from the draft (should not happen past the
        // loader's id/version checks): drop the draft rather than fit on
        // mismatched evidence.
        clearCalibrationDraft()
        responses.current = []
      } else {
        responses.current = replayed as TrialResponse[]
      }
    }
    return session
  }, [calibrationDraft, calibrationRun, calibrationSeed])
  const schedule = calibrationSession.scheduledTrials
  const engine = useMemo<CalibrationEngine>(() => {
    return {
      get trials() {
        return calibrationSession.trials
      },
      recordAnswer(answer: CalibrationAnswer) {
        const response = calibrationSession.recordAnswer(answer)
        if (response) responses.current.push(response)
      },
      saveDraft(completedTrials: number) {
        saveCalibrationDraft({
          version: CALIBRATION_SCHEDULE_VERSION,
          seed: calibrationSeed,
          completedTrials,
          responses: responses.current,
        })
      },
    }
  }, [calibrationSeed, calibrationSession])
  const validationTrials = useMemo(
    () =>
      profile
        ? createValidationSession({
            seed: 20260811,
            personalized: profile,
            excludedSeeds: schedule.map((trial) => trial.stimulus.seed),
            ...(isE2eMode ? { trialsPerCondition: 4 } : {}),
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
  const validationTestConditions = useMemo(
    () =>
      new Map(validationTrials.map((trial) => [trial.id, trial.condition])),
    [validationTrials],
  )
  const quickCheckTrials = useMemo(
    () =>
      activeProfile ? createQuickCheckTrials(activeProfile, 20260812) : [],
    [activeProfile],
  )
  const quickCheckEngine = useMemo<CalibrationEngine>(() => {
    const trialsById = new Map(quickCheckTrials.map((trial) => [trial.id, trial]))
    return {
      trials: quickCheckTrials,
      recordAnswer(answer: CalibrationAnswer) {
        const trial = trialsById.get(answer.trialId)
        if (!trial) return
        quickCheckResponses.current.push(
          toQuickCheckResponse(trial, {
            selectedDirection: answer.selectedDirection,
          }),
        )
      },
      saveDraft(completedTrials: number) {
        localStorage.setItem(
          'color-master:quick-check-draft',
          JSON.stringify({
            completedTrials,
            responses: quickCheckResponses.current,
          }),
        )
      },
    }
  }, [quickCheckTrials])
  const viewerLut = useMemo(
    () =>
      originalOnly
        ? generateLut(2, (color) => color)
        : activeProfile
          ? activeProfile.lut
          : profile
            ? buildCompensationLut(profile)
            : generateLut(2, (color) => color),
    [activeProfile, originalOnly, profile],
  )

  const restoreProfile = flow.restoreProfile
  const resumeCalibration = flow.resumeCalibration
  useEffect(() => {
    let cancelled = false

    async function restore() {
      const browserStorage = globalThis.window?.localStorage
      if (!browserStorage) return
      const serialized = browserStorage.getItem(
        'color-master:display-conditions',
      )
      if (!serialized) return
      let conditions: DisplayConditions
      try {
        conditions = JSON.parse(serialized) as DisplayConditions
      } catch {
        return
      }
      const fingerprint = createDisplayFingerprint(conditions)
      const repository = await createProfileRepository()
      try {
        const exact = await repository.loadActiveProfile(fingerprint)
        const candidate = exact ?? (await repository.loadMostRecentProfile())
        if (cancelled) return
        if (!candidate) {
          if (
            calibrationDraft &&
            calibrationDraft.completedTrials < calibrationSession.trials.length
          ) {
            resumeCalibration(conditions)
          }
          return
        }
        const requirement = quickCheckRequirement({
          profile: candidate,
          currentDisplayFingerprint: fingerprint,
          lastCheckedAt: browserStorage.getItem(
            `color-master:quick-check:${candidate.id}`,
          ),
        })
        setActiveProfile(candidate)
        const rememberedArtwork = findArtwork(
          browserStorage.getItem(SELECTED_ARTWORK_KEY) ?? '',
        )
        if (rememberedArtwork) setSelectedArtwork(rememberedArtwork)
        restoreProfile(conditions, requirement !== 'not-due')
      } finally {
        repository.close()
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [
    calibrationDraft,
    calibrationSession.trials.length,
    restoreProfile,
    resumeCalibration,
  ])

  useEffect(
    () => () => {
      if (customImageUrl.current) {
        URL.revokeObjectURL(customImageUrl.current)
      }
    },
    [],
  )

  function completeCalibration() {
    clearCalibrationDraft()
    setCalibrationDraft(null)
    setProfile(fitProfile(responses.current, calibrationSession.staircases()))
    flow.beginValidation()
  }

  function completeValidation() {
    setMetrics(
      summarizeValidation(
        validationResponses.current,
        calculateRepeatConsistency(responses.current),
      ),
    )
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
        algorithmVersion: '1.1.0-mvp-adaptive',
        createdAt,
        displayFingerprint: createDisplayFingerprint(flow.displayConditions),
        displayConditions: flow.displayConditions,
        sourceSessionId: 'local-calibration-session',
        rawTrials: responses.current,
        thresholds: profile.thresholds,
        compensation: profile,
        confidence: profile.confidence,
        validation: profileValidationSummary(metrics),
        lut: buildCompensationLut(profile),
      }
      const repository = await createProfileRepository()
      try {
        await repository.promoteValidatedProfile(value)
        setActiveProfile(value)
        setOriginalOnly(false)
        localStorage.setItem(
          `color-master:quick-check:${value.id}`,
          createdAt,
        )
      } finally {
        repository.close()
      }
    } else {
      setOriginalOnly(true)
    }
    flow.openGallery()
  }

  function handleDisplaySetup(conditions: DisplayConditions) {
    if (!activeProfile) {
      clearCalibrationDraft()
      setCalibrationDraft(null)
      responses.current = []
      validationResponses.current = []
      flow.beginCalibration(conditions)
      return
    }
    quickCheckResponses.current = []
    setQuickCheckResult(null)
    flow.beginQuickCheck(conditions)
  }

  async function completeQuickCheck() {
    if (!activeProfile || !flow.displayConditions) return
    const result = assessQuickCheck(activeProfile, quickCheckResponses.current)
    setQuickCheckResult(result)
    if (result.status !== 'pass') {
      flow.showQuickCheckResult()
      return
    }

    const fingerprint = createDisplayFingerprint(flow.displayConditions)
    const verifiedProfile: CalibrationProfileV1 = {
      ...activeProfile,
      id:
        fingerprint === activeProfile.displayFingerprint
          ? activeProfile.id
          : `${activeProfile.id}-display-${Date.now()}`,
      displayFingerprint: fingerprint,
      displayConditions: flow.displayConditions,
    }
    const checkedAt = new Date().toISOString()
    const repository = await createProfileRepository()
    try {
      await repository.promoteValidatedProfile(verifiedProfile)
      setActiveProfile(verifiedProfile)
      setOriginalOnly(false)
      localStorage.setItem(
        `color-master:quick-check:${verifiedProfile.id}`,
        checkedAt,
      )
    } finally {
      repository.close()
    }
    flow.openGallery()
  }

  function restartCalibration() {
    if (!flow.displayConditions) return
    responses.current = []
    validationResponses.current = []
    quickCheckResponses.current = []
    setProfile(null)
    setMetrics(null)
    setQuickCheckResult(null)
    clearCalibrationDraft()
    setCalibrationDraft(null)
    setCalibrationRun((value) => value + 1)
    flow.beginCalibration(flow.displayConditions)
  }

  async function importProfile(value: CalibrationProfileV1) {
    const repository = await createProfileRepository()
    try {
      await repository.promoteValidatedProfile(value)
    } finally {
      repository.close()
    }
    setActiveProfile(value)
    setOriginalOnly(false)
    flow.restoreProfile(value.displayConditions, false)
  }

  function openPersonalImage(file: File) {
    if (customImageUrl.current) {
      URL.revokeObjectURL(customImageUrl.current)
    }
    const imagePath = URL.createObjectURL(file)
    customImageUrl.current = imagePath
    localStorage.removeItem(SELECTED_ARTWORK_KEY)
    setSelectedArtwork({
      id: `personal-${file.name}`,
      titleZh: file.name,
      titleOriginal: '个人图片',
      artist: '仅在本机处理',
      date: '当前会话',
      imagePath,
      objectPageUrl: 'about:blank',
      imageSourceUrl: imagePath,
      rights: 'User provided',
      rationale: '用于观察你熟悉的颜色关系。',
      interpretation:
        '这是一张个人图片。请先看原图，再开启增强，并留意细节分离是否改善、肤色或中性色是否失真。',
    })
  }

  function openArtwork(artwork: ArtworkRecord) {
    localStorage.setItem(SELECTED_ARTWORK_KEY, artwork.id)
    setSelectedArtwork(artwork)
  }

  function closeArtwork() {
    localStorage.removeItem(SELECTED_ARTWORK_KEY)
    setSelectedArtwork(null)
  }

  if (flow.phase === 'setup') {
    return (
      <DisplaySetup
        onComplete={handleDisplaySetup}
        initialConditions={activeProfile?.displayConditions}
        mode={activeProfile ? 'review' : 'calibrate'}
      />
    )
  }
  if (flow.phase === 'calibration') {
    return (
      <CalibrationScreen
        key="calibration"
        engine={engine}
        initialTrialIndex={
          calibrationRun === 0 ? calibrationDraft?.completedTrials : 0
        }
        onComplete={completeCalibration}
      />
    )
  }
  if (flow.phase === 'validation') {
    return (
      <CalibrationScreen
        key="validation"
        engine={validationEngine}
        onComplete={completeValidation}
        eyebrow="独立验证 · 条件已隐藏"
        title="再辨认一组新图形"
        progressName="验证进度"
        note="三种显示方式会随机出现；界面不会提示当前条件或正确答案。"
        testConditionByTrialId={validationTestConditions}
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
  if (flow.phase === 'quick-check' && activeProfile) {
    return (
      <CalibrationScreen
        key="quick-check"
        engine={quickCheckEngine}
        onComplete={() => void completeQuickCheck()}
        eyebrow="配置短复核 · 8 题"
        title="确认这套增强仍然合适"
        progressName="复核进度"
        note="请保持与原校准相近的亮度。短复核不会自动删除旧配置。"
      />
    )
  }
  if (
    flow.phase === 'quick-check-result' &&
    activeProfile &&
    quickCheckResult
  ) {
    return (
      <main className="calibration-page completion-pause quick-check-result">
        <p className="folio">短复核未通过</p>
        <h1>
          {quickCheckResult.status === 'review-display-settings'
            ? '先检查显示设置'
            : '建议重新完整校准'}
        </h1>
        <p>
          目标轴正确率 {Math.round(quickCheckResult.dominantAccuracy * 100)}%，
          控制轴正确率 {Math.round(quickCheckResult.controlAccuracy * 100)}%。旧配置仍然保留。
        </p>
        <div className="quick-check-actions">
          <button className="primary-button" type="button" onClick={flow.reviewDisplay}>
            检查显示设置
          </button>
          <button className="quiet-button" type="button" onClick={restartCalibration}>
            重新完整校准
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setOriginalOnly(true)
              flow.openGallery()
            }}
          >
            暂时只看原图
          </button>
        </div>
      </main>
    )
  }
  if (flow.phase === 'profile' && activeProfile) {
    return (
      <ProfileSettings
        profile={activeProfile}
        validation={
          metrics
            ? profileValidationSummary(metrics)
            : activeProfile.validation ?? { passed: true }
        }
        onClose={flow.openGallery}
        onImport={importProfile}
        onReviewDisplay={flow.reviewDisplay}
        onRecalibrate={restartCalibration}
      />
    )
  }
  if (flow.phase === 'gallery') {
    if (selectedArtwork) {
      return (
        <ArtworkViewer
          artwork={selectedArtwork}
          lut={viewerLut}
          recommendedStrength={
            originalOnly
              ? 0
              : activeProfile?.compensation.recommendedStrength ??
                profile?.recommendedStrength ??
                0
          }
          onBack={closeArtwork}
        />
      )
    }
    return (
      <GalleryScreen
        artworks={ARTWORKS}
        onSelect={openArtwork}
        onUpload={openPersonalImage}
        onOpenProfile={activeProfile ? flow.openProfile : undefined}
      />
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
