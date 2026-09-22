<#
.SYNOPSIS
    Stamps the next available version onto a copy of the tests/sample-extension test .vsix fixture.

.DESCRIPTION
    The Visual Studio Marketplace rejects publishing the same extension version twice, so the
    committed tests/sample-extension/vs-marketplace-test-1.0.0.vsix fixture can only ever be
    published once as-is. This script queries the Marketplace Gallery API for the version of
    -ExtensionId (publisher "jessehouwing") that is currently published, increments its last
    segment by one, copies the fixture, rewrites the <Identity Id="..." Version="..."> in its
    embedded extension.vsixmanifest to that new extension id / version, and writes the result to
    -OutputPath.

    -ExtensionId defaults to "vs-marketplace-test", but release test workflows fan out multiple
    matrix combinations (e.g. auth type) in parallel. Those combinations must each pass a distinct
    -ExtensionId (e.g. "vs-marketplace-test-actions-pat", "vs-marketplace-test-actions-oidc",
    "vs-marketplace-test-azdo-pat", "vs-marketplace-test-azdo-azurerm") so concurrent jobs publish
    to their own private extension instead of racing for the same "next" version of a shared one.

    When -ManifestPath / -ManifestOutputPath are supplied, the publish-manifest.json's
    identity.internalName is rewritten to match -ExtensionId as well, so the manifest handed to
    VsixPublisher.exe stays consistent with the stamped .vsix. Relative paths in the manifest
    (e.g. "overview") are rewritten to absolute paths pointing back at the original manifest's
    directory, since VsixPublisher.exe resolves them relative to the manifest file's own location.

.PARAMETER SourcePath
    Path to the source tests/sample-extension .vsix fixture (left untouched).

.PARAMETER OutputPath
    Path to write the re-stamped .vsix copy.

.PARAMETER PublisherId
    Marketplace publisher id that owns the test extension. Defaults to "jessehouwing".

.PARAMETER ExtensionId
    Marketplace internal extension name to look up, and to stamp onto the copy's
    <Identity Id="..."> (and, when -ManifestPath is supplied, identity.internalName). Defaults to
    "vs-marketplace-test". Pass a scenario-specific value (e.g. "vs-marketplace-test-actions-pat")
    so parallel matrix jobs use their own private extension.

.PARAMETER AccessToken
    Bearer/PAT token used to query the Marketplace Gallery API for the currently published
    version. When omitted, falls back to the VSS_PAT / SYSTEM_ACCESSTOKEN environment variables.
    The Gallery API requires authentication - a missing, invalid, or expired token (or any other
    non-404 failure) causes the script to fail rather than silently assuming 1.0.0; only a 404
    (extension never published under this publisher/id) falls back to 1.0.0.

.PARAMETER Version
    Optional explicit version to stamp (3- or 4-part dotted version, e.g. 1.0.1 or 1.0.1234.5678),
    bypassing the Marketplace lookup entirely.

.PARAMETER ManifestPath
    Optional path to the source publish-manifest.json (left untouched). When supplied together
    with -ManifestOutputPath, its identity.internalName is rewritten to -ExtensionId and written
    to -ManifestOutputPath.

.PARAMETER ManifestOutputPath
    Optional path to write the re-stamped publish-manifest.json copy. Required when -ManifestPath
    is supplied.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $false)]
    [string]$PublisherId = 'jessehouwing',

    [Parameter(Mandatory = $false)]
    [string]$ExtensionId = 'vs-marketplace-test',

    [Parameter(Mandatory = $false)]
    [string]$AccessToken,

    [Parameter(Mandatory = $false)]
    [string]$Version,

    [Parameter(Mandatory = $false)]
    [string]$ManifestPath,

    [Parameter(Mandatory = $false)]
    [string]$ManifestOutputPath
)

if ($ManifestPath -and -not $ManifestOutputPath) {
    throw '-ManifestOutputPath is required when -ManifestPath is supplied.'
}

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "Source .vsix not found: $SourcePath"
}

function Get-NextMarketplaceVersion {
    param(
        [string]$PublisherId,
        [string]$ExtensionId,
        [string]$AccessToken
    )

    # The public gallery endpoint (_apis/public/gallery/...) only returns data for extensions
    # visible without authentication, so it 404s for private extensions even with a valid PAT.
    # Use the authenticated gallery endpoint instead, with flags=1 (IncludeVersions) to get the
    # currently published version.
    $uri = "https://marketplace.visualstudio.com/_apis/gallery/publishers/$PublisherId/extensions/$ExtensionId" +
        '?flags=1&api-version=7.2-preview.1'

    $headers = @{
        Accept                  = 'application/json;api-version=7.2-preview.1'
        'X-TFS-FedAuthRedirect' = 'Suppress'
    }
    if (-not $AccessToken) {
        $AccessToken = $env:VSS_PAT
    }
    if (-not $AccessToken) {
        $AccessToken = $env:SYSTEM_ACCESSTOKEN
    }
    if ($AccessToken) {
        $headers['Authorization'] = "Bearer $AccessToken"
    }

    try {
        $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    }
    catch {
        # A 404 means the extension has never been published under this publisher/id - that's
        # expected for a brand-new scenario-specific extension id and should fall back to 1.0.0.
        # Any other failure (401/403 auth, network, throttling, etc.) is a real error and must
        # not be silently swallowed, or the pipeline would keep re-publishing 1.0.0 and failing.
        # X-TFS-FedAuthRedirect: Suppress (above) ensures auth failures come back as a proper
        # 401/403 instead of a 200 OK HTML sign-in redirect page that would otherwise be
        # indistinguishable from a legitimate "no versions" response.
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        if ($statusCode -eq 404) {
            Write-Host "No published extension found for '$PublisherId.$ExtensionId' (404). Starting at 1.0.0."
            return '1.0.0'
        }

        if ($statusCode -eq 401 -or $statusCode -eq 403) {
            throw "Could not query Marketplace for current version of '$PublisherId.$ExtensionId': authentication failed (HTTP $statusCode). Check that a valid access token is available."
        }

        throw "Could not query Marketplace for current version of '$PublisherId.$ExtensionId': $($_.Exception.Message)"
    }

    $currentVersion = $response.versions | Select-Object -First 1 -ExpandProperty version -ErrorAction SilentlyContinue
    if (-not $currentVersion) {
        Write-Host "No published versions found for '$PublisherId.$ExtensionId'. Starting at 1.0.0."
        return '1.0.0'
    }

    Write-Host "Currently published version of '$PublisherId.$ExtensionId': $currentVersion"

    $parts = $currentVersion.Split('.') | ForEach-Object { [int]$_ }
    $lastIndex = $parts.Count - 1

    $parts[$lastIndex]++
    for ($i = $lastIndex; $i -gt 0 -and $parts[$i] -gt 65535; $i--) {
        $parts[$i] = 0
        $parts[$i - 1]++
    }

    return ($parts -join '.')
}

if (-not $Version) {
    $Version = Get-NextMarketplaceVersion -PublisherId $PublisherId -ExtensionId $ExtensionId -AccessToken $AccessToken
}

if ($Version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') {
    throw "Version must be a 3- or 4-part dotted version (e.g. 1.0.1 or 1.0.1234.5678), got: $Version"
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Copy-Item -LiteralPath $SourcePath -Destination $OutputPath -Force

# On Windows PowerShell 5.1 (used by the Azure Pipelines PowerShell@2 task), [System.IO.Compression.ZipArchive]
# lives in System.IO.Compression.dll, not System.IO.Compression.FileSystem.dll (which only adds the static
# ZipFile helper) - both assemblies must be loaded explicitly.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipArchive]::new([System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite), [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $entry = $zip.GetEntry('extension.vsixmanifest')
    if (-not $entry) {
        throw "extension.vsixmanifest not found in $OutputPath"
    }

    $reader = New-Object System.IO.StreamReader($entry.Open())
    $manifest = $reader.ReadToEnd()
    $reader.Dispose()

    # Check whether the pattern matched via -match rather than comparing before/after strings -
    # a before/after equality check would false-positive as "not found" whenever the replacement
    # value happens to be identical to the value already in the manifest (e.g. the fallback
    # version 1.0.0 matching the fixture's existing 1.0.0).
    if ($manifest -notmatch '<Identity\b[^>]*\bVersion="[^"]+"') {
        throw 'Failed to locate Identity Version attribute to replace in extension.vsixmanifest'
    }
    $updatedManifest = $manifest -replace '(<Identity\b[^>]*\bVersion=")[^"]+(")', "`${1}$Version`${2}"

    if ($updatedManifest -notmatch '<Identity\b[^>]*\bId="[^"]+"') {
        throw 'Failed to locate Identity Id attribute to replace in extension.vsixmanifest'
    }
    $updatedManifest = $updatedManifest -replace '(<Identity\b[^>]*\bId=")[^"]+(")', "`${1}$ExtensionId`${2}"

    $entry.Delete()
    $newEntry = $zip.CreateEntry('extension.vsixmanifest')
    $writer = New-Object System.IO.StreamWriter($newEntry.Open())
    $writer.Write($updatedManifest)
    $writer.Dispose()
}
finally {
    $zip.Dispose()
}

Write-Host "Stamped $OutputPath with extension id '$ExtensionId', version $Version"

if ($ManifestPath) {
    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        throw "Manifest not found: $ManifestPath"
    }

    $manifestOutputDir = Split-Path -Parent $ManifestOutputPath
    if ($manifestOutputDir -and -not (Test-Path -LiteralPath $manifestOutputDir)) {
        New-Item -ItemType Directory -Path $manifestOutputDir -Force | Out-Null
    }

    $manifestJson = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $manifestJson.identity.internalName = $ExtensionId

    # VsixPublisher.exe resolves relative paths (e.g. "overview") relative to the manifest file's
    # own directory, so rewrite them to absolute paths pointing back at the original manifest's
    # directory now that the stamped copy lives elsewhere (e.g. a temp directory).
    $sourceManifestDir = Split-Path -Parent (Resolve-Path -LiteralPath $ManifestPath).Path
    if ($manifestJson.overview -and -not [System.IO.Path]::IsPathRooted($manifestJson.overview)) {
        $manifestJson.overview = (Resolve-Path -LiteralPath (Join-Path $sourceManifestDir $manifestJson.overview)).Path
    }

    $manifestJson | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ManifestOutputPath -Encoding utf8

    Write-Host "Stamped $ManifestOutputPath with identity.internalName '$ExtensionId'"
}

if ($env:GITHUB_OUTPUT) {
    "version=$Version" >> $env:GITHUB_OUTPUT
    "extension-id=$ExtensionId" >> $env:GITHUB_OUTPUT
}
if ($env:AGENT_TEMPDIRECTORY -or $env:AZURE_HTTP_USER_AGENT) {
    Write-Host "##vso[task.setvariable variable=stampedVsixVersion;isOutput=true]$Version"
    Write-Host "##vso[task.setvariable variable=stampedExtensionId;isOutput=true]$ExtensionId"
}

