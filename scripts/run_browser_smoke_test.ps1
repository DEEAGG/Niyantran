# Reusable browser smoke-test workflow for Niyantran using Playwright CLI
param(
    [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Niyantran Playwright Browser Smoke Test" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Ensure artifacts directory exists
if (-not (Test-Path "artifacts")) {
    New-Item -ItemType Directory -Path "artifacts" -Force | Out-Null
}

# Verify or launch FastAPI server
$serverRunning = $false
try {
    $res = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 3 -ErrorAction Stop
    if ($res.status -eq "healthy") {
        $serverRunning = $true
        Write-Host "FastAPI server is reachable at $BaseUrl" -ForegroundColor Green
    }
} catch {
    Write-Host "FastAPI server is not currently reachable at $BaseUrl" -ForegroundColor Yellow
}

if (-not $serverRunning) {
    Write-Host "Starting FastAPI server in background..." -ForegroundColor Yellow
    Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

$scriptPath = "scripts/browser_smoke_test.js"
if (-not (Test-Path $scriptPath)) {
    Write-Error "Test script not found at $scriptPath"
    exit 1
}

Write-Host "Executing Playwright CLI browser smoke tests..." -ForegroundColor Cyan
try {
    playwright-cli open "$BaseUrl"
    $jsonOutput = playwright-cli --json run-code --filename "$scriptPath"
    if ($jsonOutput) {
        $jsonOutput | Out-File -FilePath "artifacts/browser_test_report.json" -Encoding utf8
    }
} finally {
    playwright-cli close
}

Write-Host "Verifying captured artifacts..." -ForegroundColor Cyan
Get-ChildItem -Path "artifacts" -Filter "*.png" | ForEach-Object {
    Write-Host "  Captured: $($_.Name) ($([math]::Round($_.Length / 1KB, 1)) KB)" -ForegroundColor Green
}

Write-Host "`nWorkflow complete. Report saved to artifacts/browser_test_report.json" -ForegroundColor Green
