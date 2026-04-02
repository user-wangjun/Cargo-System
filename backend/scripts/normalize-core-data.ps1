param(
  [string]$StagingRoot = "D:\Users\Desktop\CargoSystem\data\imports\staging",
  [string]$OutDir = "D:\Users\Desktop\CargoSystem\data\imports\normalized"
)

$ErrorActionPreference = "Stop"

function New-Row {
  param([hashtable]$Data)
  return [PSCustomObject]$Data
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$sourceFile = Get-ChildItem -Recurse -Path $StagingRoot -File | Where-Object { $_.FullName -like "*1-接单汇总及入库*\\*.csv" } | Select-Object -First 1
if (-not $sourceFile) {
  throw "Cannot find staging csv for 1-接单汇总及入库"
}

$csv = Import-Csv -Path $sourceFile.FullName -Header c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15,c16,c17,c18,c19,c20,c21,c22,c23,c24

# Heuristic: row where c1='接单日期' is header row
$headerIndex = -1
for ($i = 0; $i -lt $csv.Count; $i++) {
  if ($csv[$i].c1 -eq "接单日期") { $headerIndex = $i; break }
}
if ($headerIndex -lt 0) { throw "Cannot find header row in $($sourceFile.FullName)" }

$dataRows = @()
for ($i = $headerIndex + 2; $i -lt $csv.Count; $i++) {
  $r = $csv[$i]
  if ([string]::IsNullOrWhiteSpace($r.c1) -and [string]::IsNullOrWhiteSpace($r.c3) -and [string]::IsNullOrWhiteSpace($r.c7)) {
    continue
  }
  $dataRows += $r
}

$customers = @{}
$suppliers = @{}
$products = @{}
$orders = @{}
$orderItems = New-Object System.Collections.Generic.List[object]
$receipts = New-Object System.Collections.Generic.List[object]

$lineNoMap = @{}

foreach ($r in $dataRows) {
  $customer = ($r.c3).Trim()
  $supplier = ($r.c17).Trim()
  $orderNo = ($r.c4).Trim()
  $orderDate = ($r.c1).Trim()
  $productCode = (($r.c7) -replace "`r|`n", " ").Trim()
  $productName = ($r.c9).Trim()
  $color = ($r.c13).Trim()
  $qty = ($r.c14).Trim()
  $unit = ($r.c15).Trim()
  $supplierDate = ($r.c18).Trim()
  $supplierQty = ($r.c19).Trim()

  if (-not [string]::IsNullOrWhiteSpace($customer)) {
    $customers[$customer] = New-Row @{ customer_code = $customer; name = $customer }
  }
  if (-not [string]::IsNullOrWhiteSpace($supplier) -and $supplier -ne "扣库") {
    $suppliers[$supplier] = New-Row @{ supplier_code = $supplier; name = $supplier }
  }
  if (-not [string]::IsNullOrWhiteSpace($productCode)) {
    $key = $productCode
    $products[$key] = New-Row @{
      product_code = $productCode
      name = if ($productName) { $productName } else { $productCode }
      spec = ($r.c12).Trim()
      color = $color
      base_unit = if ($unit) { $unit } else { "Y" }
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($orderNo)) {
    if (-not $orders.ContainsKey($orderNo)) {
      $orders[$orderNo] = New-Row @{
        external_order_no = $orderNo
        customer_name = $customer
        order_date = $orderDate
        remarks = ($r.c16).Trim()
      }
      $lineNoMap[$orderNo] = 0
    }

    $lineNoMap[$orderNo] = [int]$lineNoMap[$orderNo] + 1
    $orderItems.Add((New-Row @{
      external_order_no = $orderNo
      line_no = $lineNoMap[$orderNo]
      product_code = $productCode
      product_name = $productName
      color = $color
      ordered_qty = $qty
      unit = $unit
      supplier_name = $supplier
      supplier_delivery_date = $supplierDate
      supplier_qty = $supplierQty
      remarks = ($r.c16).Trim()
    }))
  }

  if (-not [string]::IsNullOrWhiteSpace($supplier) -and -not [string]::IsNullOrWhiteSpace($supplierQty)) {
    $receipts.Add((New-Row @{
      supplier_name = $supplier
      receipt_date = $supplierDate
      product_code = $productCode
      product_name = $productName
      received_qty = $supplierQty
      unit = if ($unit) { $unit } else { "Y" }
      related_external_order_no = $orderNo
    }))
  }
}

$customers.Values | Export-Csv -Path (Join-Path $OutDir "customers.csv") -NoTypeInformation -Encoding UTF8
$suppliers.Values | Export-Csv -Path (Join-Path $OutDir "suppliers.csv") -NoTypeInformation -Encoding UTF8
$products.Values | Export-Csv -Path (Join-Path $OutDir "products.csv") -NoTypeInformation -Encoding UTF8
$orders.Values | Export-Csv -Path (Join-Path $OutDir "sales_orders.csv") -NoTypeInformation -Encoding UTF8
$orderItems | Export-Csv -Path (Join-Path $OutDir "sales_order_items.csv") -NoTypeInformation -Encoding UTF8
$receipts | Export-Csv -Path (Join-Path $OutDir "purchase_receipt_items_seed.csv") -NoTypeInformation -Encoding UTF8

Write-Output "Normalized csv exported to $OutDir"
