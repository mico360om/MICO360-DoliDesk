import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { settings as settingsApi } from '../api/ipc.js'

const SettingsContext = createContext(null)

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur'])

const FALLBACK = {
  display: { theme: 'system', density: 'comfortable', zoom: 100, dashboardLayout: 'default', language: 'en', hiddenMenu: [] },
  updates: { autoUpdate: true, checkOnStartup: true },
  security: { lockEnabled: false, maskApiKey: true, hasPin: false },
  notifications: { updates: true, apiErrors: true, syncComplete: true },
}

// Applies visual settings to the document: theme class, density attribute,
// and content zoom. Kept here so it runs the instant settings change.
function applyDisplay(display) {
  const root = document.documentElement
  const wantDark =
    display.theme === 'dark' ||
    (display.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', wantDark)
  root.setAttribute('data-density', display.density || 'comfortable')
  root.style.zoom = `${(display.zoom || 100) / 100}`
  // Language + text direction (RTL for Arabic etc.).
  const lang = display.language || 'en'
  root.setAttribute('lang', lang)
  root.setAttribute('dir', RTL_LANGS.has(lang) ? 'rtl' : 'ltr')
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const s = await settingsApi.get()
      setSettings(s)
      applyDisplay(s.display)
    } catch {
      applyDisplay(FALLBACK.display)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // React to OS theme changes when in "system" mode.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => settings.display.theme === 'system' && applyDisplay(settings.display)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.display])

  // Merge a partial settings patch, persist it, and re-apply display.
  const update = useCallback(async (section, patch) => {
    const next = { ...settings, [section]: { ...settings[section], ...patch } }
    setSettings(next)
    applyDisplay(next.display)
    try {
      const saved = await settingsApi.set({ [section]: patch })
      setSettings(saved)
      applyDisplay(saved.display)
    } catch {
      /* keep optimistic state */
    }
  }, [settings])

  const value = useMemo(() => ({ settings, loaded, update, refresh }), [settings, loaded, update, refresh])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
