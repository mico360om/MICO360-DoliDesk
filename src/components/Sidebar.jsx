import { NavLink } from 'react-router-dom'
import { ENTITY_LIST } from '../lib/entities.js'
import { useT } from '../lib/i18n.js'

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
  }`

export default function Sidebar() {
  const t = useT()
  return (
    <aside className="flex w-60 flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-lg font-black text-white">
          M
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide">MICO360</div>
          <div className="text-xs text-slate-400">DoliDesk</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        <NavLink to="/" end className={linkClass}>
          <span className="text-base">📊</span> {t('nav.dashboard')}
        </NavLink>

        <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {t('nav.records')}
        </div>
        {ENTITY_LIST.map((e) => (
          <NavLink key={e.key} to={`/records/${e.key}`} className={linkClass}>
            <span className="text-base">{e.icon}</span> {e.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 px-3 py-3">
        <NavLink to="/modules" className={linkClass}>
          <span className="text-base">🧩</span> {t('nav.modules')}
        </NavLink>
        <NavLink to="/profiles" className={linkClass}>
          <span className="text-base">👤</span> {t('nav.profiles')}
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          <span className="text-base">⚙️</span> {t('nav.settings')}
        </NavLink>
      </div>
    </aside>
  )
}
