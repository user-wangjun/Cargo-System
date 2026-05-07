# Collaboration Guide

This file defines task boundaries for a 2-person team to avoid duplicate work.

## Roles

### Owner (you)
- Owns backend optimization and API stability.
- Allowed paths:
  - `backend/**`
  - `docs/plans/**`
- Not allowed:
  - `frontend/**` (unless explicitly required to unblock build)
  - `data/**` (unless data task is explicitly approved)

### Collaborator Agent
- Owns frontend optimization and API integration.
- Allowed paths:
  - `frontend/admin/**`
  - `frontend/user/**`
  - `docs/**` (frontend usage docs only, when needed)
- Not allowed:
  - `backend/**`
  - `data/**`
  - `scripts/**` (unless explicitly approved)

## Current Sprint Scope (Collaborator Agent)

1. Improve UX on key pages:
   - login
   - order list/detail
   - delivery/receipt related pages
2. Add/optimize:
   - loading states
   - empty states
   - validation hints
   - API error feedback
3. Fix frontend/API integration issues based on current backend behavior.
4. Do not request backend field changes unless a bug is proven and documented.

## Branch and PR Rules

1. One task = one branch.
2. Branch naming:
   - `feat/frontend-<topic>`
   - `fix/frontend-<topic>`
   - `feat/backend-<topic>`
   - `fix/backend-<topic>`
3. Every PR must include:
   - changed files list
   - affected pages or APIs
   - at least 3 manual test steps
   - known risks (if any)
4. Avoid unrelated formatting or mass rename commits.

## Anti-overlap Rules

1. A path can only have one active owner at a time.
2. Cross-boundary changes require a GitHub Issue first.
3. If API fields change, update `docs/plans/*openapi*.yaml` in the same PR.
4. Rebase before merge to reduce conflicts.

## Agent Prompt (for Collaborator)

Use this as the collaborator agent instruction:

```text
You are the collaborator agent for CargoSystem.
You only own frontend optimization and integration.
Allowed paths: frontend/admin/**, frontend/user/**, docs/** (frontend docs only).
Forbidden paths: backend/**, data/**, scripts/**.
Do not change backend logic.
For each task use a separate branch: feat/frontend-xxx or fix/frontend-xxx.
Each PR must include: changed files, affected pages, test steps, and risks.
Target: improve UX feedback (loading/empty/error/validation) and fix current API integration issues.
```
