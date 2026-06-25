'use strict'

const { app, BrowserWindow, ipcMain, session, shell, dialog, Notification, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const store = require('./store')
const settings = require('./settings')
const dolibarr = require('./dolibarr')

let autoUpdater = null
try {
  // electron-updater pulls in native-ish deps; guard so dev never crashes.
  autoUpdater = require('electron-updater').autoUpdater
} catch {
  autoUpdater = null
}

const isDev = process.env.NODE_ENV === 'development'
let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#0f172a',
    title: 'MICO360 DoliDesk',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  mainWindow = win

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function applyProductionCsp() {
  if (isDev) return
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'",
        ],
      },
    })
  })
}

function activeOrThrow() {
  const p = store.getActiveProfile()
  if (!p) throw new Error('No active profile. Add a Dolibarr profile first.')
  return p
}

function wrap(handler) {
  return async (_event, ...args) => {
    try {
      return { ok: true, data: await handler(...args) }
    } catch (err) {
      return { ok: false, error: err.message || String(err) }
    }
  }
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

// ---- Auto update -----------------------------------------------------------

function setupAutoUpdate() {
  if (!autoUpdater) return
  autoUpdater.autoDownload = false
  autoUpdater.on('checking-for-update', () => send('update:status', { state: 'checking' }))
  autoUpdater.on('update-available', (info) => send('update:status', { state: 'available', version: info?.version }))
  autoUpdater.on('update-not-available', (info) => send('update:status', { state: 'none', version: info?.version }))
  autoUpdater.on('error', (err) => send('update:status', { state: 'error', error: String(err?.message || err) }))
  autoUpdater.on('download-progress', (p) => send('update:status', { state: 'downloading', percent: Math.round(p?.percent || 0) }))
  autoUpdater.on('update-downloaded', (info) => send('update:status', { state: 'downloaded', version: info?.version }))
}

function maybeCheckOnStartup() {
  if (!autoUpdater || !app.isPackaged) return
  try {
    const s = settings.getSettings()
    if (s.updates.autoUpdate && s.updates.checkOnStartup) {
      autoUpdater.checkForUpdates().catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

// ---- IPC -------------------------------------------------------------------

function registerIpc() {
  // Profiles
  ipcMain.handle('profiles:list', wrap(() => store.listProfiles()))
  ipcMain.handle('profiles:save', wrap((profile) => store.saveProfile(profile)))
  ipcMain.handle('profiles:delete', wrap((id) => store.deleteProfile(id)))
  ipcMain.handle('profiles:setActive', wrap((id) => store.setActive(id)))
  ipcMain.handle(
    'profiles:test',
    wrap((candidate) => {
      const profile =
        candidate && candidate.url ? { url: candidate.url, apiKey: candidate.apiKey } : activeOrThrow()
      return dolibarr.testConnection(profile)
    })
  )
  // Test a saved profile by id WITHOUT changing the active profile.
  ipcMain.handle(
    'profiles:testId',
    wrap((id) => {
      const { profiles } = store.listProfiles()
      const p = profiles.find((x) => x.id === id)
      if (!p) throw new Error('Profile not found')
      return dolibarr.testConnection({ url: p.url, apiKey: store.getApiKey(id) })
    })
  )
  ipcMain.handle(
    'profiles:loginTest',
    wrap(async ({ url, login, password, reset }) => {
      await dolibarr.login(url, login, password, reset)
      return { ok: true }
    })
  )
  ipcMain.handle(
    'profiles:saveLogin',
    wrap(async ({ id, name, url, login, password, reset }) => {
      const token = await dolibarr.login(url, login, password, reset)
      return store.saveProfile({ id, name, url, apiKey: token })
    })
  )
  ipcMain.handle('profiles:clearCredentials', wrap(() => store.clearAllCredentials()))

  // Data
  ipcMain.handle('api:list', wrap((type, opts) => dolibarr.list(activeOrThrow(), type, opts)))
  ipcMain.handle('api:get', wrap((type, id) => dolibarr.getOne(activeOrThrow(), type, id)))
  ipcMain.handle('api:listAll', wrap((type, opts) => dolibarr.listAll(activeOrThrow(), type, opts)))
  ipcMain.handle('api:listRaw', wrap((endpoint, opts) => dolibarr.listRaw(activeOrThrow(), endpoint, opts)))
  ipcMain.handle('api:getRaw', wrap((endpoint, id) => dolibarr.getRaw(activeOrThrow(), endpoint, id)))
  ipcMain.handle('api:resolveThirdparties', wrap((ids) => dolibarr.resolveThirdparties(activeOrThrow(), ids)))
  ipcMain.handle('api:modules', wrap(() => dolibarr.getModules(activeOrThrow())))
  ipcMain.handle('api:company', wrap(() => dolibarr.getCompany(activeOrThrow())))
  ipcMain.handle('api:companyLogo', wrap(() => dolibarr.getCompanyLogo(activeOrThrow())))

  // Dynamically set the window/taskbar icon to the active company logo
  // (or back to the bundled icon when null).
  ipcMain.handle('app:setIcon', wrap((dataUrl) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false }
    try {
      if (dataUrl) {
        const img = nativeImage.createFromDataURL(dataUrl)
        if (!img.isEmpty()) mainWindow.setIcon(img)
      } else {
        mainWindow.setIcon(path.join(__dirname, '..', 'build', 'icon.ico'))
      }
    } catch {
      /* ignore icon failures */
    }
    return { ok: true }
  }))
  ipcMain.handle('api:documents', wrap((type, id) => dolibarr.listDocuments(activeOrThrow(), type, id)))

  // Download a record's PDF and save it via the native dialog.
  ipcMain.handle('documents:savePdf', async (event, { type, id, ref }) => {
    try {
      const doc = await dolibarr.downloadRecordPdf(activeOrThrow(), type, id, ref)
      const win = BrowserWindow.fromWebContents(event.sender)
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: doc.filename || `${ref || 'document'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (canceled || !filePath) return { ok: true, data: { saved: false } }
      fs.writeFileSync(filePath, Buffer.from(doc.content, 'base64'))
      return { ok: true, data: { saved: true, path: filePath } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Settings
  ipcMain.handle('settings:get', wrap(() => settings.getSettings()))
  ipcMain.handle('settings:set', wrap((partial) => settings.saveSettings(partial)))
  ipcMain.handle('settings:reset', wrap(() => settings.resetSettings()))
  ipcMain.handle('settings:setPin', wrap((pin) => settings.setPin(pin)))
  ipcMain.handle('settings:verifyPin', wrap((pin) => settings.verifyPin(pin)))
  ipcMain.handle('settings:clearPin', wrap(() => settings.clearPin()))

  // Backup / restore (settings + profiles, same-machine)
  ipcMain.handle('settings:export', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: 'dolidesk-backup.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (canceled || !filePath) return { ok: true, data: { saved: false } }
      const backup = { settings: settings.exportBackup(), profiles: store.exportProfiles() }
      fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8')
      return { ok: true, data: { saved: true, path: filePath } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
  ipcMain.handle('settings:import', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (canceled || !filePaths?.length) return { ok: true, data: { imported: false } }
      const backup = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'))
      if (backup.settings) settings.importBackup(backup.settings)
      if (backup.profiles) store.importProfiles(backup.profiles)
      return { ok: true, data: { imported: true } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Data & cache
  ipcMain.handle('cache:clear', wrap(() => {
    dolibarr.clearCaches()
    return { cleared: true }
  }))

  // Updates
  ipcMain.handle('update:check', wrap(async () => {
    if (!autoUpdater || !app.isPackaged) return { state: 'dev', version: app.getVersion() }
    await autoUpdater.checkForUpdates()
    return { state: 'checking', version: app.getVersion() }
  }))
  ipcMain.handle('update:download', wrap(async () => {
    if (!autoUpdater || !app.isPackaged) throw new Error('Updates are only available in the installed app.')
    await autoUpdater.downloadUpdate()
    return { state: 'downloading' }
  }))
  ipcMain.handle('update:install', wrap(() => {
    if (autoUpdater) autoUpdater.quitAndInstall()
    return { ok: true }
  }))

  // App / diagnostics / support
  ipcMain.handle('app:version', wrap(() => ({ version: app.getVersion() })))
  ipcMain.handle('app:openExternal', wrap((url) => {
    if (/^https?:|^mailto:/i.test(url || '')) shell.openExternal(url)
    return { ok: true }
  }))
  ipcMain.handle('app:notify', wrap(({ title, body }) => {
    if (Notification.isSupported()) new Notification({ title: title || 'MICO360 DoliDesk', body: body || '' }).show()
    return { ok: true }
  }))
  ipcMain.handle('diagnostics:get', wrap(() => ({
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    osVersion: require('os').release(),
    userData: app.getPath('userData'),
    profiles: store.listProfiles().profiles.length,
  })))
  ipcMain.handle('diagnostics:export', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: 'dolidesk-diagnostics.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (canceled || !filePath) return { ok: true, data: { saved: false } }
      const diag = {
        appVersion: app.getVersion(),
        versions: process.versions,
        platform: `${process.platform} ${process.arch}`,
        userData: app.getPath('userData'),
        profiles: store.listProfiles().profiles.map((p) => ({ name: p.name, url: p.url })),
        generatedAt: new Date().toISOString(),
      }
      fs.writeFileSync(filePath, JSON.stringify(diag, null, 2), 'utf8')
      return { ok: true, data: { saved: true, path: filePath } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Export arbitrary content (used by CSV export) via native save dialog.
  ipcMain.handle('export:save', async (event, { defaultName, content }) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: defaultName || 'export.csv',
        filters: [{ name: 'CSV (Excel-compatible)', extensions: ['csv'] }],
      })
      if (canceled || !filePath) return { ok: true, data: { saved: false } }
      fs.writeFileSync(filePath, '﻿' + content, 'utf8')
      return { ok: true, data: { saved: true, path: filePath } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}

app.whenReady().then(() => {
  applyProductionCsp()
  registerIpc()
  setupAutoUpdate()
  createWindow()
  maybeCheckOnStartup()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
