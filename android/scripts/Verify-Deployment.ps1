[CmdletBinding()]
param(
    [uri]$Site = 'https://www.savely.cc/',
    [string]$PackageName = 'cc.savely.android',
    [string]$CertificateSha256,
    [switch]$AllowMissingAssetLinks
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($Site.Scheme -ne 'https') { throw 'Il sito TWA deve usare HTTPS.' }
$siteUri = [uri]::new($Site.GetLeftPart([System.UriPartial]::Authority) + '/')
$homeResponse = Invoke-WebRequest -Uri $siteUri -UseBasicParsing -MaximumRedirection 0
$homeCache = [string]$homeResponse.Headers['Cache-Control']
if ($homeResponse.StatusCode -ne 200 -or [string]$homeResponse.Headers['Content-Type'] -notmatch 'text/html') {
    throw 'Home page non servita come HTML con status 200.'
}
$cacheDirectives = @($homeCache -split ',' | ForEach-Object { $_.Trim().ToLowerInvariant() })
if (-not ($cacheDirectives | Where-Object { $_ -match '^(no-cache|no-store)$|^max-age\s*=\s*"?0"?$' })) {
    throw "La home non richiede rivalidazione della cache: $homeCache"
}
$assetUri = [uri]::new($siteUri, '.well-known/assetlinks.json')
$assetResponse = Invoke-WebRequest -Uri $assetUri -UseBasicParsing -MaximumRedirection 0
if ([string]$assetResponse.Headers['Content-Type'] -notmatch 'application/(json|[^;]+\+json)') {
    if ($AllowMissingAssetLinks) {
        Write-Warning 'assetlinks.json non e ancora pubblicato come JSON. Verifica TWA non completata.'
        exit 0
    }
    throw 'assetlinks.json restituisce un contenuto diverso da JSON. Non modificare il routing web senza autorizzazione.'
}
$assetLinks = ConvertFrom-Json -InputObject $assetResponse.Content
$matchingLinks = @($assetLinks | Where-Object {
    $_.relation -contains 'delegate_permission/common.handle_all_urls' -and
    $_.target.namespace -eq 'android_app' -and $_.target.package_name -eq $PackageName
})
if ($matchingLinks.Count -eq 0) { throw "Associazione mancante per $PackageName" }
if ($CertificateSha256) {
    $expected = ($CertificateSha256 -replace ':', '').ToUpperInvariant()
    $fingerprints = @($matchingLinks | ForEach-Object { $_.target.sha256_cert_fingerprints })
    if (-not ($fingerprints | Where-Object { ($_ -replace ':', '').ToUpperInvariant() -eq $expected })) {
        throw 'Il certificato APK non corrisponde ad assetlinks.json.'
    }
}
[pscustomobject]@{
    Site = $siteUri.AbsoluteUri
    HomeStatus = $homeResponse.StatusCode
    HomeCacheControl = $homeCache
    AssetLinksStatus = $assetResponse.StatusCode
    AssetLinksContentType = [string]$assetResponse.Headers['Content-Type']
    PackageName = $PackageName
    CertificateChecked = [bool]$CertificateSha256
} | ConvertTo-Json
