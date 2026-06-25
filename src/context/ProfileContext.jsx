import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { profiles as profilesApi, api } from '../api/ipc.js'
import { setBaseCurrency } from '../lib/format.js'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [company, setCompany] = useState(null) // Dolibarr company branding

  const refresh = useCallback(async () => {
    try {
      const data = await profilesApi.list()
      setProfiles(data.profiles)
      setActiveId(data.activeId)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Fetch the active instance's company branding (name, logo, address).
  // Best-effort: failure simply leaves branding unset.
  useEffect(() => {
    let cancelled = false
    if (!activeId) {
      setCompany(null)
      return
    }
    setCompany(null)
    setBaseCurrency(null)
    api
      .company()
      .then((c) => {
        if (cancelled) return
        setCompany(c)
        setBaseCurrency(c && (c.currency_code || c.currency))
      })
      .catch(() => !cancelled && setCompany(null))
    return () => {
      cancelled = true
    }
  }, [activeId])

  const saveProfile = useCallback(async (profile) => {
    const data = await profilesApi.save(profile)
    setProfiles(data.profiles)
    setActiveId(data.activeId)
    return data
  }, [])

  const removeProfile = useCallback(async (id) => {
    const data = await profilesApi.remove(id)
    setProfiles(data.profiles)
    setActiveId(data.activeId)
    return data
  }, [])

  const switchProfile = useCallback(async (id) => {
    const data = await profilesApi.setActive(id)
    setProfiles(data.profiles)
    setActiveId(data.activeId)
    return data
  }, [])

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeId) || null,
    [profiles, activeId]
  )

  const value = useMemo(
    () => ({
      profiles,
      activeId,
      activeProfile,
      company,
      loading,
      error,
      refresh,
      saveProfile,
      removeProfile,
      switchProfile,
      hasProfiles: profiles.length > 0,
    }),
    [profiles, activeId, activeProfile, company, loading, error, refresh, saveProfile, removeProfile, switchProfile]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfiles() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfiles must be used within ProfileProvider')
  return ctx
}
