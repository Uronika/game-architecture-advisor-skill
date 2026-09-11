[CmdletBinding()]
param(
    [string] $Repository = 'https://github.com/munificent/game-programming-patterns',
    [switch] $Refresh
)

$ErrorActionPreference = 'Stop'
$skillRoot = Split-Path -Parent $PSScriptRoot
$knowledgeRoot = Join-Path $skillRoot 'knowledge'
$destination = Join-Path $knowledgeRoot 'game-programming-patterns'

New-Item -ItemType Directory -Path $knowledgeRoot -Force | Out-Null
if (Test-Path -LiteralPath (Join-Path $destination '.git')) {
    if ($Refresh) {
        git -C $destination pull --ff-only
        if ($LASTEXITCODE -ne 0) { throw 'Game Programming Patterns update failed.' }
    }
    else {
        Write-Host "Game Programming Patterns already exists at $destination"
    }
    exit 0
}

if (Test-Path -LiteralPath $destination) {
    $contents = Get-ChildItem -LiteralPath $destination -Force | Select-Object -First 1
    if ($contents) {
        throw "Destination exists and is not a Git checkout: $destination"
    }
}

git clone --depth 1 $Repository $destination
if ($LASTEXITCODE -ne 0) { throw 'Game Programming Patterns clone failed.' }
Write-Host "Game Programming Patterns is available at $destination"
