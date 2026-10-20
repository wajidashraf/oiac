param([string]$SdkDirectory = "$env:LOCALAPPDATA/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.11.2/tools")
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent (Split-Path -Parent $project)
$output = Join-Path $workspace '.superpowers/activity-channel-build'
New-Item -ItemType Directory -Force $output | Out-Null
$key = Join-Path $output 'activity-channel.snk'
if (-not (Test-Path -LiteralPath $key)) {
    & "${env:ProgramFiles(x86)}\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\sn.exe" -k $key
    if ($LASTEXITCODE -ne 0) { throw 'Strong-name key generation failed.' }
}
$compiler = "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
$references = @("/r:$SdkDirectory/Microsoft.Xrm.Sdk.dll", '/r:System.Runtime.Serialization.dll', '/r:System.ServiceModel.dll', '/r:System.Xml.Linq.dll')
$source = Join-Path $PSScriptRoot 'ActivityChannelCommandPlugin.cs'
& $compiler /nologo /target:library /optimize+ "/keyfile:$key" "/out:$output/Oiac.Engage.ActivityChannel.dll" @references $source
if ($LASTEXITCODE -ne 0) { throw 'Plugin compilation failed.' }
Copy-Item -LiteralPath "$SdkDirectory/Microsoft.Xrm.Sdk.dll" -Destination $output -Force
& $compiler /nologo /target:exe "/out:$output/ActivityChannelCommandTests.exe" @references $source (Join-Path $PSScriptRoot 'ActivityChannelCommandTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
& "$output/ActivityChannelCommandTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Activity Channel handler tests failed.' }
Get-FileHash -Algorithm SHA256 "$output/Oiac.Engage.ActivityChannel.dll"
& "${env:ProgramFiles(x86)}\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\sn.exe" -vf "$output/Oiac.Engage.ActivityChannel.dll"
if ($LASTEXITCODE -ne 0) { throw 'Strong-name verification failed.' }

# Administrative helpers are deliberately compiled separately from the runtime DLL.
& $compiler /nologo /target:library "/out:$output/ActivityChannelAdmin.dll" @references "/r:$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" "/r:$SdkDirectory/Newtonsoft.Json.dll" (Join-Path $PSScriptRoot 'RegisterActivityChannelCommand.cs') (Join-Path $PSScriptRoot 'ApplyActivityChannelSchema.cs')
if ($LASTEXITCODE -ne 0) { throw 'Administrative helper compilation failed.' }
