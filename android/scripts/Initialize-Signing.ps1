[CmdletBinding()]
param(
    [string]$SigningDirectory = (Join-Path $env:LOCALAPPDATA 'Savely\android-signing'),
    [string]$JavaHome = 'C:\Program Files\Java\jdk-21'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$keytool = Join-Path $JavaHome 'bin\keytool.exe'
if (-not (Test-Path -LiteralPath $keytool)) { throw "JDK keytool non trovato: $keytool" }
$keyStore = Join-Path $SigningDirectory 'savely-release.p12'
$credentialFile = Join-Path $SigningDirectory 'signing-credential.clixml'
if ((Test-Path -LiteralPath $keyStore) -or (Test-Path -LiteralPath $credentialFile)) {
    throw 'Firma locale gia presente. Non viene sovrascritta: riutilizzare la chiave esistente.'
}
New-Item -ItemType Directory -Path $SigningDirectory -Force | Out-Null
# Limit access to the current Windows user; secrets never enter the checkout.
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $SigningDirectory /inheritance:r /grant:r "${identity}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Impossibile proteggere la directory di firma.' }
$random = New-Object byte[] 48
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($random) } finally { $generator.Dispose() }
$password = [Convert]::ToBase64String($random)
$previousPassword = [Environment]::GetEnvironmentVariable('SAVELY_KEYTOOL_PASSWORD', 'Process')
try {
    $env:SAVELY_KEYTOOL_PASSWORD = $password
    & $keytool -genkeypair -keystore $keyStore -storetype PKCS12 -alias savely-release `
        -keyalg RSA -keysize 4096 -validity 10000 `
        -dname 'CN=Savely Android,O=Savely' `
        -storepass:env SAVELY_KEYTOOL_PASSWORD -keypass:env SAVELY_KEYTOOL_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Generazione della chiave fallita.' }
    $securePassword = ConvertTo-SecureString $password -AsPlainText -Force
    $credential = [pscredential]::new('savely-release', $securePassword)
    $credential | Export-Clixml -LiteralPath $credentialFile
} finally {
    [Environment]::SetEnvironmentVariable('SAVELY_KEYTOOL_PASSWORD', $previousPassword, 'Process')
    $password = $null
    [Array]::Clear($random, 0, $random.Length)
}
Write-Output "Keystore creato fuori repository: $keyStore"
Write-Output 'Password protetta con Windows DPAPI. Conservare un backup della chiave e della password per i futuri aggiornamenti.'
