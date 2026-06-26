import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Card } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { useProfiles } from '../context/ProfileContext.js'

const APP_VERSION = '0.1.0'

export default function SettingsScreen() {
  const { active, company } = useProfiles()
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
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>Security</Text>
        <Text style={{ color: colors.textMuted }}>
          API keys are stored in the device’s secure keystore (Android Keystore / iOS Keychain) and are never shown after saving.
        </Text>
      </Card>

      <Card>
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>About</Text>
        <Row label="App" value="MICO360 DoliDesk" />
        <Row label="Version" value={APP_VERSION} />
        <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 8 }}>
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
