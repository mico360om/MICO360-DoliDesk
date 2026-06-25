import { useState } from 'react'
import { settings as settingsApi } from '../api/ipc.js'
import Logo from './Logo.jsx'

// Shown before the app when a PIN lock is enabled. Verifies the PIN against
// the salted hash held in the main process.
export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!pin) return
    setChecking(true)
    setError(false)
    try {
      const ok = await settingsApi.verifyPin(pin)
      if (ok) onUnlock()
      else {
        setError(true)
        setPin('')
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="grid h-full place-items-center bg-gradient-to-br from-slate-900 to-brand-900 p-6">
      <form onSubmit={submit} className="w-full max-w-xs text-center">
        <div className="mb-5 flex justify-center">
          <Logo panel className="h-12" />
        </div>
        <h1 className="text-xl font-bold text-white">🔒 Locked</h1>
        <p className="mb-6 mt-1 text-sm text-slate-300">Enter your PIN to unlock MICO360 DoliDesk.</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          className={`input text-center text-lg tracking-[0.4em] ${error ? 'ring-2 ring-rose-400' : ''}`}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
        />
        {error && <p className="mt-2 text-sm text-rose-300">Incorrect PIN. Try again.</p>}
        <button type="submit" className="btn-primary mt-4 w-full" disabled={checking}>
          Unlock
        </button>
      </form>
    </div>
  )
}
