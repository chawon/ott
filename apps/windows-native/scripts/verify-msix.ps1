param(
    [string]$Version = "2.0.0.0"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$msixDir = "$repoRoot\output\msix"

$x64Msix = "$msixDir\ottline-$Version-x64.msix"
$arm64Msix = "$msixDir\ottline-$Version-arm64.msix"
$bundle = "$msixDir\ottline-$Version.msixbundle"

foreach ($file in @($x64Msix, $arm64Msix, $bundle)) {
    if (-not (Test-Path $file)) {
        throw "Expected package missing: $file"
    }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Assert-MsixPackage([string]$path, [string]$expectedArch) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    try {
        $manifestEntry = $zip.GetEntry("AppxManifest.xml")
        $blockMapEntry = $zip.GetEntry("AppxBlockMap.xml")
        $exeEntry = $zip.GetEntry("Ottline.App.exe")
        if (-not $manifestEntry) { throw "AppxManifest.xml missing in $path" }
        if (-not $blockMapEntry) { throw "AppxBlockMap.xml missing in $path" }
        if (-not $exeEntry) { throw "Ottline.App.exe missing in $path" }

        $sr = New-Object System.IO.StreamReader($manifestEntry.Open())
        $xmlText = $sr.ReadToEnd()
        $sr.Dispose()

        if ($xmlText -notmatch 'Name="ChawonLee\.ottline"') { throw "Identity Name mismatch in $path" }
        if ($xmlText -notmatch 'CN=A486532B-583B-4088-AFDE-FC4377E51968') { throw "Publisher mismatch in $path" }
        if ($xmlText -notmatch "Version=`"$Version`"") { throw "Version mismatch in $path" }
        if ($xmlText -notmatch "ProcessorArchitecture=`"$expectedArch`"") { throw "Architecture mismatch in $path" }
        if ($xmlText -notmatch 'EntryPoint="Windows\.FullTrustApplication"') { throw "EntryPoint mismatch in $path" }
        if ($xmlText -notmatch '<uap3:Protocol Name="ottline"[^>]*Parameters=') { throw "ottline:// uap3:Protocol Parameters missing in $path" }
        if ($xmlText -notmatch 'Name="com\.microsoft\.windows\.widgets"') { throw "Windows 11 Widget extension missing in $path" }
        if ($xmlText -notmatch 'Category="windows\.comServer"') { throw "Widget COM server registration missing in $path" }
        if ($xmlText -notmatch '-RegisterProcessAsComServer') { throw "Widget COM server launch argument missing in $path" }

        foreach ($requiredEntry in @(
            "resources.pri",
            "Microsoft.Windows.Widgets.dll",
            "Microsoft.Windows.Widgets.Projection.dll",
            "WidgetAssets/WidgetIcon.png",
            "WidgetAssets/WidgetScreenshot.png",
            "WidgetAssets/WidgetScreenshotDark.png",
            "Public/WidgetAssets/WidgetScreenshot.png",
            "Public/WidgetAssets/WidgetScreenshotDark.png"
        )) {
            if (-not $zip.GetEntry($requiredEntry)) {
                throw "Required widget asset/binary missing in ${path}: $requiredEntry"
            }
        }

        if ($zip.Entries | Where-Object { $_.FullName -like "*.pdb" }) {
            throw "Unexpected .pdb symbol file found in $path"
        }

        Write-Host "[OK] Verified MSIX ($expectedArch): $path" -ForegroundColor Green
    }
    finally {
        $zip.Dispose()
    }
}

Assert-MsixPackage $x64Msix "x64"
Assert-MsixPackage $arm64Msix "arm64"

$bundleZip = [System.IO.Compression.ZipFile]::OpenRead($bundle)
try {
    $bundleManifest = $bundleZip.GetEntry("AppxMetadata/AppxBundleManifest.xml")
    if (-not $bundleManifest) { throw "AppxBundleManifest.xml missing in $bundle" }
    $sr = New-Object System.IO.StreamReader($bundleManifest.Open())
    $bXml = $sr.ReadToEnd()
    $sr.Dispose()

    if ($bXml -notmatch 'Name="ChawonLee\.ottline"') { throw "Bundle Identity Name mismatch" }
    if ($bXml -notmatch 'Architecture="x64"') { throw "Bundle missing x64 package" }
    if ($bXml -notmatch 'Architecture="arm64"') { throw "Bundle missing arm64 package" }

    Write-Host "[OK] Verified Multi-Arch MSIXBundle (x64 + arm64): $bundle" -ForegroundColor Green
}
finally {
    $bundleZip.Dispose()
}

$storeUploadDir = "$repoRoot\output\store-upload"
if (Test-Path $storeUploadDir) {
    $uploadFiles = @(Get-ChildItem $storeUploadDir -File)
    if ($uploadFiles.Count -ne 1 -or $uploadFiles[0].Name -ne "ottline-$Version.msixbundle") {
        throw "output\store-upload must contain strictly 1 file named ottline-$Version.msixbundle (found: $(($uploadFiles | ForEach-Object { $_.Name }) -join ', '))"
    }
    Write-Host "[OK] Verified isolated Store upload payload: $($uploadFiles[0].FullName)" -ForegroundColor Green
}

Write-Host "`n=== Release Artifacts & SHA-256 Checksums ===" -ForegroundColor Cyan
$checksumRows = foreach ($file in @($x64Msix, $arm64Msix, $bundle)) {
    $item = Get-Item $file
    $hash = (Get-FileHash -Path $file -Algorithm SHA256).Hash
    [PSCustomObject]@{
        Name   = $item.Name
        SizeMB = [math]::Round($item.Length / 1MB, 2)
        SHA256 = $hash
    }
}
$checksumRows | Format-Table -AutoSize
