import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ENTITY_LIST, getEntity } from '../lib/entities.js'
import { getModuleMeta, NON_BROWSABLE } from '../lib/moduleMeta.js'
import { useT } from '../lib/i18n.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import Logo from './Logo.jsx'

const COLLAPSE_KEY = 'dolidesk:sidebar-collapsed'
const NARROW = 1100

function linkClass(collapsed) {
  return ({ isActive }) =>
    `flex items-center rounded-lg py-2 text-sm font-medium transition ${
      collapsed ? 'justify-center px-2' : 'gap-3 px-3'
    } ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'}`
}

export default function Sidebar() {
  const t = useT()
  const { companyLogo, moduleList } = useProfiles()
  const [userPref, setUserPref] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const collapsed = narrow || userPref
  const setCollapsed = (v) => {
    const next = typeof v === 'function' ? v(collapsed) : v
    setUserPref(next)
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
  }
  const cls = linkClass(collapsed)

  // Build the record navigation from the instance's enabled API modules. Each
  // module routes to its curated view when we have one, the Client Statements
  // page for the statement module, or the generic read-only viewer otherwise.
  const navItems = useMemo(() => {
    if (moduleList && moduleList.length) {
      return moduleList
        .filter((m) => m.methods.includes('GET') && !NON_BROWSABLE.has(m.key))
        .map((m) => {
          const curated = getEntity(m.key)
          const meta = getModuleMeta(m.key)
          let to
          if (m.key === 'mico360statements') to = '/statements'
          else if (curated) to = `/records/${m.key}`
          else to = `/explore/${m.key}`
          return { key: m.key, to, icon: curated?.icon || meta.icon, label: curated?.label || meta.label }
        })
        .sort((a, b) => a.label.localeCompare(b.label))
    }
    // Fallback before discovery completes (or if it fails): curated core types.
    return ENTITY_LIST.map((e) => ({ key: e.key, to: `/records/${e.key}`, icon: e.icon, label: e.label }))
  }, [moduleList])

  const Item = ({ to, end, icon, label }) => (
    <NavLink to={to} end={end} className={cls} title={collapsed ? label : undefined}>
      <span className="text-base">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-slate-100 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
    >
      <div className={`flex items-center py-5 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
        {collapsed ? (
          <Logo src={companyLogo} panel className="h-7 w-7" alt="Company" />
        ) : (
          <div>
            <Logo src={companyLogo} panel className="h-9" />
            <div className="mt-2 px-1 text-xs font-medium text-slate-400">DoliDesk</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <Item to="/" end icon="📊" label={t('nav.dashboard')} />

        <div className={`pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${collapsed ? 'text-center' : 'px-3'}`}>
          {collapsed ? '•••' : t('nav.records')}
        </div>
        {navItems.map((it) => (
          <Item key={it.key} to={it.to} icon={it.icon} label={it.label} />
        ))}
      </nav>

      <div className="space-y-1 px-3 py-3">
        <Item to="/modules" icon="🧩" label={t('nav.modules')} />
        <Item to="/profiles" icon="👤" label={t('nav.profiles')} />
        <Item to="/settings" icon="⚙️" label={t('nav.settings')} />
        {!narrow && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-700/60 hover:text-white ${
              collapsed ? 'justify-center px-2' : 'gap-3 px-3'
            }`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="text-base">{collapsed ? '»' : '«'}</span>
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </aside>
  )
}
