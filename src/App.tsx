import { AppFlow } from './app/AppFlow'
import { OfflineStatus } from './components/common/OfflineStatus'

export function App() {
  return (
    <>
      <OfflineStatus />
      <AppFlow />
    </>
  )
}
