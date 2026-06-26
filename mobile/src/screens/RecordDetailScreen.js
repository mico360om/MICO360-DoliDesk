import React, { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Card, ErrorBox, Loading, StatusBadge } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { getEntity } from '../lib/entities.js'
import { humanizeKey } from '../lib/format.js'
import { useProfiles } from '../context/ProfileContext.js'
import * as api from '../lib/api.js'

export default function RecordDetailScreen({ route }) {
  const { type, id } = route.params
  const entity = getEntity(type)
  const { active } = useProfiles()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const r = await api.getOne(active, type, id)
        if (!cancelled) setRecord(r)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [active, type, id])

  if (loading) return <Loading label="Loading record…" />
  if (error) return <ErrorBox message={error} />
  if (!record || !entity) return <ErrorBox message="Record not found." />

  const status = entity.status(record)
  const fields = entity.detailFields.filter((f) => record[f] !== undefined && record[f] !== null && record[f] !== '')
  const display = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 14 }}>
        <Text style={{ color: colors.textFaint, fontSize: 12 }}>{entity.icon} {entity.singular} · #{record.id ?? record.rowid ?? id}</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 }}>{entity.title(record)}</Text>
        {entity.subtitle(record) ? <Text style={{ color: colors.textMuted, marginTop: 4 }}>{entity.subtitle(record)}</Text> : null}
        <View style={{ marginTop: 10 }}><StatusBadge label={status.label} tone={status.tone} /></View>
      </Card>

      <Card>
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>Details</Text>
        {fields.map((f) => (
          <View key={f} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', color: colors.textFaint }}>{humanizeKey(f)}</Text>
            <Text style={{ fontSize: 15, color: colors.text, marginTop: 2 }}>{display(record[f])}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  )
}
