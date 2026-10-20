param([string]$SdkDirectory = "$env:LOCALAPPDATA/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.11.2/tools")
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$output = Join-Path $workspace '.superpowers/coverage-files-build'
New-Item -ItemType Directory -Force $output | Out-Null
$key = Join-Path $output 'coverage-files.snk'
$strongName = "${env:ProgramFiles(x86)}/Microsoft SDKs/Windows/v10.0A/bin/NETFX 4.8 Tools/sn.exe"
if (-not (Test-Path -LiteralPath $key)) { & $strongName -k $key; if ($LASTEXITCODE -ne 0) { throw 'Strong-name key generation failed.' } }
$compiler = "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
$references = @("/r:$SdkDirectory/Microsoft.Xrm.Sdk.dll", '/r:System.Runtime.Serialization.dll', '/r:System.ServiceModel.dll', '/r:System.Xml.Linq.dll')
$source = Join-Path $PSScriptRoot 'CoverageFileCommandPlugin.cs'
& $compiler /nologo /target:library /optimize+ "/keyfile:$key" "/out:$output/Oiac.Engage.CoverageFiles.dll" @references $source
if ($LASTEXITCODE -ne 0) { throw 'Runtime compilation failed.' }
Copy-Item -LiteralPath "$SdkDirectory/Microsoft.Xrm.Sdk.dll" -Destination $output -Force
& $compiler /nologo /target:exe "/out:$output/CoverageFileCommandTests.exe" @references $source (Join-Path $PSScriptRoot 'CoverageFileCommandTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
& "$output/CoverageFileCommandTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Coverage File handler tests failed.' }
Get-FileHash -Algorithm SHA256 "$output/Oiac.Engage.CoverageFiles.dll"
& $strongName -vf "$output/Oiac.Engage.CoverageFiles.dll"
if ($LASTEXITCODE -ne 0) { throw 'Strong-name verification failed.' }
# Administrative code is excluded from the signed runtime assembly.
$admin = Join-Path $PSScriptRoot 'RegisterCoverageFileCommand.cs'
if (Test-Path -LiteralPath $admin) {
 & $compiler /nologo /target:library "/out:$output/CoverageFilesAdmin.dll" @references "/r:$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" "/r:$SdkDirectory/Newtonsoft.Json.dll" $admin (Join-Path $PSScriptRoot 'ApplyCoverageFileSchema.cs')
 if ($LASTEXITCODE -ne 0) { throw 'Administrative helper compilation failed.' }
 Copy-Item -LiteralPath "$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" -Destination $output -Force
 Copy-Item -LiteralPath "$SdkDirectory/Newtonsoft.Json.dll" -Destination $output -Force
 & $compiler /nologo /target:exe "/out:$output/CoverageFilesAdminTests.exe" @references "/r:$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" "/r:$SdkDirectory/Newtonsoft.Json.dll" "/r:$output/CoverageFilesAdmin.dll" (Join-Path $PSScriptRoot 'CoverageFilesAdminTests.cs')
 if ($LASTEXITCODE -ne 0) { throw 'Administrative test compilation failed.' }
 & "$output/CoverageFilesAdminTests.exe" $output
 if ($LASTEXITCODE -ne 0) { throw 'Administrative guard tests failed.' }
}
