import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { generateLut } from '../../color/lut'
import { ARTWORKS } from '../../data/artworks'
import { ArtworkViewer } from './ArtworkViewer'

describe('ArtworkViewer', () => {
  function renderViewer() {
    const onBack = vi.fn()
    render(
      <ArtworkViewer
        artwork={ARTWORKS[0]!}
        lut={generateLut(2, (color) => color)}
        recommendedStrength={0.72}
        onBack={onBack}
      />,
    )
    return { onBack }
  }

  it('opens on the original and enables the recommendation explicitly', async () => {
    const user = userEvent.setup()
    renderViewer()

    expect(screen.getByText('原始数字图像')).toBeVisible()
    expect(screen.getByRole('slider', { name: '增强强度' })).toHaveValue('0')
    await user.click(screen.getByRole('button', { name: '开启个人增强' }))
    expect(screen.getByText('个人增强')).toBeVisible()
    expect(screen.getByRole('slider', { name: '增强强度' })).toHaveValue('72')
  })

  it('temporarily reveals the original while pointer or Space is held', async () => {
    const user = userEvent.setup()
    renderViewer()
    await user.click(screen.getByRole('button', { name: '开启个人增强' }))
    const stage = screen.getByTestId('artwork-stage')

    fireEvent.pointerDown(stage)
    expect(screen.getByText('按住查看原图')).toBeVisible()
    fireEvent.pointerUp(stage)
    expect(screen.getByText('个人增强')).toBeVisible()

    stage.focus()
    fireEvent.keyDown(stage, { code: 'Space' })
    expect(screen.getByText('按住查看原图')).toBeVisible()
    fireEvent.keyUp(stage, { code: 'Space' })
    expect(screen.getByText('个人增强')).toBeVisible()
  })

  it('changes strength and zoom, supports comparison, and gates interpretation', async () => {
    const user = userEvent.setup()
    const { onBack } = renderViewer()

    expect(screen.queryByText(/梵高有意让红与绿/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '展开色彩解读' }))
    expect(screen.getByText(/梵高有意让红与绿/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: '并排比较' }))
    expect(screen.getByTestId('artwork-stage')).toHaveAttribute(
      'data-layout',
      'split',
    )
    await user.click(screen.getByRole('button', { name: '放大' }))
    expect(screen.getByTestId('artwork-stage')).toHaveStyle({
      '--artwork-zoom': '1.25',
    })
    await user.click(screen.getByRole('button', { name: '返回画廊' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
