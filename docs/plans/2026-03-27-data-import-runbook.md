# CargoSystem 数据导入手册（Excel -> PostgreSQL）

## 1. 数据放置位置
1. 原始 Excel 放这里：`D:\Users\Desktop\CargoSystem\data\imports\raw`
2. 抽取后的分表 CSV：`D:\Users\Desktop\CargoSystem\data\imports\staging`
3. 标准化 CSV（可直接入库）：`D:\Users\Desktop\CargoSystem\data\imports\normalized`
4. 抽取日志：`D:\Users\Desktop\CargoSystem\data\imports\logs\extract.log`

## 2. 已准备好的脚本
1. 抽取脚本（全工作表 -> CSV）  
`D:\Users\Desktop\CargoSystem\backend\scripts\extract_excel_to_staging.py`
2. 标准化脚本（接单主链路）  
`D:\Users\Desktop\CargoSystem\backend\scripts\normalize_core_data.py`
3. 标准化脚本（送货单+账单）  
`D:\Users\Desktop\CargoSystem\backend\scripts\normalize_delivery_billing.py`
4. SQL（创建 staging 表）  
`D:\Users\Desktop\CargoSystem\backend\scripts\sql\01_create_staging_tables.sql`
5. SQL（创建送货/账单 staging 表）  
`D:\Users\Desktop\CargoSystem\backend\scripts\sql\01b_create_staging_tables_delivery_invoice.sql`
6. SQL（导入并转换到业务表：订单主链路）  
`D:\Users\Desktop\CargoSystem\backend\scripts\sql\02_load_and_transform.sql`
7. SQL（导入并转换到业务表：送货/账单）  
`D:\Users\Desktop\CargoSystem\backend\scripts\sql\03_load_delivery_and_invoice.sql`
8. SQL（导入后验收核对报表）  
`D:\Users\Desktop\CargoSystem\backend\scripts\sql\04_post_import_validation.sql`
9. SQL（一键执行导入+验收）  
`D:\Users\Desktop\CargoSystem\backend\scripts\sql\00_run_all_import_and_validation.sql`
10. Python（生成中文验收报告）  
`D:\Users\Desktop\CargoSystem\backend\scripts\generate_validation_report.py`
11. PowerShell（一键生成报告，支持传DB参数）  
`D:\Users\Desktop\CargoSystem\backend\scripts\run_validation_report.ps1`

## 3. 执行顺序
1. 先跑抽取：
```powershell
python D:\Users\Desktop\CargoSystem\backend\scripts\extract_excel_to_staging.py
```
2. 再跑标准化：
```powershell
python D:\Users\Desktop\CargoSystem\backend\scripts\normalize_core_data.py
python D:\Users\Desktop\CargoSystem\backend\scripts\normalize_delivery_billing.py
```
3. 在 PostgreSQL 执行：
```sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/01_create_staging_tables.sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/01b_create_staging_tables_delivery_invoice.sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/02_load_and_transform.sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/03_load_delivery_and_invoice.sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/04_post_import_validation.sql
```

或直接一键执行：
```sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/00_run_all_import_and_validation.sql
```

生成中文验收报告：
```powershell
powershell -ExecutionPolicy Bypass -File D:\Users\Desktop\CargoSystem\backend\scripts\run_validation_report.ps1 -DB_HOST 127.0.0.1 -DB_PORT 5432 -DB_USER postgres -DB_PASSWORD postgres -DB_NAME cargosystem
```

输出文件：
`D:\Users\Desktop\CargoSystem\data\imports\logs\validation-report.md`
`D:\Users\Desktop\CargoSystem\data\imports\logs\validation-todos.csv`

报告分级说明：
1. `P0`：阻塞上线，必须先修复（主数据缺失、孤儿明细等）。
2. `P1`：高优先级，建议上线前修复（金额/数量对账差异明显、大量未关联合同发票）。
3. `P2`：可带风险上线，但需排期修复（少量未关联合同发票等）。

## 4. 本次已完成
1. 已把你现有 Excel 复制到 `data/imports/raw`
2. 已成功生成 `staging` CSV
3. 已成功生成 `normalized` CSV（核心文件）：
   - `customers.csv`
   - `suppliers.csv`
   - `products.csv`
   - `sales_orders.csv`
   - `sales_order_items.csv`
   - `purchase_receipt_items_seed.csv`
   - `delivery_orders.csv`
   - `delivery_order_items.csv`
   - `invoices.csv`
   - `invoice_lines.csv`

## 5. 注意事项
1. 当前标准化脚本优先覆盖了“接单汇总及入库”主链路，能先把订单/入库基础数据进库。
2. `送货单及帐单` 已进入第二阶段标准化，但由于模板差异仍建议先在测试库导入验证后再上生产库。
3. 导入前请确保数据库中已执行 `docs/mvp-schema.sql`，并存在至少一个仓库记录（入库过账需要）。
