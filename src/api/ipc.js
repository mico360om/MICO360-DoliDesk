// Typed-ish wrapper over the preload bridge. Throws on failure so callers
// can use try/catch instead of inspecting { ok } everywhere.

const bridge = window.dolidesk

function unwrap(res) {
  if (!res) throw new Error('No response from main process')
  if (res.ok) return res.data
  throw new Error(res.error || 'Unknown error')
}

export const profiles = {
  list: async () => unwrap(await bridge.profiles.list()),
  save: async (p) => unwrap(await bridge.profiles.save(p)),
  remove: async (id) => unwrap(await bridge.profiles.remove(id)),
  setActive: async (id) => unwrap(await bridge.profiles.setActive(id)),
  test: async (candidate) => unwrap(await bridge.profiles.test(candidate)),
  testId: async (id) => unwrap(await bridge.profiles.testId(id)),
  loginTest: async (creds) => unwrap(await bridge.profiles.loginTest(creds)),
  saveLogin: async (creds) => unwrap(await bridge.profiles.saveLogin(creds)),
  clearCredentials: async () => unwrap(await bridge.profiles.clearCredentials()),
}

export const api = {
  list: async (type, opts) => unwrap(await bridge.api.list(type, opts)),
  listAll: async (type, opts) => unwrap(await bridge.api.listAll(type, opts)),
  get: async (type, id) => unwrap(await bridge.api.get(type, id)),
  resolveThirdparties: async (ids) => unwrap(await bridge.api.resolveThirdparties(ids)),
  modules: async () => unwrap(await bridge.api.modules()),
  company: async () => unwrap(await bridge.api.company()),
}

export const settings = {
  get: async () => unwrap(await bridge.settings.get()),
  set: async (partial) => unwrap(await bridge.settings.set(partial)),
  reset: async () => unwrap(await bridge.settings.reset()),
  setPin: async (pin) => unwrap(await bridge.settings.setPin(pin)),
  verifyPin: async (pin) => unwrap(await bridge.settings.verifyPin(pin)),
  clearPin: async () => unwrap(await bridge.settings.clearPin()),
  exportBackup: async () => unwrap(await bridge.settings.exportBackup()),
  importBackup: async () => unwrap(await bridge.settings.importBackup()),
}

export const cache = {
  clear: async () => unwrap(await bridge.cache.clear()),
}

export const update = {
  check: async () => unwrap(await bridge.update.check()),
  download: async () => unwrap(await bridge.update.download()),
  install: async () => unwrap(await bridge.update.install()),
  onStatus: (cb) => bridge.update.onStatus(cb),
}

export const diagnostics = {
  get: async () => unwrap(await bridge.diagnostics.get()),
  export: async () => unwrap(await bridge.diagnostics.export()),
}

export const appInfo = {
  version: async () => unwrap(await bridge.app.version()),
  openExternal: (url) => bridge.app.openExternal(url),
  notify: (payload) => bridge.app.notify(payload),
}

export async function exportFile(payload) {
  return unwrap(await bridge.exportFile(payload))
}
