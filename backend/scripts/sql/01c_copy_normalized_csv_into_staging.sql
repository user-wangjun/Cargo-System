\echo ==== Load normalized CSV into staging ====

truncate table import_stg.customers;
truncate table import_stg.suppliers;
truncate table import_stg.products;
truncate table import_stg.sales_orders;
truncate table import_stg.sales_order_items;
truncate table import_stg.purchase_receipt_items_seed;
truncate table import_stg.delivery_orders;
truncate table import_stg.delivery_order_items;
truncate table import_stg.invoices;
truncate table import_stg.invoice_lines;

\copy import_stg.customers from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/customers.csv' csv header encoding 'utf8'
\copy import_stg.suppliers from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/suppliers.csv' csv header encoding 'utf8'
\copy import_stg.products from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/products.csv' csv header encoding 'utf8'
\copy import_stg.sales_orders from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/sales_orders.csv' csv header encoding 'utf8'
\copy import_stg.sales_order_items from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/sales_order_items.csv' csv header encoding 'utf8'
\copy import_stg.purchase_receipt_items_seed from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/purchase_receipt_items_seed.csv' csv header encoding 'utf8'
\copy import_stg.delivery_orders from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/delivery_orders.csv' csv header encoding 'utf8'
\copy import_stg.delivery_order_items from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/delivery_order_items.csv' csv header encoding 'utf8'
\copy import_stg.invoices from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/invoices.csv' csv header encoding 'utf8'
\copy import_stg.invoice_lines from 'D:/Users/Desktop/CargoSystem/data/imports/normalized/invoice_lines.csv' csv header encoding 'utf8'

\echo ==== CSV load complete ====
