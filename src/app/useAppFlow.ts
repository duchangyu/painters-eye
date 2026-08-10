import { useCallback, useState } from 'react'
import type { DisplayConditions } from '../domain/calibration'

export type AppPhase = 'setup' | 'calibration' | 'validation'

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

  return {
    phase,
    displayConditions,
    beginCalibration,
    beginValidation: () => setPhase('validation'),
  }
}
