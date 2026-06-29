import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Text, View } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { getAppLock } from '../lib/store.js'
import { colors } from '../lib/theme.js'
import { Btn } from './ui.js'

// Wraps the app: when the lock preference is on, requires biometric/device-PIN
// authentication on launch and whenever the app returns from the background.
// Fails open only if the device has no biometrics/PIN enrolled, to avoid a
// permanent lock-out if device security is removed after enabling.
export default function LockGate({ children }) {
  const [ready, setReady] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [locked, setLocked] = useState(false)
  const authing = useRef(false)
  const appState = useRef(AppState.currentState)

  const authenticate = useCallback(async () => {
    if (authing.current) return
    authing.current = true
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      if (!hasHw || !enrolled) { setLocked(false); return } // fail open — can't authenticate
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock MICO360 DoliDesk',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // allow device PIN/pattern as fallback
      })
      if (res.success) setLocked(false)
    } catch {
      /* keep locked; user can retry */
    } finally {
      authing.current = false
    }
  }, [])

  // Initial load of the preference.
  useEffect(() => {
    let cancelled = false
    getAppLock().then((on) => {
      if (cancelled) return
      setEnabled(on)
      setLocked(on)
      setReady(true)
      if (on) authenticate()
    })
    return () => { cancelled = true }
  }, [authenticate])

  // Re-lock when returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current
      appState.current = next
      if (!enabled) return
      if (next === 'active' && prev.match(/inactive|background/)) {
        setLocked(true)
        authenticate()
      }
    })
    return () => sub.remove()
  }, [enabled, authenticate])

  if (!ready) return null
  if (enabled && locked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 30 }}>🔒</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16 }}>Locked</Text>
        <Text style={{ color: '#fecaca', marginTop: 6, textAlign: 'center' }}>Authenticate to open MICO360 DoliDesk.</Text>
        <Btn title="Unlock" onPress={authenticate} style={{ marginTop: 20, minWidth: 160 }} />
      </View>
    )
  }
  return children
}
