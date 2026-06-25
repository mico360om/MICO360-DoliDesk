// Tiny in-memory cache of the currently-listed record ids per type, so the
// detail view can offer prev/next navigation through the list the user came
// from. Not persisted — resets on reload (deep links just hide prev/next).

const cache = new Map()

export function setNavIds(type, ids) {
  cache.set(type, ids.map(String))
}

// Returns { prev, next } ids around the given id, or nulls if unknown.
export function getNeighbours(type, id) {
  const ids = cache.get(type)
  if (!ids) return { prev: null, next: null }
  const i = ids.indexOf(String(id))
  if (i === -1) return { prev: null, next: null }
  return {
    prev: i > 0 ? ids[i - 1] : null,
    next: i < ids.length - 1 ? ids[i + 1] : null,
    index: i,
    total: ids.length,
  }
}
