import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory fakes for the two native storage modules.
const { memAsync, memSecure } = vi.hoisted(() => ({ memAsync: new Map(), memSecure: new Map() }))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k) => (memAsync.has(k) ? memAsync.get(k) : null),
    setItem: async (k, v) => { memAsync.set(k, v) },
    removeItem: async (k) => { memAsync.delete(k) },
  },
}))
vi.mock('expo-secure-store', () => ({
  setItemAsync: async (k, v) => { memSecure.set(k, v) },
  getItemAsync: async (k) => (memSecure.has(k) ? memSecure.get(k) : null),
  deleteItemAsync: async (k) => { memSecure.delete(k) },
}))

const store = await import('./store.js')

beforeEach(() => { memAsync.clear(); memSecure.clear() })

const byName = (meta, name) => meta.profiles.find((p) => p.name === name)

describe('saveProfile', () => {
  it('creates a profile, makes it active, and stores the key in the secure store', async () => {
    const meta = await store.saveProfile({ name: 'Acme', url: 'https://erp.example.com/', apiKey: 'SECRET' })
    expect(meta.profiles).toHaveLength(1)
    const p = meta.profiles[0]
    expect(p.name).toBe('Acme')
    expect(p.url).toBe('https://erp.example.com') // trailing slash trimmed
    expect(meta.activeId).toBe(p.id)
    // Key is in SecureStore, NOT in the AsyncStorage metadata.
    expect([...memSecure.values()]).toContain('SECRET')
    expect(JSON.stringify([...memAsync.values()])).not.toContain('SECRET')
  })
  it('defaults a blank name to Untitled and rejects duplicates', async () => {
    const m = await store.saveProfile({ name: '   ', url: 'h' })
    expect(m.profiles[0].name).toBe('Untitled')
    await expect(store.saveProfile({ name: 'untitled', url: 'h2' })).rejects.toThrow(/already exists/)
  })
  it('editing keeps the id and does not overwrite the key when apiKey is omitted', async () => {
    const m1 = await store.saveProfile({ name: 'Acme', url: 'h', apiKey: 'K1' })
    const id = m1.profiles[0].id
    await store.saveProfile({ id, name: 'Acme Renamed', url: 'h2' }) // no apiKey
    const p = await store.getProfileWithKey(id)
    expect(p.name).toBe('Acme Renamed')
    expect(p.apiKey).toBe('K1') // preserved
  })
})

describe('getProfileWithKey / getActiveProfile', () => {
  it('returns the profile merged with its key', async () => {
    const m = await store.saveProfile({ name: 'Acme', url: 'h', apiKey: 'K' })
    const id = m.profiles[0].id
    expect(await store.getProfileWithKey(id)).toMatchObject({ id, name: 'Acme', apiKey: 'K' })
    expect(await store.getProfileWithKey('missing')).toBeNull()
    expect((await store.getActiveProfile()).apiKey).toBe('K')
  })
})

describe('setActive', () => {
  it('switches only to known profiles', async () => {
    await store.saveProfile({ name: 'A', url: 'h', apiKey: 'x' })
    const m = await store.saveProfile({ name: 'B', url: 'h2', apiKey: 'y' })
    const a = byName(m, 'A'); const b = byName(m, 'B')
    expect(a.id).not.toBe(b.id)
    expect((await store.setActive(b.id)).activeId).toBe(b.id)
    expect((await store.setActive('ghost')).activeId).toBe(b.id) // unchanged
  })
})

describe('deleteProfile', () => {
  it('removes the profile, deletes its key, and reassigns active', async () => {
    await store.saveProfile({ name: 'A', url: 'h', apiKey: 'x' })
    const m = await store.saveProfile({ name: 'B', url: 'h2', apiKey: 'y' })
    const a = byName(m, 'A'); const b = byName(m, 'B')
    await store.setActive(a.id)
    const meta = await store.deleteProfile(a.id)
    expect(meta.profiles.map((p) => p.id)).toEqual([b.id])
    expect(meta.activeId).toBe(b.id) // reassigned away from deleted active
    expect(await store.getProfileWithKey(a.id)).toBeNull()
    expect([...memSecure.values()]).not.toContain('x') // key wiped
  })
  it('sets active to null when the last profile is deleted', async () => {
    const a = byName(await store.saveProfile({ name: 'A', url: 'h', apiKey: 'x' }), 'A')
    const meta = await store.deleteProfile(a.id)
    expect(meta.profiles).toHaveLength(0)
    expect(meta.activeId).toBeNull()
  })
})

describe('listProfiles', () => {
  it('returns an empty shape when nothing is stored', async () => {
    expect(await store.listProfiles()).toEqual({ profiles: [], activeId: null })
  })
})
