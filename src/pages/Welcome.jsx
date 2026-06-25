import { useNavigate } from 'react-router-dom'
import ProfileForm from '../components/ProfileForm.jsx'
import Logo from '../components/Logo.jsx'
import { useProfiles } from '../context/ProfileContext.jsx'

// First-run screen shown when no profiles exist yet.
export default function Welcome() {
  const { refresh } = useProfiles()
  const navigate = useNavigate()

  return (
    <div className="grid h-full place-items-center overflow-y-auto bg-gradient-to-br from-slate-900 to-brand-900 p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center text-white">
          <div className="mb-4 flex justify-center">
            <Logo panel className="h-14" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to MICO360 DoliDesk</h1>
          <p className="mt-1 text-sm text-slate-300">
            Connect your first Dolibarr account to get started.
          </p>
        </div>

        <div className="card p-6">
          <ProfileForm
            onSaved={async () => {
              // Profile already persisted by the form; sync context, go home.
              await refresh()
              navigate('/')
            }}
          />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Your API keys are encrypted with your operating system's secure storage and never leave this device.
        </p>
      </div>
    </div>
  )
}
