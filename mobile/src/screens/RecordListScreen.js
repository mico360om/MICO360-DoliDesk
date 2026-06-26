import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { EmptyState, ErrorBox, Input, Loading, StatusBadge } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { getEntity, recordId } from '../lib/entities.js'
import { useProfiles } from '../context/ProfileContext.js'
import * as api from '../lib/api.js'

export default function RecordListScreen({ route, navigation }) {
  const { type, title } = route.params
  const entity = getEntity(type)
  const { active } = useProfiles()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  useLayoutEffect(() => { navigation.setOptions({ title: title || entity?.label }) }, [navigation, title, entity])

  const load = useCallback(async () => {
    if (!active || !entity) return
    setLoading(true)
    setError(null)
    try {
      setRows(await api.list(active, entity.key, { limit: 100 }))
    } catch (e) {
      setError(e.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [active, entity])

  useEffect(() => { load() }, [load])

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !entity) return rows
    return rows.filter((r) => entity.searchFields.some((f) => String(r[f] ?? '').toLowerCase().includes(q)))
  }, [rows, query, entity])

  if (!entity) return <ErrorBox message={'Unknown type: ' + type} />

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Input placeholder={`Search ${entity.label.toLowerCase()}…`} value={query} onChangeText={setQuery} autoCapitalize="none" />
      </View>
      {loading ? (
        <Loading label="Loading…" />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingTop: 12 }}
          data={view}
          keyExtractor={(r) => String(recordId(r))}
          ListEmptyComponent={<EmptyState icon={entity.icon} title={`No ${entity.label.toLowerCase()}`} subtitle="Nothing to show, or this module is disabled." />}
          renderItem={({ item }) => {
            const s = entity.status(item)
            return (
              <Pressable
                onPress={() => navigation.navigate('RecordDetail', { type, id: recordId(item), title: entity.title(item) })}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#f8fafc' : colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>{entity.title(item)}</Text>
                    {entity.subtitle(item) ? <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: 13 }} numberOfLines={1}>{entity.subtitle(item)}</Text> : null}
                  </View>
                  <StatusBadge label={s.label} tone={s.tone} />
                </View>
                {entity.amount ? <Text style={{ marginTop: 6, fontWeight: '700', color: colors.text }}>{entity.amount(item)}</Text> : null}
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}
