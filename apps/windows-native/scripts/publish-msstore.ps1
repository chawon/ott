param(
    [string]$AppId = "9NSVNZGDMGF5",
    [string]$Version = "2.0.0.0",
    [ValidateSet("Draft", "Commit")]
    [string]$Mode = "Draft",
    [int]$RolloutPercentage = 100,
    [int]$UploadTimeoutSeconds = 600,
    [string]$PriceId = "",
    [string]$ReleaseNotesKo = "",
    [string]$ReleaseNotesEn = "",
    [string]$NotesForCertification = "",
    [switch]$ApplyDefaultNotes,
    [switch]$ApplyDefaultListing,
    [switch]$MetadataOnly,
    [string]$TitleKo = "",
    [string]$TitleEn = "",
    [string]$StoreListingDir = "",
    [switch]$SkipBuild,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$useDefaultListing = $ApplyDefaultListing.IsPresent -or $ApplyDefaultNotes.IsPresent

if ([string]::IsNullOrWhiteSpace($StoreListingDir)) {
    $StoreListingDir = Join-Path $repoRoot "packaging\StoreListing"
}

function Resolve-MsStoreExe {
    $cmd = Get-Command "msstore" -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path $cmd.Source)) {
        return $cmd.Source
    }

    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:PATH = "$userPath;$machinePath;$env:USERPROFILE\.dotnet\tools;$env:PATH"

    $cmd = Get-Command "msstore" -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path $cmd.Source)) {
        return $cmd.Source
    }

    $winAppsCandidate = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\MSStore.exe"
    if (Test-Path $winAppsCandidate) {
        return $winAppsCandidate
    }

    throw "msstore-cli (MSStore.exe) not found. Install it via: winget install Microsoft.MSStore.CLI"
}

function Invoke-MsStoreCapture {
    param(
        [string]$ExePath,
        [string[]]$Arguments
    )

    $prevPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $ExePath @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $prevPreference
    }

    return [pscustomobject]@{
        ExitCode = $code
        Output   = @($output | ForEach-Object { $_.ToString() })
        Text     = ((@($output | ForEach-Object { $_.ToString() }) -join "`n").Trim())
    }
}

function Try-GetPendingSubmission {
    param(
        [string]$ExePath,
        [string]$ProductId
    )

    $res = Invoke-MsStoreCapture -ExePath $ExePath -Arguments @("submission", "get", $ProductId, "--output-stream", "Stderr")
    if ($res.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($res.Text)) {
        return $null
    }

    $jsonStart = $res.Text.IndexOf('{')
    if ($jsonStart -lt 0) {
        return $null
    }

    $jsonText = $res.Text.Substring($jsonStart)
    try {
        return ($jsonText | ConvertFrom-Json)
    }
    catch {
        return $null
    }
}

function Set-JsonProp {
    param(
        [object]$Target,
        [string]$Name,
        [object]$Value
    )

    $Target | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
}

function Upload-ZipBlobInBlocks {
    param(
        [string]$ZipPath,
        [string]$SasUrl,
        [int]$TimeoutSeconds = 600
    )

    if ([string]::IsNullOrWhiteSpace($SasUrl)) {
        throw "Submission FileUploadUrl is empty; cannot upload package/image payload."
    }

    Add-Type -AssemblyName System.Net.Http
    $handler = New-Object System.Net.Http.HttpClientHandler
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)

    try {
        $fileInfo = Get-Item $ZipPath
        $totalBytes = $fileInfo.Length
        $chunkSize = 4 * 1024 * 1024
        $blockIds = New-Object System.Collections.Generic.List[string]
        $separator = if ($SasUrl.Contains("?")) { "&" } else { "?" }

        $fs = [System.IO.File]::OpenRead($ZipPath)
        try {
            $buffer = New-Object byte[] $chunkSize
            $blockIndex = 0
            $uploadedBytes = 0L

            while ($true) {
                $bytesRead = $fs.Read($buffer, 0, $chunkSize)
                if ($bytesRead -le 0) {
                    break
                }

                $chunkData = if ($bytesRead -eq $chunkSize) {
                    $buffer
                }
                else {
                    $slice = New-Object byte[] $bytesRead
                    [Array]::Copy($buffer, 0, $slice, 0, $bytesRead)
                    $slice
                }

                $blockIdRaw = $blockIndex.ToString("D6")
                $blockIdB64 = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($blockIdRaw))
                $blockIds.Add($blockIdB64)

                $blockUri = "${SasUrl}${separator}comp=block&blockid=$([Uri]::EscapeDataString($blockIdB64))"
                $attempt = 0
                $uploadedBlock = $false
                while (-not $uploadedBlock) {
                    $attempt++
                    $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Put, $blockUri)
                    $content = New-Object System.Net.Http.ByteArrayContent(,$chunkData)
                    $req.Content = $content
                    $req.Headers.Add("x-ms-version", "2020-04-08")
                    try {
                        $resp = $client.SendAsync($req).GetAwaiter().GetResult()
                        try {
                            if (-not $resp.IsSuccessStatusCode) {
                                $errBody = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                                throw "Block $blockIndex PUT failed ($($resp.StatusCode)): $errBody"
                            }
                            $uploadedBlock = $true
                        }
                        finally {
                            $resp.Dispose()
                        }
                    }
                    catch {
                        if ($attempt -ge 3) {
                            throw
                        }
                        Write-Host "Retrying block $blockIndex upload (attempt $($attempt + 1)/3)..." -ForegroundColor Yellow
                        Start-Sleep -Seconds (2 * $attempt)
                    }
                    finally {
                        $req.Dispose()
                    }
                }

                $uploadedBytes += $bytesRead
                $blockIndex++
                if ($blockIndex % 5 -eq 0 -or $uploadedBytes -eq $totalBytes) {
                    $pct = [math]::Round(($uploadedBytes * 100.0) / [math]::Max(1, $totalBytes), 1)
                    $mb = [math]::Round($uploadedBytes / 1MB, 1)
                    $totalMb = [math]::Round($totalBytes / 1MB, 1)
                    Write-Host "  Uploaded $mb / $totalMb MB ($pct%)" -ForegroundColor Gray
                }
            }
        }
        finally {
            $fs.Dispose()
        }

        $sb = New-Object System.Text.StringBuilder
        [void]$sb.Append('<?xml version="1.0" encoding="utf-8"?><BlockList>')
        foreach ($id in $blockIds) {
            [void]$sb.Append("<Latest>$id</Latest>")
        }
        [void]$sb.Append('</BlockList>')

        $commitUri = "${SasUrl}${separator}comp=blocklist"
        $commitReq = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Put, $commitUri)
        $commitReq.Headers.Add("x-ms-version", "2020-04-08")
        $commitReq.Content = New-Object System.Net.Http.StringContent($sb.ToString(), [System.Text.Encoding]::UTF8, "application/xml")
        try {
            $commitResp = $client.SendAsync($commitReq).GetAwaiter().GetResult()
            try {
                if (-not $commitResp.IsSuccessStatusCode) {
                    $errBody = $commitResp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                    throw "Blob blocklist commit failed ($($commitResp.StatusCode)): $errBody"
                }
            }
            finally {
                $commitResp.Dispose()
            }
        }
        finally {
            $commitReq.Dispose()
        }
    }
    finally {
        $client.Dispose()
    }
}

$msstoreExe = Resolve-MsStoreExe
Write-Host "Using MSStore CLI: $msstoreExe" -ForegroundColor Gray

$storeUploadDir = Join-Path $repoRoot "output\store-upload"
$msixBundleSrc = Join-Path $repoRoot "output\msix\ottline-$Version.msixbundle"
$bundlePath = Join-Path $storeUploadDir "ottline-$Version.msixbundle"

if (-not $MetadataOnly) {
    if (-not $SkipBuild) {
        $global:LASTEXITCODE = 0
        & "$PSScriptRoot\build-msix.ps1" -Version $Version
        if ($LASTEXITCODE -ne 0) { throw "build-msix.ps1 failed" }
        $global:LASTEXITCODE = 0
        & "$PSScriptRoot\verify-msix.ps1" -Version $Version
        if ($LASTEXITCODE -ne 0) { throw "verify-msix.ps1 failed" }
    }
    else {
        if (-not (Test-Path $msixBundleSrc)) {
            throw "Prebuilt MSIXBundle not found at $msixBundleSrc. Run build-msix.ps1 first or omit -SkipBuild."
        }

        if (Test-Path $storeUploadDir) {
            Remove-Item $storeUploadDir -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $storeUploadDir | Out-Null
        Copy-Item $msixBundleSrc $bundlePath -Force

        $global:LASTEXITCODE = 0
        & "$PSScriptRoot\verify-msix.ps1" -Version $Version
        if ($LASTEXITCODE -ne 0) { throw "verify-msix.ps1 failed" }
    }

    $uploadFiles = @(Get-ChildItem $storeUploadDir -File)
    if ($uploadFiles.Count -ne 1 -or -not (Test-Path $bundlePath)) {
        throw "Expected strictly one payload file ($bundlePath) in $storeUploadDir"
    }
}

$storeAssetSpecsKo = @(
    @{ FileName = "store-icon-300x300.png";          ImageType = "Icon";            Description = "" },
    @{ FileName = "store-logo-square-1080x1080.png"; ImageType = "StoreLogoSquare"; Description = "" },
    @{ FileName = "store-poster-ko-720x1080.png";    ImageType = "StoreLogo9x16";   Description = "" },
    @{ FileName = "screenshot-ko-1-home.png";        ImageType = "Screenshot";      Description = "홈 화면 — 그날의 온기와 이어보는 작품" },
    @{ FileName = "screenshot-ko-2-quicklog.png";    ImageType = "Screenshot";      Description = "빠른 기록 모달 — 날짜·플랫폼·장소·느낌·메모" },
    @{ FileName = "screenshot-ko-3-timeline.png";    ImageType = "Screenshot";      Description = "시간순 타임라인 및 5단 필터" },
    @{ FileName = "screenshot-ko-4-widget.png";      ImageType = "Screenshot";      Description = "Windows 11 공식 위젯(Win + W) 및 OTT 시청 종료 알림" }
)

$storeAssetSpecsEn = @(
    @{ FileName = "store-icon-300x300.png";          ImageType = "Icon";            Description = "" },
    @{ FileName = "store-logo-square-1080x1080.png"; ImageType = "StoreLogoSquare"; Description = "" },
    @{ FileName = "store-poster-en-720x1080.png";    ImageType = "StoreLogo9x16";   Description = "" },
    @{ FileName = "screenshot-en-1-home.png";        ImageType = "Screenshot";      Description = "Home — Featured warmth memory and ongoing titles" },
    @{ FileName = "screenshot-en-2-quicklog.png";    ImageType = "Screenshot";      Description = "Quick Record modal — Date, platform, place, feeling, and note" },
    @{ FileName = "screenshot-en-3-timeline.png";    ImageType = "Screenshot";      Description = "Chronological timeline with moment filters" },
    @{ FileName = "screenshot-en-4-widget.png";      ImageType = "Screenshot";      Description = "Official Windows 11 Widget (Win + W) and OTT watch reminders" }
)

$allStoreAssetFiles = @($storeAssetSpecsKo + $storeAssetSpecsEn | ForEach-Object { $_.FileName } | Select-Object -Unique)
$hasStoreAssetsDir = Test-Path $StoreListingDir
$includeStoreImages = $false
if (-not $MetadataOnly -and $hasStoreAssetsDir) {
    $missingAssets = @($allStoreAssetFiles | Where-Object { -not (Test-Path (Join-Path $StoreListingDir $_)) })
    if ($missingAssets.Count -gt 0) {
        throw "Missing Store listing PNG asset(s) in ${StoreListingDir}: $($missingAssets -join ', ')"
    }
    $includeStoreImages = $true
}

Write-Host "`n=== Checking Partner Center Credentials (`msstore info`) ===" -ForegroundColor Cyan
& $msstoreExe info
if ($LASTEXITCODE -ne 0) {
    throw "msstore credentials check failed. Run 'msstore reconfigure' first."
}

$desiredTitleKo = if (-not [string]::IsNullOrWhiteSpace($TitleKo)) { $TitleKo } else { "ottline - 영화·드라마·책·독서 기록" }
$desiredTitleEn = if (-not [string]::IsNullOrWhiteSpace($TitleEn)) { $TitleEn } else { "ottline: Movie, TV & Book Log" }

$shortDescKo = "영화·드라마·OTT 시청 기록과 독서 노트를 한곳에, 가입 없이 타임라인과 Windows 11 위젯으로 남기는 감상 기록장"
$shortDescEn = "Track movies, TV series, and books in a calm local-first timeline with an official Windows 11 widget."

$descriptionKo = @"
ottline은 영화, 시리즈(드라마), 책을 조용히 기록하고 나만의 타임라인으로 모아보는 순수 Windows 데스크톱 감상 수첩입니다.

작품을 검색해 상태(봤어요·보는 중·보고 싶어요 / 읽었어요·읽는 중·읽고 싶어요)를 고르고, 날짜·감상 느낌·메모·플랫폼·장소·함께한 상황을 가볍게 남기면 시간순 타임라인에 차곡차곡 쌓입니다. 로그인이나 회원가입 없이 설치 즉시 시작할 수 있고, 오프라인에서도 로컬 SQLite DB에 먼저 안전하게 저장됩니다.

[Windows 11 · 데스크톱 전용 기능]
• Windows 11 공식 위젯 (Win + W): 소형·중형·대형 위젯으로 이어보는 작품과 이번 달 기록을 바탕화면 위젯 보드에서 바로 확인하고, 원클릭으로 빠른 기록을 열 수 있어요.
• OTT 시청 종료 알림 & 전역 단축키 (Ctrl + Shift + O): Netflix, TVING, Wavve, Disney+, Apple TV 등 감상을 마친 뒤 잔잔한 알림으로 기억을 바로 남길 수 있어요.
• 커스텀 시스템 트레이 플라이아웃: 창을 닫아도 트레이에서 가볍게 대기하며, 트레이 팝업으로 현재 시청 상태 확인과 빠른 기록을 이어갈 수 있어요.
• 고해상도 공유 카드 PNG & CSV 백업: Story(9:16)·Feed(4:5) 감상 카드 및 리캡 카드를 고해상도 PNG로 저장하고, 타임라인 CSV 내보내기와 넷플릭스 시청 기록 가져오기를 지원해요.
• 내 서가 (KDC 000~900) & 함께: 도서 기록을 KDC 주제별 서가로 모아보고, 다른 사람들의 감상 기록에 반응과 댓글로 이야기를 나눌 수 있어요.
• 기존 앱·웹 기록 자동 이어받기: 기존 Microsoft Store PWA(Edge)에서 업데이트하면 첫 실행 시 자동 핸드오프로 기존 기록과 연결 코드를 안전하게 가져오며, 8자리 연결 코드로 iOS·Android·웹과도 이어집니다.
"@.Trim()

$descriptionEn = @"
ottline is a calm, local-first Windows desktop recordbook for keeping movies, TV series, and books on a personal timeline.

Search any film, series, or book, choose a status (Watched/Watching/Want to watch or Read/Reading/Want to read), and save the date, feeling, short note, platform, place, and occasion. No sign-up is required to start—every entry is saved offline first to your local SQLite timeline and can be synced across devices anytime with an 8-character connection code.

[Built for Windows 11 & Desktop]
• Official Windows 11 Widget (Win + W): Pin Small, Medium, or Large widgets to keep your current watch or read and monthly count on the Widgets Board, and launch Quick Record directly from the widget.
• OTT Watch-End Reminders & Global Shortcut (Ctrl + Shift + O): Receive a gentle reminder after closing streaming apps (Netflix, TVING, Wavve, Disney+, Apple TV) so you never lose a thought right after credits roll.
• Custom System Tray Flyout: Minimize cleanly to the system tray and click the tray icon for quick status, sync, and logging controls.
• Editorial Share Cards & CSV Backup: Export high-resolution Story (9:16) and Feed (4:5) PNG cards, export your full timeline as CSV, or import your Netflix viewing history.
• KDC Bookshelf (000–900) & Together: Browse books arranged by subject shelf and join quiet discussions around titles you care about.
• Seamless Store PWA Migration: Existing Microsoft Store Edge PWA users automatically carry over their timeline, profile, and connection code on first launch, with cross-device sync across Windows, iOS, Android, and Web.
"@.Trim()

$featuresKo = @(
    "회원가입·로그인 없이 바로 시작하는 로컬 우선 영화·시리즈·책 타임라인",
    "Windows 11 공식 위젯(Win + W) 소형·중형·대형 지원",
    "OTT 시청 종료 알림 및 전역 단축키(Ctrl+Shift+O)로 빠른 감상 기록",
    "날짜, 플랫폼, 장소, 함께한 상황, 3단계 느낌 및 메모 기록",
    "고해상도 Story·Feed 감상 카드 PNG 저장 및 리캡 리포트",
    "KDC 000~900 내 서가 분류 및 타임라인 CSV 내보내기·넷플릭스 기록 가져오기",
    "기존 Store PWA 자동 이어받기 및 8자리 연결 코드 멀티 디바이스 동기화"
)

$featuresEn = @(
    "Instant local-first timeline for movies, TV series, and books with no sign-up",
    "Official Windows 11 Widget (Win + W) in Small, Medium, and Large sizes",
    "OTT watch-end reminders and global Quick Record shortcut (Ctrl+Shift+O)",
    "Record watch date, platform, place, occasion, feeling, and notes",
    "Export crisp high-resolution Story and Feed PNG share cards",
    "KDC 000–900 bookshelf shelves, CSV export, and Netflix history import",
    "Automatic Store PWA migration and 8-character connection code sync"
)

$keywordsKo = @("영화 기록", "드라마 기록", "독서 기록", "시청 기록", "책 기록", "타임라인", "감상 수첩")
$keywordsEn = @("movie log", "book tracker", "tv tracker", "reading log", "watch diary", "timeline", "media journal")
$copyrightText = "© 2026 Chawon Lee. All rights reserved."

if ($ApplyDefaultNotes -or $ApplyDefaultListing) {
    if ([string]::IsNullOrWhiteSpace($ReleaseNotesKo)) {
        $ReleaseNotesKo = @"
ottline이 순수 Windows 네이티브 앱(v$Version)으로 새롭게 태어났어요.

• Windows 11 공식 위젯 (Win + W) 지원: 소형·중형·대형 3가지 크기로 이어보는 작품과 이번 달 기록을 확인하고, 위젯에서 바로 빠른 기록을 열 수 있어요.
• 더욱 가벼워진 순수 네이티브 속도: 웹뷰 없이 바로 열리고, 오프라인에서도 로컬에 먼저 안전하게 기록을 보관해요.
• 커스텀 시스템 트레이 플라이아웃: 트레이 아이콘 클릭 시 에디토리얼 톤의 전용 팝업에서 현재 시청 상태, 빠른 기록, 동기화를 한 번에 다룰 수 있어요.
• OTT 시청 종료 알림 & 전역 단축키(Ctrl+Shift+O): Netflix, TVING, Wavve 등 시청 후 바로 기억을 남길 수 있어요.
• 공유 카드 & 도서/영상 검색 강화: 영화·시리즈는 물론 국내 도서 표지까지 선명한 고해상도 공유 카드 PNG로 저장할 수 있어요.
• 기존 PWA/웹 사용자 원클릭 이어받기: 기존 스토어 앱(Edge) 업데이트 시 자동 핸드오프(?native_handoff=1)를 지원하며, 홈/내 공간의 버튼이나 8자리 연결 코드로도 기존 기록을 합칠 수 있어요.
"@.Trim()
    }

    if ([string]::IsNullOrWhiteSpace($ReleaseNotesEn)) {
        $ReleaseNotesEn = @"
ottline $Version arrives as a brand-new, pure Windows native desktop app.

• Official Windows 11 Widget (Win + W): Pin ottline in Small, Medium, or Large size to keep your current watch/read and monthly count right on your Widgets Board.
• Fast Local-First Native Experience: Launches cleanly with zero WebView overhead and stores your timeline offline first in SQLite.
• Custom System Tray Flyout: Left- or right-click the tray icon for quick logging, watch status, sync, and exit controls.
• Watch Reminders & Global Shortcut (Ctrl+Shift+O): Get a gentle nudge after watching OTT titles to save the memory before it fades.
• High-Resolution Share Cards: Export editorial Story and Feed PNG cards with crisp movie, series, and book covers.
• Seamless Migration: One-click Store PWA (Edge) / browser session handoff (?native_handoff=1) automatically brings over your existing timeline and profile, alongside 8-character connection code pairing.
"@.Trim()
    }

    if ([string]::IsNullOrWhiteSpace($NotesForCertification)) {
        $NotesForCertification = @"
Testing & Certification Notes for ottline $Version (Native Desktop + Windows 11 Widget):

1. No Login Required (Local-First Instant Access):
   - Launch the app directly after installation. No sign-in or password is required to test any feature.
   - Click "+ 기록하기" (or "+ Quick Record" after switching language to EN in the header) to search movies, series, or books and save logs immediately to the local SQLite timeline.
   - Existing Store PWA (Edge) or web/Android users can migrate via one-click browser handoff or an 8-character connection code in "내 공간 (My Space)".

2. Windows 11 Official Widget (Win + W):
   - On Windows 11, press Win + W, click "+" in the top-right corner of the Widgets Board, and select "ottline" (small, medium, and large sizes are supported).
   - Clicking "+ Quick Record", "Video", "Book", "Timeline", or the featured item activates ottline via ottline:// protocol or Named Pipe IPC to the running window.

3. Optional Desktop Watch Reminder & Tray Behavior:
   - Clicking the window close button (X) minimizes the app to the system tray by default (configurable in My Space > Watch reminder settings).
   - Left-click or right-click the system tray icon to open the custom quick popup or completely exit the app.
   - Use "Test watch reminder" inside My Space > Watch reminder settings to preview the desktop reminder notification immediately without waiting 5 minutes.
"@.Trim()
    }
}

$hasMetadataUpdates = $useDefaultListing -or
                      (-not [string]::IsNullOrWhiteSpace($ReleaseNotesKo)) -or
                      (-not [string]::IsNullOrWhiteSpace($ReleaseNotesEn)) -or
                      (-not [string]::IsNullOrWhiteSpace($NotesForCertification)) -or
                      (-not [string]::IsNullOrWhiteSpace($TitleKo)) -or
                      (-not [string]::IsNullOrWhiteSpace($TitleEn)) -or
                      $includeStoreImages

if ($DryRun) {
    $cliVer = (& $msstoreExe --version)
    Write-Host "`n=== DRY RUN: No changes will be sent to Partner Center ===" -ForegroundColor Yellow
    Write-Host "MSStore CLI Version : $cliVer"
    Write-Host "ProductId (AppId)   : $AppId"
    Write-Host "Mode                : $Mode"
    Write-Host "MetadataOnly        : $MetadataOnly"
    Write-Host "UseDefaultListing   : $useDefaultListing"
    Write-Host "IncludeStoreImages  : $includeStoreImages ($StoreListingDir)"
    Write-Host "Desired Title (KO)  : $desiredTitleKo"
    Write-Host "Desired Title (EN)  : $desiredTitleEn"
    if (-not $MetadataOnly) {
        $bundleHash = (Get-FileHash -Path $bundlePath -Algorithm SHA256).Hash
        $bundleSizeMb = [math]::Round((Get-Item $bundlePath).Length / 1MB, 2)
        Write-Host "Bundle Path         : $bundlePath ($bundleSizeMb MB)"
        Write-Host "Bundle SHA-256      : $bundleHash"
    }
    exit 0
}

Write-Host "`n=== Ensuring Pending Partner Center Draft Submission ===" -ForegroundColor Cyan
$draft = Try-GetPendingSubmission -ExePath $msstoreExe -ProductId $AppId
if ($null -eq $draft) {
    if ($MetadataOnly) {
        throw "No pending Partner Center submission found for $AppId. Run without -MetadataOnly first to create a Draft submission."
    }

    Write-Host "No active pending submission found. Creating Draft via msstore publish (--noCommit)..." -ForegroundColor Yellow
    $publishArgs = @(
        "publish",
        $bundlePath,
        "--appId", $AppId,
        "--uploadTimeout", "$UploadTimeoutSeconds",
        "--noCommit",
        "--output-stream", "Stderr"
    )
    if (-not [string]::IsNullOrWhiteSpace($PriceId)) {
        $publishArgs += @("--priceId", $PriceId)
    }

    $pubRes = Invoke-MsStoreCapture -ExePath $msstoreExe -Arguments $publishArgs
    if ($pubRes.ExitCode -ne 0 -and [string]::IsNullOrWhiteSpace($PriceId)) {
        Write-Host "Retrying msstore publish with '--priceId Free' for advanced pricing model compatibility..." -ForegroundColor Yellow
        $pubRes = Invoke-MsStoreCapture -ExePath $msstoreExe -Arguments ($publishArgs + @("--priceId", "Free"))
    }
    if ($pubRes.ExitCode -ne 0) {
        throw "msstore publish failed with exit code $($pubRes.ExitCode): $($pubRes.Text)"
    }

    $draft = Try-GetPendingSubmission -ExePath $msstoreExe -ProductId $AppId
    if ($null -eq $draft) {
        throw "Created submission but could not retrieve it via 'msstore submission get $AppId'."
    }
}
else {
    Write-Host "Reusing existing pending submission: $($draft.Id) (Status=$($draft.Status))" -ForegroundColor Gray
}

function Apply-SubmissionMutations {
    param(
        [object]$DraftObj,
        [string]$ApplyTitleKo,
        [string]$ApplyTitleEn
    )

    if (-not $MetadataOnly) {
        $updatedPackages = New-Object System.Collections.Generic.List[object]
        $hasTargetBundle = $false
        $targetBundleName = "ottline-$Version.msixbundle"

        if ($DraftObj.ApplicationPackages) {
            foreach ($pkg in @($DraftObj.ApplicationPackages)) {
                if ($pkg.FileName -eq $targetBundleName) {
                    Set-JsonProp $pkg "FileStatus" "PendingUpload"
                    $hasTargetBundle = $true
                    $updatedPackages.Add($pkg)
                }
                else {
                    if ($pkg.FileStatus -eq "Uploaded") {
                        Set-JsonProp $pkg "FileStatus" "PendingDelete"
                    }
                    if ($null -ne $pkg.Id -or $pkg.FileStatus -eq "PendingDelete") {
                        $updatedPackages.Add($pkg)
                    }
                }
            }
        }

        if (-not $hasTargetBundle) {
            $updatedPackages.Add([pscustomobject]@{
                FileName              = $targetBundleName
                FileStatus            = "PendingUpload"
                MinimumDirectXVersion = "None"
                MinimumSystemRam      = "None"
            })
        }

        Set-JsonProp $DraftObj "ApplicationPackages" ([object[]]$updatedPackages.ToArray())
    }

    Set-JsonProp $DraftObj "AllowMicrosoftDecideAppAvailabilityToFutureDeviceFamilies" $false
    if ($DraftObj.AllowTargetFutureDeviceFamilies) {
        foreach ($prop in @($DraftObj.AllowTargetFutureDeviceFamilies.PSObject.Properties)) {
            Set-JsonProp $DraftObj.AllowTargetFutureDeviceFamilies $prop.Name ($prop.Name -eq "Desktop")
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($NotesForCertification)) {
        Set-JsonProp $DraftObj "NotesForCertification" $NotesForCertification
    }

    if ($Mode -eq "Commit" -and $RolloutPercentage -gt 0 -and $RolloutPercentage -lt 100) {
        if ($DraftObj.PackageDeliveryOptions -and $DraftObj.PackageDeliveryOptions.PackageRollout) {
            Set-JsonProp $DraftObj.PackageDeliveryOptions.PackageRollout "IsPackageRollout" $true
            Set-JsonProp $DraftObj.PackageDeliveryOptions.PackageRollout "PackageRolloutPercentage" $RolloutPercentage
        }
    }

    if ($DraftObj.Listings) {
        foreach ($localeKey in @("ko", "en")) {
            if (-not $DraftObj.Listings.PSObject.Properties[$localeKey]) {
                continue
            }

            $baseListing = $DraftObj.Listings.$localeKey.BaseListing
            if ($null -eq $baseListing) {
                continue
            }

            $isEn = $localeKey -eq "en"
            $applyTitle = if ($isEn) { $ApplyTitleEn } else { $ApplyTitleKo }

            if (-not [string]::IsNullOrWhiteSpace($applyTitle)) {
                Set-JsonProp $baseListing "Title" $applyTitle
            }

            if ($useDefaultListing) {
                Set-JsonProp $baseListing "ShortTitle" "ottline"
                Set-JsonProp $baseListing "VoiceTitle" "ottline"
                Set-JsonProp $baseListing "ShortDescription" $(if ($isEn) { $shortDescEn } else { $shortDescKo })
                Set-JsonProp $baseListing "Description" $(if ($isEn) { $descriptionEn } else { $descriptionKo })
                Set-JsonProp $baseListing "Features" ([string[]]$(if ($isEn) { $featuresEn } else { $featuresKo }))
                Set-JsonProp $baseListing "Keywords" ([string[]]$(if ($isEn) { $keywordsEn } else { $keywordsKo }))
                Set-JsonProp $baseListing "CopyrightAndTrademarkInfo" $copyrightText
            }

            $rn = if ($isEn) { $ReleaseNotesEn } else { $ReleaseNotesKo }
            if (-not [string]::IsNullOrWhiteSpace($rn)) {
                Set-JsonProp $baseListing "ReleaseNotes" $rn
            }

            if ($includeStoreImages) {
                $updatedImages = New-Object System.Collections.Generic.List[object]
                if ($baseListing.Images) {
                    foreach ($img in @($baseListing.Images)) {
                        if ($null -ne $img.Id -and $img.FileStatus -ne "PendingUpload") {
                            Set-JsonProp $img "FileStatus" "PendingDelete"
                            $updatedImages.Add($img)
                        }
                    }
                }

                $specs = if ($isEn) { $storeAssetSpecsEn } else { $storeAssetSpecsKo }
                foreach ($spec in $specs) {
                    $entry = [ordered]@{
                        FileName   = $spec.FileName
                        FileStatus = "PendingUpload"
                        ImageType  = $spec.ImageType
                    }
                    if (-not [string]::IsNullOrWhiteSpace($spec.Description)) {
                        $entry["Description"] = $spec.Description
                    }
                    $updatedImages.Add([pscustomobject]$entry)
                }

                Set-JsonProp $baseListing "Images" ([object[]]$updatedImages.ToArray())
            }
        }
    }
}

$titleFallbackUsed = $false
$verifiedDraft = $draft

if ($hasMetadataUpdates -or (-not $MetadataOnly)) {
    Write-Host "`n=== Updating Partner Center Submission Metadata & Image/Package Manifest ===" -ForegroundColor Cyan
    $tempJson = Join-Path ([System.IO.Path]::GetTempPath()) "ottline-msstore-submission.json"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    try {
        Apply-SubmissionMutations -DraftObj $draft -ApplyTitleKo $desiredTitleKo -ApplyTitleEn $desiredTitleEn
        $updatedJson = $draft | ConvertTo-Json -Depth 32
        [System.IO.File]::WriteAllText($tempJson, $updatedJson, $utf8NoBom)

        $updateRes = Invoke-MsStoreCapture -ExePath $msstoreExe -Arguments @("submission", "update", $AppId, "--payload", $tempJson, "--output-stream", "Stderr")
        $verifiedDraft = Try-GetPendingSubmission -ExePath $msstoreExe -ProductId $AppId
        $submissionErrors = if ($verifiedDraft -and $verifiedDraft.StatusDetails -and $verifiedDraft.StatusDetails.Errors) {
            @($verifiedDraft.StatusDetails.Errors)
        }
        else {
            @()
        }

        if ($updateRes.ExitCode -ne 0 -or $submissionErrors.Count -gt 0) {
            $errDetailText = if ($submissionErrors.Count -gt 0) {
                ($submissionErrors | ConvertTo-Json -Compress)
            }
            else {
                $updateRes.Text
            }
            Write-Host "[!] Submission update with subtitle in Title returned error:" -ForegroundColor Yellow
            Write-Host "    $errDetailText" -ForegroundColor DarkYellow
            Write-Host "    Falling back BaseListing.Title to reserved name 'ottline' (keeping ShortDescription subtitle & all v2 assets)..." -ForegroundColor Yellow

            $freshDraft = Try-GetPendingSubmission -ExePath $msstoreExe -ProductId $AppId
            if ($null -eq $freshDraft) {
                throw "Failed to re-fetch pending submission after validation error."
            }

            Apply-SubmissionMutations -DraftObj $freshDraft -ApplyTitleKo "ottline" -ApplyTitleEn "ottline"
            $fallbackJson = $freshDraft | ConvertTo-Json -Depth 32
            [System.IO.File]::WriteAllText($tempJson, $fallbackJson, $utf8NoBom)

            $retryRes = Invoke-MsStoreCapture -ExePath $msstoreExe -Arguments @("submission", "update", $AppId, "--payload", $tempJson, "--output-stream", "Stderr")
            $verifiedDraft = Try-GetPendingSubmission -ExePath $msstoreExe -ProductId $AppId
            $retryErrors = if ($verifiedDraft -and $verifiedDraft.StatusDetails -and $verifiedDraft.StatusDetails.Errors) {
                @($verifiedDraft.StatusDetails.Errors)
            }
            else {
                @()
            }

            if ($retryRes.ExitCode -ne 0 -or $retryErrors.Count -gt 0) {
                $retryErrText = if ($retryErrors.Count -gt 0) { ($retryErrors | ConvertTo-Json -Compress) } else { $retryRes.Text }
                throw "msstore submission update failed even after Title fallback: $retryErrText"
            }

            $titleFallbackUsed = $true
        }
    }
    finally {
        if (Test-Path $tempJson) {
            Remove-Item $tempJson -Force -ErrorAction SilentlyContinue
        }
    }
}

if (-not $MetadataOnly) {
    Write-Host "`n=== Building Unified Store Upload ZIP (MSIXBundle + 12 Store PNGs) ===" -ForegroundColor Cyan
    if ($null -eq $verifiedDraft -or [string]::IsNullOrWhiteSpace($verifiedDraft.FileUploadUrl)) {
        $verifiedDraft = Try-GetPendingSubmission -ExePath $msstoreExe -ProductId $AppId
    }
    if ($null -eq $verifiedDraft -or [string]::IsNullOrWhiteSpace($verifiedDraft.FileUploadUrl)) {
        throw "FileUploadUrl missing on pending submission $AppId."
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $tempZip = Join-Path ([System.IO.Path]::GetTempPath()) "ottline-msstore-upload-$Version.zip"
    if (Test-Path $tempZip) {
        Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
    }

    try {
        $archive = [System.IO.Compression.ZipFile]::Open($tempZip, [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            $bundleEntryName = "ottline-$Version.msixbundle"
            Write-Host "  Adding package : $bundleEntryName" -ForegroundColor Gray
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $bundlePath,
                $bundleEntryName,
                [System.IO.Compression.CompressionLevel]::NoCompression
            ) | Out-Null

            if ($includeStoreImages) {
                foreach ($assetFileName in $allStoreAssetFiles) {
                    $assetFullPath = Join-Path $StoreListingDir $assetFileName
                    Write-Host "  Adding image   : $assetFileName" -ForegroundColor Gray
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                        $archive,
                        $assetFullPath,
                        $assetFileName,
                        [System.IO.Compression.CompressionLevel]::NoCompression
                    ) | Out-Null
                }
            }
        }
        finally {
            $archive.Dispose()
        }

        $zipSizeMb = [math]::Round((Get-Item $tempZip).Length / 1MB, 2)
        Write-Host "`n=== Uploading Unified ZIP ($zipSizeMb MB) to Partner Center FileUploadUrl ===" -ForegroundColor Cyan
        Upload-ZipBlobInBlocks -ZipPath $tempZip -SasUrl $verifiedDraft.FileUploadUrl -TimeoutSeconds $UploadTimeoutSeconds
        Write-Host "[OK] Unified payload uploaded successfully." -ForegroundColor Green
    }
    finally {
        if (Test-Path $tempZip) {
            Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($Mode -eq "Commit") {
    Write-Host "`n=== Committing Submission for Store Certification ===" -ForegroundColor Cyan
    $pubCommitRes = Invoke-MsStoreCapture -ExePath $msstoreExe -Arguments @("submission", "publish", $AppId, "--output-stream", "Stderr")
    if ($pubCommitRes.ExitCode -ne 0) {
        throw "msstore submission publish failed with exit code $($pubCommitRes.ExitCode): $($pubCommitRes.Text)"
    }

    for ($i = 1; $i -le 18; $i++) {
        Start-Sleep -Seconds 10
        $postCommitDraft = Try-GetPendingSubmission -ExePath $msstoreExe -ProductId $AppId
        if ($null -eq $postCommitDraft) {
            break
        }
        Write-Host "  Commit status: $($postCommitDraft.Status)" -ForegroundColor Gray
        if ($postCommitDraft.Status -match "Failed") {
            $errJson = if ($postCommitDraft.StatusDetails -and $postCommitDraft.StatusDetails.Errors) {
                $postCommitDraft.StatusDetails.Errors | ConvertTo-Json -Compress
            }
            else {
                ""
            }
            throw "Partner Center commit failed ($($postCommitDraft.Status)): $errJson"
        }
        if ($postCommitDraft.Status -ne "CommitStarted") {
            Write-Host "[OK] Submission entered $($postCommitDraft.Status) with 0 errors!" -ForegroundColor Green
            break
        }
    }
}

if ($titleFallbackUsed) {
    Write-Host "`n[!] Partner Center Notice: To display a subtitle directly inside BaseListing.Title," -ForegroundColor Yellow
    Write-Host "    first reserve these app names in Partner Center > App management > Manage app names:" -ForegroundColor Yellow
    Write-Host "      - KO: $desiredTitleKo" -ForegroundColor Cyan
    Write-Host "      - EN: $desiredTitleEn" -ForegroundColor Cyan
    Write-Host "    Then apply immediately without re-uploading the bundle via:" -ForegroundColor Yellow
    Write-Host "      .\scripts\publish-msstore.ps1 -MetadataOnly -ApplyDefaultNotes -Mode Draft" -ForegroundColor Cyan
}

Write-Host "`n[OK] Microsoft Store submission workflow completed (Mode=$Mode, AppId=$AppId)." -ForegroundColor Green
