$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".runtime\\pids.json"

if (!(Test-Path $pidFile)) {
  Write-Host "No PID file found. Nothing to stop." -ForegroundColor Yellow
  exit 0
}

$pids = Get-Content $pidFile | ConvertFrom-Json
$targets = @($pids.backend, $pids.adminFrontend, $pids.userFrontend) | Where-Object { $_ }

foreach ($procId in $targets) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "Stopped PID=$procId"
  } catch {
    Write-Host "PID=$procId is not running or inaccessible, skipped."
  }
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Done."
