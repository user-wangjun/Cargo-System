param(
  [switch]$RebuildBackend = $true
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$runtimeDir = Join-Path $root ".runtime"
$pidFile = Join-Path $runtimeDir "pids.json"

$node = "C:\\Users\\13640\\.trae-cn\\binaries\\node\\versions\\24.11.1\\node.exe"
$npm = "C:\\Users\\13640\\.trae-cn\\binaries\\node\\versions\\24.11.1\\npm.cmd"
$staticServer = Join-Path $root "scripts\\static-server.js"

if (!(Test-Path $runtimeDir)) {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
}

if (Test-Path $pidFile) {
  Write-Host "Found old PID file. Running stop-all.ps1 first is recommended." -ForegroundColor Yellow
}

if ($RebuildBackend) {
  Write-Host "Building backend..." -ForegroundColor Cyan
  Push-Location $backendDir
  & $npm run build
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Backend build failed"
  }
  Pop-Location
}

$oldBackendPid = $null
try {
  $oldBackendPid = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop | Select-Object -First 1 -ExpandProperty OwningProcess)
} catch {}
if ($oldBackendPid) {
  Write-Host "Stopping old backend process PID=$oldBackendPid" -ForegroundColor Yellow
  Stop-Process -Id $oldBackendPid -Force -ErrorAction SilentlyContinue
}

Write-Host "Starting backend: http://127.0.0.1:3000" -ForegroundColor Cyan
$backendProc = Start-Process -FilePath $node -ArgumentList "dist/main.js" -WorkingDirectory $backendDir -PassThru

$healthOk = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    Invoke-RestMethod -Method GET -Uri "http://127.0.0.1:3000/api/v1/health" | Out-Null
    $healthOk = $true
    break
  } catch {}
}
if (-not $healthOk) {
  Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
  throw "Backend health check failed"
}

Write-Host "Starting frontend: http://127.0.0.1:5173" -ForegroundColor Cyan
$frontendProc = Start-Process -FilePath $node -ArgumentList "`"$staticServer`" `"$frontendDir`" 5173" -PassThru

$pids = @{
  backend = $backendProc.Id
  frontend = $frontendProc.Id
  startedAt = (Get-Date).ToString("s")
}
$pids | ConvertTo-Json | Set-Content -Encoding ASCII $pidFile

Write-Host ""
Write-Host "All services started:" -ForegroundColor Green
Write-Host "  Backend API:   http://127.0.0.1:3000/api/v1"
Write-Host "  Front Login:   http://127.0.0.1:5173/"
Write-Host "  Front Register:http://127.0.0.1:5173/admin/register.html"
Write-Host ""
Write-Host "Accounts:" -ForegroundColor Green
Write-Host "  Super Admin:  18800000000 / AdminDemo123"
Write-Host "  Test Admin:   admin / admin123"
Write-Host "  Owner:       owner / owner123"
Write-Host "  Finance:     finance / finance123"
Write-Host "  Viewer:      viewer / viewer123"
Write-Host ""
Write-Host "Stop command: powershell -ExecutionPolicy Bypass -File scripts/stop-all.ps1"
