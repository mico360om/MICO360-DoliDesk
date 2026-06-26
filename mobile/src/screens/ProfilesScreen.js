import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Btn, Card } from '../components/ui.js'
import ProfileForm from '../components/ProfileForm.js'
import { colors } from '../lib/theme.js'
import { testConnection } from '../lib/api.js'
import { getProfileWithKey } from '../lib/store.js'
import { useProfiles } from '../context/ProfileContext.js'

export default function ProfilesScreen() {
  const { profiles, activeId, switchProfile, removeProfile } = useProfiles()
  const [mode, setMode] = useState(null) // null | 'add' | editId
  const [results, setResults] = useState({})
  const editing = profiles.find((p) => p.id === mode) || null

  async function test(p) {
    try {
      const full = await getProfileWithKey(p.id)
      const res = await testConnection(full)
      setResults((r) => ({ ...r, [p.id]: res }))
    } catch (e) {
      setResults((r) => ({ ...r, [p.id]: { ok: false, error: e.message } }))
    }
  }

  function confirmDelete(p) {
    Alert.alert('Delete profile', `Delete “${p.name}” and its stored API key?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeProfile(p.id) },
    ])
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {(mode === 'add' || editing) ? (
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 }}>{editing ? `Edit “${editing.name}”` : 'Add profile'}</Text>
          <ProfileForm initial={editing} onDone={() => setMode(null)} onCancel={() => setMode(null)} />
        </Card>
      ) : (
        <Btn title="+ Add profile" onPress={() => setMode('add')} style={{ marginBottom: 16 }} />
      )}

      {profiles.map((p) => {
        const active = p.id === activeId
        const res = results[p.id]
        return (
          <Card key={p.id} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{(p.name || '?').slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={1}>{p.name}</Text>
                  {active ? <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '700' }}>● Active</Text> : null}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{p.url}</Text>
                {res ? <Text style={{ fontSize: 12, marginTop: 2, color: res.ok ? '#15803d' : '#b91c1c' }}>{res.ok ? `✓ Connected${res.version && res.version !== 'unknown' ? ` — v${res.version}` : ''}` : `✗ ${res.error}`}</Text> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {!active ? <Btn title="Switch to" variant="outline" onPress={() => switchProfile(p.id)} style={{ flexGrow: 1 }} /> : null}
              <Btn title="Test" variant="outline" onPress={() => test(p)} style={{ flexGrow: 1 }} />
              <Btn title="Edit" variant="outline" onPress={() => setMode(p.id)} style={{ flexGrow: 1 }} />
              <Btn title="Delete" variant="danger" onPress={() => confirmDelete(p)} style={{ flexGrow: 1 }} />
            </View>
          </Card>
        )
      })}
    </ScrollView>
  )
}
