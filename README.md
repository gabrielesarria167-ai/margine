# Margine

Personal Finance Tracker. Margine separates the money you own from the money you can spend: a protected savings amount stays out of ordinary spending, and spending it anyway takes an explicit, motivated exception that stays on record.

Phase 1 (this version): dashboard, cash and bank accounts, expenses and income, transfers, savings goal, spendable calculation, exceptions with reason, balance checks with traceable adjustments, full history. Italian UI, euro only, data stored locally.

## Run

```bash
npm install
npm start        # dev app
npm test         # ledger and database rules
npm run dist     # macOS .dmg (Apple Silicon only) in dist/
npm run dist:win # Windows installer (unsigned)
```

Requires Node 22+. The database uses Node's built-in `node:sqlite`, so there are no native modules to rebuild.

## Installing the unsigned build

The `.dmg` is not signed or notarized. On first launch macOS will refuse to open it: right-click Margine in Applications, choose **Apri**, then confirm. On Windows, SmartScreen shows a warning: choose **Ulteriori informazioni → Esegui comunque**.

## Your data

Everything lives in one SQLite file:

- macOS: `~/Library/Application Support/Margine/margine.db`
- Windows: `%APPDATA%\Margine\margine.db`

Copy that file (with the app closed) to back it up. Before any database upgrade the app saves `margine.db.bak-v<N>` next to it.

## Rules the app enforces

Money is stored as integer cents. Spendable = max(0, patrimonio − protected); protected equals the goal in Phase 1. An expense above the spendable amount is refused unless it carries an exception (recover or emergency, with a reason); the check runs in the main process, not the UI. Transfers never change the patrimonio. Balances never go negative. The goal never changes on its own.

## Project layout

- `src/ledger.js`: pure money logic, shared by the main process and the UI
- `src/db.js`: schema, migrations, and rule enforcement
- `src/main.js`, `src/preload.cjs`: the Electron window and the IPC bridge
- `src/renderer/`: the interface
- `PRODUCT.md`: product context
- `DESIGN.md`: the design system
