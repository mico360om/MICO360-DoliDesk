import React, { useEffect, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { Card } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { useProfiles } from '../context/ProfileContext.js'
import { useTheme } from '../context/ThemeContext.js'
import { getAppLock, setAppLock } from '../lib/store.js'

const APP_VERSION = '0.1.5'
const APPEARANCES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]
const WEBSITE = 'https://www.mico360.com'
const EMAIL = 'info@mico360.om'

export default function SettingsScreen() {
  const { active, company } = useProfiles()
  const { pref, setAppearance } = useTheme()
  const [lock, setLock] = useState(false)
  const [bioLabel, setBioLabel] = useState('biometric / PIN')

  useEffect(() => {
    getAppLock().then(setLock)
    LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => {
      if (types?.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) setBioLabel('Face / PIN')
      else if (types?.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) setBioLabel('fingerprint / PIN')
    }).catch(() => {})
  }, [])

  async function toggleLock(next) {
    if (next) {
      const hasHw = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      if (!hasHw || !enrolled) {
        Alert.alert('Not available', 'Set up a fingerprint, face unlock, or screen-lock PIN on this device first, then enable the app lock.')
        return
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to enable app lock', disableDeviceFallback: false })
      if (!res.success) return
    }
    await setAppLock(next)
    setLock(next)
  }

  async function openLink(url) {
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url)
    } catch {}
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>Connection</Text>
        <Row label="Active profile" value={active?.name || '—'} />
        <Row label="Company" value={company?.name || '—'} />
        <Row label="API URL" value={active?.url || '—'} />
        <Row label="Currency" value={company?.currency_code || company?.currency || '—'} />
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>Appearance</Text>
        <View style={{ flexDirection: 'row', backgroundColor: colors.subtle, borderRadius: 10, padding: 3 }}>
          {APPEARANCES.map(([v, l]) => {
            const on = v === pref
            return (
              <Pressable key={v} onPress={() => setAppearance(v)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: on ? colors.card : 'transparent', alignItems: 'center' }}>
                <Text style={{ fontWeight: '600', color: on ? colors.brand : colors.textMuted }}>{l}</Text>
              </Pressable>
            )
          })}
        </View>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>Security</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Require unlock</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Ask for {bioLabel} on launch and when reopening.</Text>
          </View>
          <Switch value={lock} onValueChange={toggleLock} trackColor={{ true: colors.brand }} />
        </View>
        <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 10 }}>
          API keys are stored in the device's secure keystore (Android Keystore / iOS Keychain) and are never shown after saving.
        </Text>
      </Card>

      <Card>
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>About</Text>
        <Row label="App" value="MICO360 DoliDesk" />
        <Row label="Version" value={APP_VERSION} />
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text onPress={() => openLink(WEBSITE)} style={{ color: colors.brand, fontWeight: '600', fontSize: 13 }}>
            🌐 {WEBSITE.replace('https://', '')}
          </Text>
          <Text onPress={() => openLink(`mailto:${EMAIL}`)} style={{ color: colors.brand, fontWeight: '600', fontSize: 13 }}>
            ✉️ {EMAIL}
          </Text>
        </View>
        <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 10 }}>
          A read-only client for the Dolibarr ERP/CRM API.
        </Text>
      </Card>
    </ScrollView>
  )
}

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 }}>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
    </View>
  )
}
