'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dolidesk', {
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    save: (profile) => ipcRenderer.invoke('profiles:save', profile),
    remove: (id) => ipcRenderer.invoke('profiles:delete', id),
    setActive: (id) => ipcRenderer.invoke('profiles:setActive', id),
    test: (candidate) => ipcRenderer.invoke('profiles:test', candidate),
    testId: (id) => ipcRenderer.invoke('profiles:testId', id),
    loginTest: (creds) => ipcRenderer.invoke('profiles:loginTest', creds),
    saveLogin: (creds) => ipcRenderer.invoke('profiles:saveLogin', creds),
    clearCredentials: () => ipcRenderer.invoke('profiles:clearCredentials'),
  },
  api: {
    list: (type, opts) => ipcRenderer.invoke('api:list', type, opts),
    listAll: (type, opts) => ipcRenderer.invoke('api:listAll', type, opts),
    get: (type, id) => ipcRenderer.invoke('api:get', type, id),
    resolveThirdparties: (ids) => ipcRenderer.invoke('api:resolveThirdparties', ids),
    modules: () => ipcRenderer.invoke('api:modules'),
    company: () => ipcRenderer.invoke('api:company'),
    documents: (type, id) => ipcRenderer.invoke('api:documents', type, id),
    savePdf: (payload) => ipcRenderer.invoke('documents:savePdf', payload),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial) => ipcRenderer.invoke('settings:set', partial),
    reset: () => ipcRenderer.invoke('settings:reset'),
    setPin: (pin) => ipcRenderer.invoke('settings:setPin', pin),
    verifyPin: (pin) => ipcRenderer.invoke('settings:verifyPin', pin),
    clearPin: () => ipcRenderer.invoke('settings:clearPin'),
    exportBackup: () => ipcRenderer.invoke('settings:export'),
    importBackup: () => ipcRenderer.invoke('settings:import'),
  },
  cache: {
    clear: () => ipcRenderer.invoke('cache:clear'),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (cb) => {
      const handler = (_e, payload) => cb(payload)
      ipcRenderer.on('update:status', handler)
      return () => ipcRenderer.removeListener('update:status', handler)
    },
  },
  diagnostics: {
    get: () => ipcRenderer.invoke('diagnostics:get'),
    export: () => ipcRenderer.invoke('diagnostics:export'),
  },
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    notify: (payload) => ipcRenderer.invoke('app:notify', payload),
  },
  exportFile: (payload) => ipcRenderer.invoke('export:save', payload),
})
