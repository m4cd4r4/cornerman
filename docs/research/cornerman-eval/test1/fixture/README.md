# ledger

A small bookkeeping library. Records entries against accounts, keeps balances,
produces a month report and an invoice total, and exports entries as CSV.

## Layout

- `src/money.js` money helpers
- `src/ledger.js` the Ledger class (record, balance)
- `src/storage/` two interchangeable stores: `jsonl.js` and `csv.js`, opened through `openStore(kind, file)`
- `src/export.js` entries to CSV text
- `src/report.js`, `src/invoice.js` summaries
- `src/ratelimit.js` per-client limiter (not implemented yet)
- `src/legacy/` code kept for older callers
- `src/config.js` loads the JSON file named by the `LEDGER_CONFIG` environment variable
- `scripts/migrate.mjs` multi-step data migration, run with `node scripts/migrate.mjs [--from N]`

## Tests

    npm test
