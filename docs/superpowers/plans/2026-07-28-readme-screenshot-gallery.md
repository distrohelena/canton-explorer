# README Screenshot Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add six useful screenshots from the current live localnet to the beginning of the README.

**Architecture:** Use the existing Playwright screenshot CLI and live route discovery. Capture a small candidate set into `screenshots/readme/`, inspect the PNGs for readable, non-error content, retain the strongest six, and reference them from a compact README gallery near the introduction.

**Tech Stack:** Existing `npm run screenshots` CLI, Playwright/Chromium, Markdown image links.

---

### Task 1: Capture and curate live gallery assets

**Files:**
- Create: `screenshots/readme/custom-1440x900/*.png`
- Inspect: temporary generated `manifest.json` and `report.json`

Capture this exact matrix from the current localnet at `1440x900`:

| Order | CLI selector | Expected output | Purpose |
| --- | --- | --- | --- |
| 1 | `updates` (also produces row 2) | `custom-1440x900/updates.png` | Main activity overview |
| 2 | `updates` (also produces row 1) | `custom-1440x900/updates--filters.png` | Advanced Filter controls with live values |
| 3 | `update-detail` | `custom-1440x900/update-detail.png` | Rich transaction/update detail |
| 4 | `contracts--filters` | `custom-1440x900/contracts--filters.png` | Contract search/filter workflow |
| 5 | `traffic--filters` | `custom-1440x900/traffic--filters.png` | Traffic Purchases Advanced Search |
| 6 | `token-detail-transfers--default` | `custom-1440x900/token-detail-transfers.png` | Distinctive token/transfer data |

- [ ] Ensure the frontend, backend, PQS, and Canton localnet are running at the default URLs (`46000` and `4600`).
- [ ] Run `npm run screenshots -- --output screenshots/readme --viewport 1440x900 --strict --route updates --route update-detail --route contracts--filters --route traffic--filters --route token-detail-transfers--default`.
- [ ] Verify `report.json` contains six `captured` entries matching the matrix; unavailable dynamic data is a failure for this gallery, not an allowed skip.
- [ ] Inspect each candidate image for readable content, live values, and absence of loading/error/empty states.
- [ ] Remove the generated `manifest.json` and `report.json` from the publishable gallery; retain exactly the six PNGs.

### Task 2: Add the README gallery

**Files:**
- Modify: `README.md`

- [ ] Add a short gallery immediately after the opening description.
- [ ] Use descriptive alt text and repository-relative image paths.
- [ ] Keep the existing screenshot workflow documentation unchanged except where needed to avoid duplicate or misleading gallery guidance.

### Task 3: Verify and commit

- [ ] Run `git diff --check`.
- [ ] Confirm the six PNGs are valid/readable, the README references exactly those six unique paths in the intended order, and no diagnostics are staged.
- [ ] Run `npm run test:screenshots` to ensure the capture tooling remains healthy.
- [ ] Commit only this plan, the six PNGs, and README changes; preserve unrelated worktree edits.
