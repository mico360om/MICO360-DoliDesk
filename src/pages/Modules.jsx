import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/ipc.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import { ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui.jsx'

const METHOD_TONE = {
  GET: 'bg-emerald-50 text-emerald-700',
  POST: 'bg-brand-50 text-brand-700',
  PUT: 'bg-amber-50 text-amber-700',
  DELETE: 'bg-rose-50 text-rose-700',
  PATCH: 'bg-violet-50 text-violet-700',
}

export default function Modules() {
  const { activeProfile, activeId } = useProfiles()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.modules())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, activeId])

  const { custom, core } = useMemo(() => {
    const mods = data?.modules || []
    const q = query.trim().toLowerCase()
    const filtered = q ? mods.filter((m) => m.name.toLowerCase().includes(q)) : mods
    return {
      custom: filtered.filter((m) => !m.isCore),
      core: filtered.filter((m) => m.isCore),
    }
  }, [data, query])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        icon="🧩"
        title="Modules"
        subtitle={<>API modules enabled on <span className="font-medium text-slate-700 dark:text-slate-300">{activeProfile?.name}</span></>}
        actions={<button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>}
      />

      {loading ? (
        <Loading label="Discovering installed modules…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? null : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="API modules" value={data.total} />
            <Stat label="Custom / add-on" value={data.customCount} tone="violet" />
            <Stat label="Core" value={data.total - data.customCount} tone="slate" />
            <Stat label="Host" value={data.host || '—'} small />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            ℹ️ This lists modules that expose a REST API. Installed modules <strong>without</strong> an API
            (or with the API sub-feature disabled) won't appear here. Core vs custom is a best-effort
            classification based on standard Dolibarr module names.
          </div>

          <input
            className="input max-w-sm"
            placeholder="Filter modules…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {/* Custom modules first — this is the answer to "are custom modules installed?" */}
          <Section
            title="Custom / add-on modules"
            empty="No custom API modules detected — only standard Dolibarr modules are exposed."
            modules={custom}
            customSection
          />

          <Section title="Core modules" empty="No core modules match your filter." modules={core} />
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'brand', small }) {
  const tones = {
    brand: 'text-brand-700 dark:text-brand-400',
    violet: 'text-violet-700 dark:text-violet-400',
    slate: 'text-slate-700 dark:text-slate-200',
  }
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 font-bold ${tones[tone]} ${small ? 'truncate text-sm' : 'text-2xl tabular-nums'}`}>
        {value}
      </div>
    </div>
  )
}

function Section({ title, modules, empty, customSection }) {
  const navigate = useNavigate()
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title} <span className="text-slate-400">({modules.length})</span>
      </h2>
      {modules.length === 0 ? (
        <div className="card px-5 py-6 text-center text-sm text-slate-400">{empty}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.key}
              className={`card p-4 ${customSection ? 'border-violet-200 ring-1 ring-violet-100 dark:border-violet-900 dark:ring-violet-900/40' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{m.name}</span>
                {customSection ? (
                  <StatusBadge label="Custom" tone="blue" />
                ) : (
                  <StatusBadge label="Core" tone="slate" />
                )}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {m.paths} endpoint{m.paths === 1 ? '' : 's'}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {m.methods.map((mt) => (
                  <span
                    key={mt}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${METHOD_TONE[mt] || 'bg-slate-100 text-slate-600'}`}
                  >
                    {mt}
                  </span>
                ))}
                {m.methods.includes('GET') && (
                  <button
                    className="ml-auto rounded-md px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
                    onClick={() => navigate(m.key.includes('statement') ? '/statements' : `/explore/${m.key}`)}
                  >
                    Browse →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
