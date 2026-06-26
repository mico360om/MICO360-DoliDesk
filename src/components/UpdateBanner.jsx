import { useEffect, useRef, useState } from 'react'
import { update as updateApi, appInfo } from '../api/ipc.js'
import { useSettings } from '../context/SettingsContext.jsx'

// Global, auto-notifying update banner. Listens for update events, shows a
// progress bar while downloading, a desktop notification when found, and a
// restart prompt once downloaded.
export default function UpdateBanner() {
  const { settings } = useSettings()
  const [status, setStatus] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const notified = useRef(false)

  useEffect(() => {
    const off = updateApi.onStatus((s) => {
      setStatus(s)
      setDismissed(false)
      if (s.state === 'available' && !notified.current && settings.notifications?.updates !== false) {
        notified.current = true
        appInfo.notify({ title: 'Update available', body: `MICO360 DoliDesk v${s.version || ''} is downloading.` })
      }
    })
    updateApi.check().catch(() => {})
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (dismissed || !status) return null
  const st = status.state
  if (!['available', 'downloading', 'downloaded'].includes(st)) return null

  return (
    <div className="flex items-center gap-3 border-b border-brand-200 bg-brand-50 px-6 py-2 text-sm dark:border-brand-900 dark:bg-brand-950/40">
      <span>⬆️</span>
      <div className="flex-1 text-brand-800 dark:text-brand-200">
        {st === 'available' && <span>Update {status.version ? `v${status.version} ` : ''}found — downloading…</span>}
        {st === 'downloading' && (
          <div className="flex items-center gap-3">
            <span>Downloading update…</span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-brand-200 dark:bg-brand-900">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${status.percent || 0}%` }} />
            </div>
            <span className="tabular-nums">{status.percent || 0}%</span>
          </div>
        )}
        {st === 'downloaded' && <span className="font-medium">Update {status.version ? `v${status.version} ` : ''}ready to install.</span>}
      </div>
      {st === 'downloaded' && (
        <button className="btn-primary py-1.5" onClick={() => updateApi.install()}>Restart &amp; install</button>
      )}
      <button className="text-brand-700/70 hover:text-brand-900 dark:text-brand-300/70" onClick={() => setDismissed(true)} aria-label="Dismiss">✕</button>
    </div>
  )
}
