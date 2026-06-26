import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import ProfileSwitcher from './components/ProfileSwitcher.jsx'
import LockScreen from './components/LockScreen.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import { useProfiles } from './context/ProfileContext.jsx'
import { useSettings } from './context/SettingsContext.jsx'
import { Loading } from './components/ui.jsx'
import Dashboard from './pages/Dashboard.jsx'
import RecordList from './pages/RecordList.jsx'
import RecordDetail from './pages/RecordDetail.jsx'
import Modules from './pages/Modules.jsx'
import { ExploreList, ExploreDetail } from './pages/Explore.jsx'
import Statements from './pages/Statements.jsx'
import Profiles from './pages/Profiles.jsx'
import Settings from './pages/Settings.jsx'
import Welcome from './pages/Welcome.jsx'
import { useLocation } from 'react-router-dom'

export default function App() {
  const { loading, hasProfiles } = useProfiles()
  const { settings, loaded: settingsLoaded } = useSettings()
  const [unlocked, setUnlocked] = useState(false)
  const location = useLocation()

  // Wait until settings are known so we don't flash the wrong theme/lock state.
  if (!settingsLoaded || loading) {
    return (
      <div className="grid h-full place-items-center bg-slate-100 dark:bg-slate-950">
        <Loading label="Starting MICO360 DoliDesk…" />
      </div>
    )
  }

  // PIN lock gate.
  if (settings.security?.lockEnabled && settings.security?.hasPin && !unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />
  }

  // First-run: no profiles → setup screen (settings still reachable).
  if (!hasProfiles && location.pathname !== '/profiles' && location.pathname !== '/settings') {
    return <Welcome />
  }

  return (
    <div className="flex h-full overflow-hidden">
      <CommandPalette />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <UpdateBanner />
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <Brand />
          <ProfileSwitcher />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/records/:type" element={<RecordList />} />
            <Route path="/records/:type/:id" element={<RecordDetail />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/explore/:module" element={<ExploreList />} />
            <Route path="/explore/:module/:id" element={<ExploreDetail />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

// Header brand area — shows the connected Dolibarr company when available,
// falling back to the active profile name.
function Brand() {
  const { activeProfile, company, companyLogo } = useProfiles()
  const companyName = company && (company.name || company.nom)
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {companyName ? (
        <>
          {companyLogo ? (
            <span className="flex h-7 items-center justify-center overflow-hidden rounded-md bg-white px-1 ring-1 ring-slate-200 dark:ring-slate-700">
              <img src={companyLogo} alt={companyName} className="h-5 w-auto object-contain" />
            </span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
              {companyName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{companyName}</span>
            {company.town && <span className="ml-1 text-slate-400">· {company.town}</span>}
          </span>
        </>
      ) : activeProfile ? (
        <span className="text-slate-500 dark:text-slate-400">
          Connected to <span className="font-semibold text-slate-700 dark:text-slate-200">{activeProfile.name}</span>
        </span>
      ) : (
        <span className="text-slate-500 dark:text-slate-400">No active profile</span>
      )}
    </div>
  )
}
