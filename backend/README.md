# CargoSystem Backend (NestJS Scaffold)

## 1. What is included
- NestJS app scaffold with global prefix: `/api/v1`
- Swagger docs endpoint: `/api/docs`
- JWT auth module (`/auth/login`, `/auth/me`)
- Health endpoint (`/health`)
- Business modules matching current API spec:
  - `customers`
  - `suppliers`
  - `products`
  - `sales-orders`
  - `purchase-receipts`
  - `delivery-orders`
  - `inventory`
  - `invoices`
  - `payment-requests`
  - `receipts`
  - `audit-logs`

## 1.1 Current implementation status
- Real DB logic implemented:
  - `sales-orders` (list/detail/create/update/confirm/cancel)
  - `purchase-receipts` (list/detail/create/update/post/void, includes unit conversion + inbound inventory transaction)
  - `delivery-orders` (list/detail/create/update/post/print/versions/void, includes outbound inventory transaction and print-edit versioning)
  - `inventory` (balances/ledger/adjust transaction)
- Still placeholder/mock:
  - `customers`, `suppliers`, `products`, `invoices`, `payment-requests`, `receipts`, `audit-logs` service internals

## 2. Prerequisites
- Node.js 20+ (or 18+)
- npm / pnpm / yarn available in PATH
- PostgreSQL 14+

## 3. Quick start
1. Copy env:
```bash
cp .env.example .env
```
2. Install dependencies:
```bash
npm install
```
3. Run dev server:
```bash
npm run start:dev
```

## 4. Default login (mock)
- username: `admin`
- password: `admin123`

This is temporary for scaffold testing. Replace with real user table lookup + password hash check before production.

## 5. Database
- SQL schema is already prepared at:
  - `../docs/mvp-schema.sql`
- TypeORM data source file:
  - `src/database/data-source.ts`

## 6. Next implementation tasks
1. Add entities/repositories and connect module services to Postgres.
2. Replace remaining placeholder modules with real DB logic.
3. Add stronger status machine validations (cross-document constraints).
4. Add audit logs for every state transition and key update.
5. Replace mock auth with real `users/roles/permissions` checks.
