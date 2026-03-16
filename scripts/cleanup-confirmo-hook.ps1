$ErrorActionPreference = 'Stop'

$projectRoot = 'D:\Github\CodexPin'
$backupRoot = 'C:\Users\86153\.codexpin\backups'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

function Backup-And-RemoveFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath
  )

  if (-not (Test-Path $FilePath)) {
    return
  }

  $fileName = Split-Path $FilePath -Leaf
  $backupPath = Join-Path $backupRoot ($fileName + '.confirmo-cleanup.' + $timestamp + '.bak')
  Copy-Item $FilePath $backupPath -Force
  Remove-Item $FilePath -Force
}

Get-Process Confirmo -ErrorAction SilentlyContinue | Stop-Process -Force

Push-Location $projectRoot
try {
  node .\scripts\codexpin-cli.js setup | Out-Host
} finally {
  Pop-Location
}

Backup-And-RemoveFile -FilePath 'C:\Users\86153\.codexpin\original-notify.json'
Backup-And-RemoveFile -FilePath 'C:\Users\86153\.confirmo\hooks\codex-original-notify.json'
Backup-And-RemoveFile -FilePath 'C:\Users\86153\.confirmo\hooks\confirmo-codex-hook.js'

Write-Output 'cleanup-complete'
Write-Output 'config-notify-now:'
Get-Content 'C:\Users\86153\.codex\config.toml'
