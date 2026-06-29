import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme, View } from 'react-native'
import { applyScheme, schemeColors } from '../lib/theme.js'
import { getAppearance, setAppearance as persist } from '../lib/store.js'

const Ctx = createContext(null)

// Resolves the effective light/dark scheme from the stored preference
// (system/light/dark) + the device setting, applies it to the live theme
// bindings, and remounts the subtree on change so every screen re-reads colors.
export function ThemeProvider({ children }) {
  const device = useColorScheme() || 'light'
  const [pref, setPref] = useState('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getAppearance().then((p) => { setPref(p); setReady(true) })
  }, [])

  const scheme = pref === 'system' ? device : pref
  applyScheme(scheme) // synchronous: colors/tones are correct before children render

  const setAppearance = useMemo(
    () => async (p) => { setPref(p); try { await persist(p) } catch {} },
    []
  )

  const value = useMemo(() => ({ scheme, pref, setAppearance, colors: schemeColors(scheme) }), [scheme, pref, setAppearance])

  if (!ready) return null
  return (
    <Ctx.Provider value={value}>
      {/* key remounts the tree so module-level reads of `colors` refresh */}
      <View key={scheme} style={{ flex: 1 }}>{children}</View>
    </Ctx.Provider>
  )
}

export function useTheme() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTheme must be used within ThemeProvider')
  return c
}
