import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext.jsx'
import { useProfiles } from '../context/ProfileContext.jsx'
import { Toggle, Row, ConfirmDialog, Toast } from '../components/ui.jsx'
import { BRAND } from '../lib/brand.js'
import { LANGUAGES } from '../lib/i18n.js'
import { AboutPage, PrivacyPage, TermsPage } from './legal.jsx'
import {
  settings as settingsApi,
  cache as cacheApi,
  update as updateApi,
  diagnostics as diagApi,
  appInfo,
} from '../api/ipc.js'

const NAV = [
  { key: 'display', label: 'Display', icon: '🎨' },
  { key: 'updates', label: 'Updates', icon: '⬆️' },
  { key: 'data', label: 'Data & Cache', icon: '🗄️' },
  { key: 'security', label: 'Security', icon: '🔐' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'support', label: 'Support', icon: '🛟' },
  { key: 'about', label: 'About', icon: 'ℹ️' },
  { key: 'privacy', label: 'Privacy Policy', icon: '📄' },
  { key: 'terms', label: 'Terms & Conditions', icon: '📜' },
]

export default function Settings() {
  const [params, setParams] = useSearchParams()
  const section = params.get('s') || 'display'
  const [toast, setToast] = useState(null)
  const notify = (message, type) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Settings sub-menu */}
      <nav className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Settings</div>
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setParams({ s: n.key })}
            className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              section === n.key
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span>{n.icon}</span> {n.label}
          </button>
        ))}
      </nav>

      {/* Section content */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {section === 'display' && <DisplaySection />}
        {section === 'updates' && <UpdatesSection notify={notify} />}
        {section === 'data' && <DataSection notify={notify} />}
        {section === 'security' && <SecuritySection notify={notify} />}
        {section === 'notifications' && <NotificationsSection notify={notify} />}
        {section === 'support' && <SupportSection notify={notify} />}
        {section === 'about' && <AboutPage />}
        {section === 'privacy' && <PrivacyPage />}
        {section === 'terms' && <TermsPage />}
      </div>

      <Toast toast={toast} />
    </div>
  )
}

function Card({ title, desc, children }) {
  return (
    <div className="mb-5 max-w-2xl">
      {title && <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>}
      {desc && <p className="mb-3 mt-0.5 text-sm text-slate-500 dark:text-slate-400">{desc}</p>}
      <div className="card divide-y divide-slate-100 px-5 dark:divide-slate-800">{children}</div>
    </div>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-sm dark:border-slate-700 dark:bg-slate-800">
      {options.map(([val, lbl]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`rounded-md px-3 py-1.5 font-medium transition ${
            value === val
              ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {lbl}
        </button>
      ))}
    </div>
  )
}

// ---- Display ---------------------------------------------------------------
function DisplaySection() {
  const { settings, update } = useSettings()
  const d = settings.display
  return (
    <Card title="Display" desc="Appearance, language, density and zoom. Changes apply instantly and are saved.">
      <Row title="Language" subtitle="Interface language (Arabic switches to right-to-left).">
        <select className="input w-auto" value={d.language || 'en'} onChange={(e) => update('display', { language: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </Row>
      <Row title="Theme" subtitle="Light, dark, or follow your system.">
        <Segmented
          value={d.theme}
          onChange={(v) => update('display', { theme: v })}
          options={[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']]}
        />
      </Row>
      <Row title="Table density" subtitle="Compact fits more rows on screen.">
        <Segmented
          value={d.density}
          onChange={(v) => update('display', { density: v })}
          options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]}
        />
      </Row>
      <Row title="Zoom level" subtitle="Scale the whole interface.">
        <select className="input w-auto" value={d.zoom} onChange={(e) => update('display', { zoom: Number(e.target.value) })}>
          {[100, 125, 150, 175].map((z) => (
            <option key={z} value={z}>{z}%</option>
          ))}
        </select>
      </Row>
      <Row title="Default dashboard layout" subtitle="Choose the dashboard's default arrangement.">
        <Segmented
          value={d.dashboardLayout}
          onChange={(v) => update('display', { dashboardLayout: v })}
          options={[['default', 'Default'], ['compact', 'Compact']]}
        />
      </Row>
    </Card>
  )
}

// ---- Updates ---------------------------------------------------------------
function UpdatesSection({ notify }) {
  const { settings, update } = useSettings()
  const u = settings.updates
  const [version, setVersion] = useState('…')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    appInfo.version().then((v) => setVersion(v.version)).catch(() => {})
    const off = updateApi.onStatus((s) => setStatus(s))
    return off
  }, [])

  async function check() {
    setStatus({ state: 'checking' })
    try {
      const res = await updateApi.check()
      if (res.state === 'dev') {
        setStatus({ state: 'dev' })
        notify('Updates are only available in the installed app.', 'error')
      }
    } catch (e) {
      setStatus({ state: 'error', error: e.message })
      notify('Update check failed: ' + e.message, 'error')
    }
  }

  const statusText = {
    checking: 'Checking for updates…',
    available: `Update available: v${status?.version}`,
    none: 'You are on the latest version.',
    downloading: `Downloading… ${status?.percent ?? 0}%`,
    downloaded: 'Update downloaded — restart to install.',
    error: `Error: ${status?.error}`,
    dev: 'Running in development — packaged build required for updates.',
  }[status?.state]

  return (
    <Card title="Updates" desc="Keep MICO360 DoliDesk up to date.">
      <Row title="Current version">
        <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">v{version}</span>
      </Row>
      <Row title="Automatic updates" subtitle="Download and prompt to install new versions.">
        <Toggle checked={u.autoUpdate} onChange={(v) => update('updates', { autoUpdate: v })} />
      </Row>
      <Row title="Check for updates on startup">
        <Toggle checked={u.checkOnStartup} onChange={(v) => update('updates', { checkOnStartup: v })} />
      </Row>
      <Row title="Check now" subtitle={statusText || 'Manually check for a newer release.'}>
        <div className="flex gap-2">
          {status?.state === 'downloaded' && (
            <button className="btn-primary" onClick={() => updateApi.install()}>Restart &amp; install</button>
          )}
          {status?.state === 'available' && (
            <button className="btn-primary" onClick={() => updateApi.download().catch((e) => notify(e.message, 'error'))}>Download</button>
          )}
          <button className="btn-outline" onClick={check}>Check for updates</button>
        </div>
      </Row>
      <Row title="Release notes" subtitle="View changelog and past releases.">
        <button className="btn-outline" onClick={() => appInfo.openExternal(BRAND.repo + '/releases')}>Open releases</button>
      </Row>
      <Row title="Manual download" subtitle="Download the latest build from the repository.">
        <button className="btn-outline" onClick={() => appInfo.openExternal(BRAND.repo)}>Open repository</button>
      </Row>
    </Card>
  )
}

// ---- Data & Cache ----------------------------------------------------------
function DataSection({ notify }) {
  const [confirm, setConfirm] = useState(null)
  const { reset: resetSettings } = useSettings()

  async function clearCache() {
    await cacheApi.clear()
    notify('Cache cleared.')
  }
  async function exportBackup() {
    const r = await settingsApi.exportBackup()
    if (r.saved) notify('Backup saved to ' + r.path)
  }
  async function importBackup() {
    const r = await settingsApi.importBackup()
    if (r.imported) notify('Backup imported. Restart to apply everywhere.')
  }

  return (
    <>
      <Card title="Data & Cache" desc="Manage locally cached data and back up your configuration.">
        <Row title="Clear local cache" subtitle="Discards cached customer names and lookups.">
          <button className="btn-outline" onClick={() => setConfirm('cache')}>Clear cache</button>
        </Row>
        <Row title="Refresh all records" subtitle="Clears caches so the next load fetches fresh data.">
          <button className="btn-outline" onClick={clearCache}>Refresh</button>
        </Row>
        <Row title="Reset filters" subtitle="Clears saved list filters and search.">
          <button className="btn-outline" onClick={() => { sessionStorage.clear(); notify('Filters reset.') }}>Reset</button>
        </Row>
      </Card>
      <Card title="Backup" desc="Export or restore your settings and profiles (same machine).">
        <Row title="Export settings backup" subtitle="Saves settings and profiles to a JSON file.">
          <button className="btn-outline" onClick={exportBackup}>Export</button>
        </Row>
        <Row title="Import settings backup" subtitle="Restores from a backup file.">
          <button className="btn-outline" onClick={importBackup}>Import</button>
        </Row>
        <Row title="Reset all settings" subtitle="Restore defaults (your PIN is preserved).">
          <button className="btn-outline" onClick={() => setConfirm('reset')}>Reset settings</button>
        </Row>
      </Card>

      <ConfirmDialog
        open={confirm === 'cache'}
        title="Clear local cache?"
        message="Cached lookups will be discarded and refetched as needed."
        confirmLabel="Clear cache"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { setConfirm(null); await clearCache() }}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset all settings?"
        message="Display, update, notification and security toggles return to defaults."
        confirmLabel="Reset"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { setConfirm(null); await resetSettings(); notify('Settings reset to defaults.') }}
      />
    </>
  )
}

// ---- Security --------------------------------------------------------------
function SecuritySection({ notify }) {
  const { settings, refresh } = useSettings()
  const { clearCredentials } = useProfiles()
  const sec = settings.security
  const [pinMode, setPinMode] = useState(false)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState(null)

  async function setMask(v) {
    await settingsApi.set({ security: { maskApiKey: v } })
    refresh()
  }
  async function savePin() {
    if (pin.length < 4) return notify('PIN must be at least 4 digits.', 'error')
    await settingsApi.setPin(pin)
    setPin('')
    setPinMode(false)
    await refresh()
    notify('App lock enabled.')
  }
  async function disablePin() {
    await settingsApi.clearPin()
    await refresh()
    notify('App lock disabled.')
  }

  return (
    <>
      <Card title="Security" desc="Protect access to the app and your stored credentials.">
        <Row title="Mask API key" subtitle="Hide API keys behind dots in forms.">
          <Toggle checked={sec.maskApiKey} onChange={setMask} />
        </Row>
        <Row title="Require PIN to open the app" subtitle={sec.hasPin ? 'A PIN is currently set.' : 'No PIN set.'}>
          {sec.hasPin ? (
            <button className="btn-outline" onClick={disablePin}>Disable PIN</button>
          ) : pinMode ? (
            <div className="flex items-center gap-2">
              <input
                className="input w-28 text-center tracking-widest"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
              <button className="btn-primary" onClick={savePin}>Save</button>
              <button className="btn-ghost" onClick={() => { setPinMode(false); setPin('') }}>Cancel</button>
            </div>
          ) : (
            <button className="btn-outline" onClick={() => setPinMode(true)}>Set PIN</button>
          )}
        </Row>
        <Row title="Secure local storage" subtitle="API keys are encrypted with your OS keychain.">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Enabled</span>
        </Row>
        <Row title="Clear saved credentials" subtitle="Removes all profiles and their stored API keys.">
          <button className="btn-danger" onClick={() => setConfirm('creds')}>Clear all</button>
        </Row>
      </Card>

      <ConfirmDialog
        open={confirm === 'creds'}
        title="Clear all saved credentials?"
        message="Every profile and its encrypted API key will be permanently removed from this device."
        confirmLabel="Delete everything"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { setConfirm(null); await clearCredentials(); notify('All credentials cleared.') }}
      />
    </>
  )
}

// ---- Notifications ---------------------------------------------------------
function NotificationsSection({ notify }) {
  const { settings, update } = useSettings()
  const n = settings.notifications
  return (
    <Card title="Notifications" desc="Choose which desktop notifications you receive.">
      <Row title="Update notifications" subtitle="When a new version is available.">
        <Toggle checked={n.updates} onChange={(v) => update('notifications', { updates: v })} />
      </Row>
      <Row title="API error notifications" subtitle="When a Dolibarr request fails.">
        <Toggle checked={n.apiErrors} onChange={(v) => update('notifications', { apiErrors: v })} />
      </Row>
      <Row title="Sync completion notifications" subtitle="When a data refresh finishes.">
        <Toggle checked={n.syncComplete} onChange={(v) => update('notifications', { syncComplete: v })} />
      </Row>
      <Row title="Test notification">
        <button className="btn-outline" onClick={() => { appInfo.notify({ title: 'MICO360 DoliDesk', body: 'Notifications are working.' }); notify('Test notification sent.') }}>
          Send test
        </button>
      </Row>
    </Card>
  )
}

// ---- Support ---------------------------------------------------------------
function SupportSection({ notify }) {
  const [diag, setDiag] = useState(null)
  const [showDiag, setShowDiag] = useState(false)

  async function viewLogs() {
    setDiag(await diagApi.get())
    setShowDiag(true)
  }
  async function exportDiag() {
    const r = await diagApi.export()
    if (r.saved) notify('Diagnostic report saved to ' + r.path)
  }

  return (
    <>
      <Card title="Support" desc="Get help and report problems.">
        <Row title="Contact support" subtitle={BRAND.email}>
          <button className="btn-outline" onClick={() => appInfo.openExternal(`mailto:${BRAND.email}`)}>Email us</button>
        </Row>
        <Row title="Report an issue" subtitle="Open a ticket on the project tracker.">
          <button className="btn-outline" onClick={() => appInfo.openExternal(BRAND.issues)}>Report issue</button>
        </Row>
        <Row title="Documentation / help" subtitle="Read the project README and guides.">
          <button className="btn-outline" onClick={() => appInfo.openExternal(BRAND.repo + '#readme')}>Open docs</button>
        </Row>
        <Row title="View diagnostics" subtitle="App version and environment details.">
          <button className="btn-outline" onClick={viewLogs}>View</button>
        </Row>
        <Row title="Export diagnostic report" subtitle="Save environment info to share with support.">
          <button className="btn-outline" onClick={exportDiag}>Export</button>
        </Row>
      </Card>

      {showDiag && diag && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4" onClick={() => setShowDiag(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">Diagnostics</h3>
            <dl className="space-y-1.5 text-sm">
              {Object.entries(diag).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="truncate text-right font-medium text-slate-700 dark:text-slate-200">{String(v)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 text-right">
              <button className="btn-primary" onClick={() => setShowDiag(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
