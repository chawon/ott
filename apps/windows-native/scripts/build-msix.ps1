param(
    [string]$Version = "2.0.0.0",
    [string]$Publisher = "CN=A486532B-583B-4088-AFDE-FC4377E51968",
    [switch]$UseStorePatchedOid,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

if ($UseStorePatchedOid) {
    $Publisher = "CN=A486532B-583B-4088-AFDE-FC4377E51968, OID.2.25.311729368913984317654407730594956997722=1"
}

$dotnetExe = "$env:USERPROFILE\.dotnet\dotnet.exe"
if (-not (Test-Path $dotnetExe)) {
    $dotnetExe = "dotnet"
}

Write-Host "=== [1/4] Restoring & Running Unit Tests ===" -ForegroundColor Cyan
& $dotnetExe restore "$repoRoot\OttlineWindows.sln"
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed" }

if (-not $SkipTests) {
    & $dotnetExe test "$repoRoot\tests\Ottline.Tests\Ottline.Tests.csproj" -c Release --no-restore
    if ($LASTEXITCODE -ne 0) { throw "dotnet test failed" }
}

$nugetRoot = if (-not [string]::IsNullOrWhiteSpace($env:NUGET_PACKAGES)) {
    $env:NUGET_PACKAGES
} else {
    Join-Path $env:USERPROFILE ".nuget\packages"
}

$hostArch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
$buildToolsRoot = Join-Path $nugetRoot "microsoft.windows.sdk.buildtools"
$makeAppx = Get-ChildItem $buildToolsRoot -Recurse -Filter "makeappx.exe" |
    Where-Object { $_.FullName -like "*\$hostArch\makeappx.exe" } |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $makeAppx) {
    $makeAppx = Get-ChildItem $buildToolsRoot -Recurse -Filter "makeappx.exe" |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $makeAppx) {
    throw "makeappx.exe not found in NuGet cache ($buildToolsRoot)"
}

$makePri = Get-ChildItem $buildToolsRoot -Recurse -Filter "makepri.exe" |
    Where-Object { $_.FullName -like "*\$hostArch\makepri.exe" } |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $makePri) {
    $makePri = Get-ChildItem $buildToolsRoot -Recurse -Filter "makepri.exe" |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $makePri) {
    throw "makepri.exe not found in NuGet cache ($buildToolsRoot)"
}

Write-Host "Using MakeAppx: $makeAppx" -ForegroundColor Gray
Write-Host "Using MakePri:  $makePri" -ForegroundColor Gray

try {
    Stop-Process -Name "Ottline.App" -Force -ErrorAction SilentlyContinue
    $devPkg = Get-AppxPackage -Name "ChawonLee.ottline" -ErrorAction SilentlyContinue | Where-Object { $_.IsDevelopmentMode -eq $true }
    if ($devPkg) {
        Write-Host "Unregistering existing dev package before cleaning output..." -ForegroundColor Yellow
        $devPkg | Remove-AppxPackage
    }
}
catch {
    Write-Host "Skipping local Appx cleanup: $($_.Exception.Message)" -ForegroundColor DarkGray
}

$outputRoot = "$repoRoot\output"
$msixOutDir = "$outputRoot\msix"
$bundleInputDir = "$outputRoot\bundle-input"
$storeUploadDir = "$outputRoot\store-upload"
if (Test-Path $outputRoot) {
    Remove-Item $outputRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $msixOutDir | Out-Null
New-Item -ItemType Directory -Force -Path $bundleInputDir | Out-Null
New-Item -ItemType Directory -Force -Path $storeUploadDir | Out-Null

$manifestTemplate = Get-Content "$repoRoot\packaging\AppxManifest.template.xml" -Raw -Encoding UTF8
$architectures = @(
    @{ Rid = "win-x64";   Arch = "x64" },
    @{ Rid = "win-arm64"; Arch = "arm64" }
)

foreach ($item in $architectures) {
    $rid = $item.Rid
    $arch = $item.Arch
    $publishDir = "$outputRoot\publish\$rid"
    $stageDir = "$outputRoot\stage\$arch"

    Write-Host "=== [2/4] Publishing Self-Contained Build for $rid ($arch) ===" -ForegroundColor Cyan
    & $dotnetExe publish "$repoRoot\src\Ottline.App\Ottline.App.csproj" `
        -c Release `
        -r $rid `
        --self-contained true `
        -p:PublishSingleFile=false `
        -p:DebugType=none `
        -p:DebugSymbols=false `
        -p:Version=$Version `
        -o $publishDir
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed for $rid" }

    Write-Host "=== [3/4] Staging & Packing MSIX for $arch ===" -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path "$stageDir\Images" | Out-Null
    New-Item -ItemType Directory -Force -Path "$stageDir\WidgetAssets" | Out-Null
    New-Item -ItemType Directory -Force -Path "$stageDir\Public\Images" | Out-Null
    New-Item -ItemType Directory -Force -Path "$stageDir\Public\WidgetAssets" | Out-Null
    Copy-Item "$publishDir\*" $stageDir -Recurse -Force
    Copy-Item "$repoRoot\packaging\Images\*" "$stageDir\Images\" -Force
    Copy-Item "$repoRoot\packaging\WidgetAssets\*" "$stageDir\WidgetAssets\" -Force
    Copy-Item "$repoRoot\packaging\Images\StoreLogo.png" "$stageDir\Public\Images\StoreLogo.png" -Force
    Copy-Item "$repoRoot\packaging\WidgetAssets\*" "$stageDir\Public\WidgetAssets\" -Force

    if (-not (Test-Path "$stageDir\Microsoft.Windows.Widgets.dll")) {
        $widgetNative = Join-Path $nugetRoot "microsoft.windowsappsdk.widgets\1.8.251231004\runtimes-framework\$rid\native\Microsoft.Windows.Widgets.dll"
        if (-not (Test-Path $widgetNative)) {
            throw "Native Microsoft.Windows.Widgets.dll not found for $rid at $widgetNative"
        }
        Copy-Item $widgetNative "$stageDir\Microsoft.Windows.Widgets.dll" -Force
    }

    # Ensure no debug symbols (.pdb) ship inside Store MSIX payload
    Get-ChildItem $stageDir -Recurse -Filter "*.pdb" -ErrorAction SilentlyContinue | Remove-Item -Force

    $manifestContent = $manifestTemplate.
        Replace("{{PUBLISHER}}", $Publisher).
        Replace("{{VERSION}}", $Version).
        Replace("{{ARCH}}", $arch)

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText("$stageDir\AppxManifest.xml", $manifestContent, $utf8NoBom)

    Write-Host "=== Generating resources.pri (MakePri) for $arch ===" -ForegroundColor Cyan
    $priConfig = "$outputRoot\priconfig-$arch.xml"
    & $makePri createconfig /cf $priConfig /dq ko-KR /o | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "makepri createconfig failed for $arch" }

    & $makePri new /pr $stageDir /cf $priConfig /mn "$stageDir\AppxManifest.xml" /of "$stageDir\resources.pri" /o | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$stageDir\resources.pri")) {
        throw "makepri new failed to produce resources.pri for $arch"
    }

    $msixFile = "$msixOutDir\ottline-$Version-$arch.msix"
    & $makeAppx pack /d $stageDir /p $msixFile /o
    if ($LASTEXITCODE -ne 0) { throw "makeappx pack failed for $arch" }

    Copy-Item $msixFile "$bundleInputDir\ottline-$Version-$arch.msix" -Force
}

Write-Host "=== [4/4] Creating Unified Multi-Arch MSIXBundle (x64 + arm64) ===" -ForegroundColor Cyan
$bundleFile = "$msixOutDir\ottline-$Version.msixbundle"
& $makeAppx bundle /bv $Version /d $bundleInputDir /p $bundleFile /o
if ($LASTEXITCODE -ne 0) { throw "makeappx bundle failed" }

Copy-Item $bundleFile "$storeUploadDir\ottline-$Version.msixbundle" -Force

Write-Host "`nMSIX & MSIXBundle Build Succeeded!" -ForegroundColor Green
Get-ChildItem $msixOutDir | Select-Object Name, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}}, FullName | Format-Table -AutoSize
