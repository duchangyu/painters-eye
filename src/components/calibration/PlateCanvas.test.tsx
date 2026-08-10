import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStimulus } from '../../calibration/stimulus'
import { PlateCanvas } from './PlateCanvas'

describe('PlateCanvas', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('draws supplied dots and exposes four accessible answer buttons', () => {
    const context = {
      arc: vi.fn(),
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    )
    const stimulus = createStimulus({
      seed: 12,
      axis: 'deutan',
      delta: 0.05,
    })
    const onAnswer = vi.fn()

    render(
      <PlateCanvas
        stimulus={stimulus}
        width={320}
        height={240}
        onAnswer={onAnswer}
      />,
    )

    const canvas = screen.getByRole('img', { name: '辨认圆环开口方向' })
    expect(canvas).toHaveAttribute('width', '320')
    expect(canvas).toHaveAttribute('height', '240')
    expect(context.arc).toHaveBeenCalledTimes(stimulus.dots.length)
    expect(screen.getAllByRole('button')).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: '向右' }))
    expect(onAnswer).toHaveBeenCalledWith('right')
  })
})
