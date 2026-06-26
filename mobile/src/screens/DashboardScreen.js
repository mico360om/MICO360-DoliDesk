import React, { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { Card, ErrorBox, Loading } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { useProfiles } from '../context/ProfileContext.js'
import { ENTITIES } from '../lib/entities.js'
import * as api from '../lib/api.js'
import { formatMoney, formatMoneyShort, toNumber } from '../lib/format.js'

const CAP = 200

export default function DashboardScreen() {
  const { active, company } = useProfiles()
  const cur = company?.currency_code || company?.currency
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!active) return
    setLoading(true)
    setError(null)
    try {
      const types = Object.keys(ENTITIES)
      const settled = await Promise.all(
        types.map(async (t) => {
          try {
            return [t, await api.list(active, t, { limit: CAP })]
          } catch {
            return [t, []]
          }
        })
      )
      setData(Object.fromEntries(settled))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [active])

  useEffect(() => { load() }, [load])

  if (loading && !data) return <Loading label="Loading dashboard…" />
  if (error) return <ErrorBox message={error} onRetry={load} />
  if (!data) return null

  const inv = data.invoices || []
  const unpaid = inv.filter((r) => { const s = Number(r.status ?? r.statut); return Number(r.paye) !== 1 && s !== 0 && s !== 3 })
  const invoiceTotal = inv.reduce((s, r) => s + (toNumber(r.total_ttc) || 0), 0)
  const unpaidTotal = unpaid.reduce((s, r) => s + (toNumber(r.total_ttc) || 0), 0)
  const orderTotal = (data.orders || []).reduce((s, r) => s + (toNumber(r.total_ttc) || 0), 0)
  const tp = data.thirdparties || []
  const customers = tp.filter((r) => [1, 3].includes(Number(r.client))).length
  const suppliers = tp.filter((r) => Number(r.fournisseur) === 1).length

  const kpis = [
    { label: 'Invoiced', value: formatMoneyShort(invoiceTotal, cur), full: formatMoney(invoiceTotal, cur), tone: colors.brand },
    { label: 'Outstanding', value: formatMoneyShort(unpaidTotal, cur), full: `${unpaid.length} unpaid`, tone: '#b45309' },
    { label: 'Orders', value: formatMoneyShort(orderTotal, cur), full: `${(data.orders || []).length} orders`, tone: '#15803d' },
    { label: 'Customers', value: String(customers), full: `${suppliers} suppliers`, tone: '#1d4ed8' },
  ]

  const minis = [
    ['Invoices', String(inv.length)],
    ['Paid', String(inv.filter((r) => ENTITIES.invoices.status(r).label === 'Paid').length)],
    ['Unpaid', String(unpaid.length)],
    ['Products', String((data.products || []).length)],
  ]

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
    >
      <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12 }}>
        {company?.name || active?.name} · recent {CAP} records
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
        {kpis.map((k) => (
          <View key={k.label} style={{ width: '50%', padding: 6 }}>
            <Card>
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted }}>{k.label}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: k.tone, marginTop: 4 }}>{k.value}</Text>
              <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>{k.full}</Text>
            </Card>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginTop: 6 }}>
        {minis.map(([label, value]) => (
          <View key={label} style={{ width: '50%', padding: 6 }}>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: colors.textMuted }}>{label}</Text>
              <Text style={{ fontWeight: '700', color: colors.text }}>{value}</Text>
            </Card>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
