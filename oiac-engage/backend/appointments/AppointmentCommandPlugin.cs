using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization.Json;
using System.ServiceModel;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.6.2")]
namespace Oiac.Engage.Appointments {
 public sealed class AppointmentCommandPlugin : IPlugin {
  const string Table="mss_appointment", Requester="mss_requester", Recipient="mss_contact", Status="mss_appointmentstatus", Format="mss_meetingformat", Preferred="mss_preferreddate";
  const int Pending=866530000, Accepted=866530001, Rescheduled=866530003;
  static readonly Guid AdminRole=new Guid("6ec72c3e-4f1b-420f-9565-d20047b12c1f"), Site=new Guid("e7f400bd-1e04-4efa-b8b3-7a7a3b168662");
  static readonly string[] Fields={"mss_appointmenttitle",Requester,Recipient,Status,Format,Preferred,"mss_suggesteddate","mss_purposeagenda","mss_reschedulingreason","mss_meetinglink","versionnumber"};
  static readonly TimeZoneInfo Eastern=TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
  sealed class Problem:Exception {public string Code; public Problem(string code){Code=code;}}
  static void Fail(string code){throw new Problem(code);}
  public void Execute(IServiceProvider provider) {
   var context=(IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
   if(context.MessageName!="mss_AppointmentCommand")throw new InvalidPluginExecutionException("Unsupported command.");
   var factory=(IOrganizationServiceFactory)provider.GetService(typeof(IOrganizationServiceFactory));
   // Never elevate to SYSTEM. API registration restricts the integration caller.
   var service=factory.CreateOrganizationService(context.UserId);
   object actor,command,payload;
   context.InputParameters.TryGetValue("ActorContactId",out actor);context.InputParameters.TryGetValue("Command",out command);context.InputParameters.TryGetValue("Payload",out payload);
   context.OutputParameters["Result"]=Run(service,actor is Guid?(Guid)actor:Guid.Empty,command as string,payload as string);
  }
  public static string Run(IOrganizationService service,Guid actor,string command,string payload) {
   try {
    if(actor==Guid.Empty)Fail("unauthenticated");
    var p=Parse(payload);if(!Eligible(service,actor))Fail("forbidden");
    if(command=="create")return Json(Create(service,actor,p));
    if(command=="accept"||command=="reschedule")return Json(Change(service,actor,command,p));
    if(command=="contacts")return Json(Contacts(service,actor,p));
    if(command=="incoming"||command=="outgoing"||command=="all"||command=="calendar")return Json(List(service,actor,command,p));
    Fail("validation");return null;
   }catch(Problem e){return Error(e.Code);}catch(FaultException<OrganizationServiceFault> e){return Error(e.Detail.ErrorCode==-2147088254?"conflict":"unavailable");}catch{return Error("unavailable");}
  }
  static string Error(string code){return Json(D("ok",false,"error",D("code",code,"message",code=="conflict"?"This appointment changed. Refresh it and try again.":code=="validation"?"Check the appointment fields and try again.":code=="unauthenticated"?"Sign in to continue.":code=="forbidden"?"You do not have permission to perform this action.":"Appointments are temporarily unavailable.")));}
  static Dictionary<string,object> D(params object[] values){var d=new Dictionary<string,object>();for(int i=0;i<values.Length;i+=2)d.Add((string)values[i],values[i+1]);return d;}
  static string Json(object value){
   if(value==null)return "null";var dictionary=value as Dictionary<string,object>;if(dictionary!=null)return "{"+string.Join(",",dictionary.Select(pair=>Json(pair.Key)+":"+Json(pair.Value)))+"}";
   var array=value as object[];if(array!=null)return "["+string.Join(",",array.Select(Json))+"]";
   if(value is bool)return (bool)value?"true":"false";if(value is int||value is long||value is decimal)return Convert.ToString(value,CultureInfo.InvariantCulture);
   using(var stream=new MemoryStream()){new DataContractJsonSerializer(typeof(string)).WriteObject(stream,(string)value);return Encoding.UTF8.GetString(stream.ToArray());}
  }
  static Dictionary<string,object> Parse(string text){
   if(text==null||text.Length>16384)Fail("validation");
   try{using(var reader=JsonReaderWriterFactory.CreateJsonReader(Encoding.UTF8.GetBytes(text),new XmlDictionaryReaderQuotas{MaxDepth=8,MaxStringContentLength=16384,MaxArrayLength=100})){var root=XElement.Load(reader);var result=Read(root) as Dictionary<string,object>;if(result==null)Fail("validation");return result;}}
   catch(Problem){throw;}catch{Fail("validation");return null;}
  }
  static object Read(XElement node){string type=(string)node.Attribute("type");if(type=="object"){var d=new Dictionary<string,object>();foreach(var child in node.Elements()){string key=(string)child.Attribute("item")??child.Name.LocalName;if(d.ContainsKey(key))Fail("validation");d.Add(key,Read(child));}return d;}if(type=="string")return node.Value;if(type=="null")return null;if(type=="number"){decimal n;if(!decimal.TryParse(node.Value,NumberStyles.Float,CultureInfo.InvariantCulture,out n))Fail("validation");return n;}if(type=="boolean")return node.Value=="true";Fail("validation");return null;}
  static void Keys(Dictionary<string,object> p,params string[] keys){if(p==null||p.Keys.Any(k=>!keys.Contains(k)))Fail("validation");}
  static object Value(Dictionary<string,object> p,string key){object v;return p.TryGetValue(key,out v)?v:null;}
  static string Text(Dictionary<string,object> p,string key,int max,bool required){object v=Value(p,key);if(!(v is string)){if(v==null&&!required)return "";Fail("validation");}string s=((string)v).Trim();if(s.Length>max||(required&&s.Length==0)||s.Any(c=>char.IsControl(c)&&c!='\n'&&c!='\r'&&c!='\t'))Fail("validation");return s;}
  static int Number(Dictionary<string,object> p,string key,int min,int max){object v=Value(p,key);if(!(v is decimal)||(decimal)v!=decimal.Truncate((decimal)v)||(decimal)v<min||(decimal)v>max)Fail("validation");return (int)(decimal)v;}
  static Guid Id(Dictionary<string,object> p,string key){Guid id;var value=Value(p,key) as string;if(value==null||!Regex.IsMatch(value,"^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$")||!Guid.TryParse(value,out id)||id==Guid.Empty){Fail("validation");return Guid.Empty;}return id;}
  static DateTime Local(Dictionary<string,object> p,string dateKey,string timeKey,string offsetKey){
   string date=Text(p,dateKey,10,true),time=Text(p,timeKey,5,true);DateTime local;
   if(!DateTime.TryParseExact(date+"T"+time,"yyyy-MM-dd'T'HH:mm",CultureInfo.InvariantCulture,DateTimeStyles.None,out local)||local.Year<1753||Eastern.IsInvalidTime(local))Fail("validation");
   local=DateTime.SpecifyKind(local,DateTimeKind.Unspecified);var offsets=Eastern.IsAmbiguousTime(local)?Eastern.GetAmbiguousTimeOffsets(local):new[]{Eastern.GetUtcOffset(local)};
   object raw=Value(p,offsetKey);TimeSpan offset;
   if(raw==null){if(offsets.Length!=1)Fail("validation");offset=offsets[0];}else{offset=TimeSpan.FromMinutes(Number(p,offsetKey,-840,840));if(!offsets.Contains(offset))Fail("validation");}
   DateTime utc;try{utc=new DateTimeOffset(local,offset).UtcDateTime;}catch{Fail("validation");return default(DateTime);}
   if(utc.Year<1753||TimeZoneInfo.ConvertTimeFromUtc(utc,Eastern)!=local)Fail("validation");return utc;
  }
  static bool Eligible(IOrganizationService service,Guid id){
   var c=service.Retrieve("contact",id,new ColumnSet("statecode","adx_identity_logonenabled","adx_identity_username"));
   if(c.GetAttributeValue<OptionSetValue>("statecode")==null||c.GetAttributeValue<OptionSetValue>("statecode").Value!=0||!c.GetAttributeValue<bool>("adx_identity_logonenabled"))return false;
   if(!string.IsNullOrWhiteSpace(c.GetAttributeValue<string>("adx_identity_username")))return true;
   var q=new QueryExpression("adx_externalidentity"){ColumnSet=new ColumnSet(false),TopCount=1};q.Criteria.AddCondition("adx_contactid",ConditionOperator.Equal,id);return service.RetrieveMultiple(q).Entities.Count>0;
  }
  static Dictionary<string,object> Create(IOrganizationService service,Guid actor,Dictionary<string,object> p){
   if(!FunctionalRole(service,actor))Fail("forbidden");
   Keys(p,"id","title","recipientId","meetingFormat","preferredDate","preferredTime","preferredOffsetMinutes","agenda");Guid id=Id(p,"id"),recipient=Id(p,"recipientId");if(recipient==actor||!Eligible(service,recipient))Fail("validation");
   var row=new Entity(Table,id);row["mss_appointmenttitle"]=Text(p,"title",850,true);row[Requester]=new EntityReference("contact",actor);row[Recipient]=new EntityReference("contact",recipient);row[Status]=new OptionSetValue(Pending);row[Format]=new OptionSetValue(Number(p,"meetingFormat",1,3));row[Preferred]=Local(p,"preferredDate","preferredTime","preferredOffsetMinutes");row["mss_purposeagenda"]=Text(p,"agenda",100,false);service.Create(row);return D("ok",true,"id",id.ToString());
  }
  static Dictionary<string,object> Change(IOrganizationService service,Guid actor,string command,Dictionary<string,object> p){
   Keys(p,"id","expectedRowVersion","payload");Guid id=Id(p,"id");string version=Text(p,"expectedRowVersion",30,true);if(!Regex.IsMatch(version,"^[1-9][0-9]*$"))Fail("validation");var fields=Value(p,"payload") as Dictionary<string,object>;
   if(command=="accept")Keys(fields,"meetingLink");else Keys(fields,"reason","suggestedDate","suggestedTime","suggestedOffsetMinutes");
   var old=service.Retrieve(Table,id,new ColumnSet(Fields));var recipient=old.GetAttributeValue<EntityReference>(Recipient);if(recipient==null||recipient.Id!=actor)Fail("forbidden");var status=old.GetAttributeValue<OptionSetValue>(Status);if(status==null||status.Value!=Pending||old.RowVersion!=version)Fail("conflict");
   var update=new Entity(Table,id){RowVersion=version};
   if(command=="accept"){
    var format=old.GetAttributeValue<OptionSetValue>(Format);if(format==null||format.Value<1||format.Value>3)Fail("validation");string link=Text(fields,"meetingLink",2000,format.Value==1);
    if(format.Value==1){Uri uri;if(!Uri.TryCreate(link,UriKind.Absolute,out uri)||uri.Scheme!=Uri.UriSchemeHttps||string.IsNullOrEmpty(uri.Host)||!string.IsNullOrEmpty(uri.UserInfo)||link.Any(char.IsWhiteSpace)||link.IndexOfAny(new[]{'\\','<','>'})>=0)Fail("validation");}else if(link.Length>0)Fail("validation");
    update["mss_meetinglink"]=link.Length==0?null:link;update[Status]=new OptionSetValue(Accepted);
   }else{update["mss_reschedulingreason"]=Text(fields,"reason",100,true);update["mss_suggesteddate"]=Local(fields,"suggestedDate","suggestedTime","suggestedOffsetMinutes");update[Status]=new OptionSetValue(Rescheduled);}
   // This conditional SDK update, not the prior version read, closes the race.
   service.Execute(new UpdateRequest{Target=update,ConcurrencyBehavior=ConcurrencyBehavior.IfRowVersionMatches});return D("ok",true,"id",id.ToString());
  }
  static bool Administrator(IOrganizationService service,Guid actor){
   var q=new QueryExpression("contact"){ColumnSet=new ColumnSet(false),TopCount=1};q.Criteria.AddCondition("contactid",ConditionOperator.Equal,actor);var intersect=q.AddLink("powerpagecomponent_mspp_webrole_contact","contactid","contactid");var role=intersect.AddLink("powerpagecomponent","powerpagecomponentid","powerpagecomponentid");role.LinkCriteria.AddCondition("powerpagecomponentid",ConditionOperator.Equal,AdminRole);role.LinkCriteria.AddCondition("powerpagesiteid",ConditionOperator.Equal,Site);return service.RetrieveMultiple(q).Entities.Count>0;
  }
  static bool FunctionalRole(IOrganizationService service,Guid actor){
   var q=new QueryExpression("contact"){ColumnSet=new ColumnSet(false),TopCount=1};q.Criteria.AddCondition("contactid",ConditionOperator.Equal,actor);
   var intersect=q.AddLink("powerpagecomponent_mspp_webrole_contact","contactid","contactid");
   var role=intersect.AddLink("powerpagecomponent","powerpagecomponentid","powerpagecomponentid");
   role.LinkCriteria.AddCondition("powerpagesiteid",ConditionOperator.Equal,Site);
   role.LinkCriteria.AddCondition("powerpagecomponentid",ConditionOperator.In,AdminRole,new Guid("89a4fe62-4c85-48cb-b848-7603374faca2"),new Guid("b743c85b-4db3-484a-bd49-ff5ff975ec2b"),new Guid("c0ff381c-44a5-497b-b738-a442d62b07c1"));
   return service.RetrieveMultiple(q).Entities.Count>0;
  }
  static readonly string[] UnusableContactNames={"unknown","unknown contact","undefined","null"};
  static string NormalizeContactName(string value){return Regex.Replace(value??"",@"\s+"," ").Trim();}
  static bool UsableContactName(string value){return value.Length>0&&!value.Any(char.IsControl)&&value.Any(char.IsLetterOrDigit)&&!UnusableContactNames.Contains(value,StringComparer.OrdinalIgnoreCase);}
  static string ContactDisplayName(Entity contact){
   string full=NormalizeContactName(contact.GetAttributeValue<string>("fullname"));
   if(UsableContactName(full))return full;
   string combined=NormalizeContactName(contact.GetAttributeValue<string>("firstname")+" "+contact.GetAttributeValue<string>("lastname"));
   return UsableContactName(combined)?combined:null;
  }
  static Dictionary<string,object> Contacts(IOrganizationService service,Guid actor,Dictionary<string,object> p){
   if(!FunctionalRole(service,actor))Fail("forbidden");
   Keys(p,"q");string term=NormalizeContactName(Text(p,"q",100,false));
   var q=new QueryExpression("contact"){ColumnSet=new ColumnSet("contactid","firstname","lastname","fullname"),Distinct=true,PageInfo=new PagingInfo{Count=15,PageNumber=1}};
   // Preserve the existing active, signed-in-recipient and self-exclusion rules.
   q.Criteria.AddCondition("statecode",ConditionOperator.Equal,0);q.Criteria.AddCondition("adx_identity_logonenabled",ConditionOperator.Equal,true);q.Criteria.AddCondition("contactid",ConditionOperator.NotEqual,actor);
   var named=new FilterExpression(LogicalOperator.Or);
   foreach(string field in new[]{"firstname","lastname","fullname"}){var usable=new FilterExpression();usable.AddCondition(field,ConditionOperator.NotNull);usable.AddCondition(field,ConditionOperator.NotEqual,"");usable.AddCondition(field,ConditionOperator.NotIn,UnusableContactNames.Cast<object>().ToArray());named.AddFilter(usable);}
   q.Criteria.AddFilter(named);
   // AND the name tokens, OR the three fields within each token. Dataverse string
   // comparisons are case-insensitive; literal wildcard characters stay literal.
   foreach(string token in term.Split(new[]{' '},StringSplitOptions.RemoveEmptyEntries)){
    string pattern="%"+token.Replace("[","[[]").Replace("%","[%]").Replace("_","[_]")+"%";
    var match=new FilterExpression(LogicalOperator.Or);foreach(string field in new[]{"firstname","lastname","fullname"})match.AddCondition(field,ConditionOperator.Like,pattern);q.Criteria.AddFilter(match);
   }
   var external=q.AddLink("adx_externalidentity","contactid","adx_contactid",JoinOperator.LeftOuter);external.EntityAlias="identity";external.Columns=new ColumnSet(false);var identities=new FilterExpression(LogicalOperator.Or);var local=new FilterExpression();local.AddCondition("adx_identity_username",ConditionOperator.NotNull);local.AddCondition("adx_identity_username",ConditionOperator.NotEqual,"");identities.AddFilter(local);identities.AddCondition("identity","adx_externalidentityid",ConditionOperator.NotNull);q.Criteria.AddFilter(identities);q.AddOrder("fullname",OrderType.Ascending);q.AddOrder("contactid",OrderType.Ascending);
   var result=new List<object>();var seen=new HashSet<Guid>();
   while(true){
    var batch=service.RetrieveMultiple(q);
    foreach(var contact in batch.Entities){string name=ContactDisplayName(contact);if(contact.Id==Guid.Empty||contact.Id==actor||name==null||!seen.Add(contact.Id))continue;result.Add(D("id",contact.Id.ToString(),"name",name));if(result.Count==15)break;}
    if(result.Count==15||!batch.MoreRecords)break;
    if(q.PageInfo.PageNumber>=3333)Fail("unavailable");
    q.PageInfo.PageNumber++;q.PageInfo.PagingCookie=batch.PagingCookie;
   }
   return D("ok",true,"contacts",result.ToArray());
  }
  static Dictionary<string,object> List(IOrganizationService service,Guid actor,string command,Dictionary<string,object> p){
   Keys(p,command=="calendar"?new[]{"page","month"}:new[]{"page"});int page=Value(p,"page")==null?1:Number(p,"page",1,3333);if(command=="all"&&!Administrator(service,actor))Fail("forbidden");var q=new QueryExpression(Table){ColumnSet=new ColumnSet(Fields),PageInfo=new PagingInfo{Count=15,PageNumber=page}};
   if(command!="all"){if(command=="incoming")q.Criteria.AddCondition(Recipient,ConditionOperator.Equal,actor);else if(command=="outgoing")q.Criteria.AddCondition(Requester,ConditionOperator.Equal,actor);else{var either=new FilterExpression(LogicalOperator.Or);either.AddCondition(Requester,ConditionOperator.Equal,actor);either.AddCondition(Recipient,ConditionOperator.Equal,actor);q.Criteria.AddFilter(either);}}
   string month=null;if(command=="calendar"){month=Text(p,"month",7,true);DateTime first;if(!DateTime.TryParseExact(month+"-01","yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out first)||first.Year<1753||first.Year==9999&&first.Month==12)Fail("validation");q.Criteria.AddCondition(Status,ConditionOperator.Equal,Accepted);q.Criteria.AddCondition(Preferred,ConditionOperator.GreaterEqual,TimeZoneInfo.ConvertTimeToUtc(first,Eastern));q.Criteria.AddCondition(Preferred,ConditionOperator.LessThan,TimeZoneInfo.ConvertTimeToUtc(first.AddMonths(1),Eastern));}
   q.AddOrder(Preferred,OrderType.Ascending);q.AddOrder("mss_appointmentid",OrderType.Ascending);var rows=service.RetrieveMultiple(q);int count=0;var countQuery=new QueryExpression(Table){ColumnSet=new ColumnSet(false),PageInfo=new PagingInfo{Count=5000,PageNumber=1}};countQuery.Criteria.AddCondition(Recipient,ConditionOperator.Equal,actor);countQuery.Criteria.AddCondition(Status,ConditionOperator.Equal,Pending);countQuery.AddOrder("mss_appointmentid",OrderType.Ascending);
   // TotalRecordCount caps at 5,000; consume scoped ID pages for an exact count.
   while(true){var batch=service.RetrieveMultiple(countQuery);count=checked(count+batch.Entities.Count);if(!batch.MoreRecords)break;if(countQuery.PageInfo.PageNumber>=1000)Fail("unavailable");countQuery.PageInfo.PageNumber++;countQuery.PageInfo.PagingCookie=batch.PagingCookie;}
   string next=rows.MoreRecords&&page<3333?"/_api/serverlogics/appointments?view="+command+"&page="+(page+1)+(month==null?"":"&month="+month):null;return D("ok",true,"appointments",rows.Entities.Select(r=>(object)Record(r)).ToArray(),"nextLink",next,"awaitingCount",count);
  }
  static object Person(Entity row,string field){var person=row.GetAttributeValue<EntityReference>(field);return person==null?null:D("id",person.Id.ToString(),"name",string.IsNullOrWhiteSpace(person.Name)?"Unknown contact":person.Name);}
  static string Instant(Entity row,string field){if(!row.Contains(field))return null;return DateTime.SpecifyKind(row.GetAttributeValue<DateTime>(field),DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture);}
  static Dictionary<string,object> Record(Entity row){int status=row.GetAttributeValue<OptionSetValue>(Status)==null?0:row.GetAttributeValue<OptionSetValue>(Status).Value,format=row.GetAttributeValue<OptionSetValue>(Format)==null?0:row.GetAttributeValue<OptionSetValue>(Format).Value;var statuses=new[]{"Pending","Accepted","Rejected","Rescheduled","Cancelled"};var formats=new[]{"Microsoft Teams","Phone Call","In Person"};string statusLabel=row.FormattedValues.Contains(Status)?row.FormattedValues[Status]:status>=Pending&&status<=Pending+4?statuses[status-Pending]:"Unknown",formatLabel=row.FormattedValues.Contains(Format)?row.FormattedValues[Format]:format>=1&&format<=3?formats[format-1]:"Unknown";
   return D("id",row.Id.ToString(),"title",row.GetAttributeValue<string>("mss_appointmenttitle")??"","status",status,"statusLabel",statusLabel,"meetingFormat",format,"meetingFormatLabel",formatLabel,"preferredDateTime",Instant(row,Preferred),"suggestedDateTime",Instant(row,"mss_suggesteddate"),"agenda",row.GetAttributeValue<string>("mss_purposeagenda")??"","meetingLink",row.GetAttributeValue<string>("mss_meetinglink"),"reschedulingReason",row.GetAttributeValue<string>("mss_reschedulingreason")??"","requester",Person(row,Requester),"recipient",Person(row,Recipient),"rowVersion",row.RowVersion??(row.Contains("versionnumber")?Convert.ToString(row["versionnumber"],CultureInfo.InvariantCulture):""));
  }
 }
}
