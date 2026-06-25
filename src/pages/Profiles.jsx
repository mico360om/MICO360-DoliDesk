import { useState } from 'react'
import { useProfiles } from '../context/ProfileContext.jsx'
import ProfileForm from '../components/ProfileForm.jsx'
import { EmptyState } from '../components/ui.jsx'
import { profiles as profilesApi } from '../api/ipc.js'

export default function Profiles() {
  const { profiles, activeId, refresh, removeProfile, switchProfile } = useProfiles()
  const [mode, setMode] = useState(null) // null | 'add' | editId
  const [testingId, setTestingId] = useState(null)
  const [results, setResults] = useState({}) // id -> { ok, version|error }

  const editing = profiles.find((p) => p.id === mode) || null

  async function handleTest(p) {
    setTestingId(p.id)
    try {
      // Switch active to this profile first so the saved key is used.
      await switchProfile(p.id)
      const res = await profilesApi.test()
      setResults((r) => ({ ...r, [p.id]: res }))
    } catch (e) {
      setResults((r) => ({ ...r, [p.id]: { ok: false, error: e.message } }))
    } finally {
      setTestingId(null)
    }
  }

  async function handleDelete(p) {
    if (!confirm(`Delete profile "${p.name}"? This removes its stored API key.`)) return
    await removeProfile(p.id)
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Profiles</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your Dolibarr accounts and API connections.</p>
        </div>
        {mode === null && (
          <button className="btn-primary" onClick={() => setMode('add')}>
            + Add profile
          </button>
        )}
      </div>

      {(mode === 'add' || editing) && (
        <div className="card mb-6 p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-200">
            {editing ? `Edit “${editing.name}”` : 'Add a new profile'}
          </h2>
          <ProfileForm
            initial={editing}
            onCancel={() => setMode(null)}
            onSaved={async () => {
              await refresh()
              setMode(null)
            }}
          />
        </div>
      )}

      {profiles.length === 0 && mode === null ? (
        <EmptyState
          icon="👤"
          title="No profiles yet"
          subtitle="Add your first Dolibarr account to start loading records."
          action={
            <button className="btn-primary" onClick={() => setMode('add')}>
              + Add profile
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => {
            const active = p.id === activeId
            const res = results[p.id]
            return (
              <div key={p.id} className="card flex items-center gap-4 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                  {(p.name || '?').slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                    {active && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-slate-500 dark:text-slate-400">{p.url}</div>
                  {res && (
                    <div className={`mt-1 text-xs ${res.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {res.ok
                        ? `✓ Connected${res.version && res.version !== 'unknown' ? ` — v${res.version}` : ''}`
                        : `✗ ${res.error}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!active && (
                    <button className="btn-ghost" onClick={() => switchProfile(p.id)}>
                      Switch to
                    </button>
                  )}
                  <button className="btn-outline" onClick={() => handleTest(p)} disabled={testingId === p.id}>
                    {testingId === p.id ? 'Testing…' : 'Test'}
                  </button>
                  <button className="btn-outline" onClick={() => setMode(p.id)}>
                    Edit
                  </button>
                  <button className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(p)}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
