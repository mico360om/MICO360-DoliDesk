# MICO360 DoliDesk — Mobile (Android)

A React Native (Expo) Android client for the Dolibarr ERP/CRM API — the mobile
companion to the desktop app. Connect multiple Dolibarr accounts, view a
dashboard, and browse records. **Read-only** (no create/edit/delete).

## Features (v0.1)

- **Multiple profiles** — name + API URL + API key (or username/password login).
- **Secure storage** — API keys go in the device keystore (`expo-secure-store`,
  Android Keystore / iOS Keychain); profile metadata in `AsyncStorage`.
- **Dashboard** — invoiced / outstanding / orders / customers KPIs + quick stats.
- **Records** — Third parties, Invoices, Products, Orders, Proposals, each with
  search, status badges, and a detail view.
- **Profiles tab** — add / edit / switch / delete, test connection.
- Company name + base currency picked up from `/setup/company`.

Calls the Dolibarr REST API directly (no CORS on native), using the `DOLAPIKEY`
header — the same API as the desktop app.

## Run it

```bash
cd mobile
npm install
npx expo start          # then press 'a' for Android, or scan the QR with Expo Go
```

- **Quick test:** install **Expo Go** on your Android phone, run `npx expo start`,
  scan the QR code.
- **Android emulator:** `npm run android` (needs Android Studio / SDK).

## Build an installable APK

Uses EAS Build (cloud) — no local Android SDK required:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview   # produces an installable .apk
```

## Project layout

```
App.js                 navigation (tabs + stacks) + providers
src/lib/api.js         Dolibarr REST client (direct fetch)
src/lib/store.js       secure profile storage (keystore + AsyncStorage)
src/lib/entities.js    record-type registry (shared shape with desktop)
src/lib/format.js      formatters + multi-currency helpers
src/context/           active-profile state
src/screens/           Dashboard, Records, RecordList, RecordDetail, Profiles, Settings, Onboarding
src/components/         shared UI + ProfileForm
```

## Roadmap

Reports, in-app PDF view, more record types / modules, dark mode, push
notifications, offline cache.
