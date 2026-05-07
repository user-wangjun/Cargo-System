param(
  [string]$BaseUrl = "http://127.0.0.1:3000/api/v1",
  [string]$Username = "admin",
  [string]$Password = "admin123"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ("`n==> " + $Message) -ForegroundColor Cyan
}

function Invoke-Api {
  param(
    [ValidateSet("GET", "POST", "PATCH")]
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$Token = ""
  )

  $uri = "$BaseUrl$Path"
  $headers = @{}
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $params = @{
    Uri = $uri
    Method = $Method
    Headers = $headers
    ContentType = "application/json"
  }
  if ($null -ne $Body) {
    $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
  }

  $resp = Invoke-RestMethod @params
  if ($null -eq $resp -or $resp.code -ne 0) {
    throw "API failed: $Method $Path"
  }
  return $resp.data
}

function Pick-FirstItem {
  param(
    [object]$Value,
    [string]$Name
  )
  if ($Value -is [System.Array]) {
    if ($Value.Count -eq 0) { throw "No $Name found." }
    return $Value[0]
  }
  if ($Value.PSObject.Properties.Name -contains "list") {
    if ($null -eq $Value.list -or $Value.list.Count -eq 0) { throw "No $Name found." }
    return $Value.list[0]
  }
  throw "Unsupported payload for $Name."
}

Write-Step "Health check"
Invoke-RestMethod -Method GET -Uri "$BaseUrl/health" | Out-Null

Write-Step "Login"
$auth = Invoke-Api -Method "POST" -Path "/auth/login" -Body @{
  username = $Username
  password = $Password
}
$token = $auth.accessToken
if (-not $token) { throw "Failed to get token." }
Write-Host ("  user: " + $auth.user.username)

Write-Step "Load master data"
$customer = Pick-FirstItem -Value (Invoke-Api -Method "GET" -Path "/customers?page=1&pageSize=1" -Token $token) -Name "customer"
$supplier = Pick-FirstItem -Value (Invoke-Api -Method "GET" -Path "/suppliers" -Token $token) -Name "supplier"
$product = Pick-FirstItem -Value (Invoke-Api -Method "GET" -Path "/products" -Token $token) -Name "product"

$customerId = $customer.id
$supplierId = $supplier.id
$productId = $product.id
$unitId = $product.baseUnitId

if (-not $unitId) { throw "Selected product has no baseUnitId." }

$today = (Get-Date).ToString("yyyy-MM-dd")
$qty = 5
$unitPrice = 100
$amount = $qty * $unitPrice

Write-Step "Create sales order"
$salesOrder = Invoke-Api -Method "POST" -Path "/sales-orders" -Token $token -Body @{
  orderDate = $today
  customerId = $customerId
  remarks = "E2E flow test"
  items = @(
    @{
      lineNo = 1
      productId = $productId
      orderedQty = $qty
      unitId = $unitId
      unitPrice = $unitPrice
    }
  )
}
Write-Host ("  salesOrder: " + $salesOrder.orderNo + " (" + $salesOrder.status + ")")

Write-Step "Confirm sales order"
$salesOrder = Invoke-Api -Method "POST" -Path "/sales-orders/$($salesOrder.id)/confirm" -Token $token
Write-Host ("  salesOrder status: " + $salesOrder.status)

Write-Step "Create purchase receipt"
$purchaseReceipt = Invoke-Api -Method "POST" -Path "/purchase-receipts" -Token $token -Body @{
  receiptDate = $today
  supplierId = $supplierId
  remarks = "E2E inbound"
  items = @(
    @{
      lineNo = 1
      productId = $productId
      receivedQty = $qty
      unitId = $unitId
    }
  )
}
Write-Host ("  purchaseReceipt: " + $purchaseReceipt.receiptNo + " (" + $purchaseReceipt.status + ")")

Write-Step "Post purchase receipt (inbound)"
$purchaseReceipt = Invoke-Api -Method "POST" -Path "/purchase-receipts/$($purchaseReceipt.id)/post" -Token $token
Write-Host ("  purchaseReceipt status: " + $purchaseReceipt.status)

Write-Step "Get warehouse from inventory balances"
$balances = Invoke-Api -Method "GET" -Path "/inventory/balances" -Token $token
$balanceRow = $null
foreach ($row in $balances.list) {
  if ($row.productId -eq $productId -and [double]$row.onHandQty -ge $qty) {
    $balanceRow = $row
    break
  }
}
if ($null -eq $balanceRow) {
  throw "No warehouse balance with enough stock for selected product."
}
$warehouseId = $balanceRow.warehouseId
Write-Host ("  warehouseId: " + $warehouseId)

Write-Step "Create delivery order"
$deliveryOrder = Invoke-Api -Method "POST" -Path "/delivery-orders" -Token $token -Body @{
  deliveryDate = $today
  customerId = $customerId
  warehouseId = $warehouseId
  remarks = "E2E outbound"
  items = @(
    @{
      lineNo = 1
      productId = $productId
      deliveredQty = $qty
      unitId = $unitId
    }
  )
}
Write-Host ("  deliveryOrder: " + $deliveryOrder.deliveryNo + " (" + $deliveryOrder.status + ")")

Write-Step "Post delivery order (outbound)"
$deliveryOrder = Invoke-Api -Method "POST" -Path "/delivery-orders/$($deliveryOrder.id)/post" -Token $token
Write-Host ("  deliveryOrder status: " + $deliveryOrder.status)

Write-Step "Print delivery order"
$deliveryOrder = Invoke-Api -Method "POST" -Path "/delivery-orders/$($deliveryOrder.id)/print" -Token $token
Write-Host ("  deliveryOrder status: " + $deliveryOrder.status)

Write-Step "Create invoice"
$invoice = Invoke-Api -Method "POST" -Path "/invoices" -Token $token -Body @{
  customerId = $customerId
  deliveryOrderId = $deliveryOrder.id
  invoiceDate = $today
  totalAmount = $amount
}
Write-Host ("  invoice: " + $invoice.invoiceNo + " (" + $invoice.status + ")")

Write-Step "Issue invoice"
$invoice = Invoke-Api -Method "POST" -Path "/invoices/$($invoice.id)/issue" -Token $token
Write-Host ("  invoice status: " + $invoice.status)

Write-Step "Create payment request"
$paymentRequest = Invoke-Api -Method "POST" -Path "/payment-requests" -Token $token -Body @{
  customerId = $customerId
  invoiceId = $invoice.id
  requestDate = $today
  requestedAmount = $amount
}
Write-Host ("  paymentRequest: " + $paymentRequest.requestNo + " (" + $paymentRequest.status + ")")

Write-Step "Submit and approve payment request"
$paymentRequest = Invoke-Api -Method "POST" -Path "/payment-requests/$($paymentRequest.id)/submit" -Token $token
$paymentRequest = Invoke-Api -Method "POST" -Path "/payment-requests/$($paymentRequest.id)/approve" -Token $token
Write-Host ("  paymentRequest status: " + $paymentRequest.status)

Write-Step "Create receipt"
$receipt = Invoke-Api -Method "POST" -Path "/receipts" -Token $token -Body @{
  customerId = $customerId
  invoiceId = $invoice.id
  receivedDate = $today
  amount = $amount
}
Write-Host ("  receipt: " + $receipt.receiptNo + " amount=" + $receipt.amount)

Write-Step "Close payment request"
$paymentRequest = Invoke-Api -Method "POST" -Path "/payment-requests/$($paymentRequest.id)/close" -Token $token
Write-Host ("  paymentRequest final status: " + $paymentRequest.status)

Write-Host "`nE2E flow completed." -ForegroundColor Green
Write-Host ("salesOrder=" + $salesOrder.orderNo)
Write-Host ("purchaseReceipt=" + $purchaseReceipt.receiptNo)
Write-Host ("deliveryOrder=" + $deliveryOrder.deliveryNo)
Write-Host ("invoice=" + $invoice.invoiceNo)
Write-Host ("paymentRequest=" + $paymentRequest.requestNo)
Write-Host ("receipt=" + $receipt.receiptNo)
