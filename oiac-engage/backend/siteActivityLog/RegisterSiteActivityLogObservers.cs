// Administrative-only native registration/activation. No business/schema writes.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
public static class RegisterSiteActivityLogObservers {
 const string Prefix="Oiac.Engage.SiteActivityLog.",Capture=Prefix+"SiteActivityLogCapturePlugin",Stamp=Prefix+"SiteActivityLogNativeProvenancePlugin",Guard=Prefix+"SiteActivityLogGuardPlugin";
 static readonly Guid Organization=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09");
 static readonly string[] StepColumns={"name","eventhandler","sdkmessageid","sdkmessagefilterid","stage","mode","configuration","filteringattributes","statecode","statuscode","rank","supporteddeployment","asyncautodelete","impersonatinguserid","sdkmessageprocessingstepsecureconfigid"};
 public sealed class TypePlan {public Guid Id;public string Name;public bool Create;}
 public sealed class ImagePlan {public Guid Id;public string Alias;public int Kind;public string Fields;public string Property;public bool Create;}
 public sealed class StepPlan {public Guid Id,TypeId,MessageId,FilterId;public string Name,Table,Message,TypeName,Fields,Configuration;public int Stage,Mode;public bool Create,IsGuard;public int PriorState;public List<ImagePlan> Images=new List<ImagePlan>();}
 public sealed class Journal {public int SchemaVersion=2;public Guid OrganizationId;public Guid AssemblyId;public string RuntimeSha256,Operation;public List<TypePlan> Types;public List<StepPlan> Steps;}
 static void Require(bool ok,string message){if(!ok)throw new InvalidOperationException(message);}
 static string Hash(byte[] bytes){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
 static string Verify(IOrganizationService s,Guid assembly){
  Require(((WhoAmIResponse)s.Execute(new WhoAmIRequest())).OrganizationId==Organization,"Native history operations require exact OIAC UAT organization.");Require(assembly!=Guid.Empty,"History assembly required.");
  var table=((RetrieveEntityResponse)s.Execute(new RetrieveEntityRequest{LogicalName="mss_activitylog",EntityFilters=EntityFilters.Entity,RetrieveAsIfPublished=false})).EntityMetadata;Require(table!=null&&table.LogicalName=="mss_activitylog"&&table.TableType=="Standard","History guard registration requires verified Standard table metadata; elastic/unknown table types are refused.");
  var local=typeof(Oiac.Engage.SiteActivityLog.SiteActivityLogNativeProvenancePlugin).Assembly;string token=BitConverter.ToString(local.GetName().GetPublicKeyToken()).Replace("-","").ToLowerInvariant();string expected=Hash(File.ReadAllBytes(local.Location));
  var a=s.Retrieve("pluginassembly",assembly,new ColumnSet("name","version","publickeytoken","isolationmode","sourcetype","content"));
  Require(a.Id==assembly&&a.GetAttributeValue<string>("name")==local.GetName().Name&&a.GetAttributeValue<string>("version")==local.GetName().Version.ToString()&&a.GetAttributeValue<string>("publickeytoken")==token&&Choice(a,"isolationmode")==2&&Choice(a,"sourcetype")==0,"Native history requires the exact signed sandbox/database assembly identity.");
  string content=a.GetAttributeValue<string>("content");Require(!string.IsNullOrEmpty(content)&&Hash(Convert.FromBase64String(content))==expected,"Deploy the exact locally reviewed native history DLL before registration or activation.");return expected;
 }
 static int Choice(Entity e,string name){var v=e.GetAttributeValue<OptionSetValue>(name);return v==null?-1:v.Value;}
 static Guid Reference(Entity e,string name){var v=e.GetAttributeValue<EntityReference>(name);return v==null?Guid.Empty:v.Id;}
 static Entity Find(IOrganizationService s,string table,string field,object value,params string[] columns){var q=new QueryExpression(table){ColumnSet=new ColumnSet(columns),TopCount=2};q.Criteria.AddCondition(field,ConditionOperator.Equal,value);var rows=s.RetrieveMultiple(q).Entities;Require(rows.Count<=1,"Ambiguous native history component: "+table);return rows.SingleOrDefault();}
 static List<StepPlan> Specifications(){var steps=new List<StepPlan>();foreach(string message in new[]{"Update","Delete"})steps.Add(new StepPlan{Name="OIAC History mss_activitylog "+message,Table="mss_activitylog",Message=message,Stage=10,Mode=0,TypeName=Guard,IsGuard=true});
  foreach(string table in new[]{"mss_activitypost","mss_activitycomment","mss_appointment"})foreach(string message in new[]{"Create","Update","Delete"}){
   if(table=="mss_activitycomment"&&message=="Update")continue;string fields=table=="mss_appointment"?"mss_appointmentstatus,mss_appointmenttitle":table=="mss_activitypost"?"mss_ispinned":"mss_parentcomment";
   steps.Add(new StepPlan{Name="OIAC History Native Stamp "+table+" "+message,Table=table,Message=message,Stage=20,Mode=0,TypeName=Stamp,Fields=message=="Update"?fields:null});
   var capture=new StepPlan{Name="OIAC History "+table+" "+message,Table=table,Message=message,Stage=40,Mode=1,TypeName=Capture,Fields=fields,Configuration="deletedAction=866530017"};
   if(message!="Create")capture.Images.Add(new ImagePlan{Alias="PreImage",Kind=0,Fields=fields,Property="Target"});if(message!="Delete")capture.Images.Add(new ImagePlan{Alias="PostImage",Kind=1,Fields=fields,Property=message=="Create"?"Id":"Target"});steps.Add(capture);
  }return steps;
 }
 static Journal Preflight(IOrganizationService s,Guid assembly,bool activation){string hash=Verify(s,assembly);var types=new List<TypePlan>();foreach(string name in new[]{Stamp,Capture,Guard}){var found=Find(s,"plugintype","typename",name,"typename","pluginassemblyid");if(found!=null)Require(Reference(found,"pluginassemblyid")==assembly&&found.GetAttributeValue<string>("typename")==name,"Native history plug-in type assembly differs.");Require(!activation||found!=null,"Configure disabled native types before activation.");types.Add(new TypePlan{Name=name,Id=found==null?Guid.NewGuid():found.Id,Create=found==null});}
  var specs=Specifications();foreach(var spec in specs){spec.TypeId=types.Single(t=>t.Name==spec.TypeName).Id;var message=Find(s,"sdkmessage","name",spec.Message,"sdkmessageid");Require(message!=null,"Native history SDK message missing.");spec.MessageId=message.Id;var fq=new QueryExpression("sdkmessagefilter"){ColumnSet=new ColumnSet(false),TopCount=2};fq.Criteria.AddCondition("sdkmessageid",ConditionOperator.Equal,message.Id);fq.Criteria.AddCondition("primaryobjecttypecode",ConditionOperator.Equal,spec.Table);var filters=s.RetrieveMultiple(fq).Entities;Require(filters.Count==1,"Native history SDK table/message filter missing or ambiguous: "+spec.Table+"/"+spec.Message);spec.FilterId=filters[0].Id;
   var existing=Find(s,"sdkmessageprocessingstep","name",spec.Name,StepColumns);Require(!activation||existing!=null,"Configure every disabled native step before activation.");spec.Id=existing==null?Guid.NewGuid():existing.Id;spec.Create=existing==null;spec.PriorState=existing==null?1:Choice(existing,"statecode");
   if(existing!=null){string filtering=spec.Message=="Update"?spec.Fields:null;Require(Reference(existing,"eventhandler")==spec.TypeId&&Reference(existing,"sdkmessageid")==spec.MessageId&&Reference(existing,"sdkmessagefilterid")==spec.FilterId&&Choice(existing,"stage")==spec.Stage&&Choice(existing,"mode")==spec.Mode&&existing.GetAttributeValue<int>("rank")==1&&Choice(existing,"supporteddeployment")==0&&!existing.GetAttributeValue<bool>("asyncautodelete")&&Reference(existing,"impersonatinguserid")==Guid.Empty&&Reference(existing,"sdkmessageprocessingstepsecureconfigid")==Guid.Empty&&(existing.GetAttributeValue<string>("configuration")??"")==(spec.Configuration??"")&&(existing.GetAttributeValue<string>("filteringattributes")??"")==(filtering??""),"Existing native history metadata differs: "+spec.Name);
    Require((spec.PriorState==1&&Choice(existing,"statuscode")==2)||(activation&&!spec.IsGuard&&spec.PriorState==0&&Choice(existing,"statuscode")==1),"Native history configuration is disabled-only; guards must remain disabled: "+spec.Name);
   }
   var iq=new QueryExpression("sdkmessageprocessingstepimage"){ColumnSet=new ColumnSet("name","entityalias","imagetype","attributes","messagepropertyname","sdkmessageprocessingstepid","relatedattributename")};iq.Criteria.AddCondition("sdkmessageprocessingstepid",ConditionOperator.Equal,spec.Id);var images=s.RetrieveMultiple(iq).Entities;
   Require(images.Count<=spec.Images.Count&&images.Select(i=>i.GetAttributeValue<string>("name")).Distinct().Count()==images.Count,"Unexpected/duplicate image on native history step: "+spec.Name);
   foreach(var image in images){var planned=spec.Images.SingleOrDefault(i=>i.Alias==image.GetAttributeValue<string>("name"));Require(planned!=null&&image.GetAttributeValue<string>("entityalias")==planned.Alias&&Choice(image,"imagetype")==planned.Kind&&image.GetAttributeValue<string>("attributes")==planned.Fields&&image.GetAttributeValue<string>("messagepropertyname")==planned.Property&&Reference(image,"sdkmessageprocessingstepid")==spec.Id&&string.IsNullOrEmpty(image.GetAttributeValue<string>("relatedattributename")),"Native history image ownership/metadata differs: "+spec.Name);planned.Id=image.Id;}
   foreach(var image in spec.Images){image.Create=image.Id==Guid.Empty;if(image.Create)image.Id=Guid.NewGuid();Require(!activation||!image.Create,"Native history images incomplete; activation refused.");}
  }
  // No extra/unreviewed step may reuse one of these runtime handlers.
  foreach(var type in types.Where(t=>!t.Create)){var q=new QueryExpression("sdkmessageprocessingstep"){ColumnSet=new ColumnSet(false)};q.Criteria.AddCondition("eventhandler",ConditionOperator.Equal,type.Id);var actual=s.RetrieveMultiple(q).Entities;Require(actual.All(row=>specs.Any(plan=>!plan.Create&&plan.Id==row.Id&&plan.TypeId==type.Id)),"Unexpected native history registration uses a protected handler.");}
  return new Journal{OrganizationId=Organization,AssemblyId=assembly,RuntimeSha256=hash,Operation=activation?"activate-native-only":"configure-disabled-native",Types=types,Steps=specs};
 }
 public static void InspectNativeFilters(IOrganizationService service){Require(((WhoAmIResponse)service.Execute(new WhoAmIRequest())).OrganizationId==Organization,"Metadata inspection requires exact OIAC UAT.");foreach(string name in new[]{"Create","Update","Delete","Upsert"}){var message=Find(service,"sdkmessage","name",name,"name");Require(message!=null,"SDK message missing: "+name);var q=new QueryExpression("sdkmessagefilter"){ColumnSet=new ColumnSet("primaryobjecttypecode","secondaryobjecttypecode","isvisible","iscustomprocessingstepallowed"),PageInfo=new PagingInfo{Count=5000,PageNumber=1}};q.Criteria.AddCondition("sdkmessageid",ConditionOperator.Equal,message.Id);var filters=service.RetrieveMultiple(q);Console.WriteLine("SDKMESSAGE "+name+" id="+message.Id+" filters="+filters.Entities.Count+" more="+filters.MoreRecords);foreach(var filter in filters.Entities){string table=filter.GetAttributeValue<string>("primaryobjecttypecode");if(string.IsNullOrEmpty(table)||new[]{"mss_activitylog","mss_activitypost","mss_activitycomment","mss_appointment"}.Contains(table))Console.WriteLine("SDKFILTER "+name+" id="+filter.Id+" primary="+(table??"null")+" visible="+filter.GetAttributeValue<bool>("isvisible")+" customAllowed="+filter.GetAttributeValue<bool>("iscustomprocessingstepallowed"));}}}
 static void SaveJournal(string path,Journal journal){if(path==null)return;Require(!string.IsNullOrWhiteSpace(path)&&!File.Exists(path),"Use a fresh native registration/activation journal path.");using(var file=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None))using(var writer=new StreamWriter(file))writer.Write(JsonConvert.SerializeObject(journal,Formatting.Indented));}
 public static void Apply(IOrganizationService service,Guid assembly,bool enableCapture,bool hostedProvenanceProofAccepted,string journalPath=null){
  Require(!enableCapture&&!hostedProvenanceProofAccepted,"Configuration creates disabled steps only; use explicit reviewed native activation.");var plan=Preflight(service,assembly,false);SaveJournal(journalPath,plan);
  foreach(var type in plan.Types.Where(t=>t.Create)){var row=new Entity("plugintype",type.Id);row["typename"]=type.Name;row["name"]=type.Name;row["friendlyname"]=type.Name;row["pluginassemblyid"]=new EntityReference("pluginassembly",assembly);Require(service.Create(row)==type.Id,"Unexpected native type identity.");}
  foreach(var step in plan.Steps){if(step.Create){var row=new Entity("sdkmessageprocessingstep",step.Id);row["name"]=step.Name;row["eventhandler"]=new EntityReference("plugintype",step.TypeId);row["sdkmessageid"]=new EntityReference("sdkmessage",step.MessageId);row["sdkmessagefilterid"]=new EntityReference("sdkmessagefilter",step.FilterId);row["stage"]=new OptionSetValue(step.Stage);row["mode"]=new OptionSetValue(step.Mode);row["rank"]=1;row["supporteddeployment"]=new OptionSetValue(0);row["asyncautodelete"]=false;if(step.Configuration!=null)row["configuration"]=step.Configuration;if(step.Message=="Update"&&step.Fields!=null)row["filteringattributes"]=step.Fields;Require(CreateDisabledStep(service,row)==step.Id,"Unexpected native step identity.");}
   foreach(var image in step.Images.Where(i=>i.Create)){var row=new Entity("sdkmessageprocessingstepimage",image.Id);row["name"]=image.Alias;row["entityalias"]=image.Alias;row["imagetype"]=new OptionSetValue(image.Kind);row["messagepropertyname"]=image.Property;row["attributes"]=image.Fields;row["sdkmessageprocessingstepid"]=new EntityReference("sdkmessageprocessingstep",step.Id);Require(service.Create(row)==image.Id,"Unexpected native image identity.");}
  }
  Console.WriteLine("Native history metadata preflight passed; configured eight disabled stamps, eight disabled async observers and two disabled guards. Existing components were not overwritten.");
 }
 public static Guid CreateDisabledStep(IOrganizationService service,Entity step){
  Require(step!=null&&step.LogicalName=="sdkmessageprocessingstep","Only new SDK steps can use atomic disabled creation.");if(step.Id==Guid.Empty)step.Id=Guid.NewGuid();
  // Dataverse step Create defaults to Enabled and ignores requested statecode.
  // Commit the new registration only if SetState(Disabled) succeeds in the SAME
  // database transaction; never expose a briefly enabled capture registration.
  step.Attributes.Remove("statecode");step.Attributes.Remove("statuscode");
  var request=new ExecuteTransactionRequest{Requests=new OrganizationRequestCollection{new CreateRequest{Target=step},new SetStateRequest{EntityMoniker=new EntityReference("sdkmessageprocessingstep",step.Id),State=new OptionSetValue(1),Status=new OptionSetValue(2)}},ReturnResponses=true};
  var response=(ExecuteTransactionResponse)service.Execute(request);object created;Require(response.Responses!=null&&response.Responses.Count==2&&response.Responses[0].Results.TryGetValue("id",out created)&&created is Guid&&(Guid)created==step.Id,"Unexpected atomic disabled-step response.");return step.Id;
 }
 public static void ActivateNativeCapture(IOrganizationService service,Guid assembly,string journalPath){Require(!string.IsNullOrWhiteSpace(journalPath),"A fresh scoped native activation journal is required.");var plan=Preflight(service,assembly,true);SaveJournal(journalPath,plan);
  // Full component/image/ownership verification above precedes the first state change.
  // A failed metadata change stops here; journal supports explicit reviewed recovery.
  foreach(var step in plan.Steps.Where(s=>!s.IsGuard&&s.PriorState==1).OrderBy(s=>s.Mode))service.Execute(new SetStateRequest{EntityMoniker=new EntityReference("sdkmessageprocessingstep",step.Id),State=new OptionSetValue(0),Status=new OptionSetValue(1)});
  Console.WriteLine("Activated only the sixteen verified native stamp/async steps. Two history guards remain disabled; legacy observers were untouched.");
 }
}




