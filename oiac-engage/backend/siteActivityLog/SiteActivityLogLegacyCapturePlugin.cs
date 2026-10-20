using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Oiac.Engage.SiteActivityLog {
 // Separate observers leave existing portal write services, permissions and flows intact.
 // Enable only after the actual portal integration identity/context is proven in UAT.
 public sealed class SiteActivityLogLegacyCapturePlugin:IPlugin {
  readonly Guid integrationUser=new Guid("605697c5-69a5-f111-b8dd-002248042536"),organization=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09");
  public SiteActivityLogLegacyCapturePlugin(){}
  public SiteActivityLogLegacyCapturePlugin(string configuration,string secureConfiguration):this(configuration){if(!string.IsNullOrEmpty(secureConfiguration))throw new InvalidPluginExecutionException("Unexpected secure history configuration.");}
  public SiteActivityLogLegacyCapturePlugin(string configuration){
   var values=(configuration??"").Split(';').Select(x=>x.Split('=')).ToArray();
   if(values.Length!=2||values.Any(x=>x.Length!=2)||values.Select(x=>x[0]).Distinct().Count()!=2)throw new InvalidPluginExecutionException("Invalid history observer configuration.");
   var user=values.SingleOrDefault(x=>x[0]=="integrationUser");var org=values.SingleOrDefault(x=>x[0]=="organization");
   if(user==null||org==null||!Guid.TryParseExact(user[1],"D",out integrationUser)||!Guid.TryParseExact(org[1],"D",out organization)||integrationUser==Guid.Empty||organization==Guid.Empty)throw new InvalidPluginExecutionException("Verified history integration identity is required.");
  }
  public static string[] FieldsFor(string table){switch(table){
   case "mss_meetingreport":return new[]{"mss_subject","mss_startdateandtime","mss_enddateandtime","mss_representative","mss_district","mss_meetingformat","mss_writedownwhatthestaffsaidnotwhatyousaid","mss_followupnoteoncethemeetingended","mss_overallsentiment"};
   case "mss_events":return new[]{"mss_eventname","mss_description","mss_eventtype","mss_eventformat","mss_startdatetime","mss_enddatetime","mss_eventstatus","mss_venuename","mss_address","mss_city","mss_meetingurl"};
   case "mss_eventregistration":return new[]{"mss_registrationnumber","mss_event","mss_contact","mss_registrationstatus"};
   case "contact":return new[]{"firstname","lastname","fullname","jobtitle","mobilephone","emailaddress1","address1_city","address1_stateorprovince","address1_postalcode","mss_district"};
   case "mss_presscoverage":return new[]{"mss_headline","mss_headlinetitle","mss_isfeatured","mss_mediaoutlet","mss_datepublishedaired","mss_oiaceventcampaign","mss_personinterviewedquoted","mss_reporterjournalist","mss_programsection","mss_coveragetype","mss_coveragelevel","mss_tone","mss_keytopic","mss_articlevideourl","mss_summary","mss_oiacmentioned","mss_relatedcontact","mss_keyquotes","mss_followupneeded","mss_publication","mss_shortsummary","mss_publicationdate","mss_originalarticlelink","mss_coveragefile","mss_coveragefile_name","mss_coverageuploadstate"};
   default:return new string[0];
  }}
  public void Execute(IServiceProvider provider){
   var c=(IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
   if(c.Stage!=40||c.Mode!=1)throw new InvalidPluginExecutionException("History observers require asynchronous PostOperation.");
   if(c.OrganizationId!=organization||integrationUser==Guid.Empty||FieldsFor(c.PrimaryEntityName).Length==0)return;
   Guid actor;bool portal=SiteActivityLogPortalActor.TryResolve(c,integrationUser,organization,out actor);
   var before=c.PreEntityImages.Contains("PreImage")?c.PreEntityImages["PreImage"]:null;
   var after=c.PostEntityImages.Contains("PostImage")?c.PostEntityImages["PostImage"]:null;
   try{
    bool committedUpload=false;
    if(!portal){
     if(!IsTerminalCoverageUpdate(c,integrationUser,organization))return;
     if(before==null||after==null)throw new InvalidOperationException("Required upload completion snapshots are missing.");
     committedUpload=TryCoverageCommit(c,integrationUser,organization,before,after,out actor);
     if(!committedUpload)throw new InvalidOperationException("Upload completion context could not be verified.");
    }
    if(portal&&((c.MessageName=="Create"&&after==null)||(c.MessageName=="Update"&&(before==null||after==null))||(c.MessageName=="Delete"&&before==null)))throw new InvalidOperationException("Required history snapshot is missing.");
    if(c.OperationId==Guid.Empty||c.OperationCreatedOn==default(DateTime))throw new InvalidOperationException("Missing durable event identity.");
    Entity entry=committedUpload?UploadEvent(c.PrimaryEntityId,actor,before,after,c.OperationId,c.OperationCreatedOn):Project(c.PrimaryEntityName,c.PrimaryEntityId,c.MessageName,actor,before,after,c.OperationId,c.OperationCreatedOn);
    if(entry==null)return;
    var factory=(IOrganizationServiceFactory)provider.GetService(typeof(IOrganizationServiceFactory));var service=factory.CreateOrganizationService(c.UserId);
    var person=service.Retrieve("contact",actor,new ColumnSet("fullname"));string actorName=person.GetAttributeValue<string>("fullname");
    entry["mss_actorname"]=string.IsNullOrWhiteSpace(actorName)||actorName.Length>100?"Member":actorName;
    entry["mss_correlationid"]=c.CorrelationId.ToString("D");SiteActivityLogWriter.Append(service,entry);
   }catch(Exception){throw new InvalidPluginExecutionException(OperationStatus.Retry,0,"Activity history delivery failed; retry the asynchronous job.");}
  }
  static object Value(Entity e,string name){object v;return e!=null&&e.Attributes.TryGetValue(name,out v)?v:null;}
  static bool Same(object a,object b){var ar=a as EntityReference;var br=b as EntityReference;if(ar!=null||br!=null)return ar!=null&&br!=null&&ar.Id==br.Id&&ar.LogicalName==br.LogicalName;var ao=a as OptionSetValue;var bo=b as OptionSetValue;if(ao!=null||bo!=null)return ao!=null&&bo!=null&&ao.Value==bo.Value;return object.Equals(a,b);}
  static int Number(Entity e,string field){var v=Value(e,field) as OptionSetValue;return v==null?-1:v.Value;}
  static string Text(Entity e,string field){return Value(e,field) as string;}
  static string Label(string table,Entity source){string value=Text(source,table=="mss_meetingreport"?"mss_subject":table=="mss_events"?"mss_eventname":table=="mss_eventregistration"?"mss_registrationnumber":table=="contact"?"fullname":source!=null&&source.GetAttributeValue<bool>("mss_isfeatured")?"mss_headline":"mss_headlinetitle");
   if(string.IsNullOrWhiteSpace(value)||value.Length>850||value.Any(char.IsControl)||value.Contains("://"))return Generic(table);return value;
  }
  static string Generic(string table){switch(table){case "mss_meetingreport":return "Meeting report";case "mss_events":return "Event";case "mss_eventregistration":return "Event registration";case "contact":return "Contact";default:return "Press coverage";}}
  internal static Entity Project(string table,Guid id,string message,Guid actor,Entity before,Entity after,Guid operation,DateTime occurred){
   if(actor==Guid.Empty||id==Guid.Empty||operation==Guid.Empty||FieldsFor(table).Length==0)return null;
   if(message!="Create"&&message!="Update"&&message!="Delete")return null;
   if(message=="Delete"&&before==null||message!="Delete"&&after==null||message=="Update"&&before==null)return null;
   var tracked=FieldsFor(table).Where(x=>x!="mss_coveragefile"&&x!="mss_coveragefile_name"&&x!="mss_coverageuploadstate");
   if(message=="Update"&&!tracked.Any(x=>!Same(Value(before,x),Value(after,x))))return null;
   int module=table=="mss_meetingreport"?866530000:table=="mss_events"?866530001:table=="mss_eventregistration"?866530002:table=="contact"?(id==actor?866530007:866530006):866530004;
   int action=message=="Delete"?866530017:message=="Create"?866530000:866530001;
   string verb=message=="Delete"?"Deleted":message=="Create"?"Created":"Updated";
   if(table=="mss_meetingreport"&&message=="Create"){action=866530002;verb="Submitted";}
   if(table=="contact"&&id==actor&&message=="Update"){action=866530015;verb="Updated profile";}
   if(table=="mss_eventregistration"&&message!="Delete"){
    int status=Number(after,"mss_registrationstatus"),previous=Number(before,"mss_registrationstatus");
    if(status==1&&(message=="Create"||previous!=1)){action=866530013;verb="Joined";}
    else if(status==2&&previous!=2){action=866530007;verb="Cancelled";}
   }
   if(table=="mss_events"&&message=="Update"){
    int status=Number(after,"mss_eventstatus");if(status!=Number(before,"mss_eventstatus")){if(status==866530001){action=866530011;verb="Published";}else if(status==866530005){action=866530007;verb="Cancelled";}}
   }
   string title=Label(table,message=="Delete"?before:after);
   string operationName=table=="mss_eventregistration"&&message=="Update"&&Number(before,"mss_registrationstatus")==2&&Number(after,"mss_registrationstatus")==1?"RegistrationReactivated":Generic(table).Replace(" ","")+message;
   return Event(table,id,actor,operation,occurred,module,action,title,verb+" "+title+".",Codec.D("schemaVersion",1,"operation",operationName));
  }
  static Entity Event(string table,Guid id,Guid actor,Guid operation,DateTime occurred,int module,int action,string title,string summary,Dictionary<string,object> details){
   var e=new Entity("mss_activitylog");e["mss_name"]=Generic(table)+" history";e["mss_performedby"]=new EntityReference("contact",actor);e["mss_actoridsnapshot"]=actor.ToString("D");e["mss_siteid"]=SiteActivityLogReadPlugin.Site.ToString("D");e["mss_recordtype"]=table;e["mss_recordid"]=id.ToString("D");e["mss_recordtitle"]=title.Length<=100?title:Generic(table);e["mss_summary"]=summary;e["mss_detailsjson"]=Codec.Json(details);e["mss_module"]=new OptionSetValue(module);e["mss_action"]=new OptionSetValue(action);e["mss_occurredon"]=DateTime.SpecifyKind(occurred,DateTimeKind.Utc);e["mss_eventkey"]=SiteActivityLogWriter.Hash(SiteActivityLogReadPlugin.Site.ToString("D")+"|"+actor.ToString("D")+"|"+operation.ToString("D")+"|"+table+"|"+id.ToString("D")+"|"+action.ToString(CultureInfo.InvariantCulture));return e;
  }
  static bool IsTerminalCoverageUpdate(IPluginExecutionContext c,Guid expectedUser,Guid expectedOrg){
   return expectedUser!=Guid.Empty&&c.OrganizationId==expectedOrg&&SiteActivityLogCoverageReceipt.Read(c)!=null;
  }
  internal static bool TryCoverageCommit(IPluginExecutionContext c,Guid expectedUser,Guid expectedOrg,Entity before,Entity after,out Guid actor){
   actor=Guid.Empty;if(c.OrganizationId!=expectedOrg||expectedUser==Guid.Empty||before==null||after==null)return false;
   var receipt=SiteActivityLogCoverageReceipt.Read(c);if(receipt==null)return false;
   try{var transfer=SiteActivityLogCoverageReceipt.Transfer(before);var person=(Guid)receipt["actor"];var session=(Guid)receipt["session"];
    if(!SiteActivityLogCoverageReceipt.Matches(transfer,person,c.PrimaryEntityId,session)||!string.IsNullOrEmpty(Text(after,"mss_coverageuploadstate"))||!(Value(after,"mss_coveragefile") is Guid)||(Guid)Value(after,"mss_coveragefile")==Guid.Empty||Text(after,"mss_coveragefile_name")!=transfer.Name)return false;
    actor=person;return true;
   }catch{return false;}
  }
  static Entity UploadEvent(Guid id,Guid actor,Entity before,Entity after,Guid operation,DateTime occurred){var transfer=SiteActivityLogCoverageReceipt.Transfer(before);bool logo=after.GetAttributeValue<bool>("mss_isfeatured");return Event("mss_presscoverage",id,actor,operation,occurred,866530004,866530012,Label("mss_presscoverage",after),logo?"Uploaded a publication logo linked to this coverage record.":"Uploaded an attachment linked to this coverage record.",Codec.D("schemaVersion",1,"operation","FileUploaded","fileSize",transfer.Size,"fileKind",logo?"logo":"attachment"));}
 }
}
