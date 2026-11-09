param(
    [string]$AabPath = "$PSScriptRoot\..\app\build\outputs\bundle\release\app-release.aab",
    [switch]$RequireSigned
)

$ErrorActionPreference = "Stop"

$ResolvedAab = Resolve-Path $AabPath -ErrorAction Stop
Write-Host "=== ottline Native Release AAB Verification ===" -ForegroundColor Cyan
Write-Host "AAB Path : $ResolvedAab"

$FileInfo = Get-Item $ResolvedAab
$Sha256 = (Get-FileHash -Path $ResolvedAab -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "Size     : $($FileInfo.Length) bytes"
Write-Host "SHA-256  : $Sha256"

$SdkRoot = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$Dexdump = Get-ChildItem "$SdkRoot\build-tools" -Recurse -Filter "dexdump.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $Dexdump) {
    throw "dexdump.exe not found under $SdkRoot\build-tools"
}

$TempDir = Join-Path $env:TEMP ("ottline-aab-verify-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $TempDir | Out-Null

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Zip = [System.IO.Compression.ZipFile]::OpenRead($ResolvedAab)
    try {
        $DexEntries = $Zip.Entries | Where-Object { $_.FullName -like "base/dex/classes*.dex" }
        if (-not $DexEntries) {
            throw "No base/dex/classes*.dex found in AAB"
        }

        $AllDexText = New-Object System.Text.StringBuilder
        foreach ($Entry in $DexEntries) {
            $OutDex = Join-Path $TempDir $Entry.Name
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($Entry, $OutDex, $true)
            $DumpLines = & $Dexdump $OutDex
            [void]$AllDexText.AppendLine(($DumpLines -join "`n"))
        }
        $DexDumpContent = $AllDexText.ToString()

        $RequiredClasses = @(
            "Landroidx/work/impl/WorkDatabase_Impl;",
            "Lapp/ottline/data/local/OttlineDatabase_Impl;",
            "Lapp/ottline/LauncherActivity;",
            "Lapp/ottline/WatchReminderSettingsActivity;",
            "Lapp/ottline/QuickLogWidgetProvider;",
            "Lapp/ottline/ReminderBootReceiver;",
            "Lapp/ottline/WatchReminderWorker;",
            "Lapp/ottline/RevisitReminderWorker;",
            "Lapp/ottline/data/SyncWorker;"
        )

        foreach ($Cls in $RequiredClasses) {
            $Escaped = [Regex]::Escape($Cls)
            if ($DexDumpContent -notmatch "Class descriptor\s*:\s*'$Escaped'") {
                throw "Missing required class in release DEX: $Cls"
            }
            Write-Host "[OK] DEX class present: $Cls" -ForegroundColor Green
        }
    } finally {
        $Zip.Dispose()
    }
} finally {
    if (Test-Path $TempDir) {
        Remove-Item -Recurse -Force $TempDir
    }
}

$SeedsFile = Join-Path $PSScriptRoot "..\app\build\outputs\mapping\release\seeds.txt"
if (Test-Path $SeedsFile) {
    $SeedsContent = Get-Content $SeedsFile -Raw
    $RequiredSeeds = @(
        "androidx.work.impl.WorkDatabase_Impl: WorkDatabase_Impl()",
        "app.ottline.data.local.OttlineDatabase_Impl: OttlineDatabase_Impl()",
        "app.ottline.WatchReminderWorker: WatchReminderWorker(android.content.Context,androidx.work.WorkerParameters)",
        "app.ottline.RevisitReminderWorker: RevisitReminderWorker(android.content.Context,androidx.work.WorkerParameters)",
        "app.ottline.data.SyncWorker: SyncWorker(android.content.Context,androidx.work.WorkerParameters)"
    )
    foreach ($Seed in $RequiredSeeds) {
        if (-not $SeedsContent.Contains($Seed)) {
            throw "Missing R8 constructor seed in seeds.txt: $Seed"
        }
        Write-Host "[OK] R8 constructor seed verified: $Seed" -ForegroundColor Green
    }
}

$JarSigner = Get-Command "jarsigner" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if ($JarSigner) {
    $VerifyOut = & $JarSigner -verify $ResolvedAab 2>&1 | Out-String
    if ($VerifyOut -match "jar verified") {
        Write-Host "[OK] AAB signature verified (jarsigner)." -ForegroundColor Green
    } elseif ($RequireSigned) {
        throw "AAB is unsigned! Place keystore.properties and android.keystore in project root before building for Play Console."
    } else {
        Write-Host "[INFO] AAB is currently unsigned (no keystore.properties in project root). Ready for CI signing or local keystore." -ForegroundColor Yellow
    }
}

Write-Host "=== Release AAB Verification PASSED ===" -ForegroundColor Cyan
