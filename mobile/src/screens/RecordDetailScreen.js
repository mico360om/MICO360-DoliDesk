import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Btn, Card, ErrorBox, Loading, OfflineBanner, StatusBadge } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { getEntity, recordId } from '../lib/entities.js'
import { formatDate, formatNumber, humanizeKey, lineMoney, recordMoney } from '../lib/format.js'
import { dolibarrWebUrl } from '../lib/dolibarrUrl.js'
import { useProfiles } from '../context/ProfileContext.js'
import * as api from '../lib/api.js'
import { cacheGet, cacheSet } from '../lib/cache.js'

const DATE_FIELDS = new Set(['date', 'date_lim_reglement', 'date_commande', 'datef', 'fin_validite', 'date_creation', 'date_modification', 'date_validation', 'tms'])
const MONEY_FIELDS = new Set(['total_ht', 'total_tva', 'total_ttc', 'price', 'price_ttc'])
const NUMBER_FIELDS = new Set(['stock_reel', 'weight'])
const URL_FIELDS = new Set(['url'])
const CAN_PDF = new Set(['invoices', 'orders', 'proposals', 'supplierorders', 'supplierinvoices'])

function fieldValue(record, f) {
  const v = record[f]
  if (DATE_FIELDS.has(f)) return { text: formatDate(v) }
  if (MONEY_FIELDS.has(f)) return { text: recordMoney(record, f) }
  if (NUMBER_FIELDS.has(f)) return { text: formatNumber(v) }
  if (URL_FIELDS.has(f)) return { text: String(v), link: /^https?:\/\//i.test(String(v)) ? String(v) : `https://${v}` }
  if (typeof v === 'object') return null // never render raw JSON
  return { text: String(v) }
}

async function openUrl(url) {
  try {
    if (await Linking.canOpenURL(url)) await Linking.openURL(url)
    else Alert.alert('Cannot open link', url)
  } catch {
    Alert.alert('Cannot open link', url)
  }
}

export default function RecordDetailScreen({ route }) {
  const { type, id } = route.params
  const entity = getEntity(type)
  const { active } = useProfiles()
  const [record, setRecord] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const CACHE_KEY = `detail:${type}:${id}`

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      setCustomer(null)
      setOffline(false)
      try {
        const r = await api.getOne(active, type, id)
        if (cancelled) return
        setRecord(r)
        cacheSet(active?.url, CACHE_KEY, r).catch(() => {})
        const socId = entity?.socField ? r[entity.socField] : null
        if (socId && String(socId) !== '0') {
          api.resolveThirdparties(active, [socId])
            .then((m) => { if (!cancelled) setCustomer(m[String(socId)]) })
            .catch(() => {})
        }
      } catch (e) {
        const cached = await cacheGet(active?.url, CACHE_KEY).catch(() => null)
        if (!cancelled) {
          if (cached?.data) {
            setRecord(cached.data)
            setOffline(true)
          } else {
            setError(e.message)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [active, type, id, entity, refreshKey])

  async function viewPdf() {
    setPdfBusy(true)
    try {
      const pdf = await api.downloadRecordPdf(active, type, recordId(record), record.ref)
      const safeName = (pdf.filename || 'document.pdf').replace(/[\\/]/g, '_')
      const uri = FileSystem.cacheDirectory + safeName
      await FileSystem.writeAsStringAsync(uri, pdf.content, { encoding: FileSystem.EncodingType.Base64 })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: safeName, UTI: 'com.adobe.pdf' })
      } else {
        Alert.alert('PDF saved', uri)
      }
    } catch (e) {
      Alert.alert('PDF', e.message)
    } finally {
      setPdfBusy(false)
    }
  }

  if (loading) return <Loading label="Loading record…" />
  if (error) return <ErrorBox message={error} />
  if (!record || !entity) return <ErrorBox message="Record not found." />

  const status = entity.status(record)
  const fields = entity.detailFields
    .map((f) => ({ f, val: (record[f] !== undefined && record[f] !== null && record[f] !== '') ? fieldValue(record, f) : null }))
    .filter((x) => x.val)
  const webUrl = dolibarrWebUrl(active?.url, type, recordId(record))
  const lines = Array.isArray(record.lines) ? record.lines : []
  const lineDesc = (l) => l.label || l.product_label || l.desc || l.description || l.ref || '—'

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {offline ? <OfflineBanner onRetry={() => setRefreshKey((k) => k + 1)} /> : null}
      <Card style={{ marginBottom: 14 }}>
        <Text style={{ color: colors.textFaint, fontSize: 12 }}>{entity.icon} {entity.singular} · #{record.id ?? record.rowid ?? id}</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 }}>{entity.title(record)}</Text>
        {customer ? <Text style={{ color: colors.brand, fontWeight: '600', marginTop: 4 }}>🏢 {customer}</Text> : null}
        {entity.subtitle(record) ? <Text style={{ color: colors.textMuted, marginTop: 2 }}>{entity.subtitle(record)}</Text> : null}
        <View style={{ marginTop: 10 }}><StatusBadge label={status.label} tone={status.tone} /></View>
        {entity.amount ? <Text style={{ marginTop: 10, fontSize: 18, fontWeight: '800', color: colors.text }}>{entity.amount(record)}</Text> : null}
      </Card>

      <Card>
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>Details</Text>
        {fields.map(({ f, val }) => (
          <View key={f} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', color: colors.textFaint }}>{humanizeKey(f)}</Text>
            {val.link ? (
              <Text onPress={() => openUrl(val.link)} style={{ fontSize: 15, color: colors.brand, marginTop: 2 }}>{val.text}</Text>
            ) : (
              <Text style={{ fontSize: 15, color: colors.text, marginTop: 2 }}>{val.text}</Text>
            )}
          </View>
        ))}
      </Card>

      {lines.length ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 10 }}>Line items ({lines.length})</Text>
          {lines.map((l, i) => (
            <View key={l.id || l.rowid || i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 14, color: colors.text }} numberOfLines={2}>{lineDesc(l)}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {formatNumber(l.qty)} × {lineMoney(l, record, 'subprice')}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{lineMoney(l, record, 'total_ht')}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {CAN_PDF.has(type) ? (
        <Btn title={pdfBusy ? 'Fetching PDF…' : '📄 View / share PDF'} variant="outline" onPress={viewPdf} disabled={pdfBusy} style={{ marginTop: 14 }} />
      ) : null}
      {pdfBusy ? <ActivityIndicator color={colors.brand} style={{ marginTop: 8 }} /> : null}

      {webUrl ? (
        <Btn title="Open in Dolibarr web ↗" variant="outline" onPress={() => openUrl(webUrl)} style={{ marginTop: 10 }} />
      ) : null}
    </ScrollView>
  )
}
