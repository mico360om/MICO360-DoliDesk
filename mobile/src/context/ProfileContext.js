import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as store from '../lib/store.js'
import { getCompany } from '../lib/api.js'
import { setBaseCurrency } from '../lib/format.js'

const Ctx = createContext(null)

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null) // active profile incl. apiKey
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const meta = await store.listProfiles()
    setProfiles(meta.profiles)
    setActiveId(meta.activeId)
    const ap = meta.activeId ? await store.getProfileWithKey(meta.activeId) : null
    setActive(ap)
    setLoading(false)
    if (ap) {
      try {
        const c = await getCompany(ap)
        setCompany(c)
        setBaseCurrency(c && (c.currency_code || c.currency))
      } catch {
        setCompany(null)
      }
    } else {
      setCompany(null)
      setBaseCurrency(null)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveProfile = useCallback(async (p) => { await store.saveProfile(p); await refresh() }, [refresh])
  const removeProfile = useCallback(async (id) => { await store.deleteProfile(id); await refresh() }, [refresh])
  const switchProfile = useCallback(async (id) => { await store.setActive(id); await refresh() }, [refresh])

  const value = useMemo(
    () => ({ profiles, activeId, active, company, loading, refresh, saveProfile, removeProfile, switchProfile, hasProfiles: profiles.length > 0 }),
    [profiles, activeId, active, company, loading, refresh, saveProfile, removeProfile, switchProfile]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProfiles() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useProfiles must be used within ProfileProvider')
  return c
}
