\echo ==== CargoSystem import start ====
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/01_create_staging_tables.sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/01b_create_staging_tables_delivery_invoice.sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/01c_copy_normalized_csv_into_staging.sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/02_load_and_transform.sql
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/03_load_delivery_and_invoice.sql
\echo ==== CargoSystem validation report ====
\i D:/Users/Desktop/CargoSystem/backend/scripts/sql/04_post_import_validation.sql
\echo ==== Done ====
