param([string]$SdkDirectory = "$env:LOCALAPPDATA/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.11.2/tools")
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$output = Join-Path $workspace '.superpowers/coverage-time-build'
New-Item -ItemType Directory -Force $output | Out-Null
$key = Join-Path $output 'coverage-time.snk'
$strongName = "${env:ProgramFiles(x86)}\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\sn.exe"
if (-not (Test-Path -LiteralPath $key)) { & $strongName -k $key; if ($LASTEXITCODE -ne 0) { throw 'Key generation failed.' } }
$compiler = "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
$references = @("/r:$SdkDirectory/Microsoft.Xrm.Sdk.dll", "/r:$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll", '/r:System.ServiceModel.dll')
$source = Join-Path $PSScriptRoot 'CoverageTimePlugin.cs'
& $compiler /nologo /target:library /optimize+ "/keyfile:$key" "/out:$output/Oiac.Engage.CoverageTime.dll" @references $source
if ($LASTEXITCODE -ne 0) { throw 'Plugin compilation failed.' }
Copy-Item -LiteralPath "$SdkDirectory/Microsoft.Xrm.Sdk.dll" -Destination $output -Force
Copy-Item -LiteralPath "$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" -Destination $output -Force
& $compiler /nologo /target:exe "/out:$output/CoverageTimeTests.exe" @references $source (Join-Path $PSScriptRoot 'CoverageTimeTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
& "$output/CoverageTimeTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Coverage time tests failed.' }
& $strongName -vf "$output/Oiac.Engage.CoverageTime.dll"
if ($LASTEXITCODE -ne 0) { throw 'Strong-name verification failed.' }
Get-FileHash -Algorithm SHA256 "$output/Oiac.Engage.CoverageTime.dll"
