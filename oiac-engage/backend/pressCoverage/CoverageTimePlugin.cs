using System;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;
using Microsoft.Crm.Sdk.Messages;
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.6.2")]
namespace Oiac.Engage.PressCoverage {
 public sealed class CoverageTimePlugin : IPlugin {
  public void Execute(IServiceProvider provider) {
   var context=(IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
   if(context.MessageName!="mss_CoverageLocalTime" || context.InputParameters.Count!=1 || !context.InputParameters.Contains("UtcTime")) throw new InvalidPluginExecutionException("Unsupported coverage time request.");
   var factory=(IOrganizationServiceFactory)provider.GetService(typeof(IOrganizationServiceFactory));
   // Keep the Dataverse integration caller; never elevate to SYSTEM.
   var service=factory.CreateOrganizationService(context.UserId);
   context.OutputParameters["LocalTime"]=ConvertUtc(service,context.InputParameters["UtcTime"] as string);
  }
  public static string ConvertUtc(IOrganizationService service, string text) {
   DateTime utc;
   if(text==null || text.Length>32 || !Regex.IsMatch(text,"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,7})?Z$") || !DateTime.TryParseExact(text,new[]{"yyyy-MM-dd'T'HH:mm:ss'Z'","yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'"},CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out utc) || utc.Year<1753) throw new InvalidPluginExecutionException("A valid UTC timestamp is required.");
   var response=(LocalTimeFromUtcTimeResponse)service.Execute(new LocalTimeFromUtcTimeRequest { TimeZoneCode=129,UtcTime=utc });
   // This is a local wall-clock value represented consistently for the JS consumer.
   return response.LocalTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture);
  }
 }
}
