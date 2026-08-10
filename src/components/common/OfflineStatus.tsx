import { useEffect, useState } from 'react'

const OFFLINE_SESSION_KEY = 'color-master:offline'

export function OfflineStatus() {
  const [online, setOnline] = useState(
    () =>
      navigator.onLine &&
      sessionStorage.getItem(OFFLINE_SESSION_KEY) !== 'true',
  )

  useEffect(() => {
    const showOnline = () => {
      sessionStorage.removeItem(OFFLINE_SESSION_KEY)
      setOnline(true)
    }
    const showOffline = () => {
      sessionStorage.setItem(OFFLINE_SESSION_KEY, 'true')
      setOnline(false)
    }
    async function verifyConnection() {
      if (!navigator.onLine) {
        showOffline()
        return
      }
      if (typeof window.fetch !== 'function') return
      try {
        await window.fetch(`/__color_master_online__?t=${Date.now()}`, {
          method: 'HEAD',
          cache: 'no-store',
        })
        showOnline()
      } catch {
        showOffline()
      }
    }
    window.addEventListener('online', showOnline)
    window.addEventListener('offline', showOffline)
    void verifyConnection()
    return () => {
      window.removeEventListener('online', showOnline)
      window.removeEventListener('offline', showOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="offline-status" role="status">
      离线模式 · 本地画廊与查看器仍可使用
    </div>
  )
}
