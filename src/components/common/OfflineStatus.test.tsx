import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OfflineStatus } from './OfflineStatus'

const originalOnline = navigator.onLine

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  })
}

afterEach(() => {
  setOnline(originalOnline)
  sessionStorage.removeItem('color-master:offline')
})

describe('OfflineStatus', () => {
  it('announces offline use and clears the notice after reconnecting', () => {
    setOnline(false)
    render(<OfflineStatus />)
    expect(screen.getByRole('status')).toHaveTextContent(
      '离线模式 · 本地画廊与查看器仍可使用',
    )

    setOnline(true)
    act(() => window.dispatchEvent(new Event('online')))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
