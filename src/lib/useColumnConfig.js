import { useCallback, useEffect, useMemo, useState } from 'react'

// Per-list column configuration (order + visibility) persisted in
// localStorage, so a user's column choices survive restarts. Reconciles the
// saved config against the current column set (handles added/removed columns).

const keyFor = (entityKey) => `dolidesk:cols:${entityKey}`

function load(entityKey, allKeys) {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(keyFor(entityKey)) || 'null')
  } catch {
    saved = null
  }
  const savedOrder = Array.isArray(saved?.order) ? saved.order.filter((k) => allKeys.includes(k)) : []
  const missing = allKeys.filter((k) => !savedOrder.includes(k))
  const order = [...savedOrder, ...missing]
  const hidden = Array.isArray(saved?.hidden) ? saved.hidden.filter((k) => allKeys.includes(k)) : []
  return { order, hidden }
}

export function useColumnConfig(entityKey, allColumns) {
  const allKeys = useMemo(() => allColumns.map((c) => c.key), [allColumns])
  const signature = allKeys.join('|')

  const [config, setConfig] = useState(() => load(entityKey, allKeys))

  // Re-load / reconcile when the list (or its columns) changes.
  useEffect(() => {
    setConfig(load(entityKey, allKeys))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, signature])

  const persist = useCallback(
    (next) => {
      setConfig(next)
      try {
        localStorage.setItem(keyFor(entityKey), JSON.stringify(next))
      } catch {
        /* ignore quota errors */
      }
    },
    [entityKey]
  )

  const toggle = useCallback(
    (k) =>
      persist({
        ...config,
        hidden: config.hidden.includes(k) ? config.hidden.filter((x) => x !== k) : [...config.hidden, k],
      }),
    [config, persist]
  )

  const move = useCallback(
    (k, dir) => {
      const order = [...config.order]
      const i = order.indexOf(k)
      const j = dir === 'up' ? i - 1 : i + 1
      if (i < 0 || j < 0 || j >= order.length) return
      ;[order[i], order[j]] = [order[j], order[i]]
      persist({ ...config, order })
    },
    [config, persist]
  )

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(keyFor(entityKey))
    } catch {
      /* ignore */
    }
    setConfig(load(entityKey, allKeys))
  }, [entityKey, allKeys])

  const orderedColumns = useMemo(
    () => config.order.map((k) => allColumns.find((c) => c.key === k)).filter(Boolean),
    [config.order, allColumns]
  )
  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => !config.hidden.includes(c.key)),
    [orderedColumns, config.hidden]
  )

  const isHidden = useCallback((k) => config.hidden.includes(k), [config.hidden])
  const isCustomized = config.hidden.length > 0 || config.order.join('|') !== signature

  return { orderedColumns, visibleColumns, toggle, move, reset, isHidden, isCustomized }
}
