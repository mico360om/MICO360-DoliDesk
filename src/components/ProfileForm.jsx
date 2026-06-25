import { useState } from 'react'
import { profiles as profilesApi } from '../api/ipc.js'
import { Spinner } from './ui.jsx'

// Add / edit form for a Dolibarr profile. Two ways to authenticate:
//   • API key  — paste an existing DOLAPIKEY.
//   • Login    — supply username + password; the app calls /login, gets a
//                token, and stores only that token (encrypted). The password
//                is never persisted.
// Either way an inline "Test connection" hits the live API before saving.
export default function ProfileForm({ initial, onSaved, onCancel }) {
  const editing = Boolean(initial?.id)
  const [mode, setMode] = useState('apikey') // 'apikey' | 'login'
  const [name, setName] = useState(initial?.name || '')
  const [url, setUrl] = useState(initial?.url || '')
  const [apiKey, setApiKey] = useState('')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [test, setTest] = useState(null) // { ok, version|error }
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function missingCommon() {
    if (!url.trim()) return 'Enter the Dolibarr API URL.'
    return null
  }

  async function handleTest() {
    setError(null)
    setTest(null)
    const common = missingCommon()
    if (common) return setError(common)

    setTesting(true)
    try {
      if (mode === 'login') {
        if (!loginName.trim() || !password) {
          setError('Enter both the login and password.')
          return
        }
        await profilesApi.loginTest({ url, login: loginName, password })
        setTest({ ok: true })
      } else {
        if (!apiKey && !editing) {
          setError('Enter the API key.')
          return
        }
        setTest(await profilesApi.test({ url, apiKey }))
      }
    } catch (e) {
      setTest({ ok: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Give the profile a name.')
    const common = missingCommon()
    if (common) return setError(common)

    setSaving(true)
    try {
      let data
      if (mode === 'login') {
        if (!loginName.trim() || !password) {
          setError('Enter both the login and password.')
          setSaving(false)
          return
        }
        data = await profilesApi.saveLogin({ id: initial?.id, name, url, login: loginName, password })
      } else {
        if (!editing && !apiKey.trim()) {
          setError('Enter the API key.')
          setSaving(false)
          return
        }
        data = await profilesApi.save({ id: initial?.id, name, url, apiKey })
      }
      onSaved?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function switchMode(m) {
    setMode(m)
    setTest(null)
    setError(null)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Account name</label>
        <input
          className="input"
          placeholder="e.g. Acme Production"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="label">API URL</label>
        <input
          className="input"
          placeholder="https://erp.example.com  (/api/index.php is added automatically)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          spellCheck={false}
        />
        <p className="mt-1 text-xs text-slate-400">
          Your Dolibarr base URL. The REST entry point <code>/api/index.php</code> is appended for you.
        </p>
      </div>

      {/* Auth mode toggle */}
      <div>
        <label className="label">Authentication</label>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-sm">
          {[
            ['apikey', 'API key'],
            ['login', 'Login & password'],
          ].map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              onClick={() => switchMode(val)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                mode === val ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {mode === 'apikey' ? (
        <div>
          <label className="label">
            API key{' '}
            {editing && <span className="font-normal normal-case text-slate-400">(leave blank to keep the current key)</span>}
          </label>
          <div className="relative">
            <input
              className="input pr-20"
              type={showSecret ? 'text' : 'password'}
              placeholder={editing ? '••••••••••••' : 'DOLAPIKEY value'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              spellCheck={false}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              onClick={() => setShowSecret((s) => !s)}
            >
              {showSecret ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Find it in Dolibarr under <em>User card → API key</em>. Stored encrypted in your OS keychain.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label">Login</label>
            <input
              className="input"
              placeholder="Dolibarr username"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                className="input pr-20"
                type={showSecret ? 'text' : 'password'}
                placeholder="Dolibarr password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                onClick={() => setShowSecret((s) => !s)}
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              We log in once to fetch your API token. Only the <strong>token</strong> is stored (encrypted) — your password is never saved.
            </p>
          </div>
        </div>
      )}

      {test && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            test.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {test.ok
            ? `✓ Connected${test.version && test.version !== 'unknown' ? ` — Dolibarr ${test.version}` : ''}`
            : `✗ ${test.error || 'Connection failed'}`}
        </div>
      )}

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="flex items-center justify-between pt-1">
        <button type="button" className="btn-outline" onClick={handleTest} disabled={testing}>
          {testing ? <Spinner className="h-4 w-4" /> : '🔌'} Test connection
        </button>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : null}
            {editing ? 'Save changes' : 'Add profile'}
          </button>
        </div>
      </div>
    </form>
  )
}
