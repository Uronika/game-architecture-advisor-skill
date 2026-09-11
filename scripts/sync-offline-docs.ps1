[CmdletBinding()]
param(
    [ValidateSet('Unity', 'Tuanjie', 'All')]
    [string] $Engine = 'All',
    [ValidateSet('en', 'cn')]
    [string] $Language = 'cn',
    [switch] $Force,
    [string] $Proxy
)

$ErrorActionPreference = 'Stop'
$skillRoot = Split-Path -Parent $PSScriptRoot
$officialRoot = Join-Path $skillRoot 'knowledge\official'
New-Item -ItemType Directory -Path $officialRoot -Force | Out-Null
$metadataPath = Join-Path $officialRoot 'sources.json'
$existingSourceRecords = @{}
if (Test-Path -LiteralPath $metadataPath) {
    try {
        $existingSources = (Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json).sources
        foreach ($source in $existingSources) {
            $existingSourceRecords[$source.name] = $source
        }
    }
    catch {
        Write-Warning "Existing source metadata could not be read and will be replaced: $metadataPath"
    }
}

function Invoke-OfficialDownload {
    param(
        [Parameter(Mandatory)] [string] $Url,
        [Parameter(Mandatory)] [string] $OutputPath
    )

    if ($Proxy) {
        $previousProgressPreference = $ProgressPreference
        try {
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $Url -OutFile $OutputPath -Proxy $Proxy -MaximumRedirection 5
            return
        }
        finally {
            $ProgressPreference = $previousProgressPreference
        }
    }

    $curlArgs = @('--fail', '--location', '--silent', '--show-error', '--ssl-no-revoke')
    if ((Test-Path -LiteralPath $OutputPath) -and ((Get-Item -LiteralPath $OutputPath).Length -gt 0)) {
        $curlArgs += @('--continue-at', '-')
    }
    $curlArgs += @('--output', $OutputPath, $Url)
    for ($attempt = 1; $attempt -le 50; $attempt++) {
        $lengthBefore = if (Test-Path -LiteralPath $OutputPath) { (Get-Item -LiteralPath $OutputPath).Length } else { 0 }
        & curl.exe @curlArgs
        if ($LASTEXITCODE -eq 0) {
            return
        }
        $lengthAfter = if (Test-Path -LiteralPath $OutputPath) { (Get-Item -LiteralPath $OutputPath).Length } else { 0 }
        if ($lengthAfter -le $lengthBefore) {
            throw "Download failed ($LASTEXITCODE) without progress: $Url"
        }
        Write-Host "Partial transfer interrupted; resuming ($attempt/50, $lengthAfter bytes saved)..."
        $curlArgs = @('--fail', '--location', '--silent', '--show-error', '--ssl-no-revoke', '--continue-at', '-', '--output', $OutputPath, $Url)
    }
    throw "Download did not complete after 50 resumptions: $Url"
}

$targets = @()
if ($Engine -in @('Unity', 'All')) {
    $targets += [pscustomobject]@{
        Name = 'unity-2022.3'
        LandingPage = "https://docs.unity3d.com/$Language/2022.3/Manual/OfflineDocumentation.html"
    }
}
if ($Engine -in @('Tuanjie', 'All')) {
    $targets += [pscustomobject]@{
        Name = 'tuanjie-1.10'
        LandingPage = 'https://docs.unity.cn/cn/tuanjiemanual/Manual/OfflineDocumentation.html'
    }
}

$sourceRecords = @()
foreach ($target in $targets) {
    $destination = Join-Path $officialRoot $target.Name
    $archive = Join-Path $officialRoot "$($target.Name).offline.zip"
    $obsoletePartialArchive = Join-Path $officialRoot "$($target.Name).zip"
    $existingIndex = Get-ChildItem -LiteralPath $destination -Filter 'index.html' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingIndex -and -not $Force) {
        Write-Host "[$($target.Name)] already expanded at $destination"
        $prior = $existingSourceRecords[$target.Name]
        $sourceRecords += [pscustomobject]@{
            name = $target.Name
            landingPage = if ($prior) { $prior.landingPage } else { $target.LandingPage }
            archiveUrl = if ($prior) { $prior.archiveUrl } else { $null }
            retrievedAt = if ($prior) { $prior.retrievedAt } else { $null }
            status = 'existing'
        }
        continue
    }

    Write-Host "[$($target.Name)] locating official offline archive..."
    $landingCopy = New-TemporaryFile
    try {
        Invoke-OfficialDownload -Url $target.LandingPage -OutputPath $landingCopy.FullName
        $landingHtml = Get-Content -LiteralPath $landingCopy.FullName -Raw
    }
    finally {
        Remove-Item -LiteralPath $landingCopy.FullName -Force -ErrorAction SilentlyContinue
    }
    $downloadMatch = [regex]::Match($landingHtml, '(?:https?:)?[^"''<>\s]+(?:Unity|Tuanjie)Documentation\.zip')
    $downloadLink = if ($downloadMatch.Success) { $downloadMatch.Value } else { $null }
    if (-not $downloadLink) {
        throw "[$($target.Name)] The official offline-documentation page did not expose a documentation ZIP link. Open $($target.LandingPage) and update this script with the official URL."
    }

    $archiveUrl = [Uri]::new([Uri]$target.LandingPage, $downloadLink).AbsoluteUri
    Write-Host "[$($target.Name)] downloading $archiveUrl"
    Invoke-OfficialDownload -Url $archiveUrl -OutputPath $archive

    if (Test-Path -LiteralPath $destination) {
        Remove-Item -LiteralPath $destination -Recurse -Force
    }
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Write-Host "[$($target.Name)] expanding archive..."
    & tar.exe -xf $archive -C $destination
    if ($LASTEXITCODE -ne 0) {
        throw "[$($target.Name)] Archive expansion failed ($LASTEXITCODE): $archive"
    }
    Remove-Item -LiteralPath $archive -Force
    Remove-Item -LiteralPath $obsoletePartialArchive -Force -ErrorAction SilentlyContinue

    $sourceRecords += [pscustomobject]@{ name = $target.Name; landingPage = $target.LandingPage; archiveUrl = $archiveUrl; retrievedAt = (Get-Date).ToUniversalTime().ToString('o'); status = 'downloaded' }
}

@{ sources = $sourceRecords } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $metadataPath -Encoding utf8
Write-Host "Source metadata written to $metadataPath"
