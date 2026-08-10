import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CalibrationProfileV1 } from '../../domain/profile'
import { exportProfileFile } from '../../storage/profileFile'
import { ProfileSettings } from './ProfileSettings'

function profile(): CalibrationProfileV1 {
  return {
    schemaVersion: 1,
    id: 'profile-settings',
    algorithmVersion: '1.0.0',
    createdAt: '2026-08-10T00:00:00.000Z',
    displayFingerprint: 'studio|1920x1080|24|2',
    displayConditions: {
      displayNickname: '书房显示器',
      brightnessDescription: '50%',
      nightShiftOff: true,
      trueToneOff: true,
      colorFiltersOff: true,
      screenWidthPx: 1920,
      screenHeightPx: 1080,
      colorDepth: 24,
      pixelRatio: 2,
      recordedAt: '2026-08-10T00:00:00.000Z',
    },
    sourceSessionId: 'session-settings',
    rawTrials: [],
    thresholds: [],
    compensation: {
      deficiency: 'deutan',
      severity: 0.5,
      recommendedStrength: 0.7,
      chromaGain: 0.4,
      lightnessGain: 0.01,
    },
    confidence: 0.8,
    lut: { size: 2, data: Array.from({ length: 24 }, () => 0) },
  }
}

describe('ProfileSettings', () => {
  it('downloads a checksummed backup and previews a valid import before confirmation', async () => {
    const user = userEvent.setup()
    const download = vi.fn()
    const onImport = vi.fn()
    render(
      <ProfileSettings
        profile={profile()}
        onClose={vi.fn()}
        onImport={onImport}
        onReviewDisplay={vi.fn()}
        download={download}
      />,
    )

    await user.click(screen.getByRole('button', { name: '导出配置备份' }))
    await waitFor(() => expect(download).toHaveBeenCalledOnce())
    expect(download.mock.calls[0]?.[1]).toContain('"checksum"')

    const contents = await exportProfileFile(profile(), { passed: true })
    await user.upload(
      screen.getByLabelText('导入配置文件'),
      new File([contents], 'profile.json', { type: 'application/json' }),
    )
    expect(await screen.findByText('待导入：书房显示器')).toBeVisible()
    expect(onImport).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '确认导入' }))
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(profile()))
  })

  it('rejects unsafe data and keeps the current profile after a failed import', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn().mockRejectedValue(new Error('storage failed'))
    render(
      <ProfileSettings
        profile={profile()}
        onClose={vi.fn()}
        onImport={onImport}
        onReviewDisplay={vi.fn()}
        download={vi.fn()}
      />,
    )

    await user.upload(
      screen.getByLabelText('导入配置文件'),
      new File(['{"unsafe":true}'], 'bad.json', { type: 'application/json' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('无法导入')
    expect(screen.getByText('当前配置：书房显示器')).toBeVisible()

    const contents = await exportProfileFile(profile(), { passed: true })
    await user.upload(
      screen.getByLabelText('导入配置文件'),
      new File([contents], 'profile.json', { type: 'application/json' }),
    )
    await user.click(await screen.findByRole('button', { name: '确认导入' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '导入失败，原配置仍保留',
    )
    expect(screen.getByText('当前配置：书房显示器')).toBeVisible()
  })
})
