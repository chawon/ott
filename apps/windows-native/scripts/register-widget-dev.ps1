param(
    [string]$Arch
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not $Arch) {
    $Arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
}

$unlockKey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -ErrorAction SilentlyContinue
$devModeOn = ($null -ne $unlockKey) -and ($unlockKey.AllowDevelopmentWithoutDevLicense -eq 1)

if (-not $devModeOn) {
    Write-Host "[!] Windows 개발자 모드(Developer Mode)가 꺼져 있습니다." -ForegroundColor Yellow
    Write-Host "    Win + W 위젯 보드에서 로컬 개발 빌드를 바로 테스트하려면 아래 경로에서 개발자 모드를 켜고 다시 실행해 주세요:" -ForegroundColor White
    Write-Host "    Windows 설정 > 시스템 > 개발자용(For developers) > 개발자 모드 켜기" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    참고: Microsoft Store 배포용 MSIX/MSIXBundle (output\msix\ottline-2.0.0.0.msixbundle)에는" -ForegroundColor Gray
    Write-Host "    Windows 11 공식 위젯 공급자(com.microsoft.windows.widgets)가 이미 완전히 포함되어 있습니다." -ForegroundColor Gray
    exit 0
}

$manifestPath = Join-Path $repoRoot "output\stage\$Arch\AppxManifest.xml"
$priPath = Join-Path $repoRoot "output\stage\$Arch\resources.pri"
if (-not (Test-Path $manifestPath)) {
    throw "Staged AppxManifest.xml not found at $manifestPath. Run scripts\build-msix.ps1 first."
}
if (-not (Test-Path $priPath)) {
    throw "Staged resources.pri not found at $priPath. Run scripts\build-msix.ps1 first."
}

Stop-Process -Name "Ottline.App" -Force -ErrorAction SilentlyContinue

$existing = Get-AppxPackage -Name "ChawonLee.ottline" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing ChawonLee.ottline ($($existing.Version), $($existing.SignatureKind))..." -ForegroundColor Yellow
    $existing | Remove-AppxPackage
}

Write-Host "Registering loose MSIX manifest for Win + W widget development: $manifestPath" -ForegroundColor Cyan
Add-AppxPackage -Register $manifestPath

Write-Host "Refreshing Windows Widgets runtime processes so Win + W picks up ottline..." -ForegroundColor Cyan
Stop-Process -Name "WidgetBoard", "Widgets", "WidgetService" -Force -ErrorAction SilentlyContinue

Write-Host "[OK] Registered with resources.pri! Press Win + W -> click '+' to pin ottline." -ForegroundColor Green
