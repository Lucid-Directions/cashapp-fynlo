# Stage-2 Test-Suite Refactor Plan

_Last updated: $(date)_

The goal of Stage-2 is to modernise the React-Native test-suite so that **all runtime-critical screens and stores are covered, CI stays green, and coverage gates can be re-enabled**.  This file tracks the remaining tasks and their status.

---
## 🎯 Objectives
1. Remove legacy global mocks that hide real behaviour.
2. Provide a reusable provider wrapper (navigation, safe-area, store hooks, theme) for component tests.
3. Refactor high-value screen suites (POS, Orders, Settings) to use the wrapper.
4. Keep CI green at every commit by
a. isolating failing suites via `testPathIgnorePatterns` until they are fixed, and
b. progressively re-enabling them when they pass.
5. Re-enable coverage collection and raise thresholds gradually.

---
## ✅ Completed So Far
- CocoaPods workspace reset & native build green.
- Jest split into unit / integration configs.
- All store hook tests green.
- SumUp + Colors crashes fixed in Jest environment.
- Created `testProviders.tsx` & `customRenderWithStores` helpers.
- Refactored `POSScreen.test.tsx` to remove manual store mocks.

---
## ⏳ In-Progress
- `POSScreen.test.tsx` still fails because UIStore isn't injected.
- Orders & Settings suites were unintentionally un-ignored → currently red.

---
## 🗺️ Task Checklist

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Remove residual global `useAppStore` mock in `jest.setup.js` |  | [ ] |
| 2 | Ensure `testPathIgnorePatterns` ignores heavy suites until refactored (`OrdersScreen`, `SettingsScreen`, `ReportsScreen`) |  | [ ] |
| 3 | Update `createTestWrapper` to inject **UIStore** mock |  | [ ] |
| 4 | Refactor `POSScreen.test.tsx` to use injected UIStore & replace brittle text assertions with `testID` queries |  | [ ] |
| 5 | Re-enable `POSScreen` suite (remove it from ignore list) – ensure **green** |  | [ ] |
| 6 | Refactor `OrdersScreen.test.tsx` (use provider wrapper) |  | [ ] |
| 7 | Refactor `SettingsScreen.test.tsx` (use provider wrapper) |  | [ ] |
| 8 | Delete their ignore entries → run & fix until green |  | [ ] |
| 9 | Reactivate `collectCoverage`, set global gate to `40 %`; adjust `coverageThreshold` per suite |  | [ ] |
|10 | Update GitHub Action to run `npm test` + `test:int:docker` |  | [ ] |

---
## 🛠️ Implementation Notes
- Keep each refactor in its own PR branch off `stage-2/modernise-test-suite`.
- Follow gemini.md rules: CI green, small diffs, immediate push.
- Unit tests use `jest.unit.config.js`; always run with `npm test` locally before push.

---
## 📈 Exit Criteria
- `npm test` passes with **no ignored screen suites**.
- Global coverage ≥ 40 % (to be increased in Stage-3).
- Integration tests (`health`, auth flow) pass via Docker.
- Xcode device build succeeds (`clean build`).

---
_Maintainers: tick the boxes as you push each PR._ 