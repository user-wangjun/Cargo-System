# CargoSystem 前端菜单、路由与权限矩阵（MVP）

## 1. 菜单与路由

| 一级菜单 | 二级菜单 | 路由 | 页面说明 |
|---|---|---|---|
| 工作台 | 首页看板 | `/dashboard` | 今日订单、待出库、库存预警、应收摘要 |
| 基础资料 | 客户管理 | `/master/customers` | 客户列表、编辑 |
| 基础资料 | 供应商管理 | `/master/suppliers` | 供应商列表、编辑 |
| 基础资料 | 商品管理 | `/master/products` | 商品、规格颜色、基础单位 |
| 基础资料 | 单位换算 | `/master/unit-conversions` | 商品级换算关系 |
| 基础资料 | 仓库管理 | `/master/warehouses` | 仓库维护 |
| 订单与履约 | 销售订单 | `/sales/orders` | 列表、筛选、新建 |
| 订单与履约 | 销售订单详情 | `/sales/orders/:id` | 详情编辑、确认、作废 |
| 采购与入库 | 收货单 | `/purchase/receipts` | 列表、新建、过账 |
| 采购与入库 | 收货单详情 | `/purchase/receipts/:id` | 详情编辑、过账、作废 |
| 出库与单据 | 送货单 | `/delivery/orders` | 列表、新建、打印 |
| 出库与单据 | 送货单详情 | `/delivery/orders/:id` | 详情、过账、打印、版本 |
| 库存 | 库存余额 | `/inventory/balances` | 在库、占用、可用 |
| 库存 | 库存流水 | `/inventory/ledger` | 出入库流水追踪 |
| 财务（二期） | 账单管理 | `/finance/invoices` | 账单创建、出账 |
| 财务（二期） | 请款管理 | `/finance/payment-requests` | 提交、审批、关闭 |
| 财务（二期） | 回款登记 | `/finance/receipts` | 回款录入与核销 |
| 系统 | 审计日志 | `/system/audit-logs` | 操作追踪 |
| 系统 | 用户与角色 | `/system/users` | 用户、角色、授权 |

## 2. 角色定义

- `ADMIN`：系统全权限。
- `OPERATOR`：业务操作权限，不能管理用户角色。
- `VIEWER`：只读查看权限。

## 3. 权限点与角色矩阵

说明：`Y`=允许，`N`=不允许。

| 权限点 | ADMIN | OPERATOR | VIEWER |
|---|---:|---:|---:|
| `dashboard.read` | Y | Y | Y |
| `customer.read` | Y | Y | Y |
| `customer.write` | Y | Y | N |
| `supplier.read` | Y | Y | Y |
| `supplier.write` | Y | Y | N |
| `product.read` | Y | Y | Y |
| `product.write` | Y | Y | N |
| `unit_conversion.read` | Y | Y | Y |
| `unit_conversion.write` | Y | Y | N |
| `warehouse.read` | Y | Y | Y |
| `warehouse.write` | Y | Y | N |
| `sales_order.read` | Y | Y | Y |
| `sales_order.write` | Y | Y | N |
| `sales_order.confirm` | Y | Y | N |
| `sales_order.cancel` | Y | Y | N |
| `purchase_receipt.read` | Y | Y | Y |
| `purchase_receipt.write` | Y | Y | N |
| `purchase_receipt.post` | Y | Y | N |
| `purchase_receipt.void` | Y | Y | N |
| `delivery_order.read` | Y | Y | Y |
| `delivery_order.write` | Y | Y | N |
| `delivery_order.post` | Y | Y | N |
| `delivery_order.print` | Y | Y | N |
| `delivery_order.edit_after_print` | Y | Y | N |
| `delivery_order.void` | Y | Y | N |
| `inventory.read` | Y | Y | Y |
| `inventory.adjust` | Y | Y | N |
| `invoice.read` | Y | Y | Y |
| `invoice.write` | Y | Y | N |
| `invoice.issue` | Y | Y | N |
| `payment_request.read` | Y | Y | Y |
| `payment_request.write` | Y | Y | N |
| `payment_request.approve` | Y | N | N |
| `receipt.read` | Y | Y | Y |
| `receipt.write` | Y | Y | N |
| `audit.read` | Y | Y | Y |
| `user.read` | Y | N | N |
| `user.write` | Y | N | N |
| `role.assign` | Y | N | N |

## 4. 前端路由守卫规则

1. 未登录访问任何业务路由，跳转 `/login`。
2. 登录后根据权限点动态过滤菜单。
3. 有页面权限但无按钮权限时：页面可见、按钮隐藏。
4. 路由参数 `:id` 页面统一校验资源可读权限，否则提示 403。

## 5. 打印后改单交互约束

1. 送货单状态为 `PRINTED` 时，详情页显示警示横幅。
2. 点击保存时弹窗确认：
   - “该单据已打印，本次修改将生成新版本并记录审计日志。”
3. 保存成功后自动刷新版本侧栏。

## 6. 建议路由文件结构（React）

- `src/routes/index.tsx`：基础路由与登录白名单
- `src/routes/guard.tsx`：鉴权与权限守卫
- `src/routes/modules/master.tsx`
- `src/routes/modules/sales.tsx`
- `src/routes/modules/purchase.tsx`
- `src/routes/modules/delivery.tsx`
- `src/routes/modules/inventory.tsx`
- `src/routes/modules/finance.tsx`
- `src/routes/modules/system.tsx`

## 7. MVP 默认首页

登录后默认进入 `/dashboard`，卡片顺序建议：
1. 今日新订单数
2. 待出库单数
3. 库存预警商品数
4. 本月已请款金额
5. 本月已回款金额
