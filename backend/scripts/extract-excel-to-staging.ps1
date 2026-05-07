param(
  [string]$SourceDir = "D:\Users\Desktop\CargoSystem\data\imports\raw",
  [string]$OutDir = "D:\Users\Desktop\CargoSystem\data\imports\staging",
  [string]$LogFile = "D:\Users\Desktop\CargoSystem\data\imports\logs\extract.log"
)

$ErrorActionPreference = "Stop"

function Sanitize-Name {
  param([string]$Name)
  if ([string]::IsNullOrWhiteSpace($Name)) { return "sheet" }
  return ($Name -replace '[\\/:*?"<>| ]', "_")
}

function SafeRelease($obj) {
  if ($null -ne $obj) {
    try { [void][System.Runtime.Interopservices.Marshal]::ReleaseComObject($obj) } catch {}
  }
}

function Export-WorkbookToCsv {
  param(
    [string]$FilePath,
    [string]$DestinationRoot
  )

  $excel = $null
  $wb = $null
  try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $wb = $excel.Workbooks.Open($FilePath)

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    $workbookDir = Join-Path $DestinationRoot (Sanitize-Name $baseName)
    New-Item -ItemType Directory -Force -Path $workbookDir | Out-Null

    foreach ($ws in $wb.Worksheets) {
      $sheetName = Sanitize-Name $ws.Name
      $outCsv = Join-Path $workbookDir ($sheetName + ".csv")
      $lines = New-Object System.Collections.Generic.List[string]

      $used = $ws.UsedRange
      $rows = $used.Rows.Count
      $cols = $used.Columns.Count

      for ($r = 1; $r -le $rows; $r++) {
        $vals = New-Object System.Collections.Generic.List[string]
        $nonEmpty = 0
        for ($c = 1; $c -le $cols; $c++) {
          $text = [string]$ws.Cells.Item($r, $c).Text
          if (-not [string]::IsNullOrWhiteSpace($text)) { $nonEmpty++ }
          $escaped = '"' + ($text -replace '"', '""') + '"'
          $vals.Add($escaped)
        }
        if ($nonEmpty -gt 0) {
          $lines.Add(($vals -join ','))
        }
      }

      [System.IO.File]::WriteAllLines($outCsv, $lines, [System.Text.Encoding]::UTF8)
      Write-Output "Exported: $outCsv"
    }
  } finally {
    if ($wb) { $wb.Close($false) | Out-Null }
    if ($excel) { $excel.Quit() }
    SafeRelease $wb
    SafeRelease $excel
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $LogFile -Parent) | Out-Null

$files = Get-ChildItem -Path $SourceDir -File | Where-Object { $_.Extension -in ".xlsx", ".xls" }
if ($files.Count -eq 0) {
  throw "No Excel files found in $SourceDir"
}

foreach ($f in $files) {
  try {
    Export-WorkbookToCsv -FilePath $f.FullName -DestinationRoot $OutDir
  } catch {
    $msg = "$(Get-Date -Format s) FAILED: $($f.FullName) - $($_.Exception.Message)"
    Add-Content -Path $LogFile -Value $msg -Encoding UTF8
    Write-Warning $msg
  }
}

Write-Output "Done. Staging CSV exported to $OutDir"
