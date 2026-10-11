[CmdletBinding()]
param(
    [string]$SdkPath = (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
    [string]$JavaHome = 'C:\Program Files\Java\jdk-21',
    [string]$SigningDirectory = (Join-Path $env:LOCALAPPDATA 'Savely\android-signing')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$androidRoot = Split-Path $PSScriptRoot -Parent
$project = Join-Path $androidRoot 'app-project'
$wrapper = Join-Path $project 'gradlew.bat'
$apksigner = Join-Path $SdkPath 'build-tools\36.0.0\apksigner.bat'
& (Join-Path $PSScriptRoot 'Test-DeploymentChecks.ps1')
foreach ($required in @($wrapper, $apksigner, (Join-Path $JavaHome 'bin\java.exe'))) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Strumento non trovato: $required" }
}
$environmentNames = @('JAVA_HOME', 'JAVA_TOOL_OPTIONS', 'ANDROID_HOME', 'ANDROID_SDK_ROOT',
    'SAVELY_ANDROID_KEYSTORE', 'SAVELY_ANDROID_KEYSTORE_PASSWORD',
    'SAVELY_ANDROID_KEY_ALIAS', 'SAVELY_ANDROID_KEY_PASSWORD')
$savedEnvironment = @{}
foreach ($name in $environmentNames) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    $env:JAVA_HOME = $JavaHome
    $env:ANDROID_HOME = $SdkPath
    $env:ANDROID_SDK_ROOT = $SdkPath
    # Codex desktop may virtualize Windows Temp. Keep JVM AF_UNIX pipes in the project.
    $socketDirectory = Join-Path $project '.gradle\sockets'
    New-Item -ItemType Directory -Path $socketDirectory -Force | Out-Null
    $env:JAVA_TOOL_OPTIONS = ($savedEnvironment['JAVA_TOOL_OPTIONS'] + " -Djdk.net.unixdomain.tmpdir=`"$socketDirectory`"").Trim()
    if (-not $env:SAVELY_ANDROID_KEYSTORE) {
        $credentialFile = Join-Path $SigningDirectory 'signing-credential.clixml'
        if (-not (Test-Path -LiteralPath $credentialFile)) {
            throw 'Firma assente: eseguire Initialize-Signing.ps1 oppure configurare le variabili di firma.'
        }
        $credential = Import-Clixml -LiteralPath $credentialFile
        if ($credential -isnot [pscredential]) { throw 'Formato delle credenziali di firma non valido.' }
        $env:SAVELY_ANDROID_KEYSTORE = Join-Path $SigningDirectory 'savely-release.p12'
        $env:SAVELY_ANDROID_KEYSTORE_PASSWORD = $credential.GetNetworkCredential().Password
        $env:SAVELY_ANDROID_KEY_ALIAS = $credential.UserName
        $env:SAVELY_ANDROID_KEY_PASSWORD = $credential.GetNetworkCredential().Password
    }
    foreach ($name in $environmentNames | Where-Object { $_ -like 'SAVELY_ANDROID_*' }) {
        if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) { throw "Firma incompleta: $name" }
    }
    Push-Location $project
    try {
        & $wrapper --no-daemon --console=plain testDebugUnitTest lintDebug assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "Build Android fallita (exit $LASTEXITCODE)." }
    } finally { Pop-Location }
    $apk = Join-Path $project 'app\build\outputs\apk\release\app-release.apk'
    $verification = & $apksigner verify --verbose --print-certs $apk 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Verifica firma APK fallita: $verification" }
    $certificateMatch = [regex]::Match(($verification -join "`n"), 'Signer #1 certificate SHA-256 digest: ([0-9a-fA-F]+)')
    $assetLinksPath = Join-Path (Split-Path $androidRoot -Parent) 'public\.well-known\assetlinks.json'
    $assetLinks = Get-Content -LiteralPath $assetLinksPath -Raw | ConvertFrom-Json
    $matchingLink = @($assetLinks | Where-Object {
        $_.target.package_name -eq 'cc.savely.android' -and $_.target.namespace -eq 'android_app' -and
        $_.relation -contains 'delegate_permission/common.handle_all_urls'
    })
    $expectedFingerprints = @($matchingLink | ForEach-Object { $_.target.sha256_cert_fingerprints } |
        ForEach-Object { ($_ -replace ':', '').ToLowerInvariant() })
    if (-not $certificateMatch.Success -or $expectedFingerprints -notcontains $certificateMatch.Groups[1].Value.ToLowerInvariant()) {
        throw 'Certificato APK diverso da assetlinks.json: release non distribuibile.'
    }
    $outputDirectory = Join-Path $androidRoot 'dist'
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    $outputApk = Join-Path $outputDirectory 'savely-android.apk'
    Copy-Item -LiteralPath $apk -Destination $outputApk -Force
    $hash = (Get-FileHash -LiteralPath $outputApk -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  savely-android.apk" | Set-Content -LiteralPath (Join-Path $outputDirectory 'SHA256SUMS.txt') -Encoding ascii
    $verification | Set-Content -LiteralPath (Join-Path $outputDirectory 'signature.txt') -Encoding utf8
    Copy-Item -LiteralPath (Join-Path $androidRoot 'release.json') -Destination (Join-Path $outputDirectory 'release.json') -Force
    Write-Output "APK: $outputApk"
    Write-Output "SHA256: $hash"
} finally {
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
}
