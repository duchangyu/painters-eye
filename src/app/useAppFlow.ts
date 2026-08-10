import { useCallback, useState } from 'react'
import type { DisplayConditions } from '../domain/calibration'

export type AppPhase =
  | 'setup'
  | 'calibration'
  | 'validation'
  | 'results'
  | 'gallery'
  | 'profile'
  | 'quick-check'
  | 'quick-check-result'

export function useAppFlow() {
  const [phase, setPhase] = useState<AppPhase>('setup')
  const [displayConditions, setDisplayConditions] =
    useState<DisplayConditions | null>(null)

  const beginCalibration = useCallback((conditions: DisplayConditions) => {
    localStorage.setItem(
      'color-master:display-conditions',
      JSON.stringify(conditions),
    )
    setDisplayConditions(conditions)
    setPhase('calibration')
  }, [])

  const recordConditions = useCallback((conditions: DisplayConditions) => {
    localStorage.setItem(
      'color-master:display-conditions',
      JSON.stringify(conditions),
    )
    setDisplayConditions(conditions)
  }, [])

  const beginQuickCheck = useCallback(
    (conditions: DisplayConditions) => {
      recordConditions(conditions)
      setPhase('quick-check')
    },
    [recordConditions],
  )

  const resumeCalibration = useCallback(
    (conditions: DisplayConditions) => {
      recordConditions(conditions)
      setPhase('calibration')
    },
    [recordConditions],
  )

  const restoreProfile = useCallback(
    (conditions: DisplayConditions, needsQuickCheck: boolean) => {
      recordConditions(conditions)
      setPhase(needsQuickCheck ? 'quick-check' : 'gallery')
    },
    [recordConditions],
  )
  const beginValidation = useCallback(() => setPhase('validation'), [])
  const showResults = useCallback(() => setPhase('results'), [])
  const showQuickCheckResult = useCallback(
    () => setPhase('quick-check-result'),
    [],
  )
  const openGallery = useCallback(() => setPhase('gallery'), [])
  const openProfile = useCallback(() => setPhase('profile'), [])
  const reviewDisplay = useCallback(() => setPhase('setup'), [])

  return {
    phase,
    displayConditions,
    beginCalibration,
    resumeCalibration,
    beginQuickCheck,
    restoreProfile,
    beginValidation,
    showResults,
    showQuickCheckResult,
    openGallery,
    openProfile,
    reviewDisplay,
  }
}
