<#
.SYNOPSIS
    Genere automatiquement le fichier navigation.json a partir de l'arborescence du dossier pages/

.DESCRIPTION
    Ce script scanne le dossier pages/ et cree un fichier navigation.json
    qui sera utilise par le site pour construire le menu de navigation.

.USAGE
    ./generate-navigation.ps1
    
.NOTES
    - Les dossiers "assets" sont ignores
    - Les fichiers commencant par "_" ou "." sont ignores
#>

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PagesDir = Join-Path $ScriptDir "pages"
$OutputFile = Join-Path $ScriptDir "navigation.json"

# Dossiers/fichiers a ignorer
$ExcludePatterns = @("assets", "images", "img", "css", "js", "template", "_*", ".*")

# Fonction pour convertir un nom de fichier en titre lisible
function ConvertTo-DisplayName {
    param([string]$Name)
    
    $Name = [System.IO.Path]::GetFileNameWithoutExtension($Name)
    
    $words = $Name -split '[-_]'
    $titleCase = ($words | ForEach-Object { 
        if ($_.Length -gt 0) {
            $_.Substring(0,1).ToUpper() + $_.Substring(1).ToLower()
        }
    }) -join ' '
    
    return $titleCase
}

# Fonction pour verifier si un element doit etre exclu
function Test-ShouldExclude {
    param([string]$Name)
    
    foreach ($pattern in $ExcludePatterns) {
        if ($Name -like $pattern) {
            return $true
        }
    }
    return $false
}

# Fonction recursive pour scanner un dossier
function Get-NavigationTree {
    param(
        [string]$Path,
        [string]$RelativePath = ""
    )
    
    [System.Collections.ArrayList]$items = @()
    
    # Tri: fichiers d'abord (index.html en premier), puis dossiers
    $children = Get-ChildItem -Path $Path -ErrorAction SilentlyContinue | Sort-Object { 
        $isDir = $_.PSIsContainer
        $isIndex = $_.Name -eq "index.html"
        
        if ($isIndex) { "0" }                # index.html en tout premier
        elseif (-not $isDir) { "1" + $_.Name } # Fichiers ensuite
        else { "2" + $_.Name }                # Dossiers en dernier
    }
    
    foreach ($child in $children) {
        if (Test-ShouldExclude $child.Name) {
            continue
        }
        
        $childRelativePath = if ($RelativePath) { "$RelativePath/$($child.Name)" } else { $child.Name }
        $fullRelativePath = "pages/$childRelativePath"
        
        if ($child.PSIsContainer) {
            $subItems = Get-NavigationTree -Path $child.FullName -RelativePath $childRelativePath
            
            if ($subItems.Count -gt 0) {
                $folderItem = [ordered]@{
                    name = $child.Name
                    displayName = ConvertTo-DisplayName $child.Name
                    path = $fullRelativePath
                    type = "folder"
                    children = @($subItems)
                }
                [void]$items.Add($folderItem)
            }
        }
        elseif ($child.Extension -in @(".html", ".htm")) {
            $fileItem = [ordered]@{
                name = $child.Name
                displayName = ConvertTo-DisplayName $child.Name
                path = $fullRelativePath
                type = "file"
            }
            [void]$items.Add($fileItem)
        }
    }
    
    return ,$items.ToArray()
}

# === MAIN ===

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FrWA - Generateur de Navigation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $PagesDir)) {
    Write-Host "[ERREUR] Le dossier 'pages/' n'existe pas!" -ForegroundColor Red
    Write-Host "Creez le dossier et ajoutez vos pages HTML." -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Scan du dossier: $PagesDir" -ForegroundColor Gray

$navigationTree = Get-NavigationTree -Path $PagesDir

$fileCount = 0
$folderCount = 0

function Count-Items {
    param($Items)
    $script:folderCount += ($Items | Where-Object { $_.type -eq "folder" }).Count
    $script:fileCount += ($Items | Where-Object { $_.type -eq "file" }).Count
    foreach ($item in $Items) {
        if ($item.children) {
            Count-Items $item.children
        }
    }
}
Count-Items $navigationTree

Write-Host "[INFO] Trouve: $fileCount pages, $folderCount dossiers" -ForegroundColor Gray

$navigationData = [ordered]@{
    generated = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    children = @($navigationTree)
}

$jsonContent = $navigationData | ConvertTo-Json -Depth 10 -Compress:$false

$jsonContent | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host ""
Write-Host "[OK] Fichier genere: $OutputFile" -ForegroundColor Green
Write-Host ""

Write-Host "Arborescence generee:" -ForegroundColor Yellow
Write-Host "----------------------" -ForegroundColor Yellow

function Show-Tree {
    param($Items, $Indent = "")
    
    foreach ($item in $Items) {
        $name = $item.displayName
        
        if ($item.type -eq "folder") {
            Write-Host "$Indent+ $name/" -ForegroundColor Cyan
            if ($item.children) {
                Show-Tree -Items $item.children -Indent "  $Indent"
            }
        } else {
            Write-Host "$Indent- $name" -ForegroundColor White
        }
    }
}

Show-Tree -Items $navigationTree

Write-Host ""
Write-Host "----------------------" -ForegroundColor Yellow
Write-Host "Termine! Rafraichissez votre navigateur." -ForegroundColor Green
Write-Host ""
