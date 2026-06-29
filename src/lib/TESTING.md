# Unit tests — `src/lib`

Run with:

```bash
npm test            # vitest run (one-shot)
npm run test:watch  # vitest watch mode
npx vitest run --coverage   # with V8 coverage report
```

## What is covered

The pure business-logic layer in `src/lib` is unit-tested with Vitest. These are
the modules that decide what every screen displays, so they carry the most logic
and the highest risk of silent display bugs.

| Module           | Tests | Coverage (stmts) | What is verified |
|------------------|-------|------------------|------------------|
| `format.js`      | 23    | ~92%             | `toNumber`, money/number formatting, multi-currency `recordMoney`/`lineMoney`, unix-seconds/ms/ISO date parsing, `dateInRange` (fake-timer based), `extraFields`, `humanizeKey`, base-currency state |
| `entities.js`    | 25    | 100%             | Entity registry shape, `recordId` fallback chain, every status decoder (invoice/order/proposal/thirdparty/product/supplier), `thirdpartyRole`, `buildSqlSearch` (incl. injection-char stripping), money/product/thirdparty summaries, column renderers, title/subtitle fallbacks |
| `csv.js`         | 5     | 100%             | RFC-4180 quoting, embedded quotes/commas/newlines, null handling, headers-only |
| `dolibarrUrl.js` | 5     | 100%             | Web-UI URL building for all 7 record types, `/api/index.php` stripping, trailing-slash trim, null guards |
| `moduleMeta.js`  | 6     | 100%             | Known module label/icon, humanized fallback, section grouping, `NON_BROWSABLE` set |

**Total: 62 tests, ~98% statement coverage of the tested modules.**

Date-dependent logic (`dateInRange`, the "Today" summary metric) is tested with
`vi.useFakeTimers()` / `vi.setSystemTime()` so results are deterministic.

## What is intentionally NOT covered here

These need an integration/e2e harness, not pure unit tests, and are out of scope
for this suite:

- **React components / screens** (`src/components`, `src/pages`) — would need
  `@testing-library/react` + `jsdom`.
- **Electron main process & IPC** (`electron/`) — `safeStorage`, auto-updater,
  window lifecycle; needs a Spectron/Playwright-Electron harness.
- **Live Dolibarr API calls** (`src/lib/api`, network) — needs a mock server or a
  test instance; covered today only by manual testing against the live instance.
- **The React Native mobile app** (`mobile/`) — shares the same pure logic
  (format/entities ported); on-device behaviour needs Detox or manual QA.
