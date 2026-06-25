import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfiles } from '../context/ProfileContext.jsx'

// Account switcher shown in the top bar. Lists saved profiles, lets the
// user switch the active one, and links to profile management.
export default function ProfileSwitcher() {
  const { profiles, activeProfile, switchProfile } = useProfiles()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function initials(name) {
    return (name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm shadow-sm hover:bg-slate-50"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
          {activeProfile ? initials(activeProfile.name) : '—'}
        </span>
        <span className="max-w-[180px]">
          <span className="block truncate font-semibold text-slate-700">
            {activeProfile ? activeProfile.name : 'No profile'}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {activeProfile ? activeProfile.url : 'Add one to begin'}
          </span>
        </span>
        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-72 overflow-y-auto py-1">
            {profiles.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-500">No profiles yet.</div>
            )}
            {profiles.map((p) => {
              const active = activeProfile && p.id === activeProfile.id
              return (
                <button
                  key={p.id}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    active ? 'bg-brand-50' : ''
                  }`}
                  onClick={async () => {
                    await switchProfile(p.id)
                    setOpen(false)
                  }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-200 text-[10px] font-bold text-slate-600">
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-700">{p.name}</span>
                    <span className="block truncate text-xs text-slate-400">{p.url}</span>
                  </span>
                  {active && <span className="text-brand-600">✓</span>}
                </button>
              )
            })}
          </div>
          <div className="border-t border-slate-100">
            <button
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-slate-50"
              onClick={() => {
                setOpen(false)
                navigate('/profiles')
              }}
            >
              Manage profiles…
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
