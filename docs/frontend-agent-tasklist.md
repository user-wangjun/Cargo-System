# Frontend Tasklist and Agent Prompt

This document is for the collaborator who only works on frontend optimization.

## Scope

Allowed paths:
- `frontend/admin/**`
- `frontend/user/**`
- `docs/**` (frontend docs only when needed)

Forbidden paths:
- `backend/**`
- `data/**`
- `scripts/**` (unless explicitly approved)

## Frontend Optimization Checklist

1. Login flow polish
- Add clear error text for wrong credentials/network failure.
- Add loading state on submit.
- Prevent repeated submits while request is pending.

2. List pages consistency
- Order list pages should have loading, empty, and error states.
- Add clear filter reset behavior.
- Ensure table columns remain readable on common resolutions.

3. Detail page reliability
- If API fields are missing, show graceful fallback (not blank or crash).
- Normalize date/number display.
- Add clear "no data" messaging in detail sections.

4. Form validation and UX
- Validate required fields before submit.
- Show inline field-level errors.
- Show global request error when API fails.

5. Delivery and receipt pages
- Verify core action buttons have disabled/loading feedback.
- Confirm success/failure toast or message is visible.
- Avoid silent failures.

6. Integration fixes
- Fix frontend request/response mapping issues based on existing backend behavior.
- Do not request backend API changes unless reproducible and documented.

7. Regression checks
- Re-test login -> list -> detail -> submit flow after each fix.
- Verify no console errors in core pages.

## Branch and PR Rules

1. One task per branch:
- `feat/frontend-<topic>`
- `fix/frontend-<topic>`

2. Every PR must include:
- changed file list
- affected pages
- at least 3 manual test steps
- known risks (if any)

3. Avoid:
- mass formatting-only commits
- unrelated file changes

## Agent Prompt (copy and use)

```text
You are the collaborator frontend agent for CargoSystem.
Only work on frontend optimization and integration.

Allowed paths:
- frontend/admin/**
- frontend/user/**
- docs/** (frontend docs only)

Forbidden paths:
- backend/**
- data/**
- scripts/**

Goals:
1) Improve UX feedback: loading, empty, validation, and error states.
2) Fix frontend/API integration issues based on existing backend behavior.
3) Keep flows stable: login, order list/detail, delivery/receipt related pages.

Rules:
- One task one branch: feat/frontend-xxx or fix/frontend-xxx.
- Do not change backend logic or API contracts.
- Each PR must include changed files, affected pages, test steps, and risks.
```
