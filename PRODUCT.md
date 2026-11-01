# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Electron desktop app (macOS first, Windows optional), renderer in plain HTML/CSS/JS ES modules with no bundler, local SQLite through Node's built-in `node:sqlite`. Chosen by the user; the source spec (`Margine_Piano_Progetto.md`) also names this stack.

## Users

The author and a few people they share the app with. Italian speakers managing their own money by hand: cash in a wallet, one or more bank or digital accounts. They open Margine at a desk to log a purchase, an incoming payment or a cash withdrawal, and to answer one question before buying something: how much can I actually spend?

## Product Purpose

Margine separates money owned from money spendable. It tracks the real balance of every account and of cash, lets the user protect a savings amount (even one above what they currently own), and treats any expense that would touch protected money as an explicit, motivated exception that stays on record. Success is a dashboard the user trusts at a glance and a history that explains every euro of protected money that was spent.

## Positioning

Money is not spendable just because it exists. Most finance trackers report a balance and maybe a budget; Margine's mechanism is a protected share of the balance that ordinary spending cannot reach, plus a recorded exception (to be recovered, or an emergency) whenever it is reached anyway. Future and expected money never counts as owned.

## Operating Context

- Manual entry only. No bank connections in the first version, by design: the user stays in control of the data.
- Typical actions: add an expense, add received income, move money between cash and bank, set a new savings goal, verify an account's real balance against the recorded one.
- Periodic ritual: "Ultimo controllo", the user counts cash or checks the bank app and reconciles. Adjustments are logged with a reason and never silently rewrite past movements.

## Capabilities and Constraints

Phase 1 (this build): dashboard, cash and bank accounts, expenses and income, transfers, single savings goal, spendable calculation, warning plus confirmation for expenses that touch savings, exceptions with reason (type A "Recupererò il denaro" with expected amount, source and date; type B "Emergenza o necessità"), balance check with adjustment, full history, local storage.

Phase 2 (later): future income with states, recoveries linked to exceptions (partial too), exception log view, history filters, monthly statistics and charts. Phase 3: multiple goals, forecasts, CSV export, backup and restore.

Terminology (Italian, used verbatim in the UI): Patrimonio effettivo, Risparmio protetto, Obiettivo di risparmio, Denaro spendibile, Entrate future, Recupero previsto, Eccezione, Rettifica, Ultimo controllo.

Rules: spendable = max(0, patrimonio − protected); protected equals the goal in Phase 1; the goal never changes automatically; transfers are neither income nor expense; balances never go negative; amounts are euro only.

## Brand Commitments

- Name: Margine. Subtitle: Personal Finance Tracker.
- UI language: Italian only.
- The Scrollcraft design floor (`~/Downloads/Scrollcraft/scroll-craft/references/taste.md`) is binding: at most two type families, tracking that tightens with size, tabular numerals for every amount, six colour roles with one accent, tinted secondary text, no pure black, no gradient text, glow or coloured halos, motion on transform and opacity only and under 300ms, every control with hover, focus-visible, active and disabled states, no visible em dashes, no invented numbers.
- The interface must make Denaro spendibile and Risparmio protetto impossible to confuse.

## Evidence on Hand

The project spec only. No logo, palette, photography or testimonials exist. Demonstration figures in the spec (€570 patrimonio, €500 protected, €150 cash, €420 bank) are examples, not user data.

## Product Principles

1. Owned, protected and expected money are never blended into one number.
2. Spending protected money is allowed, never silent: it takes a reason and leaves a record.
3. Nothing changes the user's numbers behind their back: no automatic goal changes, no silent corrections.
4. The answer to "how much can I spend?" is the first thing on screen.
5. The user stays in control of their data: local, manual, readable.

## Accessibility & Inclusion

No product-specific requirement established beyond WCAG AA contrast and full keyboard operation of every form.
