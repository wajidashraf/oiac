// Uses the existing approved local OIAC SDK-session helper. It never emits tokens.
using System;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

class HistoryAdminHost {
 static readonly Guid Organization=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09");
 static int Main(string[] args){
  System.Net.ServicePointManager.SecurityProtocol=System.Net.SecurityProtocolType.Tls12;
  try{
   if(args.Length<1)throw new ArgumentException("History operation required.");
   using(var session=new PacCachedSession())using(var service=session.CreateSdkClient()){
    if(service.ConnectedOrgId!=Organization||((WhoAmIResponse)service.Execute(new WhoAmIRequest())).OrganizationId!=Organization)throw new InvalidOperationException("Wrong OIAC environment; no operation performed.");
    if(args[0]=="verify"){
     if(args.Length!=1)throw new ArgumentException("Unexpected verification arguments.");
     Console.WriteLine("Verified exact OIAC UAT organization and cached OIAC session.");return 0;
    }
    if(args[0]=="diagnose-native-filters"&&args.Length==1){RegisterSiteActivityLogObservers.InspectNativeFilters(service);return 0;}
    if(args.Length<2||args[args.Length-1]!="allow-mutation")throw new ArgumentException("Explicit scoped mutation acknowledgement required.");
    if(args[0]=="configure-stamp-canary"&&args.Length==5){RegisterSiteActivityLogStampCanary.Configure(service,Guid.Parse(args[1]),args[2],args[3]);return 0;}
    if(args[0]=="remove-stamp-canary"&&args.Length==3){RegisterSiteActivityLogStampCanary.Remove(service,args[1]);return 0;}
    if(args[0]=="configure-canary"&&args.Length==5){RegisterSiteActivityLogCanary.Configure(service,Guid.Parse(args[1]),args[2],args[3]);return 0;}
    if(args[0]=="remove-canary"&&args.Length==3){RegisterSiteActivityLogCanary.Remove(service,args[1]);return 0;}
    if(args[0]=="register-reader"&&args.Length==4){RegisterSiteActivityLog.Apply(service,args[1],args[2]);return 0;}
    if(args[0]=="configure-portal-v2"&&args.Length==4){RegisterSiteActivityLogPortalPlan.Configure(service,Guid.Parse(args[1]),args[2]);return 0;}
    if(args[0]=="activate-portal-v2"&&args.Length==4){RegisterSiteActivityLogPortalPlan.Activate(service,Guid.Parse(args[1]),args[2]);return 0;}
    if(args[0]=="configure-native"&&args.Length==4){RegisterSiteActivityLogObservers.Apply(service,Guid.Parse(args[1]),false,false,args[2]);return 0;}
    if(args[0]=="activate-native-capture"&&args.Length==4){RegisterSiteActivityLogObservers.ActivateNativeCapture(service,Guid.Parse(args[1]),args[2]);return 0;}
    if(args[0]=="configure-portal"&&args.Length==4){RegisterSiteActivityLogLegacyObservers.Apply(service,Guid.Parse(args[1]),Guid.Parse(args[2]),false,false);return 0;}
    throw new ArgumentException("Unsupported history command. Capture activation requires separately verified hosted provenance; no automatic enablement is provided.");
   }
  }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}
 }
}




