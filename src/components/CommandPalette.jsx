import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ENTITY_LIST } from '../lib/entities.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

// Global command palette. Open with Ctrl/⌘-K; type to filter; ↑/↓ to move,
// Enter to run, Esc to close. Jumps to any page/record type, switches
// profiles, and toggles the theme.
export default function CommandPalette() {
  const navigate = useNavigate()
  const { profiles, switchProfile } = useProfiles()
  const { settings, update } = useSettings()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const commands = useMemo(() => {
    const go = (to) => () => { navigate(to); setOpen(false) }
    const list = [
      { id: 'dash', label: 'Go to Dashboard', icon: '📊', run: go('/') },
      ...ENTITY_LIST.map((e) => ({ id: 'rec-' + e.key, label: `Records: ${e.label}`, icon: e.icon, run: go(`/records/${e.key}`) })),
      { id: 'modules', label: 'Go to Modules', icon: '🧩', run: go('/modules') },
      { id: 'profiles', label: 'Go to Profiles', icon: '👤', run: go('/profiles') },
      { id: 'settings', label: 'Go to Settings', icon: '⚙️', run: go('/settings') },
      { id: 'about', label: 'Open About', icon: 'ℹ️', run: go('/settings?s=about') },
      ...profiles.map((p) => ({
        id: 'prof-' + p.id,
        label: `Switch to profile: ${p.name}`,
        icon: '🔁',
        run: () => { switchProfile(p.id); navigate('/'); setOpen(false) },
      })),
      {
        id: 'theme',
        label: `Theme: switch to ${settings.display.theme === 'dark' ? 'light' : 'dark'}`,
        icon: '🎨',
        run: () => { update('display', { theme: settings.display.theme === 'dark' ? 'light' : 'dark' }); setOpen(false) },
      },
    ]
    const q = query.trim().toLowerCase()
    return q ? list.filter((c) => c.label.toLowerCase().includes(q)) : list
  }, [query, profiles, settings.display.theme, navigate, switchProfile, update])

  if (!open) return null

  function onKeyDown(e) {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, commands.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); commands[sel]?.run() }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 pt-24" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="w-full border-b border-slate-100 bg-transparent px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:border-slate-800 dark:text-slate-100"
          placeholder="Type a command or search…  (Esc to close)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSel(0) }}
          onKeyDown={onKeyDown}
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {commands.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No matches.</li>}
          {commands.map((c, i) => (
            <li key={c.id}>
              <button
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                  i === sel ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-200' : 'text-slate-700 dark:text-slate-200'
                }`}
                onMouseEnter={() => setSel(i)}
                onClick={() => c.run()}
              >
                <span>{c.icon}</span>
                <span className="flex-1 truncate">{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
