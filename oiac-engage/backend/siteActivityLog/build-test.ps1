param([string]$SdkDirectory = "$env:LOCALAPPDATA/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.11.2/tools")
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent (Split-Path -Parent $project)
$output = Join-Path $workspace '.superpowers/site-activity-log-build'
New-Item -ItemType Directory -Force $output | Out-Null
$key = Join-Path $output 'site-activity-log.snk'
if (-not (Test-Path -LiteralPath $key)) {
    & "${env:ProgramFiles(x86)}\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\sn.exe" -k $key
    if ($LASTEXITCODE -ne 0) { throw 'Strong-name key generation failed.' }
}
$compiler = "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
$references = @("/r:$SdkDirectory/Microsoft.Xrm.Sdk.dll", '/r:System.Runtime.Serialization.dll', '/r:System.ServiceModel.dll', '/r:System.Xml.Linq.dll')
$source = @((Join-Path $PSScriptRoot 'SiteActivityLogPlugin.cs'), (Join-Path $PSScriptRoot 'SiteActivityLogContextCanaryPlugin.cs'), (Join-Path $PSScriptRoot 'SiteActivityLogContextStampCanaryPlugin.cs'), (Join-Path $PSScriptRoot 'SiteActivityLogNativeProvenancePlugin.cs'))
if (Test-Path (Join-Path $PSScriptRoot 'SiteActivityLogLegacyCapturePlugin.cs')) { $source += Join-Path $PSScriptRoot 'SiteActivityLogLegacyCapturePlugin.cs' }
$source += Join-Path $PSScriptRoot 'SiteActivityLogCoverageProvenancePlugin.cs'
& $compiler /nologo /target:library /optimize+ "/keyfile:$key" "/out:$output/Oiac.Engage.SiteActivityLog.dll" @references @source
if ($LASTEXITCODE -ne 0) { throw 'Plugin compilation failed.' }
Copy-Item -LiteralPath "$SdkDirectory/Microsoft.Xrm.Sdk.dll" -Destination $output -Force
& $compiler /nologo /target:exe "/out:$output/SiteActivityLogTests.exe" @references @source (Join-Path $PSScriptRoot 'SiteActivityLogTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
& "$output/SiteActivityLogTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Site Activity Log handler tests failed.' }
if (Test-Path (Join-Path $PSScriptRoot 'SiteActivityLogLegacyCaptureTests.cs')) {
    & $compiler /nologo /target:exe "/out:$output/SiteActivityLogLegacyTests.exe" @references $source (Join-Path $PSScriptRoot 'SiteActivityLogLegacyCaptureTests.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Legacy capture test compilation failed.' }
    & "$output/SiteActivityLogLegacyTests.exe"
    if ($LASTEXITCODE -ne 0) { throw 'Legacy capture tests failed.' }
}
& $compiler /nologo /target:exe "/out:$output/SiteActivityLogNativeProvenanceTests.exe" @references @source (Join-Path $PSScriptRoot 'SiteActivityLogNativeProvenanceTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native provenance test compilation failed.' }
& "$output/SiteActivityLogNativeProvenanceTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Native provenance tests failed.' }
& $compiler /nologo /target:exe "/out:$output/SiteActivityLogCoverageProvenanceTests.exe" @references @source (Join-Path $PSScriptRoot 'SiteActivityLogCoverageProvenanceTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Coverage provenance test compilation failed.' }
& "$output/SiteActivityLogCoverageProvenanceTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Coverage provenance tests failed.' }
& $compiler /nologo /target:exe /main:SiteActivityLogConfigurationTests "/out:$output/SiteActivityLogConfigurationTests.exe" @references @source (Join-Path $PSScriptRoot 'SiteActivityLogNativeProvenanceTests.cs') (Join-Path $PSScriptRoot 'SiteActivityLogConfigurationTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'History configuration test compilation failed.' }
& "$output/SiteActivityLogConfigurationTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'History configuration tests failed.' }
Get-FileHash -Algorithm SHA256 "$output/Oiac.Engage.SiteActivityLog.dll"
& "${env:ProgramFiles(x86)}\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\sn.exe" -vf "$output/Oiac.Engage.SiteActivityLog.dll"
if ($LASTEXITCODE -ne 0) { throw 'Strong-name verification failed.' }


# Compile administrative code separately; do not invoke it here.
$adminSources = @((Join-Path $PSScriptRoot 'RegisterSiteActivityLog.cs'), (Join-Path $PSScriptRoot 'RegisterSiteActivityLogObservers.cs'), (Join-Path $PSScriptRoot 'RegisterSiteActivityLogCanary.cs'), (Join-Path $PSScriptRoot 'RegisterSiteActivityLogStampCanary.cs'))
$adminSources += Join-Path $PSScriptRoot 'RegisterSiteActivityLogPortalPlan.cs'
if (Test-Path (Join-Path $PSScriptRoot 'RegisterSiteActivityLogLegacyObservers.cs')) { $adminSources += Join-Path $PSScriptRoot 'RegisterSiteActivityLogLegacyObservers.cs' }
& $compiler /nologo /target:library "/out:$output/SiteActivityLogAdmin.dll" @references "/r:$output/Oiac.Engage.SiteActivityLog.dll" "/r:$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" "/r:$SdkDirectory/Newtonsoft.Json.dll" @adminSources
if ($LASTEXITCODE -ne 0) { throw 'History administrative helper compilation failed.' }


& $compiler /nologo /target:exe "/out:$output/SiteActivityLogCanaryAdminTests.exe" @references "/r:$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" "/r:$SdkDirectory/Newtonsoft.Json.dll" "/r:$output/Oiac.Engage.SiteActivityLog.dll" "/r:$output/SiteActivityLogAdmin.dll" (Join-Path $PSScriptRoot 'SiteActivityLogCanaryAdminTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Canary administrative test compilation failed.' }
Copy-Item -LiteralPath "$SdkDirectory/Newtonsoft.Json.dll" -Destination $output -Force
Copy-Item -LiteralPath "$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" -Destination $output -Force
& "$output/SiteActivityLogCanaryAdminTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Canary administrative tests failed.' }
& $compiler /nologo /target:exe /main:SiteActivityLogPortalPlanTests "/out:$output/SiteActivityLogPortalPlanTests.exe" @references "/r:$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll" "/r:$SdkDirectory/Newtonsoft.Json.dll" "/r:$output/Oiac.Engage.SiteActivityLog.dll" "/r:$output/SiteActivityLogAdmin.dll" (Join-Path $PSScriptRoot 'SiteActivityLogCanaryAdminTests.cs') (Join-Path $PSScriptRoot 'SiteActivityLogPortalPlanTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Portal registration test compilation failed.' }
& "$output/SiteActivityLogPortalPlanTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Portal registration tests failed.' }





