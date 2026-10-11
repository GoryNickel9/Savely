# Contract tests exercise the real deployment checker with HTTP responses supplied in memory.
# They require no network, account, Android SDK or additional PowerShell modules.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$script:taskCache = ''
$script:taskCertificate = ('AB:' * 31) + 'AB'
$script:taskResponseCertificate = $script:taskCertificate
$script:taskContentType = 'application/json; charset=utf-8'

function Invoke-WebRequest {
    param($Uri, [switch]$UseBasicParsing, $MaximumRedirection)
    if ($MaximumRedirection -ne 0) { throw 'Checker must reject redirects.' }
    if ($Uri.AbsolutePath -eq '/') {
        return [pscustomobject]@{ StatusCode=200; Headers=@{
            'Content-Type'='text/html; charset=utf-8'; 'Cache-Control'=$script:taskCache
        }; Content='<html></html>' }
    }
    $links = @(@{relation=@('delegate_permission/common.handle_all_urls'); target=@{
        namespace='android_app'; package_name='cc.savely.android'
        sha256_cert_fingerprints=@($script:taskResponseCertificate)
    }})
    return [pscustomobject]@{ StatusCode=200; Headers=@{'Content-Type'=$script:taskContentType};
        Content=(ConvertTo-Json -InputObject $links -Depth 5) }
}

$cases = @(
    @{Name='must revalidate home'; Cache='public, must-revalidate, max-age=0'; Pass=$true},
    @{Name='unqualified no-cache'; Cache='no-cache'; Pass=$true},
    @{Name='no-store'; Cache='no-store'; Pass=$true},
    @{Name='quoted zero'; Cache='public, max-age="0"'; Pass=$true},
    @{Name='s-max-age is not browser max-age'; Cache='max-age=600, s-max-age=0'; Pass=$false},
    @{Name='qualified no-cache does not revalidate body'; Cache='no-cache="Set-Cookie", max-age=600'; Pass=$false},
    @{Name='positive browser cache'; Cache='public, max-age=600'; Pass=$false},
    @{Name='missing cache policy'; Cache=''; Pass=$false},
    @{Name='wrong certificate'; Cache='max-age=0'; Pass=$false; WrongCertificate=$true},
    @{Name='SPA HTML instead of asset links'; Cache='max-age=0'; Pass=$false; Html=$true}
)
foreach ($case in $cases) {
    $script:taskCache = $case.Cache
    $script:taskResponseCertificate = if ($case.ContainsKey('WrongCertificate')) { ('CD:' * 31) + 'CD' } else { $script:taskCertificate }
    $script:taskContentType = if ($case.ContainsKey('Html')) { 'text/html' } else { 'application/json; charset=utf-8' }
    $passed = $true
    try { . (Join-Path $PSScriptRoot 'Verify-Deployment.ps1') -CertificateSha256 $script:taskCertificate | Out-Null }
    catch { $passed = $false; if ($case.Pass) { Write-Output $_.Exception.Message } }
    if ($passed -ne $case.Pass) { throw "Deployment checker regression: $($case.Name)" }
    Write-Output "PASS: $($case.Name)"
}
Write-Output "$($cases.Count) deployment checker tests passed."
