# Development Checklist (Owner + Collaborator)

This checklist is for the current optimization cycle on top of the existing CargoSystem baseline.

## Phase 0: Alignment (Day 0)

- [ ] Confirm this sprint scope and freeze non-scope changes.
- [ ] Confirm role boundaries:
  - Owner: `backend/**`, `docs/plans/**`
  - Collaborator: `frontend/**`, frontend-related docs
- [ ] Confirm branch naming and PR template requirements.
- [ ] Pick 3-5 highest-impact issues as Sprint Must-Have.

## Phase 1: Core Stability (Priority P0)

### Owner (Backend)
- [ ] Verify auth flow stability (`/auth/login`, `/auth/me`).
- [ ] Verify RBAC permission checks on protected APIs.
- [ ] Add/adjust clear API error codes/messages for common failures.
- [ ] Ensure key document status transitions are strictly validated.
- [ ] Ensure no breaking API contract changes without docs update.

### Collaborator (Frontend)
- [ ] Login page: loading/error/retry behavior complete.
- [ ] Core list pages: loading/empty/error states complete.
- [ ] Core detail pages: fallback rendering for missing fields.
- [ ] Core submit actions: disable while pending and show result feedback.
- [ ] Remove obvious console errors on key pages.

### Joint Acceptance
- [ ] End-to-end path works: login -> list -> detail -> submit.
- [ ] No blocker-level error in manual smoke run.

## Phase 2: Experience and Data Quality (Priority P1)

### Owner (Backend)
- [ ] Improve server-side validation consistency for DTOs.
- [ ] Normalize common pagination/filter API behavior.
- [ ] Improve key audit logs for important status-changing actions.

### Collaborator (Frontend)
- [ ] Standardize field validation messages and display position.
- [ ] Improve filter reset and query feedback on list pages.
- [ ] Normalize date/number formatting in major pages.

### Joint Acceptance
- [ ] Top 5 user operations can be completed without confusion.
- [ ] API error messages are understandable to non-developers.

## Phase 3: Regression and Handover (Priority P1)

- [ ] Re-run manual regression:
  - login
  - sales order list/detail
  - delivery/receipt flow
  - invoice/payment request flow
- [ ] Update docs for any changed behavior.
- [ ] Close completed issues and archive deferred items.

## Daily Working Rules

- [ ] One active owner per path/module at the same time.
- [ ] One task per branch, one branch per PR.
- [ ] Rebase before opening/merging PR.
- [ ] PR must include:
  - changed files
  - impact summary
  - test steps
  - risks

## Definition of Done (DoD)

- [ ] Code merged into `main` with review completed.
- [ ] No critical regression found in smoke test.
- [ ] Related docs updated (if behavior changed).
- [ ] Task issue has clear verification note.

## Suggested First Sprint Must-Have

- [ ] Fix login and auth feedback UX (frontend + backend errors).
- [ ] Stabilize order and delivery core flow with clear state handling.
- [ ] Unify form validation and submit feedback on top pages.
- [ ] Reduce integration mismatch issues between current frontend/backend.
