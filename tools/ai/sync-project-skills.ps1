[CmdletBinding()]
param(
    [switch]$Check
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$managedSkills = @(
    'plan-writing',
    'test-driven-development',
    'systematic-debugging',
    'receiving-code-review',
    'exelearning-logic-alpha'
)

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$sourceRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.agents\skills'))
$targetRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.claude\skills'))

function Get-SkillManifest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillRoot
    )

    if (-not (Test-Path -LiteralPath $SkillRoot -PathType Container)) {
        throw "Managed skill directory is missing: $SkillRoot"
    }

    $normalizedRoot = [System.IO.Path]::GetFullPath($SkillRoot).TrimEnd('\') + '\'
    $manifest = @{}

    foreach ($file in Get-ChildItem -LiteralPath $SkillRoot -Recurse -File | Sort-Object FullName) {
        $fullPath = [System.IO.Path]::GetFullPath($file.FullName)
        if (-not $fullPath.StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "File escaped managed skill directory: $fullPath"
        }

        $relativePath = $fullPath.Substring($normalizedRoot.Length).Replace('\', '/')
        $manifest[$relativePath] = (Get-FileHash -Algorithm SHA256 -LiteralPath $fullPath).Hash
    }

    return $manifest
}

function Assert-ManagedTarget {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$SkillName
    )

    $normalizedTargetRoot = $targetRoot.TrimEnd('\') + '\'
    $normalizedPath = [System.IO.Path]::GetFullPath($Path)
    if (-not $normalizedPath.StartsWith($normalizedTargetRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to manage path outside .claude/skills: $normalizedPath"
    }
    if ((Split-Path -Leaf $normalizedPath) -ne $SkillName -or $managedSkills -notcontains $SkillName) {
        throw "Refusing to manage non-whitelisted skill path: $normalizedPath"
    }
}

if ($Check) {
    $differences = New-Object System.Collections.Generic.List[string]

    foreach ($skillName in $managedSkills) {
        $sourceSkill = Join-Path $sourceRoot $skillName
        $targetSkill = Join-Path $targetRoot $skillName

        if (-not (Test-Path -LiteralPath $sourceSkill -PathType Container)) {
            $differences.Add("SOURCE MISSING: $skillName")
            continue
        }
        if (-not (Test-Path -LiteralPath $targetSkill -PathType Container)) {
            $differences.Add("TARGET MISSING: $skillName")
            continue
        }

        $sourceManifest = Get-SkillManifest -SkillRoot $sourceSkill
        $targetManifest = Get-SkillManifest -SkillRoot $targetSkill
        $allPaths = @($sourceManifest.Keys + $targetManifest.Keys | Sort-Object -Unique)

        foreach ($relativePath in $allPaths) {
            if (-not $sourceManifest.ContainsKey($relativePath)) {
                $differences.Add("EXTRA TARGET FILE: $skillName/$relativePath")
            } elseif (-not $targetManifest.ContainsKey($relativePath)) {
                $differences.Add("TARGET FILE MISSING: $skillName/$relativePath")
            } elseif ($sourceManifest[$relativePath] -ne $targetManifest[$relativePath]) {
                $differences.Add("HASH MISMATCH: $skillName/$relativePath")
            }
        }
    }

    if ($differences.Count -gt 0) {
        foreach ($difference in $differences) {
            Write-Host "ERROR: $difference" -ForegroundColor Red
        }
        exit 1
    }

    Write-Host 'Managed project skills are synchronized.'
    exit 0
}

if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    throw "Canonical skill root is missing: $sourceRoot"
}

if (-not (Test-Path -LiteralPath $targetRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
}

foreach ($skillName in $managedSkills) {
    $sourceSkill = Join-Path $sourceRoot $skillName
    $targetSkill = Join-Path $targetRoot $skillName

    if (-not (Test-Path -LiteralPath $sourceSkill -PathType Container)) {
        throw "Managed source skill is missing: $sourceSkill"
    }

    Assert-ManagedTarget -Path $targetSkill -SkillName $skillName

    if (Test-Path -LiteralPath $targetSkill) {
        Remove-Item -LiteralPath $targetSkill -Recurse -Force
    }

    Copy-Item -LiteralPath $sourceSkill -Destination $targetRoot -Recurse -Force
    Write-Host "Synchronized managed skill: $skillName"
}

Write-Host 'Managed project skill synchronization complete.'
