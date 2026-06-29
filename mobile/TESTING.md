# Mobile unit tests

```bash
npm test            # vitest run
npm run test:watch  # watch mode
npx vitest run --coverage   # coverage report
```

The pure logic layer (`src/lib`) is unit-tested with Vitest. These modules carry
all the non-UI behaviour — API requests, secure storage, currency/date
formatting, and the entity registry — so they're where bugs hide.

| Module           | Tests | Coverage | What is verified |
|------------------|-------|----------|------------------|
| `format.js`      | 9     | ~93%     | `toNumber`, money/number formatting, multi-currency `recordMoney`, unix/ISO date parsing, `humanizeKey`, base-currency state |
| `entities.js`    | 9     | 100%     | Registry shape & screen contract, `recordId` fallback, all status decoders, title/subtitle/amount helpers |
| `api.js`         | 17    | ~94%     | `apiBase` URL building, `list` paging/sort/sqlfilters params + API-key header, `getOne`, error→status mapping, network-failure message, `login` (POST→GET fallback, 403), `testConnection` (status → thirdparties fallback, auth failure) — all with a mocked `fetch` |
| `store.js`       | 8     | ~94%     | Profile CRUD with mocked AsyncStorage + SecureStore: key kept out of metadata, duplicate-name guard, edit preserves key, active reassignment on delete |
| `dolibarrUrl.js` | 4     | 100%     | Web-UI URL building per type, API-path stripping, null guards |
| `reports.js`     | 6     | ~100%    | `isUnpaid`, `periodStart`, and the four report builders (period/customer/outstanding/aging) with fixed-clock fixtures |

API tests also cover `listAll` paging, `resolveThirdparties` name mapping, and `downloadRecordPdf` (listed PDF + `<ref>/<ref>.pdf` fallback + clear error). `entities.js` covers `buildSqlSearch` (server-side search filter) and the sort presets.

**Total: 62 tests across 6 files, ~95% statement coverage of `src/lib`.**

`api.js` and `store.js` are tested against in-memory fakes for `fetch`, AsyncStorage,
and expo-secure-store (`vi.mock`), so no device or network is needed.

## Not covered here

UI screens/components and on-device behaviour (navigation, SecureStore against the
real Android Keystore, live Dolibarr calls) need a component/e2e harness
(`jest-expo` + `@testing-library/react-native`, or Detox) and manual QA — out of
scope for this logic-level suite.
