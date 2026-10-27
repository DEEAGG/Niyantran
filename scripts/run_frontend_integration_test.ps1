# Comprehensive Browser Smoke & Integration Test for Niyantran using Playwright CLI
$ErrorActionPreference = "Stop"

if (-not (Test-Path "artifacts")) {
    New-Item -ItemType Directory -Path "artifacts" -Force | Out-Null
}

Write-Host "Running Playwright browser integration suite on Niyantran frontend..." -ForegroundColor Cyan

try {
    playwright-cli open "http://127.0.0.1:3000"
    $jsonOutput = playwright-cli --json run-code --filename "scripts/frontend_integration_test.js"
    if ($jsonOutput) {
        $jsonOutput | Out-File -FilePath "artifacts/frontend_test_report.json" -Encoding utf8
    }
} finally {
    playwright-cli close
}

Write-Host "`nCaptured screenshots in artifacts:" -ForegroundColor Green
Get-ChildItem -Path "artifacts" -Filter "*.png" | ForEach-Object {
    Write-Host "  $($_.Name) ($([math]::Round($_.Length / 1KB, 1)) KB)" -ForegroundColor Green
}
