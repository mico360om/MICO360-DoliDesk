import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { EmptyState, ErrorBox, Input, Loading, OfflineBanner, StatusBadge } from '../components/ui.js'
import { colors } from '../lib/theme.js'
import { buildSqlSearch, getEntity, recordId } from '../lib/entities.js'
import { dateInRange } from '../lib/format.js'
import { useProfiles } from '../context/ProfileContext.js'
import * as api from '../lib/api.js'
import { cacheGet, cacheSet } from '../lib/cache.js'

const PAGE = 50
const PERIODS = [['all', 'All'], ['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']]

// A labelled horizontal row of selectable pill chips.
function ChipRow({ label, options, isActive, onPick }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
      <Text style={{ width: 52, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.textFaint }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => {
          const on = isActive(o)
          return (
            <Pressable
              key={o.key}
              onPress={() => onPick(o)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand : colors.card }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: on ? '#fff' : colors.textMuted }}>{o.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default function RecordListScreen({ route, navigation }) {
  const { type, title } = route.params
  const entity = getEntity(type)
  const { active } = useProfiles()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState(null)
  const [offline, setOffline] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState(entity?.sortOptions?.[0] || { sortfield: 't.rowid', sortorder: 'DESC' })
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const pageRef = useRef(0)

  useLayoutEffect(() => { navigation.setOptions({ title: title || entity?.label }) }, [navigation, title, entity])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 400)
    return () => clearTimeout(t)
  }, [query])

  const queryOpts = useCallback(
    (page) => ({ limit: PAGE, page, sortfield: sort.sortfield, sortorder: sort.sortorder, sqlfilters: buildSqlSearch(entity, debounced) }),
    [entity, sort, debounced]
  )

  const reload = useCallback(async (isRefresh = false) => {
    if (!active || !entity) return
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const first = await api.list(active, entity.key, queryOpts(0))
      setRows(first)
      pageRef.current = 0
      setHasMore(first.length === PAGE)
      setOffline(false)
      if (!debounced) cacheSet(active.url, `list:${entity.key}`, first)
    } catch (e) {
      if (!debounced) {
        const c = await cacheGet(active.url, `list:${entity.key}`)
        if (c) { setRows(c.data); pageRef.current = 0; setHasMore(false); setOffline(true); setError(null); return }
      }
      setError(e.message)
      setRows([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [active, entity, queryOpts, debounced])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading || refreshing || !active || !entity) return
    setLoadingMore(true)
    try {
      const next = pageRef.current + 1
      const more = await api.list(active, entity.key, queryOpts(next))
      pageRef.current = next
      setRows((prev) => {
        const seen = new Set(prev.map((r) => String(recordId(r))))
        return [...prev, ...more.filter((r) => !seen.has(String(recordId(r))))]
      })
      setHasMore(more.length === PAGE)
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }, [active, entity, hasMore, loading, loadingMore, refreshing, queryOpts])

  useEffect(() => { reload() }, [reload])

  // Status options derived from the loaded rows (in order of first appearance).
  const statusOptions = useMemo(() => {
    if (!entity?.status) return []
    const seen = new Map()
    for (const r of rows) {
      const l = entity.status(r).label
      if (!seen.has(l)) seen.set(l, { key: l, label: l })
    }
    return [{ key: 'all', label: 'All' }, ...seen.values()]
  }, [rows, entity])

  // Client-side refine of the loaded rows by status + date range.
  const view = useMemo(() => {
    let out = rows
    if (statusFilter !== 'all' && entity?.status) out = out.filter((r) => entity.status(r).label === statusFilter)
    if (dateRange !== 'all' && entity?.dateField) out = out.filter((r) => dateInRange(r[entity.dateField], dateRange))
    return out
  }, [rows, statusFilter, dateRange, entity])

  const filtersActive = statusFilter !== 'all' || dateRange !== 'all'

  if (!entity) return <ErrorBox message={'Unknown type: ' + type} />

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 12, paddingBottom: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Input placeholder={`Search ${entity.label.toLowerCase()}…`} value={query} onChangeText={setQuery} autoCapitalize="none" />
        {entity.sortOptions?.length > 1 ? (
          <ChipRow label="Sort" options={entity.sortOptions} isActive={(o) => o.sortfield === sort.sortfield && o.sortorder === sort.sortorder} onPick={setSort} />
        ) : null}
        {statusOptions.length > 1 ? (
          <ChipRow label="Status" options={statusOptions} isActive={(o) => o.key === statusFilter} onPick={(o) => setStatusFilter(o.key)} />
        ) : null}
        {entity.dateField ? (
          <ChipRow label="Period" options={PERIODS.map(([key, label]) => ({ key, label }))} isActive={(o) => o.key === dateRange} onPick={(o) => setDateRange(o.key)} />
        ) : null}
      </View>
      {offline ? <OfflineBanner onRetry={() => reload(true)} /> : null}
      {loading ? (
        <Loading label="Loading…" />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingTop: 12 }}
          data={view}
          keyExtractor={(r) => String(recordId(r))}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.brand} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon={entity.icon}
              title={`No ${entity.label.toLowerCase()}`}
              subtitle={debounced ? `No matches for “${debounced}”.` : filtersActive ? 'No records match the current filters.' : 'Nothing to show, or this module is disabled.'}
            />
          }
          renderItem={({ item }) => {
            const s = entity.status(item)
            return (
              <Pressable
                onPress={() => navigation.navigate('RecordDetail', { type, id: recordId(item), title: entity.title(item) })}
                style={({ pressed }) => ({ backgroundColor: pressed ? colors.subtle : colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 })}
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
