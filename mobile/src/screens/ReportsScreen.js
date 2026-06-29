import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Card, ErrorBox, Input, Loading, OfflineBanner } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { useProfiles } from '../context/ProfileContext.js'
import * as api from '../lib/api.js'
import { cacheGet, cacheSet } from '../lib/cache.js'
import { buildReport, PERIODS, REPORTS } from '../lib/reports.js'

const CAP = 3000

export default function ReportsScreen() {
  const { active, company } = useProfiles()
  const cur = company?.currency_code || company?.currency
  const [report, setReport] = useState('period')
  const [period, setPeriod] = useState('all')
  const [invoices, setInvoices] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (isRefresh = false) => {
    if (!active) return
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const rows = await api.listAll(active, 'invoices', { cap: CAP })
      const ids = [...new Set(rows.map((r) => String(r.socid ?? r.fk_soc ?? '')).filter((x) => x && x !== '0'))]
      const resolved = ids.length ? await api.resolveThirdparties(active, ids) : {}
      setInvoices(rows)
      setNames(resolved)
      setOffline(false)
      cacheSet(active.url, 'reports', { invoices: rows, names: resolved })
    } catch (e) {
      const c = await cacheGet(active.url, 'reports')
      if (c) {
        setInvoices(c.data.invoices || [])
        setNames(c.data.names || {})
        setOffline(true)
        setError(null)
      } else {
        setError(e.message)
        setInvoices([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [active])

  useEffect(() => { load() }, [load])

  const [rowQuery, setRowQuery] = useState('')
  const table = useMemo(() => buildReport(report, { invoices, names, period, cur }), [report, invoices, names, period, cur])
  const usesPeriod = report === 'period' || report === 'customer'
  const chartMax = useMemo(() => (table.chart ? Math.max(1, ...table.chart.map((c) => c.value)) : 1), [table])

  // Client-side search across the first (label) column — e.g. customer / month.
  const visibleRows = useMemo(() => {
    const q = rowQuery.trim().toLowerCase()
    if (!q || !table.columns?.length) return table.rows
    const first = table.columns[0]
    return table.rows.filter((r) => String(first.render(r)).toLowerCase().includes(q))
  }, [table, rowQuery])

  if (loading) return <Loading label="Building reports…" />
  if (error) return <ErrorBox message={error} onRetry={load} />

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    {offline ? <OfflineBanner onRetry={() => load(true)} /> : null}
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {REPORTS.map((r) => {
          const on = r.key === report
          return (
            <Pressable key={r.key} onPress={() => setReport(r.key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand : colors.card }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : colors.textMuted }}>{r.icon} {r.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{table.title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 12 }}>{table.subtitle}</Text>

      {usesPeriod ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {PERIODS.map(([v, l]) => {
            const on = v === period
            return (
              <Pressable key={v} onPress={() => setPeriod(v)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: on ? colors.brand : colors.card, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: on ? '#fff' : colors.textMuted }}>{l}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      {table.chart ? (
        <Card style={{ marginBottom: 12 }}>
          {table.chart.map((c) => (
            <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ width: 46, fontSize: 11, color: colors.textMuted }}>{c.label}</Text>
              <View style={{ flex: 1, height: 14, backgroundColor: colors.track, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((c.value / chartMax) * 100)}%`, height: '100%', backgroundColor: colors.brand }} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {!table.rows.length ? (
        <Card><Text style={{ color: colors.textFaint, textAlign: 'center', paddingVertical: 20 }}>No data for this report.</Text></Card>
      ) : (
        <>
          {table.rows.length > 1 ? (
            <Input placeholder={`Filter ${table.columns[0].label.toLowerCase()}…`} value={rowQuery} onChangeText={setRowQuery} autoCapitalize="none" style={{ marginBottom: 10 }} />
          ) : null}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {/* header */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.subtle, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              {table.columns.map((c) => (
                <Text key={c.label} style={{ flex: c.grow ? 2 : 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, textAlign: c.align === 'right' ? 'right' : 'left' }} numberOfLines={1}>{c.label}</Text>
              ))}
            </View>
            {visibleRows.length ? visibleRows.map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: i < visibleRows.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                {table.columns.map((c) => (
                  <Text key={c.label} style={{ flex: c.grow ? 2 : 1, fontSize: 13, color: c.grow ? colors.text : colors.textMuted, fontWeight: c.grow ? '600' : '400', textAlign: c.align === 'right' ? 'right' : 'left' }} numberOfLines={1}>{c.render(row)}</Text>
                ))}
              </View>
            )) : (
              <Text style={{ color: colors.textFaint, textAlign: 'center', paddingVertical: 16 }}>No rows match “{rowQuery}”.</Text>
            )}
            {table.footer && visibleRows.length ? (
              <View style={{ flexDirection: 'row', backgroundColor: colors.subtle, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                {table.columns.map((c, i) => (
                  <Text key={c.label} style={{ flex: c.grow ? 2 : 1, fontSize: 13, fontWeight: '700', color: colors.text, textAlign: c.align === 'right' ? 'right' : 'left' }} numberOfLines={1}>
                    {i === 0 ? 'Total' : c.foot ? c.foot(visibleRows) : ''}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        </>
      )}
    </ScrollView>
    </View>
  )
}
