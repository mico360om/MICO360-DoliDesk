import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mem } = vi.hoisted(() => ({ mem: new Map() }))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: async (k, v) => { mem.set(k, v) },
    getAllKeys: async () => [...mem.keys()],
    multiRemove: async (ks) => { ks.forEach((k) => mem.delete(k)) },
  },
}))

const cache = await import('./cache.js')

beforeEach(() => mem.clear())

describe('cacheSet / cacheGet', () => {
  it('round-trips data scoped to a profile + key', async () => {
    await cache.cacheSet('https://a', 'list:invoices', [{ id: 1 }])
    const got = await cache.cacheGet('https://a', 'list:invoices')
    expect(got.data).toEqual([{ id: 1 }])
    expect(typeof got.savedAt).toBe('number')
  })
  it('isolates by profile and key', async () => {
    await cache.cacheSet('https://a', 'k', 1)
    expect(await cache.cacheGet('https://b', 'k')).toBeNull()
    expect(await cache.cacheGet('https://a', 'other')).toBeNull()
  })
  it('returns null for missing or corrupt entries', async () => {
    expect(await cache.cacheGet('https://a', 'nope')).toBeNull()
    mem.set('dolidesk:cache:https://a::bad', '{not json')
    expect(await cache.cacheGet('https://a', 'bad')).toBeNull()
  })
})

describe('cacheClear', () => {
  it('removes only the given profile’s entries', async () => {
    await cache.cacheSet('https://a', 'k1', 1)
    await cache.cacheSet('https://a', 'k2', 2)
    await cache.cacheSet('https://b', 'k1', 3)
    await cache.cacheClear('https://a')
    expect(await cache.cacheGet('https://a', 'k1')).toBeNull()
    expect(await cache.cacheGet('https://a', 'k2')).toBeNull()
    expect((await cache.cacheGet('https://b', 'k1')).data).toBe(3)
  })
})
