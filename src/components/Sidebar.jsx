import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ENTITY_LIST, getEntity } from '../lib/entities.js'
import { getModuleMeta, getModuleGroup, NON_BROWSABLE, SECTIONS } from '../lib/moduleMeta.js'
import { useT } from '../lib/i18n.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
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
  const { companyLogo, moduleList, modules } = useProfiles()
  const { settings } = useSettings()
  const hidden = useMemo(() => new Set(settings.display.hiddenMenu || []), [settings.display.hiddenMenu])
  const hasStatements = !modules || [...modules].some((k) => k.includes('statement'))

  const [userPref, setUserPref] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW)
  const [query, setQuery] = useState('')

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

  // Build record nav from the instance's enabled modules (curated view where
  // available, generic viewer otherwise), excluding statements/system tags.
  const items = useMemo(() => {
    const list = (moduleList && moduleList.length)
      ? moduleList
          .filter((m) => m.methods.includes('GET') && !NON_BROWSABLE.has(m.key) && !m.key.includes('statement'))
          .map((m) => {
            const curated = getEntity(m.key)
            const meta = getModuleMeta(m.key)
            return { key: m.key, to: curated ? `/records/${m.key}` : `/explore/${m.key}`, icon: curated?.icon || meta.icon, label: curated?.label || meta.label }
          })
      : ENTITY_LIST.map((e) => ({ key: e.key, to: `/records/${e.key}`, icon: e.icon, label: e.label }))
    return list.filter((it) => !hidden.has(it.key))
  }, [moduleList, hidden])

  // Group items into sections for the expanded, unsearched view.
  const sections = useMemo(() => {
    const map = new Map()
    for (const it of items) {
      const g = getModuleGroup(it.key)
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(it)
    }
    return SECTIONS.filter((s) => map.has(s)).map((s) => ({
      section: s,
      items: map.get(s).sort((a, b) => a.label.localeCompare(b.label)),
    }))
  }, [items])

  const q = query.trim().toLowerCase()
  const filtered = q ? items.filter((it) => it.label.toLowerCase().includes(q)) : null

  const Item = ({ to, end, icon, label }) => (
    <NavLink to={to} end={end} className={cls} title={collapsed ? label : undefined}>
      <span className="text-base">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )

  const SectionLabel = ({ children }) => (
    <div className={`pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${collapsed ? 'text-center' : 'px-3'}`}>
      {collapsed ? '·' : children}
    </div>
  )

  return (
    <aside className={`flex flex-col bg-slate-900 text-slate-100 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
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

      {/* Sidebar search (expanded only) */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="Search menu…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
        <Item to="/" end icon="📊" label={t('nav.dashboard')} />

        {collapsed || filtered ? (
          <>
            {!collapsed && <SectionLabel>{t('nav.records')}</SectionLabel>}
            {(filtered || items).map((it) => (
              <Item key={it.key} to={it.to} icon={it.icon} label={it.label} />
            ))}
            {!q && !hidden.has('reports') && <Item to="/reports" icon="📈" label="Reports" />}
            {!q && hasStatements && !hidden.has('mico360statements') && (
              <Item to="/statements" icon="📑" label="Client Statements" />
            )}
          </>
        ) : (
          <>
            {sections.map((sec) => (
              <div key={sec.section}>
                <SectionLabel>{sec.section}</SectionLabel>
                {sec.items.map((it) => (
                  <Item key={it.key} to={it.to} icon={it.icon} label={it.label} />
                ))}
              </div>
            ))}
            <div>
              <SectionLabel>Reports</SectionLabel>
              {!hidden.has('reports') && <Item to="/reports" icon="📈" label="Reports" />}
              {hasStatements && !hidden.has('mico360statements') && (
                <Item to="/statements" icon="📑" label="Client Statements" />
              )}
            </div>
          </>
        )}
      </nav>

      <div className="space-y-1 px-3 py-3">
        {!hidden.has('modules') && <Item to="/modules" icon="🧩" label={t('nav.modules')} />}
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
