# CargoSystem 前端页面清单与字段定义（MVP）

## 1. 页面地图

### 一期页面
1. 登录页
2. 首页看板（今日订单、待出库、库存预警）
3. 客户管理
4. 供应商管理
5. 商品与单位换算
6. 仓库管理
7. 销售订单列表
8. 销售订单详情/编辑
9. 收货单列表
10. 收货单详情/编辑
11. 送货单列表
12. 送货单详情/编辑/打印
13. 库存余额
14. 库存流水
15. 审计日志

### 二期页面
1. 账单列表/详情
2. 请款单列表/详情
3. 回款登记
4. 应收汇总报表

## 2. 关键页面字段

### 2.1 销售订单详情页
- 头字段：
  - `orderNo`（自动）
  - `orderDate`（必填）
  - `customerId`（必填）
  - `status`（只读）
  - `remarks`
- 明细字段（可多行）：
  - `lineNo`
  - `productId`（必填）
  - `orderedQty`（必填 > 0）
  - `unitId`（必填）
  - `unitPrice`
  - `amount`（自动=数量*单价）
- 操作按钮：`保存` `确认` `作废` `导出`

### 2.2 收货单详情页
- 头字段：
  - `receiptNo`（自动）
  - `receiptDate`（必填）
  - `supplierId`（必填）
  - `status`（只读）
  - `remarks`
- 明细字段：
  - `productId`
  - `receivedQty`
  - `unitId`
  - `convertedBaseQty`（自动计算，只读）
  - `relatedSalesOrderItemId`（可选）
- 操作按钮：`保存` `过账入库` `作废`

### 2.3 送货单详情页
- 头字段：
  - `deliveryNo`（自动）
  - `deliveryDate`（必填）
  - `customerId`（必填）
  - `warehouseId`（必填）
  - `status`（只读）
  - `printedAt`（只读）
  - `remarks`
- 明细字段：
  - `productId`
  - `deliveredQty`
  - `unitId`
  - `convertedBaseQty`（自动，只读）
  - `relatedSalesOrderItemId`（可选）
- 操作按钮：`保存` `过账出库` `打印` `查看版本` `作废`
- 交互规则：
  - 若状态为 `PRINTED`，顶部显示红色提示“该单已打印，当前修改将生成新版本”。

### 2.4 库存余额页
- 查询区：`warehouseId` `keyword(商品编码/名称)`
- 表格列：
  - `productCode`
  - `productName`
  - `spec`
  - `color`
  - `onHandQty`
  - `reservedQty`
  - `availableQty`
  - `updatedAt`

### 2.5 库存流水页
- 查询区：`warehouseId` `productId` `bizType` `dateFrom` `dateTo`
- 表格列：
  - `occurredAt`
  - `bizType`
  - `bizNo`
  - `changeQty`
  - `balanceQty`
  - `createdBy`

### 2.6 审计日志页
- 查询区：`entityType` `entityId` `action` `dateFrom` `dateTo`
- 表格列：
  - `createdAt`
  - `user`
  - `action`
  - `entityType`
  - `entityId`
  - `detail`（可展开 JSON）

## 3. 列表页统一规范
1. 顶部：筛选 + 新建按钮。
2. 中部：分页表格。
3. 行操作：`查看` `编辑` `打印/状态流转`。
4. 支持导出当前筛选结果为 Excel。

## 4. 表单校验规则（通用）
1. 数量字段保留 3 位小数，金额字段 2 位小数。
2. 数量必须大于 0。
3. 单位换算不存在时禁止提交并提示“请先维护单位换算关系”。
4. 状态不允许时，按钮禁用并显示原因。

## 5. 权限与页面可见性
1. `ADMIN`：全部菜单与操作。
2. `OPERATOR`：业务单据读写，不能改角色权限。
3. `VIEWER`：仅列表与详情查看，不显示编辑按钮。

## 6. 打印模板（一期必须）
1. 送货单打印模板
2. 账单打印模板（二期）

模板字段：
- 抬头：公司名、单号、日期、客户
- 明细：商品、规格、颜色、数量、单位
- 底部：备注、经办人、签收栏

## 7. 前端技术建议
1. `React + Ant Design Pro`
2. 状态管理：`React Query + Zustand`
3. 表单：`Antd Form` + 明细行 `Editable Table`
4. 打印：`react-to-print` 或服务端 HTML->PDF
