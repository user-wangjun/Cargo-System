# CargoSystem MVP REST API 清单

版本：v1
前缀：`/api/v1`
鉴权：`Authorization: Bearer <token>`
返回：统一 `{ code, message, data }`

## 1. 认证与用户

### POST `/auth/login`
- 入参：`username`, `password`
- 出参：`accessToken`, `user`, `roles`

### GET `/auth/me`
- 出参：当前用户信息 + 权限点

### GET `/users`
- 查询：`keyword`, `isActive`, `page`, `pageSize`

### POST `/users`
- 入参：`username`, `password`, `fullName`, `roleCodes[]`

### PATCH `/users/{id}`
- 入参：`fullName`, `isActive`, `roleCodes[]`

## 2. 主数据

### 客户
- GET `/customers`
- POST `/customers`
- PATCH `/customers/{id}`
- 字段：`customerCode`, `name`, `contactName`, `phone`, `address`, `isActive`

### 供应商
- GET `/suppliers`
- POST `/suppliers`
- PATCH `/suppliers/{id}`
- 字段：`supplierCode`, `name`, `contactName`, `phone`, `address`, `isActive`

### 商品
- GET `/products`
- POST `/products`
- PATCH `/products/{id}`
- 字段：`productCode`, `name`, `baseUnitId`, `spec`, `color`, `isActive`

### 单位与换算
- GET `/units`
- POST `/units`
- GET `/unit-conversions?productId=`
- POST `/unit-conversions`
- 入参：`productId`, `fromUnitId`, `toUnitId`, `factor`

### 仓库
- GET `/warehouses`
- POST `/warehouses`

## 3. 销售订单

### GET `/sales-orders`
- 查询：`orderNo`, `customerId`, `status`, `dateFrom`, `dateTo`, `page`, `pageSize`

### POST `/sales-orders`
- 入参：
  - 头：`orderDate`, `customerId`, `remarks`
  - 行：`items[{ lineNo, productId, orderedQty, unitId, unitPrice }]`

### GET `/sales-orders/{id}`

### PATCH `/sales-orders/{id}`
- 仅 `DRAFT` 可完整修改
- `CONFIRMED` 后限制关键字段

### POST `/sales-orders/{id}/confirm`
- `DRAFT -> CONFIRMED`

### POST `/sales-orders/{id}/cancel`
- `DRAFT/CONFIRMED -> CANCELLED`

## 4. 供应商收货单（入库）

### GET `/purchase-receipts`

### POST `/purchase-receipts`
- 入参：
  - 头：`receiptDate`, `supplierId`, `remarks`
  - 行：`items[{ lineNo, productId, receivedQty, unitId, relatedSalesOrderItemId? }]`
- 服务端自动计算：`convertedBaseQty`

### GET `/purchase-receipts/{id}`

### PATCH `/purchase-receipts/{id}`
- 仅 `DRAFT` 可改

### POST `/purchase-receipts/{id}/post`
- `DRAFT -> POSTED`
- 副作用：写 `inventory_ledger` + 更新 `inventory_balances`

### POST `/purchase-receipts/{id}/void`
- `DRAFT -> VOID`

## 5. 送货单（出库）

### GET `/delivery-orders`

### POST `/delivery-orders`
- 入参：
  - 头：`deliveryDate`, `customerId`, `warehouseId`, `remarks`
  - 行：`items[{ lineNo, productId, deliveredQty, unitId, relatedSalesOrderItemId? }]`
- 服务端自动计算：`convertedBaseQty`

### GET `/delivery-orders/{id}`

### PATCH `/delivery-orders/{id}`
- `DRAFT/POSTED/PRINTED`可改（按规则）
- `PRINTED` 后修改会产生版本记录

### POST `/delivery-orders/{id}/post`
- `DRAFT -> POSTED`
- 副作用：扣减库存

### POST `/delivery-orders/{id}/print`
- `POSTED/UPDATED_AFTER_PRINT -> PRINTED`
- 记录 `printedAt`

### POST `/delivery-orders/{id}/void`
- `DRAFT/POSTED -> VOID`

### GET `/delivery-orders/{id}/versions`
- 返回打印后修改的版本历史

## 6. 库存

### GET `/inventory/balances`
- 查询：`warehouseId`, `productId`, `keyword`
- 返回：`onHandQty`, `reservedQty`, `availableQty`

### GET `/inventory/ledger`
- 查询：`warehouseId`, `productId`, `bizType`, `dateFrom`, `dateTo`

### POST `/inventory/adjustments`
- 入参：`warehouseId`, `productId`, `adjustQty`, `reason`
- 副作用：写 `inventory_ledger(ADJUST)`

## 7. 财务往来（二期）

### 账单
- GET `/invoices`
- POST `/invoices`
- GET `/invoices/{id}`
- PATCH `/invoices/{id}`
- POST `/invoices/{id}/issue`
- POST `/invoices/{id}/void`

### 请款
- GET `/payment-requests`
- POST `/payment-requests`
- GET `/payment-requests/{id}`
- POST `/payment-requests/{id}/submit`
- POST `/payment-requests/{id}/approve`
- POST `/payment-requests/{id}/reject`
- POST `/payment-requests/{id}/close`

### 回款
- GET `/receipts`
- POST `/receipts`

## 8. 审计与版本

### GET `/audit-logs`
- 查询：`entityType`, `entityId`, `action`, `dateFrom`, `dateTo`

### GET `/documents/{docType}/{docId}/versions`

## 9. 报表接口（MVP）

### GET `/reports/order-fulfillment`
- 统计订单履约率

### GET `/reports/inventory-aging`
- 库存结构（可后续增强库龄）

### GET `/reports/ar-summary`
- 应收总览（已开单、已请款、已回款、未收款）

## 10. 权限点建议（示例）
- `customer.read`, `customer.write`
- `supplier.read`, `supplier.write`
- `product.read`, `product.write`
- `sales_order.read`, `sales_order.write`, `sales_order.confirm`, `sales_order.cancel`
- `purchase_receipt.read`, `purchase_receipt.write`, `purchase_receipt.post`, `purchase_receipt.void`
- `delivery_order.read`, `delivery_order.write`, `delivery_order.post`, `delivery_order.print`, `delivery_order.edit_after_print`, `delivery_order.void`
- `inventory.read`, `inventory.adjust`
- `invoice.read`, `invoice.write`, `invoice.issue`
- `payment_request.read`, `payment_request.write`, `payment_request.approve`
- `audit.read`
