import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FittedBehavioralProfile } from '../../profile/fitProfile'
import type { ValidationMetrics } from '../../validation/metrics'
import { ResultsScreen } from './ResultsScreen'

const metrics: ValidationMetrics = {
  byCondition: {
    original: { accuracy: 0.42, medianReactionTimeMs: 1200, controlAccuracy: 1 },
    generic: { accuracy: 0.58, medianReactionTimeMs: 1050, controlAccuracy: 1 },
    personalized: { accuracy: 0.81, medianReactionTimeMs: 850, controlAccuracy: 1 },
  },
  accuracyImprovement: 0.39,
  reactionTimeImprovementMs: 350,
  repeatConsistency: 0.9,
  confidence: 'high',
  passed: true,
}

const profile: FittedBehavioralProfile = {
  deficiency: 'deutan',
  severity: 0.7,
  recommendedStrength: 0.8,
  chromaGain: 0.5,
  lightnessGain: 0.01,
  confidence: 0.86,
  classification: 'behavioral-personalization',
  thresholds: [
    {
      axis: 'protan',
      delta: 0.04,
      reversalDeltas: [0.04],
      confidenceInterval: [0.03, 0.05],
    },
    {
      axis: 'deutan',
      delta: 0.1,
      reversalDeltas: [0.1],
      confidenceInterval: [0.09, 0.11],
    },
  ],
}

describe('ResultsScreen', () => {
  it('shows transparent behavioral evidence and continues explicitly', async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    render(
      <ResultsScreen
        metrics={metrics}
        profile={profile}
        onContinue={onContinue}
      />,
    )

    expect(screen.getByText('42%')).toBeVisible()
    expect(screen.getByText('81%')).toBeVisible()
    expect(screen.getByText('配置置信度')).toBeVisible()
    expect(screen.getByText('86%')).toBeVisible()
    expect(
      screen.getByText('这些结果描述当前显示器上的行为表现，不是医学诊断。'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: '保存配置并继续' }))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
