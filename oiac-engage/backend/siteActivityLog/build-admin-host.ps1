param([string]$SdkDirectory = "$env:LOCALAPPDATA/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.11.2/tools")
$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$output=Join-Path $workspace '.superpowers/site-activity-log-build'
$sessionHelper=Join-Path $workspace '.superpowers/press-coverage/sdk-helper/DataverseReadOnly.exe'
if(!(Test-Path $sessionHelper)){throw 'The existing approved OIAC session helper is required; no authentication or installation attempted.'}
if(!(Test-Path (Join-Path $output 'SiteActivityLogAdmin.dll'))){throw 'Run build-test.ps1 first.'}
Copy-Item -LiteralPath $sessionHelper -Destination $output -Force
Copy-Item -LiteralPath ($sessionHelper+'.config') -Destination (Join-Path $output 'HistoryAdminHost.exe.config') -Force
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$references=@("/r:$sessionHelper","/r:$output/SiteActivityLogAdmin.dll","/r:$SdkDirectory/Microsoft.Xrm.Sdk.dll","/r:$SdkDirectory/Microsoft.Crm.Sdk.Proxy.dll","/r:$SdkDirectory/Microsoft.PowerPlatform.Dataverse.Client.dll","/r:$SdkDirectory/Microsoft.Identity.Client.dll",'/r:System.ServiceModel.dll','/r:C:/Windows/Microsoft.NET/assembly/GAC_MSIL/netstandard/v4.0_2.0.0.0__cc7b13ffcd2ddd51/netstandard.dll')
& $compiler /nologo /target:exe "/out:$output/HistoryAdminHost.exe" @references (Join-Path $PSScriptRoot 'HistoryAdminHost.cs')
if($LASTEXITCODE -ne 0){throw 'History administrative host compilation failed.'}
Write-Output 'UAT-guarded administrative host compiled. No authentication, registration or deployment performed.'
