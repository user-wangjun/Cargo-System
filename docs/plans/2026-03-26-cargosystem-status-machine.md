# CargoSystem 单据状态机（MVP）

## 1. 销售订单 `sales_orders.status`
- `DRAFT`：草稿，可编辑明细。
- `CONFIRMED`：已确认，锁定关键字段（客户、主产品），允许备注改动。
- `PARTIALLY_FULFILLED`：部分完成（已有部分出货）。
- `FULFILLED`：全部完成（全部行完成出货）。
- `CANCELLED`：已作废。

允许流转：
- `DRAFT -> CONFIRMED`
- `CONFIRMED -> PARTIALLY_FULFILLED`
- `PARTIALLY_FULFILLED -> FULFILLED`
- `DRAFT/CONFIRMED -> CANCELLED`

## 2. 供应商收货单 `purchase_receipts.status`
- `DRAFT`：草稿，可录入到货数量和单位。
- `POSTED`：已过账，写入库存流水（INBOUND）。
- `VOID`：已作废（仅未被下游引用时允许）。

允许流转：
- `DRAFT -> POSTED`
- `DRAFT -> VOID`

规则：
- 过账时必须完成单位折算，写入 `converted_base_qty`。
- 过账后禁止直接改数量；若要更正，走“红字冲销 + 新单重录”。

## 3. 送货单 `delivery_orders.status`
- `DRAFT`：草稿。
- `POSTED`：已出库，写库存流水（OUTBOUND）。
- `PRINTED`：已打印（可继续修改，但必须留版本）。
- `UPDATED_AFTER_PRINT`：打印后已修改。
- `VOID`：已作废。

允许流转：
- `DRAFT -> POSTED`
- `POSTED -> PRINTED`
- `PRINTED -> UPDATED_AFTER_PRINT`
- `UPDATED_AFTER_PRINT -> PRINTED`（再次打印）
- `DRAFT/POSTED -> VOID`（受库存与下游单据约束）

规则（对应你的核心需求）：
- 一旦进入 `PRINTED`，仍允许改，但每次保存都必须：
  - 写 `document_versions`（版本号 +1）
  - 写 `audit_logs`（action=`UPDATE_AFTER_PRINT`）
  - 页面标记“此单据已打印后修改”。

## 4. 账单 `invoices.status`
- `DRAFT`：草稿。
- `ISSUED`：已出账。
- `PARTIALLY_PAID`：部分回款。
- `PAID`：已结清。
- `VOID`：已作废。

允许流转：
- `DRAFT -> ISSUED`
- `ISSUED -> PARTIALLY_PAID -> PAID`
- `DRAFT/ISSUED -> VOID`

## 5. 请款单 `payment_requests.status`
- `DRAFT`：草稿。
- `SUBMITTED`：已提交。
- `APPROVED`：已批准。
- `REJECTED`：已驳回。
- `CLOSED`：已关闭（完成或终止）。

允许流转：
- `DRAFT -> SUBMITTED`
- `SUBMITTED -> APPROVED/REJECTED`
- `APPROVED -> CLOSED`
- `REJECTED -> DRAFT`

## 6. 状态变更通用约束
- 所有状态变更都写 `audit_logs`。
- 涉及库存影响的状态（收货过账、送货过账）必须在事务内同时更新：
  - `inventory_ledger`
  - `inventory_balances`
- 禁止负库存（除非后续明确开放配置项）。
- 已被下游引用的单据，不允许硬删除，只允许作废。
