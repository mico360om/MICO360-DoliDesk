import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Btn, Field, Input } from './ui.js'
import { colors } from '../lib/theme.js'
import { login as apiLogin, testConnection } from '../lib/api.js'
import { useProfiles } from '../context/ProfileContext.js'

export default function ProfileForm({ initial, onDone, onCancel }) {
  const { saveProfile } = useProfiles()
  const editing = Boolean(initial?.id)
  const [mode, setMode] = useState('apikey')
  const [name, setName] = useState(initial?.name || '')
  const [url, setUrl] = useState(initial?.url || '')
  const [apiKey, setApiKey] = useState('')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [test, setTest] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleTest() {
    setError(null)
    setTest(null)
    if (!url.trim()) return setError('Enter the API URL first.')
    setBusy(true)
    try {
      if (mode === 'login') {
        if (!loginName || !password) { setError('Enter login and password.'); return }
        const token = await apiLogin(url, loginName, password)
        const res = await testConnection({ url, apiKey: token })
        setTest(res.ok ? { ok: true } : res)
      } else {
        if (!apiKey && !editing) { setError('Enter the API key.'); return }
        setTest(await testConnection({ url, apiKey }))
      }
    } catch (e) {
      setTest({ ok: false, error: e.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    setError(null)
    if (!name.trim()) return setError('Give the profile a name.')
    if (!url.trim()) return setError('Enter the API URL.')
    setBusy(true)
    try {
      let key = apiKey
      if (mode === 'login') {
        if (!loginName || !password) { setError('Enter login and password.'); setBusy(false); return }
        key = await apiLogin(url, loginName, password)
      } else if (!editing && !apiKey.trim()) {
        setError('Enter the API key.'); setBusy(false); return
      }
      await saveProfile({ id: initial?.id, name, url, apiKey: key || undefined })
      onDone?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View>
      <Field label="Account name">
        <Input placeholder="e.g. Acme Production" value={name} onChangeText={setName} autoFocus />
      </Field>
      <Field label="API URL" hint="/api/index.php is added automatically">
        <Input placeholder="https://erp.example.com" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      </Field>

      <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 14 }}>
        {[['apikey', 'API key'], ['login', 'Login & password']].map(([v, l]) => (
          <Pressable key={v} onPress={() => { setMode(v); setTest(null) }} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: mode === v ? '#fff' : 'transparent', alignItems: 'center' }}>
            <Text style={{ fontWeight: '600', color: mode === v ? colors.brand : colors.textMuted }}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'apikey' ? (
        <Field label={editing ? 'API key (blank = keep current)' : 'API key'} hint="From Dolibarr → User card → API key. Stored in the device keystore.">
          <Input placeholder={editing ? '••••••••' : 'DOLAPIKEY value'} value={apiKey} onChangeText={setApiKey} secureTextEntry autoCapitalize="none" />
        </Field>
      ) : (
        <>
          <Field label="Login"><Input placeholder="Dolibarr username" value={loginName} onChangeText={setLoginName} autoCapitalize="none" /></Field>
          <Field label="Password" hint="Only the retrieved token is stored — never the password.">
            <Input placeholder="Dolibarr password" value={password} onChangeText={setPassword} secureTextEntry />
          </Field>
        </>
      )}

      {test ? (
        <Text style={{ color: test.ok ? '#15803d' : '#b91c1c', marginBottom: 10 }}>
          {test.ok ? `✓ Connected${test.version && test.version !== 'unknown' ? ` — Dolibarr ${test.version}` : ''}` : `✗ ${test.error || 'Connection failed'}`}
        </Text>
      ) : null}
      {error ? <Text style={{ color: '#b91c1c', marginBottom: 10 }}>{error}</Text> : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title="Test" variant="outline" onPress={handleTest} disabled={busy} style={{ flex: 1 }} />
        <Btn title={editing ? 'Save' : 'Add profile'} onPress={handleSave} disabled={busy} style={{ flex: 1 }} />
      </View>
      {onCancel ? <Btn title="Cancel" variant="ghost" onPress={onCancel} style={{ marginTop: 8 }} /> : null}
    </View>
  )
}
