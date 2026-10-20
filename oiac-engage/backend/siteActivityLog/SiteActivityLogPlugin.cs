using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization.Json;
using System.Security.Cryptography;
using System.ServiceModel;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
[assembly:System.Reflection.AssemblyVersion("1.0.0.0")]
[assembly:System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.6.2")]
namespace Oiac.Engage.SiteActivityLog {
 public sealed class SiteActivityLogReadPlugin:IPlugin {
  public void Execute(IServiceProvider p){var c=(IPluginExecutionContext)p.GetService(typeof(IPluginExecutionContext));if(c.MessageName!="mss_SiteActivityLogRead")throw new InvalidPluginExecutionException("Unsupported message.");object a,cmd,body;c.InputParameters.TryGetValue("ActorContactId",out a);c.InputParameters.TryGetValue("Command",out cmd);c.InputParameters.TryGetValue("Payload",out body);var f=(IOrganizationServiceFactory)p.GetService(typeof(IOrganizationServiceFactory));c.OutputParameters["Result"]=Run(f.CreateOrganizationService(c.UserId),a is Guid?(Guid)a:Guid.Empty,cmd as string,body as string);}
  public static string Run(IOrganizationService s,Guid actor,string command,string payload){try{
   if(actor==Guid.Empty)throw new Problem("unauthenticated");if(!Eligible(s,actor))throw new Problem("forbidden");
   var p=Codec.Parse(payload);bool admin=Admin(s,actor);object scope;if(!p.TryGetValue("scope",out scope)||!(scope is string)||((string)scope!="mine"&&(string)scope!="all"))throw new Problem("validation");if((string)scope=="all"&&!admin)throw new Problem("forbidden");
   var q=new QueryExpression("mss_activitylog"){ColumnSet=new ColumnSet("mss_actorname","mss_action","mss_module","mss_recordtype","mss_recordid","mss_recordtitle","mss_occurredon","mss_summary"),PageInfo=new PagingInfo{Count=25,PageNumber=1}};
   q.Criteria.AddCondition("mss_siteid",ConditionOperator.Equal,Site.ToString("D"));if((string)scope=="mine")q.Criteria.AddCondition("mss_performedby",ConditionOperator.Equal,actor);
   if(command=="detail"){
    Codec.Keys(p,"id","scope");Guid id;if(!(p["id"] is string)||!Guid.TryParseExact((string)p["id"],"D",out id)||id==Guid.Empty)throw new Problem("validation");q.Criteria.AddCondition("mss_activitylogid",ConditionOperator.Equal,id);q.ColumnSet.AddColumn("mss_detailsjson");q.TopCount=1;q.PageInfo=null;var row=s.RetrieveMultiple(q).Entities.FirstOrDefault();if(row==null)throw new Problem("not_found");var dto=Dto(row);dto["details"]=Codec.SafeDetails(row.GetAttributeValue<string>("mss_detailsjson"));return Codec.Json(Codec.D("ok",true,"entry",dto));
   }
   if(command!="list"&&command!="count")throw new Problem("validation");Codec.Keys(p,"scope","page","module","action","from","to");int page=Codec.Number(p["page"],1,2500);q.PageInfo.PageNumber=page;
   foreach(string k in new[]{"module","action"})if(p[k]!=null)q.Criteria.AddCondition("mss_"+k,ConditionOperator.Equal,Codec.Number(p[k],866530000,k=="module"?866530007:866530017));
   DateTime? from=Date(p["from"]),to=Date(p["to"]);if(from.HasValue&&to.HasValue&&from>=to)throw new Problem("validation");if(from.HasValue)q.Criteria.AddCondition("mss_occurredon",ConditionOperator.GreaterEqual,from.Value);if(to.HasValue)q.Criteria.AddCondition("mss_occurredon",ConditionOperator.LessThan,to.Value);
   q.AddOrder("mss_occurredon",OrderType.Descending);q.AddOrder("mss_activitylogid",OrderType.Descending);
   // Count runs as a separate custom API invocation. A Dataverse count fault must
   // never poison the transaction that produced the list.
   if(command=="count"){q.ColumnSet=new ColumnSet(false);q.PageInfo=new PagingInfo{Count=1,PageNumber=1,ReturnTotalRecordCount=true};var count=s.RetrieveMultiple(q);return Codec.Json(Codec.D("ok",true,"totalCount",count.TotalRecordCountLimitExceeded||count.TotalRecordCount<0?null:(object)count.TotalRecordCount));}
   var rows=s.RetrieveMultiple(q);if(rows.MoreRecords&&page==2500)throw new Problem("unavailable");return Codec.Json(Codec.D("ok",true,"entries",rows.Entities.Select(e=>(object)Dto(e)).ToArray(),"nextPage",rows.MoreRecords?(object)(page+1):null,"totalCount",null,"canViewAll",admin));
  }catch(Problem e){return Codec.Json(Codec.D("ok",false,"error",Codec.D("code",e.Code)));}catch{return Codec.Json(Codec.D("ok",false,"error",Codec.D("code","unavailable")));}}
  static DateTime? Date(object v){if(v==null)return null;DateTimeOffset d;if(!(v is string)||!Regex.IsMatch((string)v,@"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|[+-]\d\d:\d\d)$")||!DateTimeOffset.TryParse((string)v,CultureInfo.InvariantCulture,DateTimeStyles.None,out d)||d.Year<1753)throw new Problem("validation");return d.UtcDateTime;}
  static Dictionary<string,object> Dto(Entity e){return Codec.D("id",e.Id.ToString("D"),"actorName",e.GetAttributeValue<string>("mss_actorname")??"","action",Choice(e,"mss_action"),"module",Choice(e,"mss_module"),"recordType",e.GetAttributeValue<string>("mss_recordtype")??"","recordId",e.GetAttributeValue<string>("mss_recordid")??"","recordTitle",e.GetAttributeValue<string>("mss_recordtitle")??"","occurredOn",DateTime.SpecifyKind(e.GetAttributeValue<DateTime>("mss_occurredon"),DateTimeKind.Utc).ToString("o",CultureInfo.InvariantCulture),"summary",e.GetAttributeValue<string>("mss_summary")??"");}
  static int Choice(Entity e,string k){var v=e.GetAttributeValue<OptionSetValue>(k);return v==null?0:v.Value;}
  static bool Eligible(IOrganizationService s,Guid actor){var c=s.Retrieve("contact",actor,new ColumnSet("statecode","adx_identity_logonenabled","adx_identity_username"));var state=c.GetAttributeValue<OptionSetValue>("statecode");if(state==null||state.Value!=0||!c.GetAttributeValue<bool>("adx_identity_logonenabled"))return false;if(!string.IsNullOrWhiteSpace(c.GetAttributeValue<string>("adx_identity_username")))return true;var q=new QueryExpression("adx_externalidentity"){ColumnSet=new ColumnSet(false),TopCount=1};q.Criteria.AddCondition("adx_contactid",ConditionOperator.Equal,actor);return s.RetrieveMultiple(q).Entities.Count>0;}
  static bool Admin(IOrganizationService s,Guid actor){var q=new QueryExpression("contact"){ColumnSet=new ColumnSet(false),TopCount=1};q.Criteria.AddCondition("contactid",ConditionOperator.Equal,actor);var i=q.AddLink("powerpagecomponent_mspp_webrole_contact","contactid","contactid");var r=i.AddLink("powerpagecomponent","powerpagecomponentid","powerpagecomponentid");r.LinkCriteria.AddCondition("powerpagecomponentid",ConditionOperator.Equal,new Guid("6ec72c3e-4f1b-420f-9565-d20047b12c1f"));r.LinkCriteria.AddCondition("powerpagesiteid",ConditionOperator.Equal,Site);return s.RetrieveMultiple(q).Entities.Count>0;}
  public static readonly Guid Site=new Guid("e7f400bd-1e04-4efa-b8b3-7a7a3b168662");
 }
 internal sealed class Problem:Exception{internal string Code;internal Problem(string c){Code=c;}}
 internal static class Codec {
  internal static Dictionary<string,object> D(params object[] a){var d=new Dictionary<string,object>();for(int i=0;i<a.Length;i+=2)d.Add((string)a[i],a[i+1]);return d;}
  internal static string Json(object o){if(o==null)return "null";var d=o as Dictionary<string,object>;if(d!=null)return "{"+string.Join(",",d.Select(x=>Json(x.Key)+":"+Json(x.Value)))+"}";var a=o as object[];if(a!=null)return "["+string.Join(",",a.Select(Json))+"]";if(o is bool)return (bool)o?"true":"false";if(o is int||o is decimal||o is long)return Convert.ToString(o,CultureInfo.InvariantCulture);using(var m=new MemoryStream()){new DataContractJsonSerializer(typeof(string)).WriteObject(m,(string)o);return Encoding.UTF8.GetString(m.ToArray());}}
  internal static Dictionary<string,object> Parse(string text){try{if(text==null||text.Length>4000)throw new Problem("validation");using(var r=JsonReaderWriterFactory.CreateJsonReader(Encoding.UTF8.GetBytes(text),new XmlDictionaryReaderQuotas{MaxDepth=5,MaxStringContentLength=4000,MaxArrayLength=20})){var p=Read(XElement.Load(r)) as Dictionary<string,object>;if(p==null)throw new Problem("validation");return p;}}catch{throw new Problem("validation");}}
  static object Read(XElement n){string t=(string)n.Attribute("type");if(t=="object"){var d=new Dictionary<string,object>();foreach(var e in n.Elements())d.Add((string)e.Attribute("item")??e.Name.LocalName,Read(e));return d;}if(t=="string")return n.Value;if(t=="number")return decimal.Parse(n.Value,CultureInfo.InvariantCulture);if(t=="boolean")return n.Value=="true";if(t=="null")return null;throw new Problem("validation");}
  internal static void Keys(Dictionary<string,object> d,params string[] names){if(d.Count!=names.Length||d.Keys.Any(k=>!names.Contains(k)))throw new Problem("validation");}
  internal static int Number(object o,int min,int max){if(!(o is decimal)||(decimal)o<min||(decimal)o>max||(decimal)o!=decimal.Truncate((decimal)o))throw new Problem("validation");return (int)(decimal)o;}
  internal static Dictionary<string,object> SafeDetails(string json){try{var d=Parse(json);var allowed=new[]{"schemaVersion","operation","confirmed","pinned","parentId","previousStatus","status","fileSize","fileKind","replaced"};if(d.Keys.Any(k=>!allowed.Contains(k))||d.Count>11)return D();if(d.Values.Any(v=>v!=null&&!(v is string)&&!(v is decimal)&&!(v is bool)))return D();if(d.Values.OfType<string>().Any(v=>v.Length>100))return D();if(d.ContainsKey("fileSize"))Number(d["fileSize"],1,10485760);if(d.ContainsKey("fileKind")&&(!(d["fileKind"] is string)||!new[]{"logo","attachment"}.Contains((string)d["fileKind"])))return D();if(d.ContainsKey("replaced")&&!(d["replaced"] is bool))return D();return d;}catch{return D();}}
 }
 public static class SiteActivityLogWriter {
  internal static string Hash(string value){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant();}
  internal static void Append(IOrganizationService s,Entity e){
   if(e==null||e.LogicalName!="mss_activitylog")throw new InvalidPluginExecutionException("Invalid history event.");
   foreach(var field in new[]{"mss_actorname","mss_actoridsnapshot","mss_recordid","mss_siteid","mss_recordtype","mss_recordtitle","mss_correlationid"}){var text=e.GetAttributeValue<string>(field);if(text!=null&&text.Length>100)throw new InvalidPluginExecutionException("History snapshot exceeds capacity.");}
   var details=e.GetAttributeValue<string>("mss_detailsjson");if(details==null||details.Length>4000||Codec.SafeDetails(details).Count==0)throw new InvalidPluginExecutionException("Invalid history details.");
   var performer=e.GetAttributeValue<EntityReference>("mss_performedby");if(performer==null||performer.LogicalName!="contact"||performer.Id==Guid.Empty||e.GetAttributeValue<string>("mss_actoridsnapshot")!=performer.Id.ToString("D")||e.GetAttributeValue<string>("mss_siteid")!=SiteActivityLogReadPlugin.Site.ToString("D"))throw new InvalidPluginExecutionException("Invalid history identity.");
   var key=e.GetAttributeValue<string>("mss_eventkey");if(key==null||!Regex.IsMatch(key,"^[0-9a-f]{64}$"))throw new InvalidPluginExecutionException("Invalid event key.");var q=new QueryExpression("mss_activitylog"){ColumnSet=new ColumnSet(false),TopCount=1};q.Criteria.AddCondition("mss_eventkey",ConditionOperator.Equal,key);if(s.RetrieveMultiple(q).Entities.Count>0)return;
   e.Id=new Guid(Enumerable.Range(0,16).Select(i=>byte.Parse(key.Substring(i*2,2),NumberStyles.HexNumber,CultureInfo.InvariantCulture)).ToArray());
   // No Upsert and no duplicate update. A racing Create faults, then the async
   // retry sees the winning row. No further SDK call occurs after the fault.
   s.Create(e);
  }
 }
 public sealed class SiteActivityLogGuardPlugin:IPlugin {
  public SiteActivityLogGuardPlugin(){}
  public SiteActivityLogGuardPlugin(string configuration){}
  public SiteActivityLogGuardPlugin(string configuration,string secureConfiguration){}
  public void Execute(IServiceProvider provider){
   var c=(IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
   if(c.PrimaryEntityName!="mss_activitylog"||!(c.MessageName=="Update"||c.MessageName=="Delete"||c.MessageName=="Upsert"))return;
   if(c.MessageName=="Update"&&RelationshipCleanup(provider,c))return;
   throw new InvalidPluginExecutionException("Activity history is append-only.");
  }
  static bool RelationshipCleanup(IServiceProvider provider,IPluginExecutionContext c){
   // The optional live Contact relationship may be maintained by the platform.
   // Saved actor ID/name and every other history field remain immutable.
   try{
    var parent=c.ParentContext;
    if(c.Depth<=1||parent==null||parent.PrimaryEntityName!="contact"||c.OrganizationId==Guid.Empty||c.CorrelationId==Guid.Empty||parent.OrganizationId!=c.OrganizationId||parent.CorrelationId!=c.CorrelationId)return false;
    object raw;if(!c.InputParameters.TryGetValue("Target",out raw))return false;var target=raw as Entity;
    if(target==null||target.LogicalName!="mss_activitylog"||target.Id==Guid.Empty||target.Id!=c.PrimaryEntityId||target.Attributes.Count!=1||!target.Contains("mss_performedby"))return false;
    object parentRaw;if(!parent.InputParameters.TryGetValue("Target",out parentRaw))return false;var contact=parentRaw as EntityReference;
    if(contact==null||contact.LogicalName!="contact"||contact.Id==Guid.Empty)return false;
    Guid expectedOriginal;
    if(parent.MessageName=="Delete"){
     if(target["mss_performedby"]!=null)return false;expectedOriginal=contact.Id;
    }else if(parent.MessageName=="Merge"){
     object subordinate;if(!parent.InputParameters.TryGetValue("SubordinateId",out subordinate)||!(subordinate is Guid)||(Guid)subordinate==Guid.Empty||(Guid)subordinate==contact.Id)return false;
     var replacement=target["mss_performedby"] as EntityReference;
     if(replacement==null||replacement.LogicalName!="contact"||replacement.Id!=contact.Id)return false;expectedOriginal=(Guid)subordinate;
    }else return false;
    var factory=(IOrganizationServiceFactory)provider.GetService(typeof(IOrganizationServiceFactory));
    var original=factory.CreateOrganizationService(c.UserId).Retrieve("mss_activitylog",target.Id,new ColumnSet("mss_performedby"));
    var performer=original.GetAttributeValue<EntityReference>("mss_performedby");
    return performer!=null&&performer.LogicalName=="contact"&&performer.Id==expectedOriginal;
   }catch{return false;}
  }
 }
 public sealed class SiteActivityLogCapturePlugin:IPlugin {
  readonly int? deleted=866530017;public SiteActivityLogCapturePlugin(){}public SiteActivityLogCapturePlugin(string configuration){if(!string.IsNullOrEmpty(configuration)&&configuration!="deletedAction=866530017")throw new InvalidPluginExecutionException("Invalid history capture configuration.");}
  public SiteActivityLogCapturePlugin(string configuration,string secureConfiguration):this(configuration){if(!string.IsNullOrEmpty(secureConfiguration))throw new InvalidPluginExecutionException("Unexpected secure history configuration.");}
  public void Execute(IServiceProvider p){var c=(IPluginExecutionContext)p.GetService(typeof(IPluginExecutionContext));if(c.Stage!=40||c.Mode!=1)throw new InvalidPluginExecutionException("History capture requires asynchronous PostOperation.");Guid actor;string command;if(!Trusted(c,out actor,out command))return;
   var pre=c.PreEntityImages.Contains("PreImage")?c.PreEntityImages["PreImage"]:null;var post=c.PostEntityImages.Contains("PostImage")?c.PostEntityImages["PostImage"]:null;
   try{if((c.MessageName=="Create"&&post==null)||(c.MessageName=="Update"&&(pre==null||post==null))||(c.MessageName=="Delete"&&pre==null))throw new InvalidPluginExecutionException("Required capture images missing.");if(c.OperationId==Guid.Empty||c.CorrelationId==Guid.Empty||c.OperationCreatedOn.Year<1753)throw new InvalidPluginExecutionException("Missing durable operation identity.");var e=Build(c.PrimaryEntityName,c.PrimaryEntityId,c.MessageName,command,actor,post,pre,c.OperationId,c.OperationCreatedOn,deleted);if(e==null)return;var f=(IOrganizationServiceFactory)p.GetService(typeof(IOrganizationServiceFactory));var s=f.CreateOrganizationService(c.UserId);var person=s.Retrieve("contact",actor,new ColumnSet("fullname"));var name=person.GetAttributeValue<string>("fullname")??"Member";e["mss_actorname"]=name.Length<=100?name:"Member";e["mss_correlationid"]=c.CorrelationId.ToString("D");SiteActivityLogWriter.Append(s,e);
   }catch(Exception){throw new InvalidPluginExecutionException(OperationStatus.Retry,0,"Activity history capture failed. Inspect the failed System Job; retry delivery, never the business operation.");}
  }
  internal static bool Trusted(IPluginExecutionContext c,out Guid actor,out string command){actor=Guid.Empty;command=null;var receipt=SiteActivityLogNativeReceipt.Read(c);if(receipt==null)return false;actor=(Guid)receipt["actor"];command=(string)receipt["command"];return true;}
  internal static Entity Build(string table,Guid id,string message,string command,Guid actor,Entity post,Entity pre,Guid operationId,DateTime occurred,int? deletedAction){
   if(actor==Guid.Empty||id==Guid.Empty||operationId==Guid.Empty)return null;int module,action;string operation;var details=Codec.D("schemaVersion",1);
   if(table=="mss_activitypost"||table=="mss_activitycomment"){
    module=866530005;
    if(message=="Create"&&post!=null&&((table=="mss_activitypost"&&command=="post")||(table=="mss_activitycomment"&&(command=="comment"||command=="reply")))){action=table=="mss_activitypost"?866530011:866530000;operation=table=="mss_activitypost"?"PostPublished":command=="reply"?"ReplyCreated":"CommentCreated";}
    else if(table=="mss_activitypost"&&message=="Update"&&(command=="pin"||command=="unpin")&&pre!=null&&post!=null&&pre.GetAttributeValue<bool>("mss_ispinned")!=post.GetAttributeValue<bool>("mss_ispinned")&&post.GetAttributeValue<bool>("mss_ispinned")== (command=="pin")){action=866530001;operation=command=="pin"?"PinActivity":"UnpinActivity";details["pinned"]=post.GetAttributeValue<bool>("mss_ispinned");}
    else if(message=="Delete"&&command=="remove"&&pre!=null&&deletedAction.HasValue){action=deletedAction.Value;operation=table=="mss_activitypost"?"PostDeleted":"CommentDeleted";}
    else return null;
   }else if(table=="mss_appointment"){
    module=866530003;if(message=="Create"&&command=="create"&&post!=null){action=866530000;operation="AppointmentCreated";}
    else if(message=="Update"&&pre!=null&&post!=null&&Value(pre,"mss_appointmentstatus")==866530000&&((command=="accept"&&Value(post,"mss_appointmentstatus")==866530001)||(command=="reschedule"&&Value(post,"mss_appointmentstatus")==866530003))){action=command=="accept"?866530006:866530010;operation=command=="accept"?"AppointmentAccepted":"RescheduleRequested";details["previousStatus"]=Value(pre,"mss_appointmentstatus");details["status"]=Value(post,"mss_appointmentstatus");if(command=="reschedule")details["confirmed"]=false;}else return null;
   }else return null;
   details["operation"]=operation;string json=Codec.Json(details);if(json.Length>4000)throw new InvalidPluginExecutionException("History snapshot exceeds capacity.");string title=module==866530003?"Appointment":table=="mss_activitypost"?"Activity post":"Activity comment";
   var snapshot=post??pre;var sourceTitle=module==866530003&&snapshot!=null?snapshot.GetAttributeValue<string>("mss_appointmenttitle"):null;if(!string.IsNullOrWhiteSpace(sourceTitle)&&sourceTitle.Length<=100&&!sourceTitle.Any(char.IsControl))title=sourceTitle;
   string summary=operation=="RescheduleRequested"?"Requested an alternative appointment time; proposal is unconfirmed.":operation=="AppointmentCreated"?"Created an appointment request.":operation=="AppointmentAccepted"?"Accepted an appointment request.":operation=="PostPublished"?"Published an activity post.":operation=="CommentCreated"?"Added a comment.":operation=="ReplyCreated"?"Replied to a comment.":operation=="PinActivity"?"Pinned an activity post.":operation=="UnpinActivity"?"Unpinned an activity post.":operation=="PostDeleted"?"Deleted an activity post.":"Deleted a comment.";
   string key=SiteActivityLogWriter.Hash(SiteActivityLogReadPlugin.Site.ToString("D")+"|"+actor.ToString("D")+"|"+operationId.ToString("D")+"|"+table+"|"+id.ToString("D")+"|"+operation);
   var e=new Entity("mss_activitylog");e["mss_name"]=operation+" "+id.ToString("D");e["mss_performedby"]=new EntityReference("contact",actor);e["mss_actoridsnapshot"]=actor.ToString("D");e["mss_siteid"]=SiteActivityLogReadPlugin.Site.ToString("D");e["mss_recordtype"]=table;e["mss_recordid"]=id.ToString("D");e["mss_recordtitle"]=title;e["mss_summary"]=summary;e["mss_detailsjson"]=json;e["mss_module"]=new OptionSetValue(module);e["mss_action"]=new OptionSetValue(action);e["mss_occurredon"]=DateTime.SpecifyKind(occurred,DateTimeKind.Utc);e["mss_eventkey"]=key;return e;
  }
  static int Value(Entity e,string k){var v=e.GetAttributeValue<OptionSetValue>(k);return v==null?-1:v.Value;}
 }
}
public static class SiteActivityLogPortalActor {
 public static bool TryResolve(Microsoft.Xrm.Sdk.IPluginExecutionContext context,System.Guid integrationUser,System.Guid organization,out System.Guid actor){
  actor=System.Guid.Empty;var portal=context as Microsoft.Xrm.Sdk.IPluginExecutionContext2;
  if(portal==null||!portal.IsPortalsClientCall||portal.PortalsContactId==System.Guid.Empty||integrationUser==System.Guid.Empty||organization==System.Guid.Empty||context.InitiatingUserId!=integrationUser||context.OrganizationId!=organization||context.Depth!=1)return false;
  if(context.ParentContext!=null&&!SelfCrudWrappers(context))return false;
  actor=portal.PortalsContactId;return true;
 }
 static bool SelfCrudWrappers(Microsoft.Xrm.Sdk.IPluginExecutionContext source){
  if(source.Stage!=40||source.Mode!=1||source.PrimaryEntityId==System.Guid.Empty||source.UserId==System.Guid.Empty||source.CorrelationId==System.Guid.Empty||string.IsNullOrEmpty(source.PrimaryEntityName)||(source.MessageName!="Create"&&source.MessageName!="Update"&&source.MessageName!="Delete"))return false;
  var seen=new System.Collections.Generic.List<Microsoft.Xrm.Sdk.IPluginExecutionContext>();var parent=source.ParentContext;
  while(parent!=null&&seen.Count<8){
   if(seen.Any(previous=>object.ReferenceEquals(previous,parent))||parent.Stage!=30||parent.Mode!=1||parent.Depth!=1||parent.MessageName!=source.MessageName||parent.OrganizationId!=source.OrganizationId||parent.UserId!=source.UserId||parent.InitiatingUserId!=source.InitiatingUserId||parent.CorrelationId!=source.CorrelationId)return false;
   // Power Pages appends a terminal transport envelope (table "none") after
   // the exact-row CRUD wrapper. Its own SDK portal identity must still match.
   if(parent.PrimaryEntityName=="none"){var envelope=parent as Microsoft.Xrm.Sdk.IPluginExecutionContext2;var portal=source as Microsoft.Xrm.Sdk.IPluginExecutionContext2;return seen.Count>0&&parent.ParentContext==null&&(parent.PrimaryEntityId==System.Guid.Empty||parent.PrimaryEntityId==source.PrimaryEntityId)&&envelope!=null&&envelope.IsPortalsClientCall&&portal!=null&&envelope.PortalsContactId==portal.PortalsContactId;}
   if(parent.PrimaryEntityName!=source.PrimaryEntityName||parent.PrimaryEntityId!=source.PrimaryEntityId)return false;
   seen.Add(parent);parent=parent.ParentContext;
  }return parent==null;
 }
}








