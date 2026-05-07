param(
  [string]$DB_HOST = "127.0.0.1",
  [string]$DB_PORT = "5432",
  [string]$DB_USER = "postgres",
  [string]$DB_PASSWORD = "postgres",
  [string]$DB_NAME = "cargosystem"
)

$env:DB_HOST = $DB_HOST
$env:DB_PORT = $DB_PORT
$env:DB_USER = $DB_USER
$env:DB_PASSWORD = $DB_PASSWORD
$env:DB_NAME = $DB_NAME

python "D:\Users\Desktop\CargoSystem\backend\scripts\generate_validation_report.py"
