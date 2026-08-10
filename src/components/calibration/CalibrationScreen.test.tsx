import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCalibrationSchedule, toPublicTrial } from '../../calibration/session'
import { CalibrationScreen, type CalibrationEngine } from './CalibrationScreen'

describe('CalibrationScreen', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      arc: vi.fn(),
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D)
  })

  it('records pointer and keyboard answers, autosaves, and never reveals correctness', async () => {
    const user = userEvent.setup()
    const trials = createCalibrationSchedule({
      seed: 2,
      trialsPerAxis: 1,
      repeatCount: 0,
    })
      .slice(0, 2)
      .map(toPublicTrial)
    const engine: CalibrationEngine = {
      trials,
      recordAnswer: vi.fn(),
      saveDraft: vi.fn(),
    }
    render(<CalibrationScreen engine={engine} onComplete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '向上' }))
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    await waitFor(() => expect(engine.saveDraft).toHaveBeenCalledWith(1))

    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(engine.recordAnswer).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(/正确|错误|正确方向/)).not.toBeInTheDocument()
  })

  it('pauses and resumes without accepting answers while paused', async () => {
    const user = userEvent.setup()
    const trials = createCalibrationSchedule({
      seed: 4,
      trialsPerAxis: 1,
      repeatCount: 0,
    }).map(toPublicTrial)
    const engine: CalibrationEngine = {
      trials,
      recordAnswer: vi.fn(),
      saveDraft: vi.fn(),
    }
    render(<CalibrationScreen engine={engine} onComplete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '暂停' }))
    expect(screen.getByRole('button', { name: '向上' })).toBeDisabled()
    await user.keyboard('{ArrowUp}')
    expect(engine.recordAnswer).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(screen.getByRole('button', { name: '向上' })).toBeEnabled()
  })

  it('resumes at a previously saved trial without replaying answers', () => {
    const trials = createCalibrationSchedule({
      seed: 8,
      trialsPerAxis: 1,
      repeatCount: 0,
    }).map(toPublicTrial)
    const engine: CalibrationEngine = {
      trials,
      recordAnswer: vi.fn(),
      saveDraft: vi.fn(),
    }

    render(
      <CalibrationScreen
        engine={engine}
        initialTrialIndex={2}
        onComplete={vi.fn()}
      />,
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(engine.recordAnswer).not.toHaveBeenCalled()
  })
})
