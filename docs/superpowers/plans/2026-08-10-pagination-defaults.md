# Pagination Defaults 15/30/50/100/200 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate pagination-specific defaults and option values from `10/25/50/100/200` to `15/30/50/100/200` throughout the frontend, API defaults, backend defaults, tests, and current pagination documentation.

**Architecture:** Keep the shared frontend pagination module as the source of selector options and the frontend default. Align direct frontend API and backend service defaults with the requested value mapping: `10 → 15` and `25 → 30`. Update only pagination-specific literals and expectations, preserving explicit unrelated limits and internal batch sizes.

**Tech Stack:** Vue 3, TypeScript, Vitest, NestJS services, npm workspaces.

---

### Task 1: Add failing shared-pagination coverage

**Files:**
- Create: `frontend/src/lib/pagination.test.ts`
- Test: `frontend/src/lib/pagination.ts`

- [ ] **Step 1: Write the failing test**

Cover the required exported default and options, accept `15` and `30`, and fall back to `15` for the retired `10` and `25` values.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk npm run test --workspace frontend -- --run src/lib/pagination.test.ts`

Expected: FAIL because the current default/options are still `10/25/50/100/200`.

- [ ] **Step 3: Implement the minimal shared-constant change**

Change `DEFAULT_PAGE_SIZE` to `15` and `PAGE_SIZE_OPTIONS` to `[15, 30, 50, 100, 200]`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `rtk npm run test --workspace frontend -- --run src/lib/pagination.test.ts`

Expected: PASS.

### Task 2: Align API/backend defaults and pagination-specific tests

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `backend/src/pqs/pqs-summary.service.ts`
- Modify: pagination-specific tests under `frontend/src/**/*.test.ts` and `backend/test/**/*.spec.ts`

- [ ] **Step 1: Update implementation defaults**

Change frontend/API and backend default expressions from `25` to `30`. Update pagination-specific test fixtures, expected response limits, and URL assertions from `limit: 10`/`limit=10` to `15`, and from `limit: 25`/`limit=25` to `30`.

- [ ] **Step 2: Run focused frontend and backend tests**

Run: `rtk npm run test --workspace frontend -- --run`

Run: `rtk npm run test --workspace backend -- --runInBand`

Expected: PASS with all affected pagination expectations aligned.

### Task 3: Update current pagination documentation and perform repository verification

**Files:**
- Modify: current pagination references under `docs/superpowers/specs/` and `docs/superpowers/plans/`

- [ ] **Step 1: Update current documentation references**

Change stale current pagination descriptions from `25` to `30` where they describe the application’s default/page size. Leave historical or unrelated numeric examples unchanged when they are not application pagination defaults.

- [ ] **Step 2: Search for retired pagination defaults**

Run targeted `rtk rg` searches for pagination-specific `10` and `25` values and inspect each remaining match.

- [ ] **Step 3: Run complete verification**

Run: `rtk npm test`

Run: `rtk npm run lint`

Run: `rtk npm run build`

Expected: all commands exit successfully.

- [ ] **Step 4: Review the final diff**

Run: `rtk git diff --check` and `rtk git status --short`; verify existing unrelated worktree changes remain intact and only the pagination migration plus its docs/tests are added.
