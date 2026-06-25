# MICO360 DoliDesk

A clean, fast desktop client for the [Dolibarr](https://www.dolibarr.org/) ERP/CRM REST API.
Connect one or more Dolibarr accounts, browse your records in a tidy table, search and
filter them, and drill into any record — all from a native desktop window.

Built with **Electron + React + Vite + Tailwind**.

## Features

- **Multiple profiles** — save several Dolibarr accounts (name + API URL + API key) and switch between them instantly.
- **Secure key storage** — API keys are encrypted at rest with your OS credential vault (Windows DPAPI / macOS Keychain / Linux libsecret) via Electron `safeStorage`. Keys never reach the web layer.
- **Dashboard** — headline figures (invoiced, outstanding, orders) plus per-type counts and recent records.
- **Record lists** — Third parties, Invoices, Products/Services, Orders and Proposals in a clean sortable table with search, status filters and pagination.
- **Detail view** — key fields plus the full raw API payload for any record.
- **No CORS headaches** — all API calls are proxied through the Electron main process.

## Getting started

```bash
npm install
npm run dev      # launches Vite + Electron with hot reload
```

On first launch you'll be asked to add a profile:

| Field    | Example                                  |
|----------|------------------------------------------|
| Name     | `Acme Production`                        |
| API URL  | `https://erp.example.com` (the `/api/index.php` entry point is appended automatically) |
| API key  | The `DOLAPIKEY` from *Dolibarr → User card → API key* |

Use **Test connection** to verify before saving.

### Enabling the Dolibarr API

In Dolibarr: **Home → Setup → Modules → Web services / API REST** must be enabled, and
your user needs an API key (User card → tab *API key*). Each module (Invoices, Products,
etc.) must also be enabled for its records to appear.

## Build a distributable

```bash
npm run dist     # builds the renderer and packages with electron-builder
```

The installer is written to `release/`.

## Project layout

```
electron/
  main.js        Electron entry — window, IPC handlers, CSP
  preload.js     Safe contextBridge surface (window.dolidesk)
  store.js       Encrypted profile storage (safeStorage)
  dolibarr.js    Dolibarr REST client (runs in main process)
src/
  api/ipc.js     Renderer-side wrapper over the preload bridge
  lib/           Entity registry + formatters
  context/       Active-profile state
  components/    Sidebar, profile switcher/form, shared UI
  pages/         Dashboard, RecordList, RecordDetail, Profiles, Welcome
```

## Roadmap ideas

- Server-side search via Dolibarr `sqlfilters`
- Create / edit records (currently read-only)
- Export to CSV
- More entity types (contacts, contracts, projects, stock movements)
